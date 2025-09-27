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

    // 🔑 Definição dos limites diferentes
    const isLoggedIn = !!localStorage.getItem("authToken"); // Ajuste conforme sua lógica de login
    const MAX_USER_MESSAGES = isLoggedIn ? 7 : 4;  
    const MAX_USER_CHARACTERS = 150;

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
        const existingCounter = document.getElementById('char-count');
        if (existingCounter) existingCounter.remove();

        const charCount = document.createElement('div');
        charCount.id = 'char-count';
        charCount.className = 'character-counter';
        charCount.innerHTML = `<span id="char-count-number">0</span>/${MAX_USER_CHARACTERS}`;
        
        if (chatInput.parentNode) {
            chatInput.parentNode.insertBefore(charCount, chatInput.nextSibling);
        }

        chatInput.addEventListener('input', () => {
            const length = chatInput.value.length;
            const charNumber = document.getElementById('char-count-number');
            if (charNumber) {
                charNumber.textContent = length;
                charCount.classList.toggle('error', length > MAX_USER_CHARACTERS);
            }
        });
    }

    function updateChatInterface() {
        if (userMessageCount >= MAX_USER_MESSAGES) {
            chatInput.disabled = true;
            chatSendButton.disabled = true;
            chatInput.placeholder = 'Limite de mensagens atingido';
            
            if (!messagesContainer.querySelector('.limit-message')) {
                const limitMessage = document.createElement('div');
                limitMessage.className = 'limit-message ai-message';
                limitMessage.innerHTML = `<p>✅ Você atingiu o limite de ${MAX_USER_MESSAGES} mensagens. Para continuar, use o botão "Iniciar Projeto" ou o formulário de contato.</p>`;
                messagesContainer.appendChild(limitMessage);
            }
        } else {
            chatInput.disabled = false;
            chatSendButton.disabled = false;
            chatInput.placeholder = 'Digite sua ideia aqui...';
        }
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
            const shortHistory = conversationHistory.slice(-2);
            const response = await fetch('/api/consultor-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: shortHistory })
            });
            
            if (!response.ok) {
                const errorResult = await response.json().catch(() => null);
                throw new Error(errorResult?.message || `Erro do servidor: ${response.statusText}`);
            }
            
            const result = await response.json();
            typingIndicator.remove();
            
            const isFinalMessage = result.result.includes('<button');
            appendMessage(result.result, 'ai', isFinalMessage);
            conversationHistory.push({ role: 'model', parts: [{ text: result.result }] });

            if (isFinalMessage) {
                userMessageCount = MAX_USER_MESSAGES;
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
        
        conversationHistory = [];
        userMessageCount = 0;
        updateChatInterface();
        setTimeout(initCharacterCounter, 100);
    }

    fab.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open')) {
            startNewConversation();
        } else {
            const charCount = document.getElementById('char-count');
            if (charCount) charCount.remove();
        }
    });
    
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatSendButton.click();
        }
    });
    
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageText = chatInput.value.trim();
        
        if (userMessageCount >= MAX_USER_MESSAGES) {
            showErrorToast(`Limite de ${MAX_USER_MESSAGES} mensagens atingido.`);
            return;
        }
        
        if (messageText.length > MAX_USER_CHARACTERS) {
            showErrorToast(`Mensagem muito longa (máximo ${MAX_USER_CHARACTERS} caracteres).`);
            return;
        }
        
        if (messageText.length === 0) return;

        appendMessage(messageText, 'user');
        conversationHistory.push({ role: 'user', parts: [{ text: messageText }] });
        userMessageCount++;
        chatInput.value = '';

        updateChatInterface();
        await getAiResponse();
    });

    messagesContainer.addEventListener('click', (e) => {
        if (e.target.id === 'iniciar-projeto-btn') {
            const userIdeas = conversationHistory.filter(msg => msg.role === 'user').map(msg => msg.parts[0].text);
            const aiResponses = conversationHistory.filter(msg => msg.role === 'model').map(msg => msg.parts[0].text);
            if (userIdeas.length === 0) {
                showErrorToast("Não foi possível capturar a ideia. Por favor, tente novamente.");
                return;
            }
            const projectSummary = `Ideia Original do Cliente:\n${userIdeas.join('\n\n')}\n\n---\nRespostas da IA:\n${aiResponses.join('\n---\n')}`;
            sessionStorage.setItem('pendingProjectDescription', projectSummary);
            window.location.href = '/login.html';
        }
    });
}

export function initApiHandlers() {
    initContactForm();
    initAIChatWidget();
}
