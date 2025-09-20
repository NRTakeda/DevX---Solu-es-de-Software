// Função genérica para carregar um componente HTML em um placeholder
async function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);
    if (!element) return; // Não faz nada se o placeholder não existir na página

    try {
        // Busca o conteúdo do arquivo HTML do componente
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Componente não encontrado em: ${filePath}`);
        }
        const componentHTML = await response.text();
        
        // Insere o HTML do componente no placeholder
        element.innerHTML = componentHTML;
    } catch (error) {
        console.error(`Falha ao carregar o componente para #${elementId}:`, error);
        element.innerHTML = `<p class="text-red-500 text-center">Erro ao carregar esta seção.</p>`;
    }
}

// Função principal que inicializa o layout da página
export async function initLayout() {
    // Carrega o header e o footer em paralelo para otimizar o tempo
    await Promise.all([
        loadComponent('header-placeholder', '/components/header.html'),
        loadComponent('footer-placeholder', '/components/footer.html')
    ]);
}