import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';

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

    // 2. Função para buscar e renderizar projetos
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

            // SEGUNDO: Buscar informações dos clientes
            const clientIds = projects.map(p => p.client_id).filter(id => id);
            
            const { data: clients, error: clientsError } = await supabase
                .from('profiles')
                .select('id, username, full_name')
                .in('id', clientIds);

            if (clientsError) {
                console.warn('Erro ao buscar clientes:', clientsError);
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

                const tr = document.createElement('tr');
                tr.className = 'border-b dark:border-gray-700';
                
                tr.innerHTML = `
                    <td class="p-4">${project.name || 'N/A'}</td>
                    <td class="p-4">
                        <div>${clientUsername}</div>
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

    // 3. Lógica de Clique nos Botões - CORREÇÃO DA BUSCA DE E-MAIL
    projectsTableBody.addEventListener('click', async (e) => {
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
            
            // CORREÇÃO: Buscar e-mail usando a função admin do Supabase
            try {
                // Método 1: Usando admin API (mais confiável)
                const { data: authData, error: authError } = await supabase.auth.admin.getUserById(clientId);
                
                if (authError) {
                    console.warn('Erro ao buscar e-mail via admin:', authError);
                    
                    // Método 2: Buscar via RPC function se disponível
                    const { data: rpcData, error: rpcError } = await supabase
                        .rpc('get_user_email', { user_id: clientId });
                    
                    if (!rpcError && rpcData) {
                        rejectClientEmailInput.value = rpcData;
                    } else {
                        // Método 3: Buscar de tabela customizada se existir
                        const { data: customData, error: customError } = await supabase
                            .from('user_emails') // ou outra tabela customizada
                            .select('email')
                            .eq('user_id', clientId)
                            .single();
                        
                        if (!customError && customData) {
                            rejectClientEmailInput.value = customData.email;
                        } else {
                            throw new Error('Não foi possível encontrar o e-mail automaticamente');
                        }
                    }
                } else if (authData && authData.user && authData.user.email) {
                    // Sucesso - e-mail encontrado via admin API
                    rejectClientEmailInput.value = authData.user.email;
                } else {
                    throw new Error('E-mail não encontrado no perfil do usuário');
                }

                rejectProjectIdInput.value = button.dataset.id;
                rejectProjectNameInput.value = button.dataset.name;
                
                // Mensagem padrão de rejeição
                rejectMessageTextarea.value = `Prezado cliente,\n\nApós análise do seu projeto "${button.dataset.name}", lamentamos informar que não poderemos dar continuidade no momento devido às seguintes razões:\n\n• [Especifique o motivo aqui]\n\nAgradecemos seu interesse e estamos à disposição para futuras colaborações.\n\nAtenciosamente,\nEquipe DevX`;
                
                rejectModal.classList.remove('hidden');

            } catch (error) {
                console.error('Erro ao buscar e-mail:', error);
                
                // Fallback: pedir e-mail manualmente
                const clientEmail = prompt(
                    `E-mail do cliente não encontrado automaticamente. \n\nDigite o e-mail para notificação do projeto "${button.dataset.name}":`,
                    'cliente@exemplo.com'
                );
                
                if (clientEmail && clientEmail.includes('@')) {
                    rejectClientEmailInput.value = clientEmail;
                    rejectProjectIdInput.value = button.dataset.id;
                    rejectProjectNameInput.value = button.dataset.name;
                    rejectMessageTextarea.value = `Prezado cliente,\n\nApós análise do seu projeto "${button.dataset.name}", lamentamos informar que não poderemos dar continuidade no momento devido às seguintes razões:\n\n• [Especifique o motivo aqui]\n\nAgradecemos seu interesse e estamos à disposição para futuras colaborações.\n\nAtenciosamente,\nEquipe DevX`;
                    rejectModal.classList.remove('hidden');
                } else {
                    showErrorToast('E-mail do cliente é necessário para rejeitar o projeto.');
                }
            }
        }
    });

    // 4. Fechar Modais
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

            showSuccessToast('Projeto atualizado com sucesso!');
            editModal.classList.add('hidden');
            await renderProjects();

        } catch (error) {
            showErrorToast('Erro ao atualizar o projeto: ' + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });

    // 6. Submit do Formulário de Rejeição
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
            const { data: { session } } = await supabase.auth.getSession();

            if (!clientEmail || !clientEmail.includes('@')) {
                throw new Error('E-mail do cliente inválido');
            }

            const response = await fetch('/api/reject-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
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

            // Atualizar status do projeto para "Rejeitado"
            const { error: updateError } = await supabase
                .from('projects')
                .update({ status: 'Rejeitado' })
                .eq('id', projectId);

            if (updateError) {
                console.error('Erro ao atualizar status:', updateError);
            }

            showSuccessToast('Projeto rejeitado e notificação enviada com sucesso!');
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

    // 7. Renderiza os projetos ao carregar
    await renderProjects();
}