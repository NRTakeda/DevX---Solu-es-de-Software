import { supabase } from './supabaseClient.js';
import '../css/style.css';
import './darkMode.js';
import AOS from 'aos';
import 'aos/dist/aos.css';

/**
 * Inicializa a página de Administração.
 */
async function initAdminPage() {
    const projectsTableBody = document.getElementById('projects-table-body');
    if (!projectsTableBody) return; // Só roda na página de admin

    // 1. Proteger a página: verificar se o usuário é admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || profile.role !== 'admin') {
        alert('Acesso negado.');
        window.location.href = '/dashboard.html'; // Redireciona não-admins
        return;
    }

    // Elementos do Modal de Edição
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-project-form');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const projectIdInput = document.getElementById('edit-project-id');
    const projectNameInput = document.getElementById('edit-project-name');
    const projectStatusInput = document.getElementById('edit-project-status');

    // 2. Função para buscar e renderizar todos os projetos
    async function renderProjects() {
        // O Supabase usa a RLS. Como somos admin, esta chamada retornará todos os projetos.
        const { data: projects, error } = await supabase
            .from('projects')
            .select('id, name, status, profiles(username)'); // Puxa o username do cliente!

        if (error) {
            console.error('Erro ao buscar projetos:', error);
            return;
        }

        projectsTableBody.innerHTML = ''; // Limpa a tabela
        projects.forEach(project => {
            const tr = document.createElement('tr');
            tr.className = 'border-b dark:border-gray-700';
            tr.innerHTML = `
                <td class="p-4">${project.name}</td>
                <td class="p-4">${project.profiles.username || 'N/A'}</td>
                <td class="p-4">${project.status}</td>
                <td class="p-4">
                    <button data-id="${project.id}" data-name="${project.name}" data-status="${project.status}" class="edit-btn text-sky-500 hover:underline">Editar</button>
                </td>
            `;
            projectsTableBody.appendChild(tr);
        });
    }

    // 3. Lógica de Edição
    projectsTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            const button = e.target;
            projectIdInput.value = button.dataset.id;
            projectNameInput.value = button.dataset.name;
            projectStatusInput.value = button.dataset.status;
            editModal.classList.remove('hidden');
        }
    });

    cancelEditButton.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = projectIdInput.value;
        const updatedData = {
            name: projectNameInput.value,
            status: projectStatusInput.value
        };

        const { error } = await supabase
            .from('projects')
            .update(updatedData)
            .eq('id', id);

        if (error) {
            alert('Erro ao atualizar o projeto: ' + error.message);
        } else {
            alert('Projeto atualizado com sucesso!');
            editModal.classList.add('hidden');
            await renderProjects(); // Re-renderiza a tabela com os novos dados
        }
    });

    // Renderiza os projetos ao carregar a página
    await renderProjects();
}

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


// INÍCIO DA NOVA VERSÃO DA FUNÇÃO
async function updateUserNav() {
    // MUDANÇA: Seleciona TODOS os elementos com a classe '.auth-links'
    const authLinksContainers = document.querySelectorAll('.auth-links');
    if (authLinksContainers.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // Usuário está LOGADO
        const navHTML = `
            <a href="/dashboard.html">Meu Perfil</a>
            <a href="#" id="logout-link" class="btn btn-primary !py-2 !px-4 hidden md:block">Sair</a>
            <a href="#" id="logout-link-mobile" class="md:hidden font-semibold">Sair</a>
        `;
        // MUDANÇA: Itera e atualiza CADA container (desktop e mobile)
        authLinksContainers.forEach(container => {
            container.innerHTML = navHTML;
        });

        // O listener de logout precisa ser adicionado a ambos os botões
        document.querySelectorAll('#logout-link, #logout-link-mobile').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabase.auth.signOut();
                window.location.href = '/login.html';
            });
        });

    } else {
        // Usuário está DESLOGADO
        const navHTML = `
            <a href="/index.html#contato" class="hidden md:block">Contato</a>
            <a href="/login.html" class="btn btn-primary !py-2 !px-4">Login</a>
        `;
        // MUDANÇA: Itera e atualiza CADA container
        authLinksContainers.forEach(container => {
            container.innerHTML = navHTML;
        });
    }
}
// FIM DA NOVA VERSÃO DA FUNÇÃO


/**
 * [VERSÃO FINAL COM SIDEBAR]
 * Gerencia o layout do Dashboard, busca dados, e lida com a navegação da sidebar.
 */
