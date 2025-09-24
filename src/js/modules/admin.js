import { supabase } from '../supabaseClient.js';

export async function initAdmin() {
    const projectsTableBody = document.getElementById('projects-table-body');
    if (!projectsTableBody) return;

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
        showErrorToast('Acesso negado.');
        window.location.href = '/dashboard.html';
        return;
    }

    // Elementos dos modais (mantidos do código anterior)
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-project-form');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const projectIdInput = document.getElementById('edit-project-id');
    const projectNameInput = document.getElementById('edit-project-name');
    const projectStatusInput = document.getElementById('edit-project-status');

    const rejectModal = document.getElementById('reject-modal');
    const rejectForm = document.getElementById('reject-project-form');
    const cancelRejectButton = document.getElementById('cancel-reject-button');
    const rejectProjectIdInput = document.getElementById('reject-project-id');
    const rejectProjectNameInput = document.getElementById('reject-project-name');
    const rejectMessageTextarea = document.getElementById('reject-message');
    const rejectClientEmailInput = document.getElementById('reject-client-email');

    // 2. Função CORRIGIDA para buscar e renderizar projetos
    async function renderProjects() {
        // QUERY CORRIGIDA - sintaxe correta para relacionamentos
        const { data: projects, error } = await supabase
            .from('projects')
            .select(`
                id, 
                name, 
                status, 
                client_id,
                profiles (
                    username, 
                    email
                )
            `);

        if (error) {
            console.error('Erro ao buscar projetos:', error);
            projectsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar projetos: ${error.message}</td></tr>`;
            return;
        }

        if (!projects || projects.length === 0) {
            projectsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum projeto encontrado.</td></tr>`;
            return;
        }

        projectsTableBody.innerHTML = '';
        projects.forEach(project => {
            const tr = document.createElement('tr');
            tr.className = 'border-b dark:border-gray-700';
            
            // Acesso CORRIGIDO aos dados do perfil
            const clientUsername = project.profiles ? project.profiles.username : 'N/A';
            const clientEmail = project.profiles ? project.profiles.email : '';

            tr.innerHTML = `
                <td class="p-4">${project.name || 'N/A'}</td>
                <td class="p-4">${clientUsername}</td>
                <td class="p-4">${project.status || 'N/A'}</td>
                <td class="p-4">
                    <button data-id="${project.id}" 
                            data-name="${project.name}" 
                            data-status="${project.status}" 
                            class="edit-btn text-sky-500 hover:underline mr-3">
                        Editar
                    </button>
                    <button data-id="${project.id}" 
                            data-name="${project.name}" 
                            data-client-email="${clientEmail}" 
                            class="reject-btn text-red-500 hover:underline">
                        Rejeitar
                    </button>
                </td>
            `;
            projectsTableBody.appendChild(tr);
        });
    }

    // 3. Lógica de Edição (mantida)
    projectsTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            const button = e.target;
            projectIdInput.value = button.dataset.id;
            projectNameInput.value = button.dataset.name;
            projectStatusInput.value = button.dataset.status;
            editModal.classList.remove('hidden');
        }
        
        if (e.target.classList.contains('reject-btn')) {
            const button = e.target;
            rejectProjectIdInput.value = button.dataset.id;
            rejectProjectNameInput.value = button.dataset.name;
            rejectClientEmailInput.value = button.dataset.clientEmail;
            
            // Mensagem padrão de rejeição
            rejectMessageTextarea.value = `Prezado cliente,\n\nApós análise do seu projeto "${button.dataset.name}", lamentamos informar que não poderemos dar continuidade no momento devido às seguintes razões:\n\n• [Especifique o motivo aqui]\n\nAgradecemos seu interesse e estamos à disposição para futuras colaborações.\n\nAtenciosamente,\nEquipe DevX`;
            
            rejectModal.classList.remove('hidden');
        }
    });

    // 4. Fechar modais (mantido)
    cancelEditButton.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    cancelRejectButton.addEventListener('click', () => {
        rejectModal.classList.add('hidden');
    });

    // 5. Submit do Formulário de Edição (mantido)
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
            showErrorToast('Erro ao atualizar o projeto: ' + error.message);
        } else {
            showErrorToast('Projeto atualizado com sucesso!');
            editModal.classList.add('hidden');
            await renderProjects();
        }
    });

    // 6. Submit do Formulário de Rejeição (NOVO - corrigido)
    rejectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rejectButton = rejectForm.querySelector('button[type="submit"]');
        const originalText = rejectButton.textContent;
        
        rejectButton.disabled = true;
        rejectButton.textContent = 'Processando...';
        
        try {
            const projectId = rejectProjectIdInput.value;
            const clientEmail = rejectClientEmailInput.value;
            const message = rejectMessageTextarea.value;

            const response = await fetch('/api/reject-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({
                    projectId,
                    clientEmail,
                    message,
                    adminId: user.id
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro ao rejeitar projeto');
            }

            showErrorToast('Projeto rejeitado e notificação enviada com sucesso!');
            rejectModal.classList.add('hidden');
            await renderProjects();

        } catch (error) {
            console.error('Erro ao rejeitar projeto:', error);
            showErrorToast(error.message || 'Erro ao rejeitar projeto');
        } finally {
            rejectButton.disabled = false;
            rejectButton.textContent = originalText;
        }
    });

    // 7. Função auxiliar para mostrar toasts (se não existir)
    function showErrorToast(message) {
        // Se você já tem um sistema de toasts, use-o
        // Caso contrário, implemente um simples:
        alert(message); // Temporário - substitua por seu sistema de toasts
    }

    // Renderiza os projetos ao carregar
    await renderProjects();
}