import { showSuccessToast, showErrorToast } from './notifications.js';


// Substitua sua função em src/js/modules/api.js por esta versão à prova de falhas

function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    const emailInput = contactForm.querySelector('#email');
    const submitButton = contactForm.querySelector('#submit-button');
    const formStatus = document.getElementById('form-status');

    // Variável para controlar o estado da validação do e-mail
    let isEmailVerified = false;
    let originalButtonText = 'Enviar Mensagem';

    // Se o usuário digitar no campo de e-mail DEPOIS de uma verificação, reseta o status.
    emailInput.addEventListener('input', () => {
        isEmailVerified = false;
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
    });

    // Verificação em tempo real, como antes
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

            isEmailVerified = result.isValid; // Atualiza nosso estado

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
            isEmailVerified = true; // Em caso de falha, permitimos o envio para não bloquear o usuário
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });
    
    // Lógica de envio do formulário ATUALIZADA
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        // --- NOVA BARREIRA DE SEGURANÇA ---
        // Verifica o status da validação ANTES de tentar enviar.
        if (!isEmailVerified) {
            showErrorToast('Por favor, utilize um e-mail válido. A verificação falhou ou não foi concluída.');
            return; // Impede o envio
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
            showSuccessToast(result.message); // Usando a notificação Toast
            contactForm.reset();
            isEmailVerified = false; // Reseta o status após o envio
        } catch (error) {
            showErrorToast(error.message); // Usando a notificação Toast
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });
}