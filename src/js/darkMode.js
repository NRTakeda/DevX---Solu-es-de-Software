// Seleciona os ícones de todos os botões
const darkIcons = [
    document.getElementById('theme-toggle-dark-icon'),
    document.getElementById('theme-toggle-dark-icon-mobile')
];
const lightIcons = [
    document.getElementById('theme-toggle-light-icon'),
    document.getElementById('theme-toggle-light-icon-mobile')
];

// Função para aplicar o tema e atualizar TODOS os ícones
function applyTheme(isDarkMode) {
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        lightIcons.forEach(icon => icon?.classList.remove('hidden'));
        darkIcons.forEach(icon => icon?.classList.add('hidden'));
    } else {
        document.documentElement.classList.remove('dark');
        darkIcons.forEach(icon => icon?.classList.remove('hidden'));
        lightIcons.forEach(icon => icon?.classList.add('hidden'));
    }
}

// Verifica a preferência salva ou do sistema
const currentTheme = localStorage.getItem('theme');
const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Define o tema inicial
if (currentTheme === 'dark' || (!currentTheme && prefersDarkMode)) {
    applyTheme(true);
} else {
    applyTheme(false);
}

// Função de clique que será usada por ambos os botões
function handleThemeToggle() {
    const isDarkMode = document.documentElement.classList.contains('dark');
    applyTheme(!isDarkMode);
    
    if (!isDarkMode) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
}

// Adiciona o evento de clique a TODOS os botões de tema
const themeToggleButtons = document.querySelectorAll('.theme-toggle-button');
themeToggleButtons.forEach(btn => {
    btn.addEventListener('click', handleThemeToggle);
});