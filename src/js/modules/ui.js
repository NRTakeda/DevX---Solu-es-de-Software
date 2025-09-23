import { supabase } from '../supabaseClient.js';

/**
 * Controla o menu hambúrguer para as páginas que não são o dashboard.
 */
function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!mobileMenuButton || !mobileMenu) return;

    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

/**
 * Atualiza os links de autenticação (Login/Sair/Meu Perfil) no header.
 * @param {boolean} isDashboardPage - Informa se a página atual é o dashboard.
 */
async function updateUserNav(isDashboardPage = false) {
    const { data: { session } } = await supabase.auth.getSession();
    const authLinksContainers = document.querySelectorAll('.auth-links');
    if (authLinksContainers.length === 0) return;

    if (session) {
        // --- USUÁRIO LOGADO ---
        const desktopNavHTML = `
            <a href="/dashboard.html">Meu Perfil</a>
            <a href="#" id="logout-link-desktop" class="btn btn-primary !py-2 !px-4">Sair</a>
        `;
        // No mobile do dashboard, queremos apenas o botão de Sair e o ícone de tema.
        const mobileNavHTML = isDashboardPage 
            ? `<a href="#" id="logout-link-mobile" class="btn btn-primary !py-2 !px-4">Sair</a>`
            : `<a href="/dashboard.html">Meu Perfil</a> <a href="#" id="logout-link-mobile" class="btn btn-primary !py-2 !px-4">Sair</a>`;

        authLinksContainers.forEach(container => {
            // O seletor .md\\:hidden identifica o container mobile do header
            if (container.closest('div.md\\:hidden')) {
                container.innerHTML = mobileNavHTML;
            } else {
                container.innerHTML = desktopNavHTML;
            }
        });
        
        // Adiciona o evento de clique a todos os botões de logout
        document.querySelectorAll('#logout-link-desktop, #logout-link-mobile').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabase.auth.signOut();
                window.location.href = '/login.html';
            });
        });

    } else {
        // --- USUÁRIO DESLOGADO ---
        const navHTML = `<a href="/login.html" class="btn btn-primary !py-2 !px-4">Login</a>`;
        authLinksContainers.forEach(container => container.innerHTML = navHTML);
    }
}

/**
 * Função principal que orquestra toda a UI do header,
 * adaptando-se à página atual.
 */
export async function initUI() {
    const isDashboardPage = window.location.pathname.includes('/dashboard.html');

    // Se estiver no dashboard, faz uma limpeza no header global.
    if (isDashboardPage) {
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        
        // Esconde o botão hambúrguer e o menu dropdown que não são usados no dashboard.
        if (mobileMenuButton) mobileMenuButton.style.display = 'none';
        if (mobileMenu) mobileMenu.style.display = 'none';

        // Remove os links de navegação ("Serviços", etc.) do header no modo desktop.
        document.querySelectorAll('header nav.hidden > a').forEach(link => link.remove());

    } else {
        // Se NÃO estiver no dashboard, inicializa o menu hambúrguer normal.
        initMobileMenu();
    }

    // Finalmente, atualiza os links de autenticação, informando se estamos no dashboard.
    await updateUserNav(isDashboardPage);
}