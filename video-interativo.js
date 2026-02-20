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
                <div class="material-icons big-play-icon" id="bigPlayIcon">play_circle_filled</div>

                <div class="custom-controls" id="controlsBar">
                    <div class="progress-track" id="progressTrack">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>

                    <div class="controls-row">
                        <button class="icon-btn" id="btnPlayPause">
                            <span class="material-icons">play_arrow</span>
                        </button>
                        
                        <div class="volume-container">
                            <button class="icon-btn" id="btnMute">
                                <span class="material-icons">volume_up</span>
                            </button>
                            <input type="range" min="0" max="1" step="0.05" value="1" 
                                   class="volume-slider" id="volumeSlider">
                        </div>

                        <span class="time-text" id="timeDisplay">00:00 / 00:00</span>
                        <button class="icon-btn" id="btnFullscreen">
                            <span class="material-icons">fullscreen</span>
                        </button>
                    </div>
                </div>

                <div class="overlay-layer" id="modalPergunta">
                    <div class="card-box">
                        <p id="qTitle" style="margin-top:0;">Pergunta</p>
                        <div id="qOptions"></div>
                    </div>
                </div>

                <div class="overlay-layer" id="modalFeedback">
                    <div class="card-box" id="feedbackCard">
                        <div id="feedbackIcon" class="material-icons" style="font-size: 50px; margin-bottom: 10px;">check_circle</div>
                        <h3 id="feedbackTitle">Correto!</h3>
                        <p id="feedbackText">Texto do feedback.</p>
                        <button id="btnContinuar" style="margin-top:15px; padding:10px 25px; background:#222; color:white; border:none; border-radius:5px; cursor:pointer;">Continuar</button>
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
        } else if (this.isHlsUrl(url)) {
            this.loadHLS(url);
        } else if (this.isSenaiRedirect(url)) {
            this.loadIframe(url);
        } else {
            this.loadDirect(url);
        }
    }

    isYouTubeUrl(url) {
        return /youtube\.com|youtu\.be|youtube-nocookie\.com/.test(url);
    }

    isHlsUrl(url) {
        return /\.m3u8|videolib|cdn.*hls/.test(url);
    }

    isSenaiRedirect(url) {
        return /redirect\.sp\.senai\.br/.test(url);
    }

    loadIframe(url) {
        console.log('Carregando via iframe (fallback):', url);
        this.video.style.display = 'none';
        
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;';
        iframe.allowFullscreen = true;
        
        this.wrapper.insertBefore(iframe, this.wrapper.firstChild);
        
        // Esconder controles customizados pois não funcionam com iframe genérico
        // (Sem acesso ao tempo do vídeo)
        const controls = document.getElementById('controlsBar');
        if (controls) controls.style.display = 'none';
        
        const bigPlay = document.getElementById('bigPlayIcon');
        if (bigPlay) bigPlay.style.display = 'none';
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

        // Continuar
        btnContinuar.addEventListener('click', () => {
            document.getElementById('modalFeedback').style.display = 'none';
            this.isLocked = false; // Destravar após feedback
            togglePlay();
        });
    }


    setupTimeline() {
        const progressTrack = document.getElementById('progressTrack');
        const navDiv = document.getElementById('chapterNav');

        if (!progressTrack || this.config.interacoes.length === 0) return;

        const duration = this.youtubePlayer ? 
            this.youtubePlayer.getDuration() : 
            (this.video ? this.video.duration : 0);

        if (!duration || duration === 0) {
            // Se a duração ainda não estiver disponível, tentar novamente em breve
            setTimeout(() => this.setupTimeline(), 500);
            return;
        }

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
                if (interacao.respondida) {
                    this.showPreviousAnswer(interacao);
                } else {
                    this.jumpTo(interacao.tempo);
                }
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

    showPreviousAnswer(interacao) {
        const modal = document.getElementById('modalFeedback');
        const card = document.getElementById('feedbackCard');
        const icon = document.getElementById('feedbackIcon');
        const title = document.getElementById('feedbackTitle');
        const text = document.getElementById('feedbackText');
        
        if (interacao.resultado) {
            card.style.borderTop = "5px solid #28a745";
            icon.innerText = "check_circle";
            icon.style.color = "#28a745";
            title.innerText = "Sua Resposta: Correta";
        } else {
            card.style.borderTop = "5px solid #dc3545";
            icon.innerText = "cancel";
            icon.style.color = "#dc3545";
            title.innerText = "Sua Resposta: Incorreta";
        }
        
        text.innerHTML = `<strong>Pergunta:</strong> ${interacao.pergunta}<br>
                         <strong>Sua resposta:</strong> ${interacao.respostaDada}<br><br>
                         ${interacao.feedbackDada}`;
        
        modal.style.display = 'flex';
        if (this.youtubePlayer) this.youtubePlayer.pauseVideo();
        else this.video.pause();
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
                const rect = progressTrack.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                
                if (this.youtubePlayer) {
                    const duration = this.youtubePlayer.getDuration();
                    this.youtubePlayer.seekTo(pos * duration);
                } else if (this.video) {
                    this.video.currentTime = pos * this.video.duration;
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
        if (document.getElementById('modalPergunta').style.display === 'flex' || 
            document.getElementById('modalFeedback').style.display === 'flex') return;

        const currentTime = this.youtubePlayer ? 
            this.youtubePlayer.getCurrentTime() : 
            (this.video ? this.video.currentTime : 0);

        const now = Math.floor(currentTime);
        // Encontrar interação que ainda não foi respondida e está no tempo correto
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
        document.getElementById('qTitle').innerText = dados.pergunta;
        const list = document.getElementById('qOptions');
        list.innerHTML = '';
        
        dados.opcoes.forEach(op => {
            const btn = document.createElement('button');
            btn.className = 'btn-opt';
            btn.innerText = op.texto;
            btn.onclick = () => this.showFeedback(op, index);
            list.appendChild(btn);
        });
        
        this.isLocked = true;
        document.getElementById('modalPergunta').style.display = 'flex';
        // if (document.fullscreenElement) document.exitFullscreen(); // Permitir fullscreen na pergunta
    }

    showFeedback(op, index) {
        document.getElementById('modalPergunta').style.display = 'none';
        const card = document.getElementById('feedbackCard');
        const icon = document.getElementById('feedbackIcon');
        const title = document.getElementById('feedbackTitle');
        const interaction = this.config.interacoes[index];
        
        // Registrar resposta
        interaction.respondida = true;
        interaction.resultado = op.correta;
        interaction.respostaDada = op.texto;
        interaction.feedbackDada = op.msg;

        // Atualizar marcador na timeline
        if (interaction.markerElement) {
            interaction.markerElement.classList.add(op.correta ? 'correct' : 'incorrect');
            const tooltip = interaction.markerElement.querySelector('.marker-tooltip');
            if (tooltip) {
                tooltip.innerText += op.correta ? ' (Acertou)' : ' (Errou)';
            }
        }
        
        if (op.correta) {
            card.style.borderTop = "5px solid #28a745";
            icon.innerText = "check_circle";
            icon.style.color = "#28a745";
            title.innerText = "Correto!";
        } else {
            card.style.borderTop = "5px solid #dc3545";
            icon.innerText = "cancel";
            icon.style.color = "#dc3545";
            title.innerText = "Incorreto";
        }
        document.getElementById('feedbackText').innerText = op.msg;
        document.getElementById('modalFeedback').style.display = 'flex';
    }

    jumpTo(sec) {
        if (this.isLocked) {
            console.warn('Salto bloqueado: responda a pergunta primeiro.');
            return;
        }

        if (this.youtubePlayer) {
            this.youtubePlayer.seekTo(sec);
            this.youtubePlayer.playVideo();
        } else if (this.video) {
            this.video.currentTime = sec;
            this.video.play();
        }
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