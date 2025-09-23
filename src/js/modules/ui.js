import { supabase } from '../supabaseClient.js';

/**
 * Atualiza os links de autenticação (Login/Sair) no header.
 */
async function updateUserNav() {
    const { data: { session } } = await supabase.auth.getSession();
    const authLinksContainers = document.querySelectorAll('.auth-links');
    if (authLinksContainers.length === 0) return;

    if (session) {
        // --- USUÁRIO LOGADO ---
        // Mostra apenas o botão de Sair
        const navHTML = `<a href="#" id="logout-link" class="btn btn-primary !py-2 !px-4">Sair</a>`;
        authLinksContainers.forEach(container => container.innerHTML = navHTML);
        
        // Adiciona o evento de clique a todos os botões de logout
        document.querySelectorAll('#logout-link').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabase.auth.signOut();
                window.location.href = '/login.html';
            });
        });

    } else {
        // --- USUÁRIO DESLOGADO ---
        // Mostra apenas o botão de Login
        const navHTML = `<a href="/login.html" class="btn btn-primary !py-2 !px-4">Login</a>`;
        authLinksContainers.forEach(container => container.innerHTML = navHTML);
    }
}

/**
 * Função principal que orquestra a UI do header.
 */
export async function initUI() {
    // A única coisa que a UI precisa fazer agora é atualizar os links de autenticação.
    // A função initMobileMenu() foi removida por não ser mais necessária.
    await updateUserNav();
}