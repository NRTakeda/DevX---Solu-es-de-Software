// CSS e Bibliotecas
import '../css/style.css';
import AOS from 'aos';
import 'aos/dist/aos.css';

// Nossos Módulos
import { initLayout } from './layout.js';
import { initThemeToggle } from './darkMode.js';
import { initAuth } from './modules/auth.js';
import { initUI } from './modules/ui.js';
import { initApiHandlers } from './modules/api.js';
import { initDashboard } from './modules/dashboard.js';
import { initAdmin } from './modules/admin.js';

// Ponto de Entrada Principal da Aplicação
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializações que não dependem do DOM dinâmico
    AOS.init({ duration: 800, once: true, offset: 50 });
    
    // Carrega componentes dinâmicos (header/footer)
    await initLayout();
    
    // Inicializa funcionalidades que dependem dos componentes carregados
    initThemeToggle();
    await initUI(); // Contém updateUserNav, que precisa do header
    
    // Inicializa funcionalidades específicas de cada página
    initAuth();
    initApiHandlers();
    await initDashboard();
    await initAdmin();
});