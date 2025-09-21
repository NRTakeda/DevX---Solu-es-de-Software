import { supabase } from '../supabaseClient.js';

export async function initDashboard() {
    // Seletor para garantir que o código só rode na página do dashboard
    const navLinkProjects = document.getElementById('nav-link-projects');
    if (!navLinkProjects) return;

    // --- ELEMENTOS DO DOM ---
    const navLinkProfile = document.getElementById('nav-link-profile');
    const contentProjects = document.getElementById('content-projects');
    const contentProfile = document.getElementById('content-profile');
    
    // --- LÓGICA DE NAVEGAÇÃO DA SIDEBAR ---
    function showContent(contentToShow) {
        [contentProjects, contentProfile].forEach(content => content.classList.add('hidden'));
        contentToShow.classList.remove('hidden');
    }

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // Lógica para buscar e preencher os dados do PROJETO
    try {
        const projectNameEl = document.getElementById('project-name');
        const projectStatusEl = document.getElementById('project-status');
        let { data: project, error } = await supabase.from('projects').select('name, status').eq('client_id', user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        
        if (project) {
            projectNameEl.textContent = project.name;
            projectStatusEl.textContent = project.status;
            if (project.status === 'Concluído') projectStatusEl.classList.add('text-green-500');
            else if (project.status === 'Em Desenvolvimento') projectStatusEl.classList.add('text-orange-500');
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
        
        welcomeMessage.textContent = `Bem-vindo(a), ${profile?.username || user.email}!`;
        emailDisplay.value = user.email;
        if (profile) {
            usernameInput.value = profile.username || '';
            fullNameInput.value = profile.full_name || '';
            websiteInput.value = profile.website || '';
        }
    } catch (error) {
        console.error('Erro ao buscar perfil:', error.message);
        statusMessage.textContent = 'Erro ao carregar perfil.';
        statusMessage.classList.add('text-red-500');
    }

    function toggleEditMode(isEditing) {
        editableInputs.forEach(input => input.disabled = !isEditing);
        editButton.classList.toggle('hidden', isEditing);
        saveButton.classList.toggle('hidden', !isEditing);
        statusMessage.textContent = isEditing ? 'Você agora pode editar seus dados.' : '';
        statusMessage.classList.remove('text-red-500', 'text-green-500');
    }

    editButton.addEventListener('click', () => toggleEditMode(true));

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = 'Salvando...';
        
        const updates = { id: user.id, username: usernameInput.value, full_name: fullNameInput.value, website: websiteInput.value, updated_at: new Date() };
        const { error } = await supabase.from('profiles').upsert(updates);
        
        if (error) {
            statusMessage.textContent = 'Erro ao salvar: ' + error.message;
            statusMessage.classList.add('text-red-500');
        } else {
            statusMessage.textContent = 'Perfil salvo com sucesso!';
            statusMessage.classList.add('text-green-500');
            welcomeMessage.textContent = `Bem-vindo(a), ${updates.username || user.email}!`;
            toggleEditMode(false);
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