import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';

async function createPendingProject(description, userId) {
    showSuccessToast("Finalizando a criação do seu projeto a partir da sua ideia...");

   const finalHtmlBlockIdentifier = '<p>Entendido. O próximo passo é criar seu projeto em nossa plataforma para que nossa equipe possa analisá-lo.</p><button id="';
    
    // Procura a posição desse trecho na descrição completa.
    const indexOfHtmlBlock = description.indexOf(finalHtmlBlockIdentifier);

    let cleanedDescription = description;

    // Se o trecho for encontrado, remove-o da descrição.
    if (indexOfHtmlBlock !== -1) {
        // Mantém apenas a parte da string ANTES do bloco de HTML.
        cleanedDescription = description.substring(0, indexOfHtmlBlock).trim();
    }
    
    // Usa a descrição já limpa ("cleanedDescription") para inserir no banco de dados.
    const { error } = await supabase.from('projects').insert({ description: cleanedDescription, client_id: userId });

    if (error) { 
        showErrorToast('Erro ao criar seu projeto pendente.'); 
        console.error(error); 
    } else { 
        showSuccessToast('Seu novo projeto foi criado com sucesso!'); 
    }
    sessionStorage.removeItem('pendingProjectDescription');
}

function createEditProjectModal() {
    const modalHTML = `
        <div id="edit-project-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <h3 class="text-xl font-semibold mb-4 dark:text-white">Editar Projeto</h3>
                <form id="edit-project-form">
                    <input type="hidden" id="edit-project-id">
                    <div class="mb-4">
                        <label for="edit-project-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome do Projeto</label>
                        <input type="text" id="edit-project-name" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white">
                    </div>
                    <div class="mb-4">
                        <label for="edit-project-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição</label>
                        <textarea id="edit-project-description" rows="4" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"></textarea>
                    </div>
                    <div class="flex justify-end space-x-3">
                        <button type="button" id="cancel-edit-project" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancelar</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    return document.getElementById('edit-project-modal');
}

export async function initDashboard() {
    if (!document.getElementById('dashboard-sidebar')) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    const pendingDescription = sessionStorage.getItem('pendingProjectDescription');
    if (pendingDescription) { await createPendingProject(pendingDescription, user.id); }
    
    const projectsCountSpan = document.getElementById('projects-count');
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
    
    const editModal = createEditProjectModal();
    const editForm = document.getElementById('edit-project-form');
    const cancelEditBtn = document.getElementById('cancel-edit-project');

    const toggleSidebar = () => {
        sidebar.classList.toggle('-translate-x-full');
        sidebarOverlay.classList.toggle('hidden');
    }
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

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

    async function renderProjects() {
        const { data: allProjects, error: projectsError } = await supabase 
            .from('projects')
            .select('*')
            .eq('client_id', user.id)
            .order('created_at', { ascending: false });

        const { count: activeProjectsCount, error: countError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', user.id)
            .not('status', 'eq', 'Rejeitado');

        if (projectsError || countError) { 
            showErrorToast('Erro ao carregar projetos.'); 
            console.error(projectsError || countError);
            if(projectsCountSpan) projectsCountSpan.textContent = "Erro ao carregar";
            return; 
        }

        if(projectsCountSpan) projectsCountSpan.textContent = `${allProjects.length} projeto(s) encontrado(s)`;
        
        projectsListDiv.innerHTML = '';

        if (allProjects.length === 0) {
            projectsListDiv.innerHTML = `<div class="card p-8 text-center"><h3 class="text-xl font-semibold mb-2">Nenhum projeto encontrado</h3><p class="text-gray-600">Você ainda não solicitou nenhum projeto.</p></div>`;
        } else {
            allProjects.forEach(project => {
                const projectCard = document.createElement('div');
                projectCard.className = 'card p-6';
                projectCard.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-grow">
                            <h3 class="text-xl font-semibold project-name">${project.name || 'Projeto Sem Nome'}</h3>
                            <p class="text-gray-500 text-sm">Criado em: ${new Date(project.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-medium ${
                            project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200' :
                            project.status === 'Aprovado' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' :
                            project.status === 'Rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }">${project.status}</span>
                    </div>
                    
                    <div class="mb-4">
                        <p class="text-gray-700 dark:text-gray-300 project-description">${project.description || 'Sem descrição'}</p>
                    </div>
                    
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                            ID: ${project.id.substring(0, 8)}...
                        </div>
                        <div class="space-x-2">
                            <button class="edit-project-btn text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 text-sm font-medium" 
                                    data-id="${project.id}"
                                    data-name="${project.name || ''}"
                                    data-description="${project.description || ''}">
                                Editar
                            </button>
                            <button data-id="${project.id}" class="delete-project-btn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-full" aria-label="Excluir projeto">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
                projectsListDiv.appendChild(projectCard);
            });
        }

        if (activeProjectsCount >= 5) {
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
        if (description.length < 20) { 
            showErrorToast('Por favor, descreva sua ideia com mais detalhes (mínimo 20 caracteres).'); 
            return; 
        }
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
        submitButton.textContent = 'Enviar Solicitação';
    });

    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-project-btn')) {
            const projectId = e.target.dataset.id;
            const projectName = e.target.dataset.name;
            const projectDescription = e.target.dataset.description;
            document.getElementById('edit-project-id').value = projectId;
            document.getElementById('edit-project-name').value = projectName;
            document.getElementById('edit-project-description').value = projectDescription;
            editModal.classList.remove('hidden');
        }
        const deleteButton = e.target.closest('.delete-project-btn');
        if (deleteButton) {
            const projectId = deleteButton.dataset.id;
            if (window.confirm("Você tem certeza que deseja excluir esta solicitação de projeto? Esta ação não pode ser desfeita.")) {
                const { error } = await supabase.from('projects').delete().eq('id', projectId).eq('client_id', user.id);
                if (error) {
                    showErrorToast("Erro ao excluir o projeto. Tente novamente.");
                    console.error("Erro de exclusão:", error);
                } else {
                    showSuccessToast("Projeto excluído com sucesso.");
                    await renderProjects();
                }
            }
        }
    });

    cancelEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectId = document.getElementById('edit-project-id').value;
        const name = document.getElementById('edit-project-name').value;
        const description = document.getElementById('edit-project-description').value;
        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        try {
            const { error } = await supabase.from('projects').update({ name: name, description: description }).eq('id', projectId).eq('client_id', user.id);
            if (error) throw error;
            showSuccessToast('Projeto atualizado com sucesso!');
            editModal.classList.add('hidden');
            await renderProjects();
        } catch (error) {
            console.error('Erro ao atualizar projeto:', error);
            showErrorToast('Erro ao atualizar projeto: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar';
        }
    });

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
    }

    editButton.addEventListener('click', () => toggleEditMode(true));
    
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true; 
        saveButton.textContent = 'Salvando...';
        const updates = { id: user.id, username: usernameInput.value, full_name: fullNameInput.value, website: websiteInput.value, updated_at: new Date() };
        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) { 
            showErrorToast('Erro ao salvar o perfil.'); 
        } else { 
            showSuccessToast('Perfil salvo com sucesso!'); 
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

    await Promise.all([renderProjects(), loadProfile()]);
    setActiveLink(navLinkProjects);
    showContent(contentProjects);
}