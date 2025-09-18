import '../css/style.css';
import './darkMode.js';

/**
 * Inicializa a animação de "revelar" elementos ao rolar a página.
 */
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const delay = entry.target.getAttribute('data-delay');
                entry.target.style.transitionDelay = delay || '0ms';
                entry.target.classList.add('reveal-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal:not(.animation-group .reveal)').forEach(el => {
        observer.observe(el);
    });

    document.querySelectorAll('.animation-group').forEach((group) => {
        const revealElements = group.querySelectorAll('.reveal');
        revealElements.forEach((el, index) => {
            el.setAttribute('data-delay', `${index * 150}ms`);
            observer.observe(el);
        });
    });
}

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

        // Adicionar mensagem do usuário à tela
        appendMessage(messageText, 'user');
        chatInput.value = '';
        chatInput.disabled = true;
        chatSendButton.disabled = true;
        
        // Adicionar indicador de "digitando..."
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
            
            // Substitui o "digitando..." pela resposta real
            updateMessage(typingIndicator, result.result);

        } catch (error) {
            updateMessage(typingIndicator, `Desculpe, ocorreu um erro: ${error.message}`);
        } finally {
            chatInput.disabled = false;
            chatSendButton.disabled = false;
            chatInput.focus();
        }
    });
    
    // Função para adicionar uma nova mensagem na tela
    function appendMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        messageDiv.innerHTML = `<p>${text}</p>`; // Inicialmente como texto simples
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto-scroll
        return messageDiv;
    }

    // Função para atualizar uma mensagem (usado para a resposta da IA)
    function updateMessage(messageDiv, newHtml) {
        // Converte o Markdown simples para HTML
        let text = newHtml;
        text = text.replace(/^#### (.*$)/gm, '<h4 class="text-xl font-bold mb-4">$1</h4>');
        text = text.replace(/^##### (.*$)/gm, '<h5 class="text-lg font-semibold text-sky-500 mb-2">$1</h5>');
        text = text.replace(/^\>\>\> (.*$)/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>').replace(/<\/ul>\s*<ul>/g, '');
        
        messageDiv.innerHTML = text;
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto-scroll
    }
}


// Executa todas as inicializações quando o DOM estiver pronto.
document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initMobileMenu();
    initContactForm();
    initAIChatWidget();
});