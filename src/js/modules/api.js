import { showSuccessToast, showErrorToast } from './notifications.js';

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
            isEmailVerified = true;
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

    fab.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
    });
    
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageText = chatInput.value.trim();
        if (messageText.length < 10) return;

        appendMessage(messageText, 'user');
        chatInput.value = '';
        chatInput.disabled = true;
        chatSendButton.disabled = true;
        
        const typingIndicator = appendMessage('...', 'ai');

        try {
            const response = await fetch('/api/consultor-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: messageText })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Erro na API.');
            updateMessage(typingIndicator, result.result);
        } catch (error) {
            updateMessage(typingIndicator, `Desculpe, erro: ${error.message}`);
        } finally {
            chatInput.disabled = false;
            chatSendButton.disabled = false;
            chatInput.focus();
        }
    });
    
    function appendMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        messageDiv.innerHTML = `<p>${text}</p>`;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageDiv;
    }

    function updateMessage(messageDiv, newHtml) {
        let text = newHtml.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        text = text.replace(/^#### (.*$)/gm, '<h4 class="text-xl font-bold mb-4">$1</h4>');
        text = text.replace(/^##### (.*$)/gm, '<h5 class="text-lg font-semibold text-sky-500 mb-2">$1</h5>');
        text = text.replace(/^\&gt;\&gt;\&gt; (.*$)/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>').replace(/<\/ul>\s*<ul>/g, '');
        
        messageDiv.innerHTML = text;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// ESTA PARTE ESTAVA FALTANDO
export function initApiHandlers() {
    initContactForm();
    initAIChatWidget();
}