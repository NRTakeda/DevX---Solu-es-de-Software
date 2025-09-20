// VERSÃO FINAL E ROBUSTA COM VITE ?RAW IMPORT

// 1. Importa o CONTEÚDO dos arquivos HTML como texto puro (string).
// O Vite faz a mágica de ler os arquivos e colocar o conteúdo aqui.
import headerHTML from '../components/header.html?raw';
import footerHTML from '../components/footer.html?raw';

/**
 * Função principal que inicializa o layout da página.
 * Ela não precisa mais ser 'async', pois os componentes já estão carregados.
 */
export function initLayout() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');

    // 2. Substitui o placeholder do header pelo HTML importado.
    if (headerPlaceholder) {
        headerPlaceholder.outerHTML = headerHTML;
    }

    // 3. Substitui o placeholder do footer pelo HTML importado.
    if (footerPlaceholder) {
        footerPlaceholder.outerHTML = footerHTML;
    }
}