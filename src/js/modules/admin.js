import { supabase } from '../supabaseClient.js';

export async function initAdmin() {
    const projectsTableBody = document.getElementById('projects-table-body');
    if (!projectsTableBody) return; // Só roda na página de admin

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
        alert('Acesso negado.');
        window.location.href = '/dashboard.html'; // Redireciona não-admins
        return;
    }

    // Elementos do Modal de Edição
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-project-form');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const projectIdInput = document.getElementById('edit-project-id');
    const projectNameInput = document.getElementById('edit-project-name');
    const projectStatusInput = document.getElementById('edit-project-status');

    // 2. Função para buscar e renderizar todos os projetos
    async function renderProjects() {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('id, name, status, profiles(username)');

        if (error) {
            console.error('Erro ao buscar projetos:', error);
            projectsTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Erro ao carregar projetos.</td></tr>`;
            return;
        }

        if (projects.length === 0) {
            projectsTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Nenhum projeto encontrado.</td></tr>`;
            return;
        }

        projectsTableBody.innerHTML = ''; // Limpa a tabela
        projects.forEach(project => {
            const tr = document.createElement('tr');
            tr.className = 'border-b dark:border-gray-700';
            tr.innerHTML = `
                <td class="p-4">${project.name}</td>
                <td class="p-4">${project.profiles?.username || 'N/A'}</td>
                <td class="p-4">${project.status}</td>
                <td class="p-4">
                    <button data-id="${project.id}" data-name="${project.name}" data-status="${project.status}" class="edit-btn text-sky-500 hover:underline">Editar</button>
                </td>
            `;
            projectsTableBody.appendChild(tr);
        });
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
    });

    cancelEditButton.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

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
            alert('Erro ao atualizar o projeto: ' + error.message);
        } else {
            alert('Projeto atualizado com sucesso!');
            editModal.classList.add('hidden');
            await renderProjects(); // Re-renderiza a tabela
        }
    });

    // Renderiza os projetos ao carregar a página
    await renderProjects();
}