async function initDashboardPage() {
    // Seleciona os elementos principais do layout
    const navLinkProjects = document.getElementById('nav-link-projects');
    const navLinkProfile = document.getElementById('nav-link-profile');
    const contentProjects = document.getElementById('content-projects');
    const contentProfile = document.getElementById('content-profile');
    
    // Se não estivermos na página do dashboard, encerra a função
    if (!navLinkProjects) return;

    // --- LÓGICA DE NAVEGAÇÃO DA SIDEBAR ---
    
    // Função para mostrar uma seção e esconder as outras
    function showContent(contentToShow) {
        [contentProjects, contentProfile].forEach(content => content.classList.add('hidden'));
        contentToShow.classList.remove('hidden');
    }

    // Função para atualizar o link ativo no menu
    function setActiveLink(activeLink) {
        [navLinkProjects, navLinkProfile].forEach(link => link.classList.remove('bg-gray-200', 'dark:bg-gray-700'));
        activeLink.classList.add('bg-gray-200', 'dark:bg-gray-700');
    }

    navLinkProjects.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveLink(navLinkProjects);
        showContent(contentProjects);
    });

    navLinkProfile.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveLink(navLinkProfile);
        showContent(contentProfile);
    });

    // --- LÓGICA DE DADOS (Busca de perfil, projeto, etc.) ---
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
        window.location.href = '/login.html';
        return;
    }
    const user = session.user;

    // Lógica para buscar e preencher os dados do PROJETO
    try {
        const projectNameEl = document.getElementById('project-name');
        const projectStatusEl = document.getElementById('project-status');
        let { data: project, error } = await supabase.from('projects').select('name, status').eq('client_id', user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (project) {
            projectNameEl.textContent = project.name;
            projectStatusEl.textContent = project.status;
            if (project.status === 'Concluído') projectStatusEl.style.color = 'green';
            else if (project.status === 'Em Desenvolvimento') projectStatusEl.style.color = 'orange';
        } else {
            projectNameEl.textContent = 'Nenhum projeto ativo encontrado.';
            projectStatusEl.textContent = '-';
        }
    } catch (error) {
        console.error('Erro ao buscar projeto:', error.message);
        document.getElementById('project-name').textContent = 'Erro ao carregar projeto.';
    }

    // Lógica para buscar e preencher os dados do PERFIL
    const profileForm = document.getElementById('profile-form');
    const welcomeMessage = document.getElementById('welcome-message');
    const emailDisplay = document.getElementById('email-display');
    const usernameInput = document.getElementById('username-input');
    const fullNameInput = document.getElementById('full_name-input');
    const websiteInput = document.getElementById('website-input');
    const editButton = document.getElementById('edit-button');
    const saveButton = document.getElementById('save-button');
    const logoutButton = document.getElementById('logout-button');
    const statusMessage = document.getElementById('form-status-message');
    const editableInputs = [usernameInput, fullNameInput, websiteInput];

    try {
        let { data: profile, error } = await supabase.from('profiles').select(`username, full_name, website`).eq('id', user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
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

    function enterEditMode() {
        editableInputs.forEach(input => input.disabled = false);
        editButton.classList.add('hidden');
        saveButton.classList.remove('hidden');
        statusMessage.textContent = 'Você agora pode editar seus dados.';
        statusMessage.style.color = 'var(--color-accent-blue)';
    }

    function exitEditMode() {
        editableInputs.forEach(input => input.disabled = true);
        editButton.classList.remove('hidden');
        saveButton.classList.add('hidden');
    }

    editButton.addEventListener('click', enterEditMode);
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';
        const updates = { id: user.id, username: usernameInput.value, full_name: fullNameInput.value, website: websiteInput.value, updated_at: new Date() };
        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) {
            statusMessage.textContent = 'Erro ao salvar: ' + error.message;
            statusMessage.style.color = 'red';
        } else {
            statusMessage.textContent = 'Perfil salvo com sucesso!';
            statusMessage.style.color = 'green';
            welcomeMessage.textContent = `Bem-vindo(a), ${updates.username || user.email}!`;
            exitEditMode();
        }
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Alterações';
    });
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    // Define o estado inicial da página
    setActiveLink(navLinkProjects);
    showContent(contentProjects);
}


/**
 * [VERSÃO CORRIGIDA COM REDIRECIONAMENTO INTELIGENTE]
 * Inicializa a lógica do formulário de Login.
 */
async function initLoginForm() { // Adicionado 'async'
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('#email').value;
        const password = loginForm.querySelector('#password').value;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            alert('Erro no login: ' + error.message);
        } else if (data.user) {
            // Após o login, busca o perfil para verificar a role
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                alert('Erro ao buscar perfil: ' + profileError.message);
            } else {
                alert('Login realizado com sucesso!');
                // Se o usuário for admin, redireciona para a página de admin
                if (profile && profile.role === 'admin') {
                    window.location.href = '/admin.html';
                } else {
                    // Senão, redireciona para o dashboard normal
                    window.location.href = '/dashboard.html';
                }
            }
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
        const fullName = signUpForm.querySelector('#full_name').value;
        const username = signUpForm.querySelector('#username').value;
        const email = signUpForm.querySelector('#email').value;
        const password = signUpForm.querySelector('#password').value;
        const passwordConfirm = signUpForm.querySelector('#password-confirm').value;

        if (password !== passwordConfirm) {
            alert('As senhas não coincidem. Por favor, tente novamente.');
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: fullName, username: username } }
        });

        // ...
        if (error) {
            alert('Erro ao criar a conta: ' + error.message);
               } else {
    alert('Conta criada com sucesso! Verifique seu email para confirmar.');
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

    fab.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        fabIconOpen.classList.toggle('hidden');
        fabIconClose.classList.toggle('hidden');
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
document.addEventListener('DOMContentLoaded', async () => {
    AOS.init({ duration: 800, once: true, offset: 50 });
    
    initMobileMenu();
    initContactForm();
    initAIChatWidget();
    initSignUpForm();
    initLoginForm();
    initForgotPasswordForm();
    initResetPasswordForm();
    
    await initDashboardPage();
    await updateUserNav();
    initAdminPage();
});