import { showSuccessToast, showErrorToast } from './notifications.js';
import DOMPurify from 'dompurify';

function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    const emailInput = contactForm.querySelector('#email');
    const submitButton = contactForm.querySelector('#submit-button');
    const formStatus = document.getElementById('form-status');

    let isEmailVerified = false;
    let originalButtonText = 'Enviar Mensagem';

    emailInput.addEventListener('input', () => {
        isEmailVerified = false;
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    });

    emailInput.addEventListener('blur', async () => {
        const email = emailInput.value;
        if (email.length < 5 || !email.includes('@')) {
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = 'Verificando e-mail...';

        try {
            const response = await fetch('/api/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const result = await response.json();
            isEmailVerified = result.isValid;

            if (result.isValid) {
                showSuccessToast('E-mail parece ser válido!');
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            } else {
                showErrorToast(result.message || 'Este e-mail não parece ser válido.');
                submitButton.innerHTML = 'E-mail Inválido';
            }
        } catch (error) {
            console.error('Erro ao verificar e-mail:', error);
            showErrorToast('Não foi possível verificar o e-mail. Tente novamente.');
            isEmailVerified = false;
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });
    
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        if (!isEmailVerified) {
            showErrorToast('Por favor, utilize um e-mail válido. A verificação falhou ou não foi concluída.');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.innerHTML = 'Enviando...';
        formStatus.innerHTML = '';

        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Ocorreu um erro no servidor.');
            }
            showSuccessToast(result.message);
            contactForm.reset();
            isEmailVerified = false;
        } catch (error) {
            showErrorToast(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });
}

function initAIChatWidget() {
    const fab = document.getElementById('chat-fab');
    if (!fab) return;

    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatSendButton = document.getElementById('chat-send-button');
    const messagesContainer = document.getElementById('chat-messages');

    let conversationHistory = [];
    let userMessageCount = 0;
    const MAX_USER_MESSAGES = 5;
    const MAX_USER_CHARACTERS = 150;

    const systemPrompt = `DevX Consultant - Guia em 3 etapas:

ETAPA 1: Analise a ideia (2-3 frases). Finalize com: "Para te dar algumas ideias, vou pesquisar 3 exemplos de mercado para você."

ETAPA 2: Liste 3 exemplos reais (apenas nomes) usando '>>>'. depois pergunte: "Algum desses exemplos se alinha? Diga o nome ou descreva melhor."

ETAPA 3: Após resposta sobre exemplos, responda SOMENTE com: '<p>Entendido. O próximo passo é criar seu projeto em nossa plataforma para que nossa equipe possa analisá-lo.</p><button id="iniciar-projeto-btn" class="btn btn-primary mt-2">Iniciar Projeto e Continuar</button>'

FIM: Após enviar o HTML, se usuário escrever mais, responda: "Para prosseguir, clique em 'Iniciar Projeto' ou use o formulário de contato."`;

    function appendMessage(text, sender, isHtml = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        if (isHtml) {
            messageDiv.innerHTML = DOMPurify.sanitize(text);
        } else {
            const p = document.createElement('p');
            p.textContent = text;
            messageDiv.appendChild(p);
        }
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageDiv;
    }

    function initCharacterCounter() {
        // Remove contador existente se houver
        const existingCounter = document.getElementById('char-count');
        if (existingCounter) {
            existingCounter.remove();
        }

        const charCount = document.createElement('div');
        charCount.id = 'char-count';
        charCount.className = 'character-counter';
        charCount.innerHTML = '<span id="char-count-number">0</span>/250';
        
        // Insere o contador após o textarea
        if (chatInput.parentNode) {
            chatInput.parentNode.insertBefore(charCount, chatInput.nextSibling);
        }

        chatInput.addEventListener('input', () => {
            const length = chatInput.value.length;
            const charNumber = document.getElementById('char-count-number');
            
            if (charNumber) {
                charNumber.textContent = length;
                
                // Feedback visual
                charCount.className = 'character-counter';
                if (length > 400) charCount.classList.add('warning');
                if (length >= 500) charCount.classList.add('error');
            }
        });
    }

    function updateChatInterface() {
        // Desabilita chat se atingiu o limite
        if (userMessageCount >= MAX_USER_MESSAGES) {
            chatInput.disabled = true;
            chatSendButton.disabled = true;
            chatInput.placeholder = 'Limite de mensagens atingido';
            
            // Adiciona mensagem final se não tiver sido adicionada
            const existingLimitMessage = messagesContainer.querySelector('.limit-message');
            if (!existingLimitMessage) {
                const limitMessage = document.createElement('div');
                limitMessage.className = 'limit-message ai-message';
                limitMessage.innerHTML = `
                    <p>✅ Você atingiu o limite de ${MAX_USER_MESSAGES} mensagens.</p>
                    <p>Para continuar, clique no botão "Iniciar Projeto" ou utilize o formulário de contato.</p>
                `;
                messagesContainer.appendChild(limitMessage);
            }
        } else {
            chatInput.disabled = false;
            chatSendButton.disabled = false;
            chatInput.placeholder = 'Digite sua mensagem...';
        }

        // Atualiza o contador de caracteres
        const currentLength = chatInput.value.length;
        const charNumber = document.getElementById('char-count-number');
        if (charNumber) {
            charNumber.textContent = currentLength;
        }
    }

    async function getAiResponse() {
        chatInput.disabled = true;
        chatSendButton.disabled = true;
        const typingIndicator = appendMessage('...', 'ai');

        try {
            const response = await fetch('/api/consultor-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: conversationHistory })
            });
            
            if (!response.ok) {
                const errorResult = await response.json().catch(() => null);
                throw new Error(errorResult?.message || `Erro do servidor: ${response.statusText}`);
            }
            
            const result = await response.json();
            typingIndicator.remove();
            
            // Verifica se é a mensagem final com o botão
            const isFinalMessage = result.result.includes('<button');
            appendMessage(result.result, 'ai', isFinalMessage);
            
            conversationHistory.push({ role: 'model', parts: [{ text: result.result }] });

            // Se for mensagem final, conta como uma "resposta" que encerra o ciclo
            if (isFinalMessage) {
                userMessageCount = MAX_USER_MESSAGES;
                updateChatInterface();
            }

        } catch (error) {
            typingIndicator.remove();
            appendMessage(`Desculpe, ocorreu um erro: ${error.message}`, 'ai');
        } finally {
            updateChatInterface();
            chatInput.focus();
        }
    }

    function startNewConversation() {
        messagesContainer.innerHTML = '';
        appendMessage('Olá! Como posso ajudar a transformar sua ideia em um projeto de software hoje?', 'ai');
        
        // Reinicia contadores
        conversationHistory = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Olá! Como posso ajudar a transformar sua ideia em um projeto de software hoje?' }] }
        ];
        userMessageCount = 0;
        updateChatInterface();
        
        // Inicializa contador de caracteres
        setTimeout(initCharacterCounter, 100);
    }

    fab.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open')) {
            startNewConversation();
        } else {
            // Remove contador quando fecha o chat
            const charCount = document.getElementById('char-count');
            if (charCount) {
                charCount.remove();
            }
        }
    });
    
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let messageText = chatInput.value.trim();
        
        // Verifica limite de mensagens primeiro
        if (userMessageCount >= MAX_USER_MESSAGES) {
            showErrorToast(`Limite de ${MAX_USER_MESSAGES} mensagens atingido.`);
            return;
        }
        
        // Verifica limite de caracteres (APENAS PARA USUÁRIO)
        if (messageText.length > MAX_USER_CHARACTERS) {
            showErrorToast(`Mensagem muito longa. Por favor, seja mais conciso (máximo ${MAX_USER_CHARACTERS} caracteres).`);
            messageText = messageText.substring(0, MAX_USER_CHARACTERS);
        }
        
        if (messageText.length === 0) return;

        // Atualiza o campo com texto cortado (se necessário)
        if (messageText.length !== chatInput.value.trim().length) {
            chatInput.value = messageText;
        }

        appendMessage(messageText, 'user');
        conversationHistory.push({ role: 'user', parts: [{ text: messageText }] });
        userMessageCount++;
        chatInput.value = '';

        updateChatInterface();
        await getAiResponse();
    });

    messagesContainer.addEventListener('click', (e) => {
        if (e.target.id === 'iniciar-projeto-btn') {
            const userIdea = conversationHistory.find(msg => msg.role === 'user' && msg.parts[0].text !== systemPrompt)?.parts[0].text;
            const aiResponse = conversationHistory.filter(msg => msg.role === 'model').map(msg => msg.parts[0].text).join('\n---\n');

            if (!userIdea) {
                showErrorToast("Não foi possível capturar a ideia. Por favor, tente novamente.");
                return;
            }

            const projectSummary = `Ideia Original do Cliente:\n${userIdea}\n\n---\nHistórico da Conversa com a IA:\n${aiResponse}`;
            sessionStorage.setItem('pendingProjectDescription', projectSummary);
            window.location.href = '/login.html';
        }
    });
}

export function initApiHandlers() {
    initContactForm();
    initAIChatWidget();
}