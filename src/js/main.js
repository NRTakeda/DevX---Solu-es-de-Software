import '../css/style.css';
import './darkMode.js';
import AOS from 'aos';
import 'aos/dist/aos.css';

/**
 * Inicializa o menu mobile (hamburguer).
 */
function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!mobileMenuButton || !mobileMenu) return;

    const navLinksMobile = mobileMenu.querySelectorAll('a');

    mobileMenuButton.addEventListener('click', () => {
        const isExpanded = mobileMenu.classList.toggle('hidden');
        mobileMenuButton.setAttribute('aria-expanded', !isExpanded);
    });

    navLinksMobile.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            mobileMenuButton.setAttribute('aria-expanded', 'false');
        });
    });
}

/**
 * Inicializa o formulário de contato.
 */
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    const formStatus = document.getElementById('form-status');
    const submitButton = document.getElementById('submit-button');
    
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const originalButtonText = submitButton.innerHTML;
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
            formStatus.innerHTML = `<p class="text-green-500">${result.message}</p>`;
            contactForm.reset();
        } catch (error) {
            formStatus.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });
}

/**
 * Inicializa o widget de chat do Consultor IA.
 */
function initAIChatWidget() {
    const fab = document.getElementById('chat-fab');
    const fabIconOpen = document.getElementById('chat-fab-icon-open');
    const fabIconClose = document.getElementById('chat-fab-icon-close');
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatSendButton = document.getElementById('chat-send-button');
    const messagesContainer = document.getElementById('chat-messages');

    if (!fab || !chatWindow) return;

    // Abrir/Fechar a janela do chat
    fab.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        fabIconOpen.classList.toggle('hidden');
        fabIconClose.classList.toggle('hidden');
    });
    
    // Enviar mensagem
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageText = chatInput.value.trim();

        if (messageText.length < 10) {
            return;
        }

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

            if (!response.ok) { 
                throw new Error(result.message || 'Ocorreu um erro na API.');
            }
            
            updateMessage(typingIndicator, result.result);

        } catch (error) {
            updateMessage(typingIndicator, `Desculpe, ocorreu um erro: ${error.message}`);
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
        let text = newHtml;
        text = text.replace(/^#### (.*$)/gm, '<h4 class="text-xl font-bold mb-4">$1</h4>');
        text = text.replace(/^##### (.*$)/gm, '<h5 class="text-lg font-semibold text-sky-500 mb-2">$1</h5>');
        text = text.replace(/^\>\>\> (.*$)/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>').replace(/<\/ul>\s*<ul>/g, '');
        
        messageDiv.innerHTML = text;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}


// Executa todas as inicializações quando o DOM estiver pronto.
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa a biblioteca AOS com algumas configurações
    AOS.init({
        duration: 800, // Duração da animação em milissegundos
        once: true,    // A animação acontece apenas uma vez
        offset: 50,    // "Gatilho" da animação um pouco antes do elemento aparecer
    });

    initMobileMenu();
    initContactForm();
    initAIChatWidget();
});