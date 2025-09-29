import headerHTML from '../components/header.html?raw';
import footerHTML from '../components/footer.html?raw';

function initSidebarToggle() {
    // Esta lógica agora funciona para QUALQUER sidebar que siga o padrão
    const sidebar = document.querySelector('aside[id$="-sidebar"]'); // Pega 'admin-sidebar' ou 'dashboard-sidebar'
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const overlay = document.getElementById('sidebar-overlay');

    if (toggleBtn && sidebar && overlay) {
        toggleBtn.setAttribute('aria-controls', sidebar.id);
        toggleBtn.setAttribute('aria-expanded', 'false');

        const openSidebar = () => {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
            document.body.classList.add('overflow-hidden', 'md:overflow-auto'); // Bloqueia scroll só no mobile
            toggleBtn.setAttribute('aria-expanded', 'true');
        };

        const closeSidebar = () => {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
            document.body.classList.remove('overflow-hidden', 'md:overflow-auto');
            toggleBtn.setAttribute('aria-expanded', 'false');
        };

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sidebar.classList.contains('-translate-x-full')) openSidebar();
            else closeSidebar();
        });

        overlay.addEventListener('click', closeSidebar);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });

        let lastWidth = window.innerWidth;
        window.addEventListener('resize', () => {
            const w = window.innerWidth;
            if (w >= 768 && lastWidth < 768) {
                // Ao passar para o modo desktop, garante que a sidebar esteja visível e o body com scroll
                sidebar.classList.remove('-translate-x-full');
                overlay.classList.add('hidden');
                document.body.classList.remove('overflow-hidden', 'md:overflow-auto');
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
            lastWidth = w;
        });
    }
}

export function initLayout() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');

    if (headerPlaceholder) {
        headerPlaceholder.outerHTML = headerHTML;
    }
    if (footerPlaceholder) {
        footerPlaceholder.outerHTML = footerHTML;
    }

    // Após o layout ser inserido, inicializa a lógica da sidebar
    initSidebarToggle();
}