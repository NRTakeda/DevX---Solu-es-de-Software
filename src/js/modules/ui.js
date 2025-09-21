import { supabase } from '../supabaseClient.js';

async function updateUserNav() {
    const authLinksContainers = document.querySelectorAll('.auth-links'); 
    if (authLinksContainers.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        const navHTML = `
            <a href="/dashboard.html">Meu Perfil</a>
            <a href="#" id="logout-link" class="btn btn-primary !py-2 !px-4 hidden md:block">Sair</a>
            <a href="#" id="logout-link-mobile" class="md:hidden font-semibold">Sair</a>
        `;
        authLinksContainers.forEach(container => container.innerHTML = navHTML);

        document.querySelectorAll('#logout-link, #logout-link-mobile').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabase.auth.signOut();
                window.location.href = '/login.html';
            });
        });
    } else {
        const navHTML = `
            <a href="/index.html#contato" class="hidden md:block">Contato</a>
            <a href="/login.html" class="btn btn-primary !py-2 !px-4">Login</a>
        `;
        authLinksContainers.forEach(container => container.innerHTML = navHTML);
    }
}

function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!mobileMenuButton || !mobileMenu) return;

    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        mobileMenuButton.setAttribute('aria-expanded', !mobileMenu.classList.contains('hidden'));
    });
}

export async function initUI() {
    initMobileMenu();
    await updateUserNav();
}