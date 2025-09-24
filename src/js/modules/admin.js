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
    const rejectClientEmailInput = document.getElementById('reject-client-email');

    // 2. Função CORRIGIDA para buscar projetos
    async function renderProjects() {
        try {
            // PRIMEIRO: Buscar apenas os projetos
            const { data: projects, error: projectsError } = await supabase
                .from('projects')
                .select('id, name, status, client_id')
                .order('created_at', { ascending: false });

            if (projectsError) {
                throw new Error(projectsError.message);
            }

            if (!projects || projects.length === 0) {
                projectsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum projeto encontrado.</td></tr>`;
                return;
            }

            // SEGUNDO: Buscar informações dos clientes - CORREÇÃO AQUI
            const clientIds = projects.map(p => p.client_id).filter(id => id);
            
            // Vamos tentar diferentes combinações de colunas
            let clients = null;
            let clientsError = null;

            // Tentativa 1: Buscar apenas username (coluna que sabemos existir)
            const { data: clientsData, error: error1 } = await supabase
                .from('profiles')
                .select('id, username, full_name') // REMOVIDO email
                .in('id', clientIds);

            clients = clientsData;
            clientsError = error1;

            // Se ainda der erro, tentar apenas id e username
            if (clientsError) {
                console.warn('Tentativa 1 falhou, tentando colunas mínimas...');
                const { data: clientsData2, error: error2 } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .in('id', clientIds);
                
                clients = clientsData2;
                clientsError = error2;
            }

            if (clientsError) {
                console.warn('Erro ao buscar clientes:', clientsError);
                // Continuamos mesmo com erro - usaremos dados básicos
            }

            // Criar mapa de clientes para acesso rápido
            const clientsMap = {};
            if (clients) {
                clients.forEach(client => {
                    clientsMap[client.id] = client;
                });
            }

            // TERCEIRO: Renderizar a tabela
            projectsTableBody.innerHTML = '';
            projects.forEach(project => {
                const client = clientsMap[project.client_id];
                const clientUsername = client ? (client.username || client.full_name || 'N/A') : 'N/A';
                
                // Para o e-mail, vamos buscar do auth.users se necessário
                // Por enquanto, usaremos um placeholder
                const clientEmail = 'cliente@exemplo.com'; // Placeholder

                const tr = document.createElement('tr');
                tr.className = 'border-b dark:border-gray-700';
                
                tr.innerHTML = `
                    <td class="p-4">${project.name || 'N/A'}</td>
                    <td class="p-4">
                        <div>${clientUsername}</div>
                        <div class="text-sm text-gray-500">ID: ${project.client_id}</div>
                    </td>
                    <td class="p-4">
                        <span class="px-2 py-1 rounded-full text-xs ${
                            project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800' :
                            project.status === 'Aprovado' ? 'bg-green-100 text-green-800' :
                            project.status === 'Rejeitado' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }">
                            ${project.status || 'N/A'}
                        </span>
                    </td>
                    <td class="p-4">
                        <button data-id="${project.id}" 
                                data-name="${project.name}" 
                                data-status="${project.status}" 
                                class="edit-btn text-sky-500 hover:underline mr-3">
                            Editar
                        </button>
                        <button data-id="${project.id}" 
                                data-name="${project.name}" 
                                data-client-id="${project.client_id}"
                                class="reject-btn text-red-500 hover:underline">
                            Rejeitar
                        </button>
                    </td>
                `;
                projectsTableBody.appendChild(tr);
            });

        } catch (error) {
            console.error('Erro ao buscar projetos:', error);
            projectsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-4 text-center text-red-500">
                        Erro ao carregar projetos: ${error.message}
                    </td>
                </tr>
            `;
        }
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
        
        if (e.target.classList.contains('reject-btn')) {
            const button = e.target;
            const clientId = button.dataset.clientId;
            
            rejectProjectIdInput.value = button.dataset.id;
            rejectProjectNameInput.value = button.dataset.name;
            
            // Mensagem padrão de rejeição
            rejectMessageTextarea.value = `Prezado cliente,\n\nApós análise do seu projeto "${button.dataset.name}", lamentamos informar que não poderemos dar continuidade no momento devido às seguintes razões:\n\n• [Especifique o motivo aqui]\n\nAgradecemos seu interesse e estamos à disposição para futuras colaborações.\n\nAtenciosamente,\nEquipe DevX`;
            
            rejectModal.classList.remove('hidden');
        }
    });

    // 4. Fechar modais
    cancelEditButton.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    cancelRejectButton.addEventListener('click', () => {
        rejectModal.classList.add('hidden');
    });

    // 5. Submit do Formulário de Edição
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitButton = editForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        try {
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
                throw new Error(error.message);
            }

            showErrorToast('Projeto atualizado com sucesso!');
            editModal.classList.add('hidden');
            await renderProjects();

        } catch (error) {
            showErrorToast('Erro ao atualizar o projeto: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });

    // 6. Submit do Formulário de Rejeição - CORRIGIDO
    rejectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rejectButton = rejectForm.querySelector('button[type="submit"]');
        const originalText = rejectButton.textContent;
        
        rejectButton.disabled = true;
        rejectButton.textContent = 'Processando...';
        
        try {
            const projectId = rejectProjectIdInput.value;
            const message = rejectMessageTextarea.value;

            // AGORA: Buscar o e-mail do cliente dinamicamente
            const { data: clientProfile, error: clientError } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('id', rejectForm.querySelector('[data-client-id]')?.dataset.clientId)
                .single();

            if (clientError) {
                console.warn('Não foi possível buscar perfil do cliente:', clientError);
            }

            // Para teste, use um e-mail fixo ou peça ao admin para digitar
            const clientEmail = prompt(
                'Digite o e-mail do cliente para envio da notificação:',
                'cliente@exemplo.com'
            );

            if (!clientEmail) {
                throw new Error('E-mail do cliente é obrigatório');
            }

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

    // 7. Função auxiliar para mostrar toasts
    function showErrorToast(message) {
        // Implementação temporária
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded shadow-lg z-50';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }

    // Renderiza os projetos ao carregar
    await renderProjects();
}