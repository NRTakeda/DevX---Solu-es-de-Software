import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';

export async function initAdmin() {
    const projectsTableBody = document.getElementById('projects-table-body');
    if (!projectsTableBody) return;

    // 1. Proteger a página (código existente, está correto)
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

    // Elementos dos modais
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

    // 2. Função para buscar e renderizar projetos (código existente, está correto)
    async function renderProjects() {
        try {
            const { data: projects, error: projectsError } = await supabase
                .from('projects')
                .select('id, name, status, client_id, profiles ( id, username, full_name )') // Otimizado para buscar dados do cliente
                .order('created_at', { ascending: false });

            if (projectsError) throw projectsError;

            if (!projects || projects.length === 0) {
                projectsTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Nenhum projeto encontrado.</td></tr>`;
                return;
            }

            projectsTableBody.innerHTML = '';
            projects.forEach(project => {
                const clientUsername = project.profiles ? (project.profiles.username || project.profiles.full_name || 'N/A') : 'N/A';

                const tr = document.createElement('tr');
                tr.className = 'border-b dark:border-gray-700';
                
                tr.innerHTML = `
                    <td class="p-4">${project.name || 'N/A'}</td>
                    <td class="p-4"><div>${clientUsername}</div></td>
                    <td class="p-4">
                        <span class="px-2 py-1 rounded-full text-xs ${
                            project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800' :
                            project.status === 'Aprovado' ? 'bg-green-100 text-green-800' :
                            project.status === 'Rejeitado' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }">${project.status || 'N/A'}</span>
                    </td>
                    <td class="p-4">
                        <button data-id="${project.id}" data-name="${project.name}" data-status="${project.status}" class="edit-btn text-sky-500 hover:underline mr-3">Editar</button>
                        <button data-id="${project.id}" data-name="${project.name}" class="reject-btn text-red-500 hover:underline">Rejeitar</button>
                    </td>
                `;
                projectsTableBody.appendChild(tr);
            });

        } catch (error) {
            console.error('Erro ao buscar projetos:', error);
            projectsTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Erro ao carregar projetos: ${error.message}</td></tr>`;
        }
    }

    // 3. Lógica de Clique nos Botões (SIMPLIFICADA)
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
            
            // Apenas preenche o modal com a informação que já temos (ID e nome do projeto)
            rejectProjectIdInput.value = button.dataset.id;
            rejectProjectNameInput.value = button.dataset.name;
            
            // Mensagem padrão de rejeição
            rejectMessageTextarea.value = `Prezado cliente,\n\nAgradecemos o interesse em nosso trabalho. Após uma análise do seu projeto "${button.dataset.name}", informamos que não poderemos dar continuidade no momento devido a:\n\n• [Especifique o motivo aqui]\n\nAtenciosamente,\nEquipe DevX`;
            
            rejectModal.classList.remove('hidden');
        }
    });

    // 4. Fechar Modais (código existente, está correto)
    cancelEditButton.addEventListener('click', () => editModal.classList.add('hidden'));
    cancelRejectButton.addEventListener('click', () => rejectModal.classList.add('hidden'));

    // 5. Submit do Formulário de Edição (código existente, está correto)
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        try {
            const id = projectIdInput.value;
            const updatedData = { name: projectNameInput.value, status: projectStatusInput.value };
            const { error } = await supabase.from('projects').update(updatedData).eq('id', id);
            if (error) throw error;
            showSuccessToast('Projeto atualizado com sucesso!');
            editModal.classList.add('hidden');
            await renderProjects();
        } catch (error) {
            showErrorToast('Erro ao atualizar o projeto: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Alterações';
        }
    });

    // 6. Submit do Formulário de Rejeição (SIMPLIFICADO)
    rejectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rejectButton = rejectForm.querySelector('button[type="submit"]');
        rejectButton.disabled = true;
        rejectButton.textContent = 'Processando...';
        
        try {
            const projectId = rejectProjectIdInput.value;
            const message = rejectMessageTextarea.value;
            const { data: { session } } = await supabase.auth.getSession();

            // O front-end não precisa mais saber o e-mail do cliente
            const response = await fetch('/api/reject-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    projectId,
                    message,
                    adminId: user.id
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Erro no servidor ao rejeitar projeto');
            
            // Opcional: Atualizar o status localmente para refletir a mudança, ou renderizar novamente
            await renderProjects(); 
            showSuccessToast('Projeto rejeitado e notificação enviada com sucesso!');
            rejectModal.classList.add('hidden');

        } catch (error) {
            console.error('Erro ao rejeitar projeto:', error);
            showErrorToast(error.message);
        } finally {
            rejectButton.disabled = false;
            rejectButton.innerHTML = `
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                Confirmar Rejeição`;
        }
    });

    // 7. Renderiza os projetos ao carregar
    await renderProjects();
}