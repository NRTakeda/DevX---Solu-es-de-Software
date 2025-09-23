import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';

async function createPendingProject(description, userId) {
    showSuccessToast("Finalizando a criação do seu projeto a partir da sua ideia...");
    const { error } = await supabase.from('projects').insert({
        description: description,
        client_id: userId,
        // O DB já tem valores padrão para 'name' e 'status', então não precisamos enviá-los.
    });
    if (error) {
        showErrorToast('Erro ao criar seu projeto pendente.');
        console.error(error);
    } else {
        showSuccessToast('Seu novo projeto foi criado com sucesso!');
    }
    sessionStorage.removeItem('pendingProjectDescription');
}

export async function initDashboard() {
    // Seletor para garantir que o código só rode na página correta
    if (!document.getElementById('dashboard-container')) return;

    // Protege a página e obtém o usuário
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // Verifica e cria projeto pendente vindo da IA
    const pendingDescription = sessionStorage.getItem('pendingProjectDescription');
    if (pendingDescription) {
        await createPendingProject(pendingDescription, user.id);
    }
    
    // --- MAPEAMENTO DOS ELEMENTOS DO DOM ---
    const dashboardContainer = document.getElementById('dashboard-container');
    const welcomeMessage = document.getElementById('welcome-message');
    const navLinkProjects = document.getElementById('nav-link-projects');
    const navLinkProfile = document.getElementById('nav-link-profile');
    const contentProjects = document.getElementById('content-projects');
    const contentProfile = document.getElementById('content-profile');
    const sidebarPinBtn = document.getElementById('sidebar-pin-btn');
    const projectsListDiv = document.getElementById('projects-list');
    const createProjectSection = document.getElementById('criar-projeto');
    const limitWarningSection = document.getElementById('limite-projetos-aviso');
    const createProjectForm = document.getElementById('create-project-form');
    const descriptionTextarea = document.getElementById('project-description');
    const profileForm = document.getElementById('profile-form');
    const emailDisplay = document.getElementById('email-display');
    const usernameInput = document.getElementById('username-input');
    const editButton = document.getElementById('edit-button');
    const saveButton = document.getElementById('save-button');
    const logoutButton = document.getElementById('logout-button');
    const statusMessage = document.getElementById('form-status-message');
    
    welcomeMessage.textContent = `Bem-vindo(a), ${user.email}!`;

    // --- LÓGICA DE CONTROLE DA SIDEBAR ---
    function showContent(contentToShow) {
        [contentProjects, contentProfile].forEach(content => content.classList.add('hidden'));
        contentToShow.classList.remove('hidden');
    }
    function setActiveLink(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }
    navLinkProjects.addEventListener('click', (e) => { e.preventDefault(); setActiveLink(navLinkProjects); showContent(contentProjects); });
    navLinkProfile.addEventListener('click', (e) => { e.preventDefault(); setActiveLink(navLinkProfile); showContent(contentProfile); });
    sidebarPinBtn.addEventListener('click', () => {
        dashboardContainer.classList.toggle('sidebar-pinned');
        sidebarPinBtn.classList.toggle('pinned');
    });

    // --- LÓGICA DE PROJETOS ---
    async function renderProjects() {
        const { data: projects, error, count } = await supabase.from('projects').select('*', { count: 'exact' }).eq('client_id', user.id).order('created_at', { ascending: false });
        if (error) { showErrorToast('Erro ao carregar seus projetos.'); return; }
        projectsListDiv.innerHTML = '';
        if (projects.length === 0) {
            projectsListDiv.innerHTML = '<div class="card p-4 text-center"><p>Você ainda não solicitou nenhum projeto.</p></div>';
        } else {
            projects.forEach(project => {
                const projectCard = document.createElement('div');
                projectCard.className = 'card p-4 flex justify-between items-center flex-wrap gap-2';
                projectCard.innerHTML = `
                    <div class="flex-grow">
                        <h4 class="font-bold">${project.name}</h4>
                        <p class="text-sm text-gray-500">${(project.description || 'Sem descrição.').substring(0, 80)}...</p>
                    </div>
                    <span class="font-semibold text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">${project.status}</span>
                `;
                projectsListDiv.appendChild(projectCard);
            });
        }
        if (count >= 5) {
            createProjectSection.classList.add('hidden');
            limitWarningSection.classList.remove('hidden');
        } else {
            createProjectSection.classList.remove('hidden');
            limitWarningSection.classList.add('hidden');
        }
    }
    createProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const description = descriptionTextarea.value;
        if (description.length < 20) { showErrorToast('Por favor, descreva sua ideia com mais detalhes.'); return; }
        const submitButton = createProjectForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';
        const { error } = await supabase.from('projects').insert({ description: description, client_id: user.id });
        if (error) {
            showErrorToast('Erro ao enviar sua solicitação.');
        } else {
            showSuccessToast('Solicitação de projeto enviada com sucesso!');
            descriptionTextarea.value = '';
            await renderProjects();
        }
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Solicitação de Projeto';
    });

    // --- LÓGICA DE PERFIL ---
    async function loadProfile() {
        emailDisplay.value = user.email;
        const { data: profile, error } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        if (error && error.code !== 'PGRST116') {
            console.error('Erro ao buscar perfil:', error);
            showErrorToast('Não foi possível carregar seu perfil.');
            return;
        }
        if (profile) {
            usernameInput.value = profile.username || '';
            welcomeMessage.textContent = `Bem-vindo(a), ${profile.username || user.email}!`;
        }
    }
    function toggleEditMode(isEditing) {
        usernameInput.disabled = !isEditing;
        editButton.classList.toggle('hidden', isEditing);
        saveButton.classList.toggle('hidden', !isEditing);
    }
    editButton.addEventListener('click', () => toggleEditMode(true));
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';
        const { error } = await supabase.from('profiles').upsert({ id: user.id, username: usernameInput.value, updated_at: new Date() });
        if (error) {
            showErrorToast('Erro ao salvar o perfil.');
        } else {
            showSuccessToast('Perfil salvo com sucesso!');
            welcomeMessage.textContent = `Bem-vindo(a), ${usernameInput.value || user.email}!`;
            toggleEditMode(false);
        }
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar Alterações';
    });
    logoutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    // --- INICIALIZAÇÃO DA PÁGINA ---
    await Promise.all([renderProjects(), loadProfile()]); // Carrega dados de projetos e perfil em paralelo
    setActiveLink(navLinkProjects); // Define a aba "Projetos" como a inicial
    showContent(contentProjects); // Mostra o conteúdo de "Projetos"
}