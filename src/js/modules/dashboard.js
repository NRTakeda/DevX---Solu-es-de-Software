import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';

/**
 * Cria um novo projeto no Supabase a partir dos dados salvos no sessionStorage.
 * @param {string} description - O resumo da conversa com a IA.
 * @param {string} userId - O ID do usuário autenticado.
 */
async function createPendingProject(description, userId) {
    showSuccessToast("Finalizando a criação do seu projeto a partir da sua ideia...");

    const { error } = await supabase
        .from('projects')
        .insert({
            description: description,
            client_id: userId,
            name: "Projeto via Consultor IA" // Nome padrão para projetos criados pela IA
        });

    if (error) {
        showErrorToast('Erro ao criar seu projeto pendente. Por favor, tente novamente.');
        console.error(error);
    } else {
        showSuccessToast('Seu novo projeto foi criado com sucesso!');
    }

    // CRUCIAL: Limpa a ideia pendente para não ser criada novamente
    sessionStorage.removeItem('pendingProjectDescription');
}

/**
 * Função principal que inicializa a página do Dashboard.
 */
export async function initDashboard() {
    const welcomeMessage = document.getElementById('welcome-message');
    if (!welcomeMessage) return; // Garante que o código só rode na página do dashboard

    // Protege a página, redirecionando se o usuário não estiver logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // --- LÓGICA DA FASE 3: VERIFICA E CRIA O PROJETO PENDENTE ---
    const pendingDescription = sessionStorage.getItem('pendingProjectDescription');
    if (pendingDescription) {
        // Se encontrou uma ideia pendente, chama a função para criar o projeto
        await createPendingProject(pendingDescription, user.id);
    }
    
    // --- LÓGICA DO DASHBOARD ---
    const projectsListDiv = document.getElementById('projects-list');
    const createProjectSection = document.getElementById('criar-projeto');
    const limitWarningSection = document.getElementById('limite-projetos-aviso');
    const createProjectForm = document.getElementById('create-project-form');
    const descriptionTextarea = document.getElementById('project-description');
    
    welcomeMessage.textContent = `Bem-vindo(a), ${user.email}!`;

    // Função interna para buscar e renderizar os projetos na tela
    async function renderProjects() {
        const { data: projects, error, count } = await supabase
            .from('projects')
            .select('*', { count: 'exact' }) // Pede para contar o total de projetos
            .eq('client_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            showErrorToast('Erro ao carregar seus projetos.');
            projectsListDiv.innerHTML = '<p class="text-red-500">Não foi possível carregar os projetos.</p>';
            return;
        }

        projectsListDiv.innerHTML = ''; // Limpa a lista antes de renderizar

        if (projects.length === 0) {
            projectsListDiv.innerHTML = '<div class="card p-4 text-center"><p>Você ainda não solicitou nenhum projeto.</p></div>';
        } else {
            projects.forEach(project => {
                const projectCard = document.createElement('div');
                projectCard.className = 'card p-4 flex justify-between items-center flex-wrap gap-2';
                projectCard.innerHTML = `
                    <div class="flex-grow">
                        <h4 class="font-bold">${project.name}</h4>
                        <p class="text-sm text-gray-500">${project.description.substring(0, 80)}...</p>
                    </div>
                    <span class="font-semibold text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">${project.status}</span>
                `;
                projectsListDiv.appendChild(projectCard);
            });
        }
        
        // Controla a exibição do formulário com base no limite de 5 projetos
        if (count >= 5) {
            createProjectSection.classList.add('hidden');
            limitWarningSection.classList.remove('hidden');
        } else {
            createProjectSection.classList.remove('hidden');
            limitWarningSection.classList.add('hidden');
        }
    }

    // Lógica para o formulário de criação manual de projetos
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

        const { error } = await supabase
            .from('projects')
            .insert({
                description: description,
                client_id: user.id
            });

        if (error) {
            showErrorToast('Erro ao enviar sua solicitação. Tente novamente.');
        } else {
            showSuccessToast('Solicitação de projeto enviada com sucesso!');
            descriptionTextarea.value = '';
            await renderProjects(); // Atualiza a lista de projetos na tela
        }
        
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Solicitação de Projeto';
    });

    // Chama a função para renderizar tudo ao carregar a página
    await renderProjects();
}