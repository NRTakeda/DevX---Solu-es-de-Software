import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';
import QRCode from 'qrcode';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export async function initAdmin() {
    // --- PONTO DE VERIFICAÇÃO INICIAL ---
    if (!document.getElementById('admin-sidebar')) return;

    // --- SELEÇÃO DE ELEMENTOS DO DOM ---
    const { data: { user } } = await supabase.auth.getUser();

    // Elementos da Navegação e Conteúdo
    const navLinkProjects = document.getElementById('nav-link-projects');
    const navLinkQrCodes = document.getElementById('nav-link-qrcodes');
    const contentProjects = document.getElementById('content-projects');
    const contentQrCodes = document.getElementById('content-qrcodes');

    // Elementos da Seção de Projetos
    const projectsTableBody = document.getElementById('projects-table-body');
    const cardsContainer = document.getElementById('projects-cards');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-project-form');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const projectIdInput = document.getElementById('edit-project-id');
    const projectNameInput = document.getElementById('edit-project-name');
    const projectDescriptionInput = document.getElementById('edit-project-description');
    const projectStatusInput = document.getElementById('edit-project-status');
    const rejectModal = document.getElementById('reject-modal');
    const rejectForm = document.getElementById('reject-project-form');
    const cancelRejectButton = document.getElementById('cancel-reject-button');
    const rejectProjectIdInput = document.getElementById('reject-project-id');
    const rejectProjectNameInput = document.getElementById('reject-project-name');
    const rejectMessageTextarea = document.getElementById('reject-message');

    // Elementos da Seção de QR Codes
    const createQrBtn = document.getElementById('create-qr-btn');
    const qrcodesTableBody = document.getElementById('qrcodes-table-body');
    const qrCodeModal = document.getElementById('qrcode-modal');
    const qrCodeForm = document.getElementById('qrcode-form');
    const modalTitle = document.getElementById('modal-title');
    const editQrCodeId = document.getElementById('edit-qrcode-id');
    const cancelQrCodeButton = document.getElementById('cancel-qrcode-button');
    const viewQrModal = document.getElementById('view-qr-modal');
    const qrCanvas = document.getElementById('qr-canvas');
    const qrLinkDisplay = document.getElementById('qr-link-display');
    const downloadQrLink = document.getElementById('download-qr-link');
    const closeViewQrButton = document.getElementById('close-view-qr-button');

    // Elementos do Modal de Estatísticas
    const statsModal = document.getElementById('stats-modal');
    const closeStatsModalButton = document.getElementById('close-stats-modal-button');
    const statsModalTitle = document.getElementById('stats-modal-title');
    const statsTotalScans = document.getElementById('stats-total-scans');
    const statsScans7Days = document.getElementById('stats-scans-7-days');
    const statsTopCountry = document.getElementById('stats-top-country');
    const scansOverTimeChartCanvas = document.getElementById('scans-over-time-chart');
    const topCountriesList = document.getElementById('stats-top-countries-list');
    const topDevicesList = document.getElementById('stats-top-devices-list');

    let scansChart = null; // Variável global para a instância do gráfico

    // --- GUARDA DE SEGURANÇA (VERIFICA SE É ADMIN) ---
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || profile.role !== 'admin') {
        showErrorToast('Acesso negado.');
        window.location.href = '/dashboard.html';
        return;
    }

    // --- NAVEGAÇÃO DA SIDEBAR ---
    function showContent(elementToShow) {
        [contentProjects, contentQrCodes].forEach(el => el.classList.add('hidden'));
        elementToShow.classList.remove('hidden');
    }

    function setActiveLink(activeLink) {
        document.querySelectorAll('#admin-sidebar .nav-link').forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }

    navLinkProjects.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveLink(navLinkProjects);
        showContent(contentProjects);
    });

    navLinkQrCodes.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveLink(navLinkQrCodes);
        showContent(contentQrCodes);
        if (!qrcodesTableBody.dataset.loaded) {
            renderQRCodes();
        }
    });

    // --- LÓGICA DE PROJETOS ---
    function buildDescription(fullText, length = 50) {
        if (!fullText) return 'Sem descrição';
        if (fullText.length <= length) return fullText;
        const shortText = fullText.substring(0, length) + '...';
        return `<span class="short-desc">${shortText}</span><span class="full-desc hidden">${fullText}</span><button class="toggle-desc text-sky-500 hover:underline ml-1">Ver mais</button>`;
    }

    async function renderProjects() { /* ... código original para renderizar projetos ... */ }
    document.body.addEventListener('click', (e) => { /* ... código original para toggle da descrição ... */ });
    document.body.addEventListener('click', (e) => { /* ... código original para abrir modais de projetos ... */ });
    cancelEditButton.addEventListener('click', () => editModal.classList.add('hidden'));
    cancelRejectButton.addEventListener('click', () => rejectModal.classList.add('hidden'));
    editForm.addEventListener('submit', async (e) => { /* ... código original do form de edição de projeto ... */ });
    rejectForm.addEventListener('submit', async (e) => { /* ... código original do form de rejeição de projeto ... */ });

    // --- LÓGICA DE QR CODES ---
    async function renderQRCodes() {
        qrcodesTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Carregando...</td></tr>`;
        qrcodesTableBody.dataset.loaded = "true";

        const { data: links, error } = await supabase.from('qr_links').select(`id, slug, destino, descricao, qr_logs ( count )`).order('created_at', { ascending: false });
        if (error) { /* ... tratamento de erro ... */ return; }
        if (links.length === 0) { /* ... mensagem de nenhum QR Code ... */ return; }

        qrcodesTableBody.innerHTML = '';
        links.forEach(link => {
            const tr = document.createElement('tr');
            tr.className = 'border-b dark:border-gray-700';
            tr.innerHTML = `
                <td class="p-4 font-mono text-sm">${link.slug}</td>
                <td class="p-4 text-sm truncate" style="max-width: 200px;"><a href="${link.destino}" target="_blank" class="text-sky-500 hover:underline">${link.destino}</a></td>
                <td class="p-4 text-sm">${link.descricao || '---'}</td>
                <td class="p-4 text-center font-bold">${link.qr_logs[0]?.count || 0}</td>
                <td class="p-4">
                    <button data-id="${link.id}" data-slug="${link.slug}" class="stats-qr-btn text-gray-500 hover:text-sky-500 p-1" title="Ver Estatísticas">📊</button>
                    <button data-id="${link.id}" class="view-qr-btn text-gray-500 hover:text-sky-500 p-1" title="Ver QR Code">👁️</button>
                    <button data-id="${link.id}" class="edit-qr-btn text-gray-500 hover:text-sky-500 p-1" title="Editar">✏️</button>
                    <button data-id="${link.id}" class="delete-qr-btn text-gray-500 hover:text-red-500 p-1" title="Excluir">🗑️</button>
                </td>
            `;
            qrcodesTableBody.appendChild(tr);
            tr.querySelector('.edit-qr-btn').dataset.fullData = JSON.stringify(link);
        });
    }

    createQrBtn.addEventListener('click', () => { /* ... lógica para abrir modal de criação ... */ });
    cancelQrCodeButton.addEventListener('click', () => qrCodeModal.classList.add('hidden'));
    closeViewQrButton.addEventListener('click', () => viewQrModal.classList.add('hidden'));
    qrCodeForm.addEventListener('submit', async (e) => { /* ... lógica para criar/editar QR Code ... */ });
    qrcodesTableBody.addEventListener('click', async (e) => { /* ... lógica dos botões de ação da tabela de QR Code (exceto stats) ... */ });

    // --- LÓGICA DE ESTATÍSTICAS ---
    function parseUserAgent(ua) {
        if (!ua) return 'Desconhecido';
        if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Macintosh')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        return 'Outro';
    }

    async function displayStatsForQR(qrId, slug) {
        statsModalTitle.textContent = `Estatísticas para: ${slug}`;
        statsModal.classList.remove('hidden');
        statsTotalScans.textContent = '...'; /* ... resetar outros campos ... */

        const { data: logs, error } = await supabase.from('qr_logs').select('created_at, geo, user_agent').eq('qr_id', qrId).order('created_at', { ascending: true });
        if (error) { showErrorToast('Erro ao buscar estatísticas.'); return; }

        const totalScans = logs.length;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const scansLast7Days = logs.filter(log => new Date(log.created_at) > sevenDaysAgo).length;
        const countryCounts = logs.reduce((acc, log) => { const country = log.geo?.country || 'Desconhecido'; acc[country] = (acc[country] || 0) + 1; return acc; }, {});
        const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
        const deviceCounts = logs.reduce((acc, log) => { const device = parseUserAgent(log.user_agent); acc[device] = (acc[device] || 0) + 1; return acc; }, {});
        const topDevices = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]);
        const scansByDay = logs.reduce((acc, log) => { const day = new Date(log.created_at).toISOString().split('T')[0]; acc[day] = (acc[day] || 0) + 1; return acc; }, {});
        
        statsTotalScans.textContent = totalScans;
        statsScans7Days.textContent = scansLast7Days;
        statsTopCountry.textContent = topCountries.length > 0 ? topCountries[0][0] : 'N/A';
        topCountriesList.innerHTML = topCountries.slice(0, 5).map(c => `<li>${c[0]}: <strong>${c[1]}</strong></li>`).join('');
        topDevicesList.innerHTML = topDevices.slice(0, 5).map(d => `<li>${d[0]}: <strong>${d[1]}</strong></li>`).join('');

        if (scansChart) { scansChart.destroy(); }
        scansChart = new Chart(scansOverTimeChartCanvas, {
            type: 'line',
            data: { labels: Object.keys(scansByDay), datasets: [{ label: 'Scans por Dia', data: Object.values(scansByDay), borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    qrcodesTableBody.addEventListener('click', (e) => {
        const statsButton = e.target.closest('.stats-qr-btn');
        if (statsButton) {
            const qrId = statsButton.dataset.id;
            const slug = statsButton.dataset.slug;
            displayStatsForQR(qrId, slug);
        }
    });

    closeStatsModalButton.addEventListener('click', () => statsModal.classList.add('hidden'));

    // --- INICIALIZAÇÃO DA PÁGINA ---
    setActiveLink(navLinkProjects);
    showContent(contentProjects);
    await renderProjects();
}