import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';
import QRCode from 'qrcode';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export async function initAdmin() {
    // GUARDA DE PÁGINA: Se não encontrar a sidebar do admin, encerra a função imediatamente.
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

    async function renderProjects() {
        try {
            const { data: projects, error: projectsError } = await supabase
                .from('projects')
                .select('id, name, description, status, client_id, profiles ( id, username, full_name )')
                .not('status', 'eq', 'Rejeitado')
                .order('created_at', { ascending: false });
            if (projectsError) throw projectsError;
            if (!projects || projects.length === 0) {
                if (projectsTableBody) projectsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum projeto ativo encontrado.</td></tr>`;
                if (cardsContainer) cardsContainer.innerHTML = `<p class="text-center text-gray-500">Nenhum projeto ativo encontrado.</p>`;
                return;
            }
            if (projectsTableBody) projectsTableBody.innerHTML = '';
            if (cardsContainer) cardsContainer.innerHTML = '';
            projects.forEach(project => {
                const clientUsername = project.profiles ? (project.profiles.username || project.profiles.full_name || 'N/A') : 'N/A';
                if (projectsTableBody) {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b dark:border-gray-700';
                    tr.innerHTML = `
                        <td class="p-4">${project.name || 'N/A'}</td>
                        <td class="p-4">${clientUsername}</td>
                        <td class="p-4">${buildDescription(project.description, 100)}</td>
                        <td class="p-4">
                            <span class="px-2 py-1 rounded-full text-xs ${project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800' : project.status === 'Aprovado' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${project.status || 'N/A'}</span>
                        </td>
                        <td class="p-4">
                            <button data-id="${project.id}" data-name="${project.name || ''}" data-description="${project.description || ''}" data-status="${project.status || ''}" class="edit-btn text-sky-500 hover:underline mr-3">Editar</button>
                            <button data-id="${project.id}" data-name="${project.name || ''}" class="reject-btn text-red-500 hover:underline">Rejeitar</button>
                        </td>
                    `;
                    projectsTableBody.appendChild(tr);
                }
                if (cardsContainer) {
                    const card = document.createElement('div');
                    card.className = "p-4 border rounded-lg bg-white dark:bg-gray-800 shadow space-y-2";
                    card.innerHTML = `
                        <p><strong>Projeto:</strong> ${project.name || 'N/A'}</p>
                        <p><strong>Cliente:</strong> ${clientUsername}</p>
                        <p><strong>Descrição:</strong> ${buildDescription(project.description, 120)}</p>
                        <p><strong>Status:</strong> <span class="px-2 py-1 rounded-full text-xs ${project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800' : project.status === 'Aprovado' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${project.status || 'N/A'}</span></p>
                        <div class="pt-2">
                            <button data-id="${project.id}" data-name="${project.name || ''}" data-description="${project.description || ''}" data-status="${project.status || ''}" class="edit-btn text-sky-500 hover:underline mr-3">Editar</button>
                            <button data-id="${project.id}" data-name="${project.name || ''}" class="reject-btn text-red-500 hover:underline">Rejeitar</button>
                        </div>
                    `;
                    cardsContainer.appendChild(card);
                }
            });
        } catch (error) {
            console.error('Erro ao buscar projetos:', error);
        }
    }

    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-desc')) {
            const container = e.target.closest('td, p');
            const short = container.querySelector('.short-desc');
            const full = container.querySelector('.full-desc');
            if (full.classList.contains('hidden')) {
                short.classList.add('hidden');
                full.classList.remove('hidden');
                e.target.textContent = "Ver menos";
            } else {
                short.classList.remove('hidden');
                full.classList.add('hidden');
                e.target.textContent = "Ver mais";
            }
        }
    });

    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            projectIdInput.value = e.target.dataset.id;
            projectNameInput.value = e.target.dataset.name;
            projectDescriptionInput.value = e.target.dataset.description;
            projectStatusInput.value = e.target.dataset.status;
            editModal.classList.remove('hidden');
        }
        if (e.target.classList.contains('reject-btn')) {
            rejectProjectIdInput.value = e.target.dataset.id;
            rejectProjectNameInput.value = e.target.dataset.name;
            rejectMessageTextarea.value = `O projeto não se alinha com nossas especialidades atuais.`;
            rejectModal.classList.remove('hidden');
        }
    });

    cancelEditButton.addEventListener('click', () => editModal.classList.add('hidden'));
    cancelRejectButton.addEventListener('click', () => rejectModal.classList.add('hidden'));

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await supabase.from('projects').update({ name: projectNameInput.value, description: projectDescriptionInput.value, status: projectStatusInput.value }).eq('id', projectIdInput.value);
        if (error) { showErrorToast(error.message); }
        else { showSuccessToast('Projeto atualizado com sucesso!'); editModal.classList.add('hidden'); await renderProjects(); }
    });

    rejectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const response = await fetch('/api/reject-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: rejectProjectIdInput.value, message: rejectMessageTextarea.value, adminId: user.id }) });
        const result = await response.json();
        if (!response.ok) { showErrorToast(result.message); }
        else { showSuccessToast(result.message); rejectModal.classList.add('hidden'); await renderProjects(); }
    });


    // --- LÓGICA DE QR CODES ---
    async function renderQRCodes() {
        qrcodesTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Carregando...</td></tr>`;
        qrcodesTableBody.dataset.loaded = "true";
        const { data: links, error } = await supabase.from('qr_links').select(`id, slug, destino, descricao, qr_logs ( count )`).order('created_at', { ascending: false });
        if (error) {
            showErrorToast('Erro ao carregar os QR Codes.');
            console.error(error);
            qrcodesTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar.</td></tr>`;
            return;
        }
        if (links.length === 0) {
            qrcodesTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum QR Code criado ainda.</td></tr>`;
            return;
        }
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

    createQrBtn.addEventListener('click', () => {
        qrCodeForm.reset();
        editQrCodeId.value = '';
        modalTitle.textContent = 'Criar Novo QR Code';
        qrCodeModal.classList.remove('hidden');
    });

    cancelQrCodeButton.addEventListener('click', () => qrCodeModal.classList.add('hidden'));
    closeViewQrButton.addEventListener('click', () => viewQrModal.classList.add('hidden'));

    qrCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(qrCodeForm);
        const qrData = { slug: formData.get('slug'), destino: formData.get('destino'), descricao: formData.get('descricao'), admin_id: user.id };
        const id = editQrCodeId.value;
        const { error } = id ? await supabase.from('qr_links').update(qrData).eq('id', id) : await supabase.from('qr_links').insert(qrData);
        if (error) { showErrorToast(error.message); }
        else { showSuccessToast(`QR Code ${id ? 'atualizado' : 'criado'} com sucesso!`); qrCodeModal.classList.add('hidden'); await renderQRCodes(); }
    });

    // --- LÓGICA DE ESTATÍSTICAS E AÇÕES DA TABELA QR ---
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
        statsTotalScans.textContent = '...';
        statsScans7Days.textContent = '...';
        statsTopCountry.textContent = '...';
        topCountriesList.innerHTML = '<li>Carregando...</li>';
        topDevicesList.innerHTML = '<li>Carregando...</li>';
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

    qrcodesTableBody.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;
        if (target.classList.contains('delete-qr-btn')) {
            if (confirm('Tem certeza que deseja excluir este QR Code? Todos os seus dados de scan serão perdidos.')) {
                const { error } = await supabase.from('qr_links').delete().eq('id', id);
                if (error) { showErrorToast(error.message); }
                else { showSuccessToast('QR Code excluído com sucesso.'); await renderQRCodes(); }
            }
        } else if (target.classList.contains('edit-qr-btn')) {
            const data = JSON.parse(target.dataset.fullData);
            editQrCodeId.value = data.id;
            document.getElementById('qrcode-slug').value = data.slug;
            document.getElementById('qrcode-destino').value = data.destino;
            document.getElementById('qrcode-descricao').value = data.descricao;
            modalTitle.textContent = 'Editar QR Code';
            qrCodeModal.classList.remove('hidden');
        } else if (target.classList.contains('view-qr-btn')) {
            const slug = target.closest('tr').querySelector('.font-mono').textContent;
            const qrUrl = `${window.location.origin}/api/qr/${slug}`;
            qrLinkDisplay.textContent = qrUrl;
            QRCode.toCanvas(qrCanvas, qrUrl, { width: 256 }, (error) => {
                if (error) console.error(error);
                downloadQrLink.href = qrCanvas.toDataURL('image/png');
            });
            viewQrModal.classList.remove('hidden');
        } else if (target.classList.contains('stats-qr-btn')) {
            const slug = target.dataset.slug;
            displayStatsForQR(id, slug);
        }
    });

    closeStatsModalButton.addEventListener('click', () => statsModal.classList.add('hidden'));


    // --- INICIALIZAÇÃO DA PÁGINA ---
    setActiveLink(navLinkProjects);
    showContent(contentProjects);
    await renderProjects();
}