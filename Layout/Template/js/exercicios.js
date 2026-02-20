document.addEventListener('DOMContentLoaded', function () {

    // ======================================================================
    // 1. GABARITO (MANTIDO)
    // ======================================================================
    const GABARITO = {
        "ex-1": "b", "ex-2": "c", "ex-3": "a", "ex-4": "d", "ex-5": "b",
        "ex-6": "c", "ex-7": "e", "ex-8": "a", "ex-9": "c", "ex-10": "b",

        "ex-11": { "sel1": "1", "sel2": "2", "sel3": "3" }, 
        "ex-12": { "sel1": "azul", "sel2": "verm", "sel3": "ama" },
        "ex-13": { "sel1": "mouse", "sel2": "teclado", "sel3": "monitor" },
        "ex-14": { "sel1": "a", "sel2": "b", "sel3": "c", "sel4": "d" },
        "ex-15": { "sel1": "win", "sel2": "mac", "sel3": "lin", "sel4": "and" },
        "ex-16": { "sel1": "10", "sel2": "20", "sel3": "30", "sel4": "40" },
        "ex-17": { "sel1": "norte", "sel2": "sul", "sel3": "leste", "sel4": "oeste", "sel5": "centro" },
        "ex-18": { "sel1": "1", "sel2": "2", "sel3": "3", "sel4": "4", "sel5": "5" },
        "ex-19": { "sel1": "html", "sel2": "css", "sel3": "js", "sel4": "php", "sel5": "sql" },
        "ex-20": { "sel1": "a", "sel2": "b", "sel3": "c", "sel4": "d", "sel5": "e" },

        "ex-21": "v", "ex-22": "f", "ex-23": "v", "ex-24": "f", "ex-25": "v",
        "ex-26": "f", "ex-27": "v", "ex-28": "f", "ex-29": "v", "ex-30": "f",
        "ex-31": { "ex31_a": "v", "ex31_b": "f", "ex31_c": "v" }, 

        "ex-32": { "ex32_a": "f", "ex32_b": "v", "ex32_c": "f", "ex32_d": "v" },
        "ex-33": { "ex33_a": "v", "ex33_b": "f", "ex33_c": "v" },
        "ex-34": { "ex34_a": "v", "ex34_b": "f", "ex34_c": "v" },
        "ex-35": { "ex35_a": "f", "ex35_b": "v", "ex35_c": "f" },
        "ex-36": { "ex36_a": "v", "ex36_b": "f", "ex36_c": "v" },
        "ex-37": { "ex37_a": "f", "ex37_b": "v", "ex37_c": "f" },
        "ex-38": { "ex38_a": "v", "ex38_b": "v", "ex38_c": "f" },
        "ex-39": { "ex39_a": "f", "ex39_b": "v", "ex39_c": "v" },
        "ex-40": { "ex40_a": "v", "ex40_b": "f", "ex40_c": "v", "ex40_d": "f" },

        "ex-41": ["java", "python"],
        "ex-42": ["html", "css", "js"],
        "ex-43": ["2", "4", "6"],
        "ex-44": ["verde", "amarelo"],
        "ex-45": ["a", "e", "i"],
        "ex-46": ["norte", "sul"],
        "ex-47": ["terra", "marte"],
        "ex-48": ["fusca", "brasilia"],
        "ex-49": ["futebol", "volei"],
        "ex-50": ["10", "20", "30"]
    };

    // ======================================================================
    // 2. CONFIGURAÇÃO E UTILITÁRIOS
    // ======================================================================
    
    function getMaxAttempts(wrapper) {
        let attr = wrapper.getAttribute('data-max-attempts');
        if(attr) return parseInt(attr);

        let type = wrapper.getAttribute('data-type');
        if (type === 'tf' || type === 'tf-multi') return 1; 
        return 2; 
    }

    function shuffleElements() {
        const containers = document.querySelectorAll('.js-shuffle, .js-shuffle-rows');
        containers.forEach(container => {
            if(container.getAttribute('data-shuffled')) return;
            const items = Array.from(container.children);
            for (let i = items.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }
            items.forEach(item => container.appendChild(item));
            container.setAttribute('data-shuffled', 'true');
        });
        
        document.querySelectorAll('.js-shuffle-options').forEach(select => {
            if(select.getAttribute('data-shuffled')) return;
            const options = Array.from(select.children);
            const placeholder = options.shift(); 
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }
            select.innerHTML = "";
            if(placeholder) select.appendChild(placeholder);
            options.forEach(opt => select.appendChild(opt));
            select.setAttribute('data-shuffled', 'true');
        });
    }

    function saveProgress(id, data) {
        localStorage.setItem('senai_ex_' + id, JSON.stringify(data));
    }
    
    function getProgress(id) {
        const data = localStorage.getItem('senai_ex_' + id);
        return data ? JSON.parse(data) : null;
    }

    // ======================================================================
    // 3. ATUALIZAÇÃO VISUAL (UI) - CORRIGIDA
    // ======================================================================
    function updateUI(wrapper, state, correctAnswer) {
        const type = wrapper.getAttribute('data-type');
        const maxAttempts = getMaxAttempts(wrapper);

        // --- 0. ATUALIZAR CONTADOR ---
        const badge = wrapper.querySelector('.attempt-count');
        if (badge) {
            badge.textContent = `Tentativas: ${state.attempts}/${maxAttempts}`;
        }

        // --- 1. PREPARAR GABARITO DINÂMICO (SEM TÍTULO HARDCODED) ---
        let dynamicAnswerText = "";
        
        if (state.status === 'erro') {
            if (type === 'single') {
                const correctInput = wrapper.querySelector(`input[value="${correctAnswer}"]`);
                if (correctInput) {
                    const label = correctInput.closest('label');
                    const allLabels = Array.from(wrapper.querySelectorAll('.js-shuffle label, .options-container label')); 
                    const contextLabels = allLabels.length ? allLabels : Array.from(wrapper.querySelectorAll('label'));
                    
                    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                    let index = contextLabels.indexOf(label);
                    if(index === -1) index = 0; 

                    const labelTextEl = label.querySelector('.opt-label');
                    const labelText = labelTextEl ? labelTextEl.innerText : label.innerText;
                    
                    // Apenas o texto da resposta certa
                    dynamicAnswerText = `A correta é: ${letters[index] ? letters[index] + ') ' : ''}${labelText}.`;
                }
            } else if (type === 'tf') {
                const correctInput = wrapper.querySelector(`input[value="${correctAnswer}"]`);
                if(correctInput) {
                    const labelText = correctInput.closest('label').querySelector('.tf-btn-label').innerText;
                    dynamicAnswerText = `A afirmação é: <strong>${labelText}</strong>.`;
                }
            } else {
                dynamicAnswerText = `As respostas corretas foram marcadas em verde.`;
            }
        }

        // --- 2. EXIBIR FEEDBACK (TUDO DENTRO DE SPAN) ---
        const feedbackContainer = wrapper.querySelector('.feedback-container');
        if(feedbackContainer) {
            feedbackContainer.querySelectorAll('.collapse').forEach(el => el.classList.remove('show'));

            // Função que monta a estrutura: Título + (Manual) + Dinâmico
            const updateMsgContent = (selector, headerText, defaultText, isError = false) => {
                const el = feedbackContainer.querySelector(`${selector} .msg-content, ${selector} .msg-texto`);
                if(el) {
                    // Recupera explicação manual salva no init
                    const manualText = el.getAttribute('data-manual-text') || "";
                    
                    let contentHtml = "";

                    // Monta o conteúdo
                    if (isError) {
                        // 1. Título
                        contentHtml += `<strong>${headerText}</strong>`;
                        
                        // 2. Explicação Manual (se houver)
                        if (manualText) {
                            contentHtml += `<br>${manualText}`; // Quebra linha após título
                        }

                        // 3. Gabarito Dinâmico
                        contentHtml += `<br>${dynamicAnswerText}`;
                    } 
                    else {
                        // SUCESSO / TENTATIVA
                        contentHtml += `<strong>${headerText}</strong><br>`;
                        contentHtml += manualText ? manualText : defaultText;
                    }
                    
                    // --- CORREÇÃO AQUI: FORÇA COR PRETA NA TENTATIVA ---
                    if (selector === '.feedback-tentativa') {
                        el.innerHTML = `<span style="color: #000000 !important; display:block;">${contentHtml}</span>`;
                    } else {
                        el.innerHTML = `<span>${contentHtml}</span>`;
                    }
                }
            };

            // 2.1 - Selecione
            const elSel = feedbackContainer.querySelector('.feedback-selecione .msg-content');
            if(elSel) elSel.innerHTML = '<span>Selecione todas as opções.</span>';

            // 2.2 - Tentativa
            let tentativasRestantes = maxAttempts - state.attempts;
            if(tentativasRestantes < 0) tentativasRestantes = 0;
            const msgTentativa = `Você tem mais ${tentativasRestantes} tentativa(s).`;
            updateMsgContent('.feedback-tentativa', 'Ops! Resposta incorreta.', msgTentativa);

            // 2.3 - Correto
            updateMsgContent('.feedback-correto', 'Resposta correta.', 'Parabéns!');

            // 2.4 - Erro (Passa o título padrão para ser o primeiro item)
            updateMsgContent('.feedback-erro', 'Resposta incorreta.', '', true);


            // Mostrar container
            let targetClass = '';
            if (state.tempStatus === 'selecione') targetClass = '.feedback-selecione';
            else if (state.status === 'correto') targetClass = '.feedback-correto';
            else if (state.status === 'tentativa') targetClass = '.feedback-tentativa';
            else if (state.status === 'erro') targetClass = '.feedback-erro';

            if(targetClass) {
                const target = feedbackContainer.querySelector(targetClass);
                if(target) setTimeout(() => target.classList.add('show'), 50);
            }
        }

        // --- 3. BLOQUEIO E ESTILIZAÇÃO FINAL ---
        if (state.solved) {
            // Bloqueio Geral
            wrapper.querySelectorAll('input, select, button').forEach(el => {
                el.disabled = true;
                el.classList.add('disabled-interaction');
            });

            const btnVerify = wrapper.querySelector('.js-btn-check');
            if(btnVerify) btnVerify.style.display = 'none';

            // Estilização por Tipo
            if (type === 'single' || type === 'tf') {
                const correctInput = wrapper.querySelector(`input[value="${correctAnswer}"]`);
                if (correctInput) {
                    let container;
                    if(type === 'single') container = correctInput.closest('label');
                    else container = correctInput.closest('label').querySelector('.tf-btn-label');
                    
                    if(container) {
                        /*container.classList.remove('border');*/
                        container.classList.add('soft-success');
                        container.style.borderColor = "var(--saibamais)"; 
                    }
                }
                if (state.status === 'erro' && state.userValues) {
                    const wrongInput = wrapper.querySelector(`input[value="${state.userValues}"]`);
                    if (wrongInput && wrongInput !== correctInput) {
                        let container;
                        if(type === 'single') container = wrongInput.closest('label');
                        else container = wrongInput.closest('label').querySelector('.tf-btn-label');
                        
                        if(container) {
                            container.classList.add('soft-error');
                            container.style.borderColor = "var(--importante)";
                        }
                    }
                }
            }
            else if (type === 'combobox') {
                wrapper.querySelectorAll('select').forEach(sel => {
                    const gabaritoVal = correctAnswer[sel.name];
                    
                    if (sel.value == gabaritoVal) {
                        sel.classList.add('soft-success');
                        sel.style.border = "2px solid var(--saibamais)"; 
                        sel.style.color = "var(--text1)"; 
                        sel.style.fontWeight = "bold";
                    } else {
                        sel.classList.add('soft-error');
                        sel.style.border = "2px solid var(--importante)";
                        sel.style.color = "var(--text1)";
                    }
                });
            }
            
            else if (type === 'tf-multi') {
                Object.keys(correctAnswer).forEach(rowName => {
                    const correctVal = correctAnswer[rowName]; 
                    const userVal = state.userValues ? state.userValues[rowName] : null;

                    const btnCorrect = wrapper.querySelector(`input[name="${rowName}"][value="${correctVal}"]`);
                    if(btnCorrect) {
                        const lbl = btnCorrect.closest('.btn-check-label');
                        lbl.classList.add('soft-success');
                        lbl.style.borderColor = "var(--saibamais)";
                    }

                    if (userVal && userVal !== correctVal) {
                        const btnWrong = wrapper.querySelector(`input[name="${rowName}"][value="${userVal}"]`);
                        if(btnWrong) {
                            const lbl = btnWrong.closest('.btn-check-label');
                            lbl.classList.add('soft-error');
                            lbl.style.borderColor = "var(--importante)";
                        }
                    }
                });
            }
            else if (type === 'multi') {
                wrapper.querySelectorAll('input').forEach(inp => {
                    const label = inp.closest('label');
                    if (correctAnswer.includes(inp.value)) {
                       /* label.classList.remove('border');*/
                        label.classList.add('soft-success');
                        label.style.borderColor = "var(--saibamais)";
                        inp.checked = true;
                    } 
                    else if (inp.checked) {
                        label.classList.add('soft-error');
                        label.style.borderColor = "var(--importante)";
                    }
                });
            }
        }
    }

    // ======================================================================
    // 4. LÓGICA DE VERIFICAÇÃO
    // ======================================================================
    function checkExercise(wrapper) {
        const id = wrapper.id;
        const type = wrapper.getAttribute('data-type');
        const correctAnswer = GABARITO[id];
        const maxAttempts = getMaxAttempts(wrapper);
        
        if (!correctAnswer) return console.error('Gabarito não encontrado para: ' + id);

        let state = getProgress(id) || { attempts: 0, solved: false };
        let isCorrect = true;
        let isComplete = true;
        let userValues = null;

        if (type === 'single' || type === 'tf') {
            const checked = wrapper.querySelector('input[type="radio"]:checked');
            if (!checked) return updateUI(wrapper, { status: null, tempStatus: 'selecione', attempts: state.attempts }, correctAnswer); 
            userValues = checked.value;
            if (userValues !== correctAnswer) isCorrect = false;
        }
        else if (type === 'combobox') {
            userValues = {};
            wrapper.querySelectorAll('select').forEach(sel => {
                userValues[sel.name] = sel.value;
                if (!sel.value || sel.value === "0") isComplete = false;
                if (sel.value !== correctAnswer[sel.name]) isCorrect = false;
            });
            if (!isComplete) return updateUI(wrapper, { status: null, tempStatus: 'selecione', attempts: state.attempts }, correctAnswer);
        }
        else if (type === 'tf-multi') {
            userValues = {};
            Object.keys(correctAnswer).forEach(rowName => {
                const checked = wrapper.querySelector(`input[name="${rowName}"]:checked`);
                if (!checked) { isComplete = false; } 
                else {
                    userValues[rowName] = checked.value;
                    if (checked.value !== correctAnswer[rowName]) isCorrect = false;
                }
            });
            if (!isComplete) return updateUI(wrapper, { status: null, tempStatus: 'selecione', attempts: state.attempts }, correctAnswer);
        }
        else if (type === 'multi') {
            const checked = wrapper.querySelectorAll('input[type="checkbox"]:checked');
            if (checked.length === 0) return updateUI(wrapper, { status: null, tempStatus: 'selecione', attempts: state.attempts }, correctAnswer);
            
            userValues = [];
            checked.forEach(chk => userValues.push(chk.value));
            
            if (checked.length !== correctAnswer.length) isCorrect = false;
            else {
                userValues.forEach(val => { if (!correctAnswer.includes(val)) isCorrect = false; });
            }
        }

        let status = '';
        if (isCorrect) {
            status = 'correto';
            state.solved = true;
            state.attempts++;
        } else {
            state.attempts++;
            if (state.attempts >= maxAttempts) {
                status = 'erro';
                state.solved = true;
            } else {
                status = 'tentativa';
            }
        }

        state.userValues = userValues;
        state.status = status;
        state.tempStatus = null;
        
        saveProgress(id, state);
        updateUI(wrapper, state, correctAnswer);
    }

    // ======================================================================
    // 5. INICIALIZAÇÃO
    // ======================================================================
    function init() {
        // --- CAPTURA TEXTO MANUAL ANTES DE MEXER NO DOM ---
        document.querySelectorAll('.js-exercise .feedback-container').forEach(container => {
            const els = container.querySelectorAll('.msg-content, .msg-texto');
            els.forEach(el => {
                if(el.innerHTML.trim() !== "") {
                    el.setAttribute('data-manual-text', el.innerHTML.trim());
                    el.innerHTML = ""; 
                }
            });
        });

        shuffleElements();

        document.querySelectorAll('.js-exercise').forEach(wrapper => {
            const id = wrapper.id;
            const state = getProgress(id);
            const gabarito = GABARITO[id];

            const max = getMaxAttempts(wrapper);
            const badge = wrapper.querySelector('.attempt-count');
            if(badge) badge.textContent = `Tentativas: ${state ? state.attempts : 0}/${max}`;

            if (state && gabarito) {
                if (state.userValues) {
                    const type = wrapper.getAttribute('data-type');
                    
                    if (type === 'single' || type === 'tf') {
                        const el = wrapper.querySelector(`input[value="${state.userValues}"]`);
                        if(el) el.checked = true;
                    } 
                    else if (type === 'combobox') {
                        for (const [key, val] of Object.entries(state.userValues)) {
                            const el = wrapper.querySelector(`select[name="${key}"]`);
                            if(el) el.value = val;
                        }
                    }
                    else if (type === 'tf-multi') {
                        for (const [key, val] of Object.entries(state.userValues)) {
                            const el = wrapper.querySelector(`input[name="${key}"][value="${val}"]`);
                            if(el) el.checked = true;
                        }
                    }
                    else if (type === 'multi') {
                        state.userValues.forEach(val => {
                            const el = wrapper.querySelector(`input[value="${val}"]`);
                            if(el) el.checked = true;
                        });
                    }
                }

                if (state.solved || state.attempts > 0) {
                    updateUI(wrapper, state, gabarito);
                }
            }
        });
    }

    document.body.addEventListener('click', function(e) {
        if (e.target.classList.contains('js-btn-check')) {
            e.preventDefault();
            checkExercise(e.target.closest('.js-exercise'));
        }
        if (e.target.classList.contains('js-option') && e.target.type === 'radio') {
            const wrapper = e.target.closest('.js-exercise');
            if(wrapper.getAttribute('data-type') === 'tf' || wrapper.getAttribute('data-type') === 'tf-multi') return;
            if (getProgress(wrapper.id)?.solved) { e.preventDefault(); return; }
            checkExercise(wrapper);
        }
        if (e.target.classList.contains('tf-btn-radio')) {
            const wrapper = e.target.closest('.js-exercise');
            if(wrapper.getAttribute('data-type') !== 'tf') return;
            if (getProgress(wrapper.id)?.solved) { e.preventDefault(); return; }
            setTimeout(() => checkExercise(wrapper), 50);
        }
    });

    window.limparProgresso = function() {
        Object.keys(localStorage).forEach(key => {
            if(key.startsWith('senai_ex_')) localStorage.removeItem(key);
        });
        location.reload();
    }

    init();
});