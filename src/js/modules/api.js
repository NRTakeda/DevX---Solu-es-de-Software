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

    const complexSystemPrompt = `Você é o "DevX Consultant", um assistente conversacional da agência de software DevX. Seu objetivo é guiar o usuário em 3 etapas. Seja sempre breve e amigável.

    ETAPA 1: Quando o usuário apresentar a ideia inicial, sua primeira resposta deve ser uma breve análise da oportunidade de negócio (2-3 frases). Termine EXATAMENTE com a frase: "Para te dar algumas ideias, vou pesquisar 3 exemplos de mercado para você."

    ETAPA 2: Na sua segunda resposta, liste 3 exemplos de sites reais do segmento do cliente. Use o formato '>>>' para a lista. Depois da lista, pergunte EXATAMENTE: "Algum desses exemplos se alinha com o que você imaginou? Você pode me dizer o nome dele ou descrever melhor o que busca."

    ETAPA 3: Após o usuário responder à pergunta sobre os exemplos, sua terceira e última resposta deve ser o HTML para o botão de ação. Responda APENAS com o seguinte código HTML, sem nenhum texto adicional: '<p>Entendido. O próximo passo é criar seu projeto em nossa plataforma para que nossa equipe possa analisá-lo.</p><button id="iniciar-projeto-btn" class="btn btn-primary mt-2">Iniciar Projeto e Continuar</button>'
    `;

    const simpleSystemPrompt = `Você é um assistente de IA para testes. Siga 3 etapas: Etapa 1: Responda "Analisando...". Etapa 2: Responda "Exemplos: site1, site2, site3. Qual prefere?". Etapa 3: Responda APENAS com este HTML: '<p>Entendido. O próximo passo é criar seu projeto em nossa plataforma para que nossa equipe possa analisá-lo.</p><button id="iniciar-projeto-btn" class="btn btn-primary mt-2">Iniciar Projeto e Continuar</button>'`;

    const systemPrompt = import.meta.env.DEV ? simpleSystemPrompt : complexSystemPrompt;

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
            appendMessage(result.result, 'ai', result.result.includes('<button'));
            conversationHistory.push({ role: 'model', parts: [{ text: result.result }] });

        } catch (error) {
            typingIndicator.remove();
            appendMessage(`Desculpe, ocorreu um erro: ${error.message}`, 'ai');
        } finally {
            chatInput.disabled = false;
            chatSendButton.disabled = false;
            chatInput.focus();
        }
    }

    fab.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open')) {
            messagesContainer.innerHTML = '';
            appendMessage('Olá! Como posso ajudar a transformar sua ideia em um projeto de software hoje?', 'ai');
            conversationHistory = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: 'Olá! Como posso ajudar a transformar sua ideia em um projeto de software hoje?' }] }
            ];
        }
    });
    
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageText = chatInput.value.trim();
        if (messageText.length === 0) return;

        appendMessage(messageText, 'user');
        conversationHistory.push({ role: 'user', parts: [{ text: messageText }] });
        chatInput.value = '';

        await getAiResponse();
    });

    // --- LÓGICA DA FASE 2 ---
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
            
            showSuccessToast("Ótimo! Vamos para o próximo passo...");
            
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
        }
    });
}

export function initApiHandlers() {
    initContactForm();
    initAIChatWidget();
}