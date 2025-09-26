import { supabase } from '../supabaseClient.js';

/**
 * Atualiza os links de navegação no header com base no status e na role do usuário.
 */
async function updateUserNav() {
    // Seleciona todos os containers onde os links devem ser inseridos.
    const authLinksContainers = document.querySelectorAll('.auth-links');
    if (authLinksContainers.length === 0) return;

    // Pega a sessão atual do usuário
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // --- USUÁRIO LOGADO ---

        // Busca o perfil do usuário para saber a sua role ('admin' ou 'user')
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
        
        if (profileError) {
            console.error("Erro ao buscar perfil do usuário:", profileError);
            // Em caso de erro, exibe apenas o botão de Sair como fallback
            const navHTML = `<a href="#" id="logout-link" class="btn btn-primary !py-2 !px-4">Sair</a>`;
            authLinksContainers.forEach(container => container.innerHTML = navHTML);
        } else {
            let navHTML = '';
            // Gera o HTML dos botões com base na role do usuário
            if (profile && profile.role === 'admin') {
                // Se for ADMIN, mostra o link para o Painel Admin
                navHTML = `
                    <div class="flex items-center gap-x-3">
                        <a href="/admin.html" class="font-medium text-gray-600 dark:text-gray-300 hover:text-sky-500 text-sm">Painel Admin</a>
                        <a href="#" id="logout-link" class="btn btn-primary !py-2 !px-4">Sair</a>
                    </div>
                `;
            } else {
                // Se for CLIENTE (ou qualquer outra role), mostra o link para o Dashboard
                navHTML = `
                    <div class="flex items-center gap-x-3">
                        <a href="/dashboard.html" class="font-medium text-gray-600 dark:text-gray-300 hover:text-sky-500 text-sm">Dashboard</a>
                        <a href="#" id="logout-link" class="btn btn-primary !py-2 !px-4">Sair</a>
                    </div>
                `;
            }
            authLinksContainers.forEach(container => container.innerHTML = navHTML);
        }
        
        // Adiciona o evento de clique a todos os botões de logout
        document.querySelectorAll('#logout-link').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabase.auth.signOut();
                // Redireciona para a página inicial após o logout, que é uma melhor UX
                window.location.href = '/index.html';
            });
        });

    } else {
        // --- USUÁRIO DESLOGADO ---
        // Mostra apenas o botão de Login (comportamento atual, está correto)
        const navHTML = `<a href="/login.html" class="btn btn-primary !py-2 !px-4">Login</a>`;
        authLinksContainers.forEach(container => container.innerHTML = navHTML);
    }
}

/**
 * Função principal que orquestra a UI do header.
 */
export async function initUI() {
    await updateUserNav();
}