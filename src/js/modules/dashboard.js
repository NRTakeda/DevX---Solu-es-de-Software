import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';

async function createPendingProject(description, userId) {
    showSuccessToast("Finalizando a criação do seu projeto a partir da sua ideia...");
    const { error } = await supabase.from('projects').insert({
        description: description,
        client_id: userId,
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
    // Garante que o código só execute na página do dashboard.
    if (!document.getElementById('dashboard-sidebar')) return;

    // --- AUTENTICAÇÃO E VERIFICAÇÃO DE PROJETO PENDENTE ---
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    const pendingDescription = sessionStorage.getItem('pendingProjectDescription');
    if (pendingDescription) {
        await createPendingProject(pendingDescription, user.id);
    }
    
    // --- MAPEAMENTO DOS ELEMENTOS DO DOM ---
    const sidebar = document.getElementById('dashboard-sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const welcomeMessage = document.getElementById('welcome-message');
    const navLinkProjects = document.getElementById('nav-link-projects');
    const navLinkProfile = document.getElementById('nav-link-profile');
    const contentProjects = document.getElementById('content-projects');
    const contentProfile = document.getElementById('content-profile');
    const projectsListDiv = document.getElementById('projects-list');
    const createProjectSection = document.getElementById('criar-projeto');
    const limitWarningSection = document.getElementById('limite-projetos-aviso');
    const createProjectForm = document.getElementById('create-project-form');
    const descriptionTextarea = document.getElementById('project-description');
    const profileForm = document.getElementById('profile-form');
    const emailDisplay = document.getElementById('email-display');
    const usernameInput = document.getElementById('username-input');
    const fullNameInput = document.getElementById('full_name-input');
    const websiteInput = document.getElementById('website-input');
    const editButton = document.getElementById('edit-button');
    const saveButton = document.getElementById('save-button');
    const logoutButton = document.getElementById('logout-button');
    const statusMessage = document.getElementById('form-status-message');
    
    // --- LÓGICA DA SIDEBAR RESPONSIVA ---
    const toggleSidebar = () => {
        sidebar.classList.toggle('-translate-x-full');
        sidebarOverlay.classList.toggle('hidden');
    }
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    // --- LÓGICA DE NAVEGAÇÃO INTERNA (PROJETOS / PERFIL) ---
    function showContent(contentToShow) {
        [contentProjects, contentProfile].forEach(c => c.classList.add('hidden'));
        contentToShow.classList.remove('hidden');
    }
    function setActiveLink(activeLink) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        activeLink.classList.add('active');
    }
    navLinkProjects.addEventListener('click', (e) => { e.preventDefault(); setActiveLink(navLinkProjects); showContent(contentProjects); });
    navLinkProfile.addEventListener('click', (e) => { e.preventDefault(); setActiveLink(navLinkProfile); showContent(contentProfile); });

    // --- LÓGICA DE PROJETOS ---
    async function renderProjects() {
        const { data: projects, error, count } = await supabase.from('projects').select('*', { count: 'exact' }).eq('client_id', user.id).order('created_at', { ascending: false });
        if (error) { showErrorToast('Erro ao carregar projetos.'); return; }
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
        if (error) { showErrorToast('Erro ao enviar sua solicitação.'); }
        else { showSuccessToast('Solicitação de projeto enviada com sucesso!'); descriptionTextarea.value = ''; await renderProjects(); }
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Solicitação';
    });

    // --- LÓGICA DE PERFIL ---
    const profileInputs = [usernameInput, fullNameInput, websiteInput];
    async function loadProfile() {
        emailDisplay.value = user.email;
        const { data: profile } = await supabase.from('profiles').select('username, full_name, website').eq('id', user.id).single();
        if (profile) {
            usernameInput.value = profile.username || '';
            fullNameInput.value = profile.full_name || '';
            websiteInput.value = profile.website || '';
            welcomeMessage.textContent = `Bem-vindo(a), ${profile.username || user.email}!`;
        } else {
            welcomeMessage.textContent = `Bem-vindo(a), ${user.email}!`;
        }
    }
    function toggleEditMode(isEditing) {
        profileInputs.forEach(input => input.disabled = !isEditing);
        editButton.classList.toggle('hidden', isEditing);
        saveButton.classList.toggle('hidden', !isEditing);
        statusMessage.textContent = isEditing ? 'Você pode editar seus dados.' : '';
    }
    editButton.addEventListener('click', () => toggleEditMode(true));
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true; saveButton.textContent = 'Salvando...';
        const updates = { id: user.id, username: usernameInput.value, full_name: fullNameInput.value, website: websiteInput.value, updated_at: new Date() };
        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) { showErrorToast('Erro ao salvar o perfil.'); }
        else { showSuccessToast('Perfil salvo com sucesso!'); welcomeMessage.textContent = `Bem-vindo(a), ${updates.username || user.email}!`; toggleEditMode(false); }
        saveButton.disabled = false; saveButton.textContent = 'Salvar Alterações';
    });
    logoutButton.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.href = '/login.html'; });

    // --- INICIALIZAÇÃO DA PÁGINA ---
    await Promise.all([renderProjects(), loadProfile()]);
    setActiveLink(navLinkProjects);
    showContent(contentProjects);
}