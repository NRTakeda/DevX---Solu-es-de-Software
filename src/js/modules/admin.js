import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';

export async function initAdmin() {
    const projectsTableBody = document.getElementById('projects-table-body');
    const cardsContainer = document.getElementById('projects-cards');
    if (!projectsTableBody && !cardsContainer) return;

    // proteção admin
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

    // modais
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-project-form');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const projectIdInput = document.getElementById('edit-project-id');
    const projectNameInput = document.getElementById('edit-project-name');
    const projectDescriptionInput = document.getElementById('edit-project-description');
    const projectStatusInput = document.getElementById('edit-project-status');

    const rejectModal = document.getElementById('reject-modal');
    const rejectForm = document.getElementById('reject-project-form');
    const cancelRejectButton = document.getElementById('cancel-reject-button');
    const rejectProjectIdInput = document.getElementById('reject-project-id');
    const rejectProjectNameInput = document.getElementById('reject-project-name');
    const rejectMessageTextarea = document.getElementById('reject-message');

    // helper truncar
    function buildDescription(fullText, length = 50) {
        if (!fullText) return 'Sem descrição';
        if (fullText.length <= length) return fullText;

        const shortText = fullText.substring(0, length) + '...';
        return `
            <span class="short-desc">${shortText}</span>
            <span class="full-desc hidden">${fullText}</span>
            <button class="toggle-desc text-sky-500 hover:underline ml-1">Ver mais</button>
        `;
    }

    // render projetos
    async function renderProjects() {
        try {
            const { data: projects, error: projectsError } = await supabase
                .from('projects')
                .select('id, name, description, status, client_id, profiles ( id, username, full_name )')
                .not('status', 'eq', 'Rejeitado')
                .order('created_at', { ascending: false });

            if (projectsError) throw projectsError;

            if (!projects || projects.length === 0) {
                if (projectsTableBody)
                    projectsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum projeto ativo encontrado.</td></tr>`;
                if (cardsContainer)
                    cardsContainer.innerHTML = `<p class="text-center text-gray-500">Nenhum projeto ativo encontrado.</p>`;
                return;
            }

            if (projectsTableBody) projectsTableBody.innerHTML = '';
            if (cardsContainer) cardsContainer.innerHTML = '';

            projects.forEach(project => {
                const clientUsername = project.profiles ? (project.profiles.username || project.profiles.full_name || 'N/A') : 'N/A';

                // tabela
                if (projectsTableBody) {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b dark:border-gray-700';
                    tr.innerHTML = `
                        <td class="p-4">${project.name || 'N/A'}</td>
                        <td class="p-4">${clientUsername}</td>
                        <td class="p-4">${buildDescription(project.description, 100)}</td>
                        <td class="p-4">
                            <span class="px-2 py-1 rounded-full text-xs ${
                                project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800' :
                                project.status === 'Aprovado' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                            }">${project.status || 'N/A'}</span>
                        </td>
                        <td class="p-4">
                            <button data-id="${project.id}" data-name="${project.name || ''}" data-description="${project.description || ''}" data-status="${project.status || ''}" class="edit-btn text-sky-500 hover:underline mr-3">Editar</button>
                            <button data-id="${project.id}" data-name="${project.name || ''}" class="reject-btn text-red-500 hover:underline">Rejeitar</button>
                        </td>
                    `;
                    projectsTableBody.appendChild(tr);
                }

                // cards
                if (cardsContainer) {
                    const card = document.createElement('div');
                    card.className = "p-4 border rounded-lg bg-white dark:bg-gray-800 shadow space-y-2";
                    card.innerHTML = `
                        <p><strong>Projeto:</strong> ${project.name || 'N/A'}</p>
                        <p><strong>Cliente:</strong> ${clientUsername}</p>
                        <p><strong>Descrição:</strong> ${buildDescription(project.description, 120)}</p>
                        <p><strong>Status:</strong> 
                            <span class="px-2 py-1 rounded-full text-xs ${
                                project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800' :
                                project.status === 'Aprovado' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                            }">${project.status || 'N/A'}</span>
                        </p>
                        <div class="pt-2">
                            <button data-id="${project.id}" data-name="${project.name || ''}" data-description="${project.description || ''}" data-status="${project.status || ''}" class="edit-btn text-sky-500 hover:underline mr-3">Editar</button>
                            <button data-id="${project.id}" data-name="${project.name || ''}" class="reject-btn text-red-500 hover:underline">Rejeitar</button>
                        </div>
                    `;
                    cardsContainer.appendChild(card);
                }
            });
        } catch (error) {
            console.error('Erro ao buscar projetos:', error);
        }
    }

    // toggle ver mais / ver menos
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-desc')) {
            const container = e.target.closest('td, p'); 
            const short = container.querySelector('.short-desc');
            const full = container.querySelector('.full-desc');
            if (full.classList.contains('hidden')) {
                short.classList.add('hidden');
                full.classList.remove('hidden');
                e.target.textContent = "Ver menos";
            } else {
                short.classList.remove('hidden');
                full.classList.add('hidden');
                e.target.textContent = "Ver mais";
            }
        }
    });

    // edição
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            projectIdInput.value = e.target.dataset.id;
            projectNameInput.value = e.target.dataset.name;
            projectDescriptionInput.value = e.target.dataset.description;
            projectStatusInput.value = e.target.dataset.status;
            editModal.classList.remove('hidden');
        }

        if (e.target.classList.contains('reject-btn')) {
            rejectProjectIdInput.value = e.target.dataset.id;
            rejectProjectNameInput.value = e.target.dataset.name;
            rejectMessageTextarea.value = `O projeto não se alinha com nossas especialidades atuais.`;
            rejectModal.classList.remove('hidden');
        }
    });

    cancelEditButton.addEventListener('click', () => editModal.classList.add('hidden'));
    cancelRejectButton.addEventListener('click', () => rejectModal.classList.add('hidden'));

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        try {
            const { error } = await supabase.from('projects').update({
                name: projectNameInput.value,
                description: projectDescriptionInput.value,
                status: projectStatusInput.value
            }).eq('id', projectIdInput.value);
            if (error) throw error;
            showSuccessToast('Projeto atualizado com sucesso!');
            editModal.classList.add('hidden');
            await renderProjects();
        } catch (err) {
            showErrorToast(err.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Alterações';
        }
    });

    rejectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rejectButton = rejectForm.querySelector('button[type="submit"]');
        rejectButton.disabled = true;
        rejectButton.textContent = 'Processando...';
        try {
            const response = await fetch('/api/reject-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: rejectProjectIdInput.value,
                    message: rejectMessageTextarea.value,
                    adminId: user.id
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showSuccessToast(result.message);
            rejectModal.classList.add('hidden');
            await renderProjects();
        } catch (err) {
            showErrorToast(err.message);
        } finally {
            rejectButton.disabled = false;
            rejectButton.textContent = 'Confirmar Rejeição';
        }
    });

    await renderProjects();
}
