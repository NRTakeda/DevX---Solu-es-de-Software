// CÓDIGO NOVO (DEPOIS)

// Esta parte continua igual e roda imediatamente para evitar o "flash" de tema errado
const currentTheme = localStorage.getItem('theme');
const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (currentTheme === 'dark' || (!currentTheme && prefersDarkMode)) {
    document.documentElement.classList.add('dark');
}

// A lógica de adicionar o clique nos botões agora está dentro de uma função exportada
export function initThemeToggle() {
    const themeToggleButtons = document.querySelectorAll('.theme-toggle-button');
    
    // Função para atualizar os ícones visíveis
    function updateIcons(isDarkMode) {
        document.querySelectorAll('#theme-toggle-dark-icon, #theme-toggle-dark-icon-mobile').forEach(icon => {
            isDarkMode ? icon.classList.add('hidden') : icon.classList.remove('hidden');
        });
        document.querySelectorAll('#theme-toggle-light-icon, #theme-toggle-light-icon-mobile').forEach(icon => {
            isDarkMode ? icon.classList.remove('hidden') : icon.classList.add('hidden');
        });
    }
    
    // Atualiza os ícones no carregamento da página
    updateIcons(document.documentElement.classList.contains('dark'));

    // Adiciona o evento de clique a todos os botões de tema
    themeToggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const isDarkMode = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            updateIcons(isDarkMode);
        });
    });
}