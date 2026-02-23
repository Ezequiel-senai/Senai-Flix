/**
 * SISTEMA DE VÍDEO INTERATIVO UNIVERSAL
 * Suporta: YouTube, Relink, Videolib (HLS)
 * Compatível com aula2.html e aula3.html
 */

class VideoInterativoUniversal {
    constructor(config = {}) {
        this.config = {
            containerId: config.containerId || 'video-container',
            videoUrl: config.videoUrl || '',
            videoId: config.videoId || null, // ID único do vídeo
            interacoes: config.interacoes || [],
            autoplay: config.autoplay || false,
            ...config
        };
        
        this.video = null;
        this.wrapper = null;
        this.hls = null;
        this.respondidas = new Set();
        
        this.isDestroyed = false;
        this.isLocked = false;
        this.isIframeMode = false;
        this.manualDuration = 0;
        
        // Define chave única para persistência (SCORM/Local)
        // Prioriza videoId, depois containerId (fallback)
        const vidId = this.config.videoId || this.config.containerId;
        this.progressKey = `video_progress_${vidId}`;
        
        this.initialize();
    }

    initialize() {
        this.createPlayerStructure();
        this.setupVideo();
        this.setupControls();
        this.setupEvents();
    }

    createPlayerStructure() {
        const container = document.getElementById(this.config.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="video-wrapper" id="videoWrapper">
                <video id="videoPlayer" playsinline></video>
                <div class="material-icons big-play-icon " id="bigPlayIcon">play_circle_filled</div>

                <div class="custom-controls" id="controlsBar">
                    <div class="progress-track" id="progressTrack">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>

                    <div class="controls-row">
                        <button class="icon-btn" id="btnPlayPause">
                            <span class="material-icons text-white">play_arrow</span>
                        </button>
                        
                        <div class="volume-container">
                            <button class="icon-btn" id="btnMute">
                                <span class="material-icons text-white">volume_up</span>
                            </button>
                            <input type="range" min="0" max="1" step="0.05" value="1" 
                                   class="volume-slider" id="volumeSlider">
                        </div>

                        <span class="time-text" id="timeDisplay">00:00 / 00:00</span>
                        <button class="icon-btn" id="btnFullscreen">
                            <span class="material-icons text-white">fullscreen</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

            <div class="chapter-nav" id="chapterNav"></div>
        `;

        this.wrapper = document.getElementById('videoWrapper');
        this.video = document.getElementById('videoPlayer');
        this.progressFill = document.getElementById('progressFill');
        this.timeDisplay = document.getElementById('timeDisplay');
    }

    setupVideo() {
        const url = this.config.videoUrl;
        
        if (!url) {
            console.error('VideoInterativoUniversal: URL do vídeo não fornecida');
            return;
        }

        // Detectar tipo de URL
        if (this.isYouTubeUrl(url)) {
            this.loadYouTube(url);
        } else if (this.isVideolibPlayer(url) || this.isSenaiRedirect(url)) {
            this.loadIframe(url);
        } else if (this.isHlsUrl(url)) {
            this.loadHLS(url);
        } else {
            this.loadDirect(url);
        }
    }

    isYouTubeUrl(url) {
        return /youtube\.com|youtu\.be|youtube-nocookie\.com/.test(url);
    }

    isHlsUrl(url) {
        // Se contém index.html e videolib, é link do player, não do manifesto
        if (url.includes('videolib') && url.includes('index.html')) return false;
        return /\.m3u8|videolib|cdn.*hls/.test(url);
    }

    isVideolibPlayer(url) {
        return /videolib.*index\.html/.test(url);
    }

    isSenaiRedirect(url) {
        return /redirect\.sp\.senai\.br/.test(url);
    }

    loadIframe(url) {
        console.log('Carregando via iframe (fallback):', url);
        this.isIframeMode = true;
        this.video.style.display = 'none';
        
        let finalUrl = url;
        if (this.config.autoplay) {
            const separator = finalUrl.includes('?') ? '&' : '?';
            if (this.isSenaiRedirect(finalUrl)) {
                finalUrl += `${separator}autoplay=1&autoplay=true`;
            } else if (this.isVideolibPlayer(finalUrl)) {
                finalUrl += `${separator}autoplay=true`;
            }
        }

        const iframe = document.createElement('iframe');
        iframe.src = finalUrl;
        iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;';
        iframe.allowFullscreen = true;
        // Atributo essencial para permitir autoplay em iframes
        iframe.allow = "autoplay; fullscreen";
        
        this.wrapper.insertBefore(iframe, this.wrapper.firstChild);
        
        // REMOVIDO: Não esconder controles mais, mesmo em iframe genérico
        // (Tentaremos estimar progresso ou pelo menos mostrar os marcadores)
        const controls = document.getElementById('controlsBar');
        if (controls) {
            controls.style.display = 'flex';
            controls.style.opacity = '1';
        }
        
        const bigPlay = document.getElementById('bigPlayIcon');
        if (bigPlay) bigPlay.style.display = 'block';

        // DISPARAR SETUP DA TIMELINE (Duração será buscada via Fallback no HTML)
        setTimeout(() => this.setupTimeline(), 1000);
    }

    extractYouTubeId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube-nocookie\.com\/embed\/)([^&\n?#]+)/,
            /(?:youtube\.com\/embed\/)([^&\n?#]+)/
        ];
        
        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    loadYouTube(url) {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            this.loadIframe(url);
            return;
        }

        if (this.isDestroyed) return;

        // Garantir que o modo iframe não esteja ativo para vídeos YouTube
        this.isIframeMode = false;

        // Carregar YouTube IFrame API
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            const oldOnReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof oldOnReady === 'function') oldOnReady();
                if (!this.isDestroyed) this.initYouTubePlayer(videoId);
            };
        } else if (window.YT.Player) {
            this.initYouTubePlayer(videoId);
        } else {
            // Caso YT exista mas Player não (carregando)
            setTimeout(() => this.loadYouTube(url), 100);
        }
    }

    initYouTubePlayer(videoId) {
        if (this.isDestroyed) return;
        console.log('Inicializando YouTube Player para:', videoId);
        // Limpar apenas o vídeo mantendo os overlays e controles
        const videoEl = document.getElementById('videoPlayer');
        if (videoEl) videoEl.style.display = 'none';

        const youtubeDiv = document.createElement('div');
        youtubeDiv.id = 'youtubeContainer';
        // z-index 1 coloca o youtube atrás de tudo no wrapper (que tem botões em z-index 10)
        // pointer-events: none delega o clique para o VideoWrapper
        youtubeDiv.style.cssText = 'width: 100%; height: 100%; position: absolute; top:0; left:0; z-index: 1; pointer-events: none;';
        this.wrapper.insertBefore(youtubeDiv, this.wrapper.firstChild);

        this.youtubePlayer = new window.YT.Player('youtubeContainer', {
            videoId: videoId,
            width: '100%',
            height: '100%',
            playerVars: {
                controls: 0,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
                showinfo: 0,
                ecver: 2,
                disablekb: 1,
                iv_load_policy: 3
            },
            events: {
                'onReady': () => {
                    this.onYouTubeReady();
                },
                'onStateChange': (event) => this.onYouTubeStateChange(event)
            }
        });

        // setupEvents será chamado pelo initialize e cuidará da sincronização
    }

    onYouTubeReady() {
        console.log('YouTube player pronto');
        this.setupTimeline();
        
        // Tentativa de restaurar progresso assim que o player estiver pronto
        this.restoreProgress();

        // Iniciar intervalo de atualização apenas quando pronto
        if (this.youtubeUpdateInterval) clearInterval(this.youtubeUpdateInterval);
        this.youtubeUpdateInterval = setInterval(() => this.updateTime(), 100);

        if (this.config.autoplay) {
            this.youtubePlayer.playVideo();
        }
    }

    onYouTubeStateChange(event) {
        if (event.data === window.YT.PlayerState.PLAYING) {
            this.wrapper.classList.remove('paused');
        } else if (event.data === window.YT.PlayerState.PAUSED) {
            this.wrapper.classList.add('paused');
            // Força salvar progresso ao pausar
            if (this.youtubePlayer && typeof this.youtubePlayer.getCurrentTime === 'function') {
                 this.saveProgress(this.youtubePlayer.getCurrentTime());
            }
        }
        this.updateTime();
    }

    loadHLS(url) {
        if (window.Hls && window.Hls.isSupported()) {
            if (this.hls) this.hls.destroy();
            
            this.hls = new window.Hls();
            this.hls.loadSource(url);
            this.hls.attachMedia(this.video);
            this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                this.onHLSReady();
            });
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = url;
            this.video.onloadedmetadata = () => this.onHLSReady();
        }
    }

    onHLSReady() {
        console.log('HLS/Videolib carregado');
        this.setupTimeline();
        this.restoreProgress(); // Adicionado para persistência
        this.updateTime();
    }

    loadDirect(url) {
        this.video.src = url;
        this.video.onloadedmetadata = () => {
            this.setupTimeline();
            this.restoreProgress(); // Adicionado para persistência
            this.updateTime();
        };
    }

    setupControls() {
        const btnPlay = document.getElementById('btnPlayPause');
        const btnMute = document.getElementById('btnMute');
        const volumeSlider = document.getElementById('volumeSlider');
        const bigIcon = document.getElementById('bigPlayIcon');
        const btnFullscreen = document.getElementById('btnFullscreen');
        const btnContinuar = document.getElementById('btnContinuar');

        let lastVolume = 1;

        // Play/Pause
        const togglePlay = () => {
            if (this.isLocked) return;

            if (this.youtubePlayer) {
                const state = this.youtubePlayer.getPlayerState();
                if (state === window.YT.PlayerState.PLAYING) {
                    this.youtubePlayer.pauseVideo();
                } else {
                    this.youtubePlayer.playVideo();
                }
            } else {
                if (this.video.paused || this.video.ended) {
                    this.video.play();
                } else {
                    this.video.pause();
                }
            }
        };

        if (!this.youtubePlayer) {
            this.video.addEventListener('play', () => {
                this.wrapper.classList.remove('paused');
                btnPlay.innerHTML = '<span class="material-icons">pause</span>';
                bigIcon.innerText = 'pause_circle_filled';
            });

            this.video.addEventListener('pause', () => {
                this.wrapper.classList.add('paused');
                btnPlay.innerHTML = '<span class="material-icons">play_arrow</span>';
                bigIcon.innerText = 'play_circle_filled';
            });

            this.video.addEventListener('click', (e) => {
                if (!document.getElementById('controlsBar').contains(e.target)) {
                    togglePlay();
                }
            });

            bigIcon.addEventListener('click', togglePlay);
        }

        btnPlay.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlay();
        });

        // Volume
        volumeSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            if (!this.youtubePlayer) {
                this.video.volume = vol;
                this.video.muted = (vol === 0);
            } else {
                this.youtubePlayer.setVolume(vol * 100);
            }
            this.updateVolumeIcon(vol);
            this.updateSliderFill(vol);
        });

        btnMute.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentVol = this.youtubePlayer ? 
                this.youtubePlayer.getVolume() / 100 : 
                this.video.volume;

            if (currentVol === 0 || (this.video && this.video.muted)) {
                if (this.youtubePlayer) {
                    this.youtubePlayer.setVolume(lastVolume * 100);
                } else {
                    this.video.muted = false;
                    this.video.volume = lastVolume || 1;
                }
            } else {
                lastVolume = currentVol;
                if (this.youtubePlayer) {
                    this.youtubePlayer.setVolume(0);
                } else {
                    this.video.muted = true;
                    this.video.volume = 0;
                }
            }

            volumeSlider.value = this.youtubePlayer ? 
                this.youtubePlayer.getVolume() / 100 : 
                this.video.volume;
            this.updateVolumeIcon(volumeSlider.value);
            this.updateSliderFill(volumeSlider.value);
        });

        // Fullscreen
        btnFullscreen.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                this.wrapper.requestFullscreen().catch(err => {
                    console.error(`Erro ao entrar fullscreen: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });


        // Keyboard Controls
        this.setupKeyboardControls(togglePlay);
    }

    setupKeyboardControls(togglePlay) {
        this._keyHandler = (e) => {
            if (this.isDestroyed) return;

            // Ignorar se estiver em um input ou textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.seekRelative(-10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.seekRelative(10);
                    break;
                case 'Escape':
                    e.preventDefault();
                    if (typeof window.closeVideoPlayer === 'function') {
                        window.closeVideoPlayer();
                    }
                    break;
            }
        };
        window.addEventListener('keydown', this._keyHandler);
    }

    seekRelative(seconds) {
        if (this.isLocked) return;

        const currentTime = this.youtubePlayer ? this.youtubePlayer.getCurrentTime() : (this.video ? this.video.currentTime : 0);
        const targetTime = currentTime + seconds;

        // Se estiver tentando avançar, conferir se há perguntas pendentes no caminho
        if (seconds > 0) {
            const block = this.findUnansweredInteraction(currentTime, targetTime);
            if (block) {
                this.jumpTo(block.tempo);
                return;
            }
        }

        if (this.youtubePlayer) {
            this.youtubePlayer.seekTo(targetTime, true);
        } else if (this.video) {
            this.video.currentTime = targetTime;
        }
    }


    setupTimeline() {
        const progressTrack = document.getElementById('progressTrack');
        const navDiv = document.getElementById('chapterNav');

        if (!progressTrack || this.config.interacoes.length === 0) {
            console.warn(`setupTimeline: abortando. progressTrack=${!!progressTrack}, interacoes=${this.config.interacoes.length}`);
            return;
        }

        const duration = this.youtubePlayer ? 
            this.youtubePlayer.getDuration() : 
            (this.video ? this.video.duration : 0);

        if (!duration || duration === 0) {
            // TENTA BUSCAR DURAÇÃO DO HTML SE DISPONÍVEL (FALLBACK PARA IFRAMES/ESTADOS INICIAIS)
            // Tenta por: id do episódio, data-ytid do episódio
            const videoId = this.config.videoId;
            const epEl = document.getElementById(videoId) ||
                document.querySelector(`[data-ytid="${videoId}"]`);

            if (epEl) {
                const durStr = epEl.querySelector('.duration')?.innerText;
                if (durStr && durStr.includes('min')) {
                    this.manualDuration = parseInt(durStr) * 60;
                    console.log(`Usando duração manual do HTML: ${this.manualDuration}s`);
                    this.renderMarkers(this.manualDuration);
                    return;
                }
            }

            // Se a duração ainda não estiver disponível, tentar novamente em breve
            console.log('setupTimeline: duração ainda não disponível, tentando em 1s...');
            setTimeout(() => this.setupTimeline(), 1000);
            return;
        }

        this.renderMarkers(duration);
    }

    renderMarkers(duration) {
        const progressTrack = document.getElementById('progressTrack');
        const navDiv = document.getElementById('chapterNav');

        if (!progressTrack) return;

        // Limpar marcadores anteriores para evitar duplicatas em retentativas
        const existingMarkers = progressTrack.querySelectorAll('.timeline-marker');
        existingMarkers.forEach(m => m.remove());
        if (navDiv) navDiv.innerHTML = '';

        this.config.interacoes.forEach(interacao => {
            const pct = (interacao.tempo / duration) * 100;
            
            // Marker na timeline
            const dot = document.createElement('div');
            dot.className = 'timeline-marker';
            dot.id = `marker-${interacao.tempo}`;
            dot.style.left = pct + '%';
            
            const tip = document.createElement('div');
            tip.className = 'marker-tooltip';
            tip.innerText = interacao.titulo || `Marcador ${interacao.tempo}s`;
            
            dot.appendChild(tip);
            dot.onclick = (e) => {
                e.stopPropagation();
                this.jumpTo(interacao.tempo);
            };
            
            progressTrack.appendChild(dot);
            interacao.markerElement = dot;

            // Botão de capítulo
            const btn = document.createElement('button');
            btn.className = 'chapter-pill';
            // UPDATE: Adicionado style color: var(--color1) no ícone
            btn.innerHTML = `<span class="material-icons" style="font-size:14px; color: var(--color1)">bookmark</span> ${interacao.titulo || 'Capítulo'}`;
            btn.onclick = () => this.jumpTo(interacao.tempo);
            navDiv.appendChild(btn);
        });
    }


    setupEvents() {
        const progressTrack = document.getElementById('progressTrack');

        // Evento de clique no wrapper para Play/Pause (estilo Netflix/YouTube)
        this.wrapper.addEventListener('click', (e) => {
            // Não disparar se clicou nos controles ou modais
            if (e.target.closest('.custom-controls') || e.target.closest('.overlay-layer') || e.target.closest('.icon-btn')) return;
            
            // SE ESTIVER TRAVADO POR PERGUNTA, NÃO FAZ NADA
            if (this.isLocked) {
                console.warn('Vídeo travado: responda a pergunta para continuar.');
                return;
            }

            if (this.youtubePlayer) {
                const state = this.youtubePlayer.getPlayerState();
                if (state === window.YT.PlayerState.PLAYING) this.youtubePlayer.pauseVideo();
                else this.youtubePlayer.playVideo();
            } else {
                if (this.video.paused) this.video.play();
                else this.video.pause();
            }
        });

        if (this.video) {
            this.video.addEventListener('timeupdate', () => this.updateTime());
            this.video.addEventListener('loadedmetadata', () => this.restoreProgress()); // Restaurar progresso HTML5
        }

        if (progressTrack) {
            progressTrack.addEventListener('click', (e) => {
                if (this.isLocked) return;

                const rect = progressTrack.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                
                const duration = this.youtubePlayer ? this.youtubePlayer.getDuration() : (this.video ? this.video.duration : 0);

                // Fallback para duração em Iframe
                const finalDuration = duration || this.manualDuration || 0;
                const currentTime = this.youtubePlayer ? this.youtubePlayer.getCurrentTime() : (this.video ? this.video.currentTime : 0);

                if (this.isIframeMode && finalDuration > 0) {
                    const progressFill = document.getElementById('progressFill');
                    if (progressFill) progressFill.style.width = (pos * 100) + '%';
                }

                if (!finalDuration) return;
                const targetTime = pos * finalDuration;

                // Verificar se há perguntas não respondidas no caminho do salto para frente
                if (targetTime > currentTime) {
                    const block = this.findUnansweredInteraction(currentTime, targetTime);
                    if (block) {
                        this.jumpTo(block.tempo);
                        return;
                    }
                }

                if (this.youtubePlayer) {
                    this.youtubePlayer.seekTo(targetTime);
                } else if (this.video) {
                    this.video.currentTime = targetTime;
                }
            });
        }
    }

    updateTime() {
        const currentTime = this.youtubePlayer ? 
            this.youtubePlayer.getCurrentTime() : 
            (this.video ? this.video.currentTime : 0);
        const duration = this.youtubePlayer ? 
            this.youtubePlayer.getDuration() : 
            (this.video ? this.video.duration : 0);

        if (!duration || duration === 0) return;

        const pct = (currentTime / duration) * 100;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = pct + '%';
        }

        const timeDisplay = document.getElementById('timeDisplay');
        if (timeDisplay) {
            timeDisplay.innerText = this.formatTime(currentTime) + " / " + this.formatTime(duration);
        }

        this.checkInteractions();
        this.saveProgress(currentTime);
    }

    updateVolumeIcon(vol) {
        let icon = 'volume_up';
        if (vol === 0) icon = 'volume_off';
        else if (vol < 0.5) icon = 'volume_down';
        
        const btnMute = document.getElementById('btnMute');
        if (btnMute) {
            btnMute.innerHTML = `<span class="material-icons">${icon}</span>`;
        }
    }

    updateSliderFill(vol) {
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            const percentage = vol * 100;
            volumeSlider.style.backgroundSize = `${percentage}% 100%`;
        }
    }

    checkInteractions() {
        const interactiveOverlay = document.getElementById('interactiveOverlay');
        if (interactiveOverlay && interactiveOverlay.style.display === 'flex') return;

        const currentTime = this.youtubePlayer ? 
            this.youtubePlayer.getCurrentTime() : 
            (this.video ? this.video.currentTime : 0);

        const now = Math.floor(currentTime);
        // Exibe ao passar pelo tempo normalmente na reprodução contínua (se não finalizada). 
        // Interações já finalizadas aparecem quando requisitadas via clique (jumpTo).
        const index = this.config.interacoes.findIndex(i => i.tempo === now && !i.respondida);
        
        if (index !== -1) {
            const acao = this.config.interacoes[index];
            if (this.youtubePlayer) {
                this.youtubePlayer.pauseVideo();
            } else if (this.video) {
                this.video.pause();
            }
            this.openQuestion(acao, index);
        }
    }

    openQuestion(dados, index) {
        // Pausar o vídeo garante que não avance
        if (this.youtubePlayer) this.youtubePlayer.pauseVideo();
        else if (this.video) this.video.pause();

        this.isLocked = true;
        const interaction = this.config.interacoes[index];
        const jaRespondida = interaction.respondida === true;

        // Criar o container do modal fullscreen interativo se não existir
        let interactiveOverlay = document.getElementById('interactiveOverlay');
        if (!interactiveOverlay) {
            interactiveOverlay = document.createElement('div');
            interactiveOverlay.id = 'interactiveOverlay';
            interactiveOverlay.className = 'overlay-layer';
            // Injeta diretamente dentro do #videoModal para cobrir tudo
            const videoModalContent = document.querySelector('#videoModal .video-modal-content');
            if (videoModalContent) {
                videoModalContent.appendChild(interactiveOverlay);
            } else {
                document.body.appendChild(interactiveOverlay); // Fallback
            }
        }

        // Gerar o HTML das opções
        let optionsHtml = '';
        dados.opcoes.forEach((op, optIndex) => {
            const letter = String.fromCharCode(65 + optIndex); // A, B, C...

            let extraStyles = '';
            let isChecked = '';
            let isDisabled = jaRespondida ? 'disabled' : '';

            // Lógica visual se já foi respondida
            if (jaRespondida && interaction.respostaDada === op.texto) {
                isChecked = 'checked';
                interaction.feedbackDada = op.msg || interaction.feedbackDada;
                if (interaction.resultado === true) {
                    extraStyles = 'border: 2px solid #198754; background-color: #d1e7dd;';
                } else {
                    extraStyles = 'border: 2px solid #dc3545; background-color: #f8d7da;';
                }
            }

            optionsHtml += `
                <label class="list-group-item border rounded-3 py-3 d-flex gap-3 align-items-center mb-2 ${jaRespondida ? '' : 'cursor-pointer'}" style="background:#fff; color:#333; ${extraStyles}">
                    <input class="form-check-input flex-shrink-0 js-option" type="radio" name="q_${index}" value="${optIndex}" ${isChecked} ${isDisabled}>
                    <span class="opt-label fw-bold" style="font-size: 1.1rem;"><span class="text-primary me-2">${letter})</span>${op.texto}</span>
                </label>
            `;
        });

        // Feedback HTML inicial (escondido ou visível se já respondido)
        const feedbackDisplay = jaRespondida ? 'block' : 'none';
        const successDisplay = (jaRespondida && interaction.resultado) ? 'block' : 'none';
        const errorDisplay = (jaRespondida && !interaction.resultado) ? 'block' : 'none';
        const feedbackMsg = interaction.feedbackDada || '';

        // Injetar o HTML baseado no js-exercise
        interactiveOverlay.innerHTML = `
            <div class="row py-3 js-exercise w-100 h-100 d-flex align-items-center justify-content-center" data-type="single" style="margin: 0; padding: 20px;">
                <div class="col-lg-8 mx-auto py-5 border rounded" style="  background-color: var(--bg-primary); box-shadow: 0 10px 40px rgba(0,0,0,0.5); border-radius: 12px; margin-top: 5vh; max-height: 80vh; overflow-y: auto;">
                    <div class="m-3 text-center">
                        <h4 style="color:#222; font-weight:700; margin-bottom: 20px; font-size: 1.5rem;">${dados.pergunta}</h4>
                    </div>
                    <div class="list-group m-3 gap-2" id="qOptionsContainer">
                        ${optionsHtml}
                    </div>
                    <div class="feedback-container px-3 mt-4" id="qFeedbackContainer" style="display:${feedbackDisplay};">
                        <!-- Feedback Sucesso -->
                        <div class="feedback-correto" id="feedbackSuccess" style="display:${successDisplay};">
                            <div class="alert alert-success d-flex align-items-center p-3" style="font-size: 1.1rem;">
                                <i class="bx bxs-check-circle me-3 fs-3"></i>
                                <div class="msg-content fw-bold h5 mb-0" id="msgSuccessText">${interaction.resultado ? feedbackMsg : ''}</div>
                            </div>
                        </div>
                        <!-- Feedback Erro -->
                        <div class="feedback-erro" id="feedbackError" style="display:${errorDisplay};">
                            <div class="alert alert-danger d-flex align-items-center p-3" style="font-size: 1.1rem;">
                                <i class="bx bxs-x-circle me-3 fs-3"></i>
                                <div class="msg-texto fw-bold h5 mb-0" id="msgErrorText">${!interaction.resultado ? feedbackMsg : ''}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-4 d-flex flex-column flex-sm-row justify-content-center gap-3 px-3">
                        ${!jaRespondida ? `<button id="btnConfirmQuestion" class="btn btn-primary btn-lg px-5 py-2 fw-bold w-100" style="font-size: 1.2rem; display:none; max-width: 300px; margin: 0 auto;">Confirmar</button>` : ''}
                        <button id="btnContinueVideo" class="btn ${jaRespondida ? 'btn-success' : 'btn-primary'} btn-lg px-5 py-2 fw-bold w-100" style="font-size: 1.2rem; display:${jaRespondida ? 'inline-block' : 'none'}; max-width: 300px; margin: 0 auto;">Continuar Vídeo <i class="bx bx-play-circle ms-2"></i></button>
                    </div>
                </div>
            </div>
        `;

        interactiveOverlay.style.display = 'flex';

        // Elementos interativos
        const btnContinue = interactiveOverlay.querySelector('#btnContinueVideo');

        // Lógica de Continuar (sempre disponível)
        if (btnContinue) {
            btnContinue.addEventListener('click', () => {
                interactiveOverlay.style.display = 'none';
                this.isLocked = false;

                // Retomar o vídeo
                if (this.youtubePlayer) {
                    this.youtubePlayer.playVideo();
                } else if (this.video) {
                    this.video.play();
                }
            });
        }

        // Se já respondida, encerra a configuração de eventos de seleção aqui
        if (jaRespondida) return;

        // Lógica de Seleção
        const radios = interactiveOverlay.querySelectorAll('input[type="radio"]');
        const btnConfirm = interactiveOverlay.querySelector('#btnConfirmQuestion');

        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                // Remove destaque de todos
                interactiveOverlay.querySelectorAll('.list-group-item').forEach(el => {
                    el.style.border = '';
                    el.style.backgroundColor = '#fff';
                });
                // Adiciona destaque no selecionado
                const label = radio.closest('label');
                label.style.border = '2px solid #0d6efd';
                label.style.backgroundColor = '#f8f9fa';

                // Mostrar botão confirmar
                btnConfirm.style.display = 'inline-block';
            });
        });

        // Lógica de Confirmação (Verificação Interna)
        btnConfirm.addEventListener('click', () => {
            const selectedRadio = interactiveOverlay.querySelector('input[type="radio"]:checked');
            if (selectedRadio) {
                const optIndex = parseInt(selectedRadio.value);
                const objOpcao = dados.opcoes[optIndex];
                this.showFeedback(objOpcao, index, interactiveOverlay);

                // Esconder botão confirmar, mostrar botão continuar
                btnConfirm.style.display = 'none';

                // Travar opções
                radios.forEach(r => r.disabled = true);
                interactiveOverlay.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('cursor-pointer'));
            }
        });
    }

    showFeedback(op, index, overlayEl) {
        const interaction = this.config.interacoes[index];
        interaction.respondida = true;
        interaction.resultado = op.correta;
        interaction.respostaDada = op.texto;
        interaction.feedbackDada = op.msg;

        // Atualiza UI da Timeline
        if (interaction.markerElement) {
            interaction.markerElement.classList.add(op.correta ? 'correct' : 'incorrect');
        }

        const feedbackContainer = overlayEl.querySelector('#qFeedbackContainer');
        const fSuccess = overlayEl.querySelector('#feedbackSuccess');
        const fError = overlayEl.querySelector('#feedbackError');
        const msgSuccess = overlayEl.querySelector('#msgSuccessText');
        const msgError = overlayEl.querySelector('#msgErrorText');
        const btnContinue = overlayEl.querySelector('#btnContinueVideo');

        feedbackContainer.style.display = 'block';

        if (op.correta) {
            msgSuccess.innerHTML = op.msg || 'Resposta correta!';
            fSuccess.style.display = 'block';
            fError.style.display = 'none';
            // Estilizar opção selecionada como sucesso
            const selectedLabel = overlayEl.querySelector('input[type="radio"]:checked').closest('label');
            selectedLabel.style.border = '2px solid #198754';
            selectedLabel.style.backgroundColor = '#d1e7dd';
        } else {
            msgError.innerHTML = op.msg || 'Resposta incorreta.';
            fError.style.display = 'block';
            fSuccess.style.display = 'none';
            // Estilizar opção selecionada como erro
            const selectedLabel = overlayEl.querySelector('input[type="radio"]:checked').closest('label');
            selectedLabel.style.border = '2px solid #dc3545';
            selectedLabel.style.backgroundColor = '#f8d7da';
        }

        btnContinue.style.display = 'inline-block';

        btnContinue.addEventListener('click', () => {
            overlayEl.style.display = 'none';
            this.isLocked = false;

            // Retomar o vídeo
            if (this.youtubePlayer) {
                this.youtubePlayer.playVideo();
            } else if (this.video) {
                this.video.play();
            }
        });
    }


    jumpTo(sec) {
        if (this.isLocked) {
            console.warn('Salto bloqueado: responda a pergunta primeiro.');
            return;
        }

        const interactionIndex = this.config.interacoes.findIndex(i => i.tempo === sec);

        if (this.isIframeMode) {
            // Encontrar a interação associada a este tempo para abrir a pergunta
            if (interactionIndex !== -1) {
                this.openQuestion(this.config.interacoes[interactionIndex], interactionIndex);
            }

            // Atualizar barra de progresso visualmente
            const finalDuration = this.youtubePlayer ? this.youtubePlayer.getDuration() : (this.video ? this.video.duration : (this.manualDuration || 0));
            if (finalDuration > 0) {
                const progressFill = document.getElementById('progressFill');
                if (progressFill) progressFill.style.width = ((sec / finalDuration) * 100) + '%';
            }
            return;
        }

        const currentTime = this.youtubePlayer ? this.youtubePlayer.getCurrentTime() : (this.video ? this.video.currentTime : 0);

        // Se estiver tentando pular para frente, conferir se há perguntas pendentes
        if (sec > currentTime + 1) { // +1s de margem
            const block = this.findUnansweredInteraction(currentTime, sec);
            if (block) {
                console.warn('Você precisa responder a pergunta em', block.tempo, 's antes de avançar.');
                sec = block.tempo;
                const blockIndex = this.config.interacoes.findIndex(i => i.tempo === block.tempo);
                if (blockIndex !== -1) {
                    if (this.youtubePlayer) this.youtubePlayer.seekTo(sec);
                    else if (this.video) this.video.currentTime = sec;
                    this.openQuestion(this.config.interacoes[blockIndex], blockIndex);
                    return;
                }
            }
        }

        // Se o destino exato for o tempo de uma interação (via clique no capítulo/marcador), pausar e abri-la
        if (interactionIndex !== -1) {
            if (this.youtubePlayer) {
                this.youtubePlayer.seekTo(sec);
            } else if (this.video) {
                this.video.currentTime = sec;
            }
            this.openQuestion(this.config.interacoes[interactionIndex], interactionIndex);
            return;
        }

        // Comportamento padrão: pular e tocar
        if (this.youtubePlayer) {
            this.youtubePlayer.seekTo(sec);
            this.youtubePlayer.playVideo();
        } else if (this.video) {
            this.video.currentTime = sec;
            this.video.play();
        }
    }

    findUnansweredInteraction(from, to) {
        // Encontra a primeira interação não respondida no intervalo [from, to]
        return this.config.interacoes.find(i => i.tempo > from && i.tempo <= to && !i.respondida);
    }

    formatTime(s) {
        if (isNaN(s)) return '00:00';
        const m = Math.floor(s / 60);
        const seg = Math.floor(s % 60);
        return `${m}:${seg < 10 ? '0' + seg : seg}`;
    }

    saveProgress(time) {
        if (!time || time < 5) return;
        
        // Preparar dados do vídeo atual
        const interactionsState = this.config.interacoes.map(i => ({
            tempo: i.tempo,
            respondida: i.respondida,
            resultado: i.resultado,
            respostaDada: i.respostaDada
        }));

        const videoData = {
            time: Math.floor(time),
            interactions: interactionsState,
            updatedAt: new Date().getTime()
        };

        // 1. Salvar no LocalStorage (Backup/Dev)
        localStorage.setItem(this.progressKey, JSON.stringify(videoData));

        // 2. Salvar no SCORM suspend_data (LMS)
        // Estrutura: { scrollY: "...", lastSeason: "...", videos: { [videoId]: { ...Data... } } }
        if (typeof setSuspendDataValue === 'function') {
            try {
                // Recupera todos os vídeos já salvos para não perder
                const allVideos = getSuspendDataValue("videos") || {};
                const vidId = this.config.videoId || 'unknown';
                allVideos[vidId] = videoData;
                
                setSuspendDataValue("videos", allVideos);
            } catch (e) {
                console.warn('Erro ao salvar no SCORM:', e);
            }
        }
    }

    restoreProgress() {
        let data = null;
        const vidId = this.config.videoId || 'unknown';

        // 1. Tentar recuperar do SCORM
        if (typeof doLMSGetValue === 'function') {
            try {
                const raw = doLMSGetValue("cmi.suspend_data");
                if (raw && raw !== "" && raw !== "null") {
                    const suspendData = JSON.parse(raw);
                    if (suspendData.videos && suspendData.videos[vidId]) {
                        console.log('Restaurando via SCORM suspend_data');
                        data = suspendData.videos[vidId];
                    }
                }
            } catch (e) { console.warn('Erro ao ler SCORM para restore:', e); }
        }

        // 2. Fallback para LocalStorage se SCORM falhar ou não tiver dados
        if (!data) {
            const saved = localStorage.getItem(this.progressKey);
            if (saved) {
                try {
                    data = JSON.parse(saved);
                    console.log('Restaurando via LocalStorage');
                } catch(e) { console.warn('Erro parse LocalStorage', e); }
            }
        }

        // Aplicar dados restaurados
        if (data) {
            // Suporte legado
            if (typeof data === 'number') {
                if (data > 0) this.jumpTo(data);
                return;
            }

            // Restaurar tempo (Sem forçar play automático)
            if (data.time > 0) {
                if (this.youtubePlayer) {
                    this.youtubePlayer.seekTo(data.time);
                } else if (this.video) {
                    this.video.currentTime = data.time;
                }
            }

            // Restaurar interações
            if (data.interactions && Array.isArray(data.interactions)) {
                data.interactions.forEach(savedInter => {
                    const currentInter = this.config.interacoes.find(i => i.tempo === savedInter.tempo);
                    if (currentInter && savedInter.respondida) {
                        currentInter.respondida = true;
                        currentInter.resultado = savedInter.resultado;
                        currentInter.respostaDada = savedInter.respostaDada;
                    }
                });
                this.updateMarkersVisuals();
            }
        }
    }

    updateMarkersVisuals() {
        this.config.interacoes.forEach(interacao => {
            if (interacao.respondida && interacao.markerElement) {
                interacao.markerElement.classList.remove('correct', 'incorrect');
                interacao.markerElement.classList.add(interacao.resultado ? 'correct' : 'incorrect');
                
                // Feedback tooltip (opcional, já que o clique mostra o modal)
                const tooltip = interacao.markerElement.querySelector('.marker-tooltip');
            }
        });
    }

    destroy() {
        console.log('Destruindo player interativo...');
        this.isDestroyed = true;
        
        // Remover listener de teclado
        if (this._keyHandler) {
            window.removeEventListener('keydown', this._keyHandler);
        }

        // Parar intervalo do YouTube
        if (this.youtubeUpdateInterval) {
            clearInterval(this.youtubeUpdateInterval);
            this.youtubeUpdateInterval = null;
        }

        // Parar e destruir YouTube Player
        if (this.youtubePlayer && typeof this.youtubePlayer.destroy === 'function') {
            try {
                this.youtubePlayer.stopVideo();
                this.youtubePlayer.destroy();
            } catch (e) {
                console.warn('Erro ao destruir player do YouTube:', e);
            }
            this.youtubePlayer = null;
        }

        // Destruir HLS
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        // Parar vídeo HTML5 se existir
        if (this.video) {
            this.video.pause();
            this.video.src = "";
            this.video.load();
        }

        // Limpar o container HTML para garantir que tudo (iframes, etc) suma
        const container = document.getElementById(this.config.containerId);
        if (container) {
            container.innerHTML = '';
        }
    }
}

// Export para uso em navegadores
if (typeof window !== 'undefined') {
    window.VideoInterativoUniversal = VideoInterativoUniversal;
}