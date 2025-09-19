import { supabase } from './supabaseClient.js';
import '../css/style.css';
import './darkMode.js';
import AOS from 'aos';
import 'aos/dist/aos.css';

/**
 * Inicializa o formulário de redefinição de senha.
 */
function initResetPasswordForm() {
    const form = document.getElementById('reset-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = form.querySelector('#new-password').value;
        const confirmPassword = form.querySelector('#confirm-password').value;

        if (newPassword !== confirmPassword) {
            alert('As senhas não coincidem!');
            return;
        }

        // O SDK do Supabase detecta automaticamente o token da URL 
        // e sabe qual usuário deve ser atualizado.
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            alert('Erro ao redefinir a senha: ' + error.message);
        } else {
            alert('Senha redefinida com sucesso! Você já pode fazer o login.');
            window.location.href = '/login.html';
        }
    });
}

/**
 * Inicializa o formulário de "Esqueci minha senha".
 */
function initForgotPasswordForm() {
    const form = document.getElementById('forgot-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.querySelector('#email').value;

        // Esta é a URL para onde o usuário será enviado DEPOIS de clicar no link do email.
        const resetUrl = `${window.location.origin}/resetar-senha.html`;

        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
        });

        if (error) {
            alert('Erro: ' + error.message);
        } else {
            alert('Se este email estiver cadastrado, um link de recuperação foi enviado. Verifique sua caixa de entrada.');
            form.reset(); // Limpa o formulário
        }
    });
}


/**
 * Atualiza os links de navegação no header com base no status de login do usuário.
 */
async function updateUserNav() {
    const authLinksContainer = document.getElementById('auth-links');
    if (!authLinksContainer) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // Usuário está LOGADO
        authLinksContainer.innerHTML = `
            <a href="/dashboard.html">Meu Perfil</a>
            <a href="#" id="logout-link" class="btn btn-primary !py-2 !px-4">Sair</a>
        `;

        const logoutLink = document.getElementById('logout-link');
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = '/login.html';
        });

    } else {
        // Usuário está DESLOGADO
        authLinksContainer.innerHTML = `
            <a href="/index.html#contato">Contato</a>
            <a href="/login.html" class="btn btn-primary !py-2 !px-4">Login</a>
        `;
    }
}


/**
 * [VERSÃO CORRIGIDA]
 * Protege a página de Dashboard, busca e ATUALIZA dados do perfil, e gerencia o logout.
 */
async function initDashboardPage() {
    const profileForm = document.getElementById('profile-form');
    if (!profileForm) return;

    // Seleciona todos os elementos que vamos manipular
    const welcomeMessage = document.getElementById('welcome-message');
    const emailDisplay = document.getElementById('email-display');
    const usernameInput = document.getElementById('username-input');
    const fullNameInput = document.getElementById('full_name-input');
    const websiteInput = document.getElementById('website-input');
    const editButton = document.getElementById('edit-button');
    const saveButton = document.getElementById('save-button');
    const logoutButton = document.getElementById('logout-button');
    const statusMessage = document.getElementById('form-status-message');
    
    // Agrupa os campos que podem ser editados
    const editableInputs = [usernameInput, fullNameInput, websiteInput];

    // 1. VERIFICAR A SESSÃO E PROTEGER A PÁGINA
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        window.location.href = '/login.html';
        return;
    }
    const user = session.user;

    // 2. BUSCAR DADOS DO PERFIL E PREENCHER O FORMULÁRIO
    try {
        let { data: profile, error } = await supabase
            .from('profiles')
            .select(`username, full_name, website`)
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // Ignora erro se o perfil não existir ainda
            throw error;
        }
        
        if (profile) {
            welcomeMessage.textContent = `Bem-vindo(a), ${profile.username || user.email}!`;
            emailDisplay.value = user.email;
            usernameInput.value = profile.username || '';
            fullNameInput.value = profile.full_name || '';
            websiteInput.value = profile.website || '';
        } else {
            welcomeMessage.textContent = `Bem-vindo(a), ${user.email}!`;
            emailDisplay.value = user.email;
        }
    } catch (error) {
        console.error('Erro ao buscar perfil:', error.message);
        statusMessage.textContent = 'Erro ao carregar perfil.';
        statusMessage.style.color = 'red';
    }

    // 3. LÓGICA DOS BOTÕES E FORMULÁRIO
    
    // Função para alternar para o modo de edição
    function enterEditMode() {
        editableInputs.forEach(input => input.disabled = false); // Habilita todos os inputs
        editButton.classList.add('hidden');
        saveButton.classList.remove('hidden');
        statusMessage.textContent = 'Você agora pode editar seus dados.';
        statusMessage.style.color = 'var(--color-accent-blue)';
    }

    // Função para sair do modo de edição
    function exitEditMode() {
        editableInputs.forEach(input => input.disabled = true); // Desabilita todos os inputs
        editButton.classList.remove('hidden');
        saveButton.classList.add('hidden');
    }

    // Botão de Editar: Chama a função para entrar no modo de edição
    editButton.addEventListener('click', enterEditMode);

    // Formulário (Salvar): Envia os dados atualizados para o Supabase
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';

        const updates = {
            id: user.id,
            username: usernameInput.value,
            full_name: fullNameInput.value,
            website: websiteInput.value,
            updated_at: new Date(),
        };

        const { error } = await supabase.from('profiles').upsert(updates);

        if (error) {
            statusMessage.textContent = 'Erro ao salvar: ' + error.message;
            statusMessage.style.color = 'red';
        } else {
            statusMessage.textContent = 'Perfil salvo com sucesso!';
            statusMessage.style.color = 'green';
            welcomeMessage.textContent = `Bem-vindo(a), ${updates.username || user.email}!`;
            exitEditMode(); // Sai do modo de edição
        }

        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Alterações';
    });

    // Botão de Logout
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });
}

/**
 * Inicializa a lógica do formulário de Login.
 */
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return; // Só executa se estiver na página de login

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = loginForm.querySelector('#email').value;
        const password = loginForm.querySelector('#password').value;

        // Usando a função de login do Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            alert('Erro no login: ' + error.message);
        } else {
            // Se o login for sucesso, redireciona para o dashboard!
            alert('Login realizado com sucesso!');
            window.location.href = '/dashboard.html';
        }
    });
}

/**
 * Inicializa a lógica do formulário de Cadastro com campos adicionais.
 */
function initSignUpForm() {
    const signUpForm = document.getElementById('signup-form');
    if (!signUpForm) return;

    signUpForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Capturar os valores de TODOS os campos
        const fullName = signUpForm.querySelector('#full_name').value;
        const username = signUpForm.querySelector('#username').value;
        const email = signUpForm.querySelector('#email').value;
        const password = signUpForm.querySelector('#password').value;
        const passwordConfirm = signUpForm.querySelector('#password-confirm').value;

        // 2. Validação simples: verificar se as senhas coincidem
        if (password !== passwordConfirm) {
            alert('As senhas não coincidem. Por favor, tente novamente.');
            return; // Interrompe a execução
        }
        
        // 3. Enviar os dados para o Supabase
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                // 'data' é um campo especial para enviar metadados do usuário
                data: { 
                    full_name: fullName,
                    username: username,
                }
            }
        });

        if (error) {
            alert('Erro ao criar a conta: ' + error.message);
        } else {
            alert('Conta criada com sucesso! Verifique seu email para confirmar.');
            // Podemos adicionar o nome e usuário no perfil aqui mesmo, após o cadastro.
            if (data.user) {
                await supabase
                    .from('profiles')
                    .insert([
                        { id: data.user.id, full_name: fullName, username: username }
                    ]);
            }
            window.location.href = '/login.html';
        }
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
document.addEventListener('DOMContentLoaded', async () => { // Adicione 'async' aqui
    AOS.init({ /* ... */ });
    
    // Inicializações que não dependem do usuário
    initMobileMenu();
    initContactForm();
    initAIChatWidget();
    initSignUpForm();
    initLoginForm();
    
    // Roda a verificação da página de dashboard por último
    await initDashboardPage(); // Adicione 'await' aqui
    await updateUserNav();
    initForgotPasswordForm();
    initResetPasswordForm();

});