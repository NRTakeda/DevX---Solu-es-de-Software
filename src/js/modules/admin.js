import { supabase } from '../supabaseClient.js';
import { showSuccessToast, showErrorToast } from './notifications.js';
import QRCode from 'qrcode';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export async function initAdmin() {
    console.log('🔄 Admin iniciando...');
    
    // GUARDA DE PÁGINA: Se não encontrar a sidebar do admin, encerra a função imediatamente.
    if (!document.getElementById('admin-sidebar')) {
        console.error('❌ Sidebar não encontrada - encerrando admin');
        return;
    }

    // --- SELEÇÃO DE ELEMENTOS DO DOM ---
    const { data: { user } } = await supabase.auth.getUser();

    const sidebar = document.getElementById('admin-sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const navLinkProjects = document.getElementById('nav-link-projects');
    const navLinkQrCodes = document.getElementById('nav-link-qrcodes');
    const contentProjects = document.getElementById('content-projects');
    const contentQrCodes = document.getElementById('content-qrcodes');
    const projectsTableBody = document.getElementById('projects-table-body');
    const cardsContainer = document.getElementById('projects-cards');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-project-form');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const rejectModal = document.getElementById('reject-modal');
    const rejectForm = document.getElementById('reject-project-form');
    const cancelRejectButton = document.getElementById('cancel-reject-button');
    const createQrBtn = document.getElementById('create-qr-btn');
    const qrcodesTableBody = document.getElementById('qrcodes-table-body');
    const qrCodeModal = document.getElementById('qrcode-modal');
    const qrCodeForm = document.getElementById('qrcode-form');
    const modalTitle = document.getElementById('modal-title');
    const cancelQrCodeButton = document.getElementById('cancel-qrcode-button');
    const viewQrModal = document.getElementById('view-qr-modal');
    const qrCanvas = document.getElementById('qr-canvas');
    const qrLinkDisplay = document.getElementById('qr-link-display');
    const downloadQrLink = document.getElementById('download-qr-link');
    const closeViewQrButton = document.getElementById('close-view-qr-button');
    const statsModal = document.getElementById('stats-modal');
    const closeStatsModalButton = document.getElementById('close-stats-modal-button');
    const statsModalTitle = document.getElementById('stats-modal-title');
    const statsTotalScans = document.getElementById('stats-total-scans');
    const statsScans7Days = document.getElementById('stats-scans-7-days');
    const statsTopCountry = document.getElementById('stats-top-country');
    const scansOverTimeChartCanvas = document.getElementById('scans-over-time-chart');
    const topCountriesList = document.getElementById('stats-top-countries-list');
    const topDevicesList = document.getElementById('stats-top-devices-list');

    let scansChart = null;
    // --- [1/4] VARIÁVEL ADICIONADA ---
    // Guarda a referência da "escuta" do Supabase para poder removê-la depois.
    let qrChannel = null;

    // --- GUARDA DE SEGURANÇA (ADMIN) ---
    if (!user) { window.location.href = '/login.html'; return; }
    try {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profileError || !profile || profile.role !== 'admin') {
            showErrorToast('Acesso negado.');
            window.location.href = '/dashboard.html';
            return;
        }
    } catch (err) {
        showErrorToast('Erro ao verificar permissões.');
        console.error('Permission check error:', err);
        window.location.href = '/login.html';
        return;
    }
    
    // --- LÓGICA DA SIDEBAR ---
    const toggleSidebar = () => {
        sidebar.classList.toggle('-translate-x-full');
        sidebarOverlay.classList.toggle('hidden');
        document.body.classList.toggle('overflow-hidden');
    };
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => { if (window.innerWidth < 768) { toggleSidebar(); } });
    });
    
    // --- NAVEGAÇÃO INTERNA ---
    function showContent(elementToShow) {
        [contentProjects, contentQrCodes].forEach(el => el.classList.add('hidden'));
        elementToShow.classList.remove('hidden');
    }
    function setActiveLink(activeLink) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    activeLink.classList.add('active');
}
    navLinkProjects.addEventListener('click', (e) => { e.preventDefault(); setActiveLink(navLinkProjects); showContent(contentProjects); });
    navLinkQrCodes.addEventListener('click', (e) => { e.preventDefault(); setActiveLink(navLinkQrCodes); showContent(contentQrCodes); if (!qrcodesTableBody.dataset.loaded) renderQRCodes(); });

    // --- HELPERS DE MODAIS ---
    function openModal(modal) { if (modal) modal.classList.remove('hidden'); }
    function closeModal(modal) { if (modal) modal.classList.add('hidden'); }

    // --- LÓGICA DE PROJETOS ---
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function getStatusClass(status) {
        const classes = { 'approved': 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100', 'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100', 'rejected': 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' };
        return classes[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
    function getStatusText(status) {
        const texts = { 'approved': 'Aprovado', 'pending': 'Aguardando Análise', 'rejected': 'Rejeitado' };
        return texts[status] || status;
    }
    
    function buildDescriptionNode(description, maxLength = 50) {
        const container = document.createElement('div');
        container.className = 'description-container';
        
        const textDiv = document.createElement('div');
        const fullText = description || 'Sem descrição';
        
        if (fullText.length <= maxLength) {
            textDiv.textContent = fullText;
            textDiv.className = 'description-text';
            container.appendChild(textDiv);
            return container;
        }
        
        const truncatedText = fullText.substring(0, maxLength) + '...';
        textDiv.textContent = truncatedText;
        textDiv.className = 'description-text';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Ver mais';
        toggleBtn.className = 'ver-mais-btn ml-1 text-blue-600 hover:text-blue-800 text-sm font-semibold';
        toggleBtn.type = 'button';
        
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (textDiv.textContent === truncatedText) {
                textDiv.textContent = fullText;
                toggleBtn.textContent = 'Ver menos';
            } else {
                textDiv.textContent = truncatedText;
                toggleBtn.textContent = 'Ver mais';
            }
        });
        
        container.appendChild(textDiv);
        container.appendChild(toggleBtn);
        
        return container;
    }

    async function renderProjects() {
    try {
        const { data: projects, error: projectsError } = await supabase.from('projects').select('id, name, description, status, client_id, profiles ( id, username, full_name )').not('status', 'eq', 'Rejeitado').order('created_at', { ascending: false });
        if (projectsError) throw projectsError;
        
        projectsTableBody.innerHTML = '';
        cardsContainer.innerHTML = '';

        if (!projects || projects.length === 0) {
            projectsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum projeto ativo encontrado.</td></tr>`;
            cardsContainer.innerHTML = `<p class="text-center text-gray-500">Nenhum projeto ativo encontrado.</p>`;
            return;
        }

        projects.forEach(project => {
            const clientUsername = project.profiles ? (project.profiles.username || project.profiles.full_name || 'N/A') : 'N/A';
            
            // === TABELA (DESKTOP) ===
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
            tr.dataset.project = JSON.stringify(project);

            const tdName = document.createElement('td');
            tdName.className = 'p-4 font-semibold';
            tdName.textContent = project.name || 'N/A';

            const tdClient = document.createElement('td');
            tdClient.className = 'p-4';
            tdClient.textContent = clientUsername;

            const tdDesc = document.createElement('td');
            tdDesc.className = 'p-4 text-sm';
            tdDesc.appendChild(buildDescriptionNode(project.description, 50));

            const tdStatus = document.createElement('td');
            tdStatus.className = 'p-4';
            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge ${getStatusClass(project.status)}`;
            statusBadge.textContent = getStatusText(project.status);
            tdStatus.appendChild(statusBadge);

            const tdActions = document.createElement('td');
            tdActions.className = 'p-4 space-x-2';
            
            const editBtn = document.createElement('button');
            editBtn.title = 'Editar';
            editBtn.className = 'btn-icon btn-icon-primary';
            editBtn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>`;
            editBtn.onclick = () => window.editProject(editBtn);
            
            const rejectBtn = document.createElement('button');
            rejectBtn.title = 'Rejeitar';
            rejectBtn.className = 'btn-icon btn-icon-danger';
            rejectBtn.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>`;
            rejectBtn.onclick = () => window.rejectProject(rejectBtn);
            
            tdActions.appendChild(editBtn);
            tdActions.appendChild(rejectBtn);

            tr.append(tdName, tdClient, tdDesc, tdStatus, tdActions);
            projectsTableBody.appendChild(tr);

            // === CARDS (MOBILE) ===
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4";
            card.dataset.project = JSON.stringify(project);
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg">${escapeHtml(project.name || 'N/A')}</h3>
                    <span class="status-badge ${getStatusClass(project.status)}">${getStatusText(project.status)}</span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3"><strong>Cliente:</strong> ${escapeHtml(clientUsername)}</p>
                <div class="description-wrapper text-sm mb-4"></div>
                <div class="flex justify-end items-center mt-4 space-x-2">
                    <button class="btn btn-sm bg-red-600 hover:bg-red-700 text-white" onclick="window.rejectProject(this)">Rejeitar</button>
                    <button class="btn btn-sm btn-primary" onclick="window.editProject(this)">Editar</button>
                </div>
            `;
            card.querySelector('.description-wrapper').appendChild(buildDescriptionNode(project.description, 80));
            cardsContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Erro ao buscar projetos:', error);
        showErrorToast('Erro ao carregar projetos.');
    }
}
    
    cancelEditButton.addEventListener('click', () => closeModal(editModal));
    cancelRejectButton.addEventListener('click', () => closeModal(rejectModal));

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editForm.querySelector('#edit-project-id').value;
        const name = editForm.querySelector('#edit-project-name').value;
        const description = editForm.querySelector('#edit-project-description').value;
        const status = editForm.querySelector('#edit-project-status').value;
        try {
            const { error } = await supabase.from('projects').update({ name, description, status }).eq('id', id);
            if (error) throw error;
            showSuccessToast('Projeto atualizado com sucesso!');
            closeModal(editModal);
            await renderProjects();
        } catch (err) {
            console.error('Erro ao atualizar projeto:', err);
            showErrorToast(err.message);
        }
    });

    rejectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = rejectForm.querySelector('#reject-project-id').value;
        const message = rejectForm.querySelector('#reject-message').value;
        try {
            const response = await fetch('/api/reject-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: id, message, adminId: user.id }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Erro no servidor');
            showSuccessToast(result.message);
            closeModal(rejectModal);
            await renderProjects();
        } catch (err) {
            console.error('Erro ao rejeitar projeto:', err);
            showErrorToast(err.message);
        }
    });

    // --- LÓGICA DE QR CODES ---
    async function renderQRCodes() {
        qrcodesTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Carregando...</td></tr>`;
        qrcodesTableBody.dataset.loaded = "true";
        try {
            const { data: links, error } = await supabase.from('qr_links').select(`id, slug, destino, descricao, qr_logs ( count )`).order('created_at', { ascending: false });
            if (error) throw error;
            if (!links || links.length === 0) { qrcodesTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum QR Code criado ainda.</td></tr>`; return; }
            qrcodesTableBody.innerHTML = '';
            links.forEach(link => {
                const tr = document.createElement('tr');
                tr.className = 'border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700';
                tr.dataset.qrLink = JSON.stringify(link);
                tr.innerHTML = `
                    <td class="p-4 text-left font-mono text-sm">${escapeHtml(link.slug)}</td>
                    <td class="p-4 text-left break-all text-sm">${escapeHtml(link.destino)}</td>
                    <td class="p-4 text-left text-sm">${escapeHtml(link.descricao || '---')}</td>
                    
                    <td id="scans-count-${link.id}" class="p-4 text-center font-semibold text-lg">${link.qr_logs[0]?.count || 0}</td>
                    
                    <td class="p-4 text-left space-x-2">
                        <button title="Estatísticas" onclick="statsQrCode(this)" class="btn-icon btn-icon-info">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        </button>
                        <button title="Ver QR Code" onclick="viewQrCode(this)" class="btn-icon btn-icon-secondary">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V8m0 0h-4m4 0l-5-5M4 16v4m0 0h4m-4 0l5-5m11 1v-4m0 0h-4m4 0l-5 5"></path></svg>
                        </button>
                        <button title="Editar" onclick="editQrCode(this)" class="btn-icon btn-icon-primary">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                        </button>
                        <button title="Excluir" onclick="deleteQrCode(this)" class="btn-icon btn-icon-danger">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </td>
                `;
                qrcodesTableBody.appendChild(tr);
            });

            // --- [3/4] CHAMADA ADICIONADA ---
            // Inicia a "escuta" por eventos em tempo real após a tabela ser renderizada.
            listenForQrScans();

        } catch(err) {
            console.error('Erro ao carregar QR Codes:', err);
            showErrorToast('Erro ao carregar QR Codes.');
        }
    }
    
    // --- [4/4] FUNÇÃO ADICIONADA ---
    // Esta função cria a "escuta" de eventos realtime para a tabela 'qr_logs'.
    async function listenForQrScans() {
        console.log('👂 Iniciando escuta por novos scans...');

        // Garante que não estamos criando múltiplas "escutas" (canais)
        if (qrChannel) {
            supabase.removeChannel(qrChannel);
        }

        qrChannel = supabase.channel('qr_logs_changes')
        .on(
            'postgres_changes',
            { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'qr_logs' 
            },
            (payload) => {
            console.log('🟢 Novo scan recebido em tempo real!', payload);
            const newScan = payload.new;
            
            // Encontra a célula de contagem específica usando o ID que criamos
            const countCell = document.getElementById(`scans-count-${newScan.qr_id}`);

            if (countCell) {
                // Pega o valor atual, converte para número, e soma 1
                const currentCount = parseInt(countCell.textContent, 10) || 0;
                countCell.textContent = currentCount + 1;

                // Adiciona um efeito visual para destacar a linha que foi atualizada
                const row = countCell.closest('tr');
                row.classList.add('highlight-update');
                setTimeout(() => {
                    row.classList.remove('highlight-update');
                }, 2000); // Remove o destaque após 2 segundos
            }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Escuta de scans estabelecida com sucesso!');
            }
        });
    }

    createQrBtn.addEventListener('click', () => { qrCodeForm.reset(); qrCodeForm.querySelector('#edit-qrcode-id').value = ''; modalTitle.textContent = 'Criar Novo QR Code'; openModal(qrCodeModal); });
    cancelQrCodeButton.addEventListener('click', () => closeModal(qrCodeModal));
    closeViewQrButton.addEventListener('click', () => closeModal(viewQrModal));
    
    qrCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData(qrCodeForm);
            const id = formData.get('id');
            const qrData = { slug: formData.get('slug'), destino: formData.get('destino'), descricao: formData.get('descricao') };
            const { error } = id ? await supabase.from('qr_links').update(qrData).eq('id', id) : await supabase.from('qr_links').insert({...qrData, admin_id: user.id});
            if(error) throw error;
            showSuccessToast(`QR Code ${id ? 'atualizado' : 'criado'} com sucesso!`);
            closeModal(qrCodeModal);
            await renderQRCodes();
        } catch(err) {
            console.error('Erro ao salvar QR Code:', err);
            showErrorToast(err.message);
        }
    });

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
        openModal(statsModal);
        statsModalTitle.textContent = `Estatísticas para: ${slug}`;
        statsTotalScans.textContent = '...'; statsScans7Days.textContent = '...'; statsTopCountry.textContent = '...';
        topCountriesList.innerHTML = '<li>Carregando...</li>'; topDevicesList.innerHTML = '<li>Carregando...</li>';
        try {
            const { data: logs, error } = await supabase.from('qr_logs').select('created_at, geo, user_agent').eq('qr_id', qrId).order('created_at', { ascending: true });
            if (error) throw error;
            const totalScans = logs.length;
            const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const scansLast7Days = logs.filter(log => new Date(log.created_at) > sevenDaysAgo).length;
            const countryCounts = logs.reduce((acc, log) => { const country = log.geo?.country || 'Desconhecido'; acc[country] = (acc[country] || 0) + 1; return acc; }, {});
            const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
            const deviceCounts = logs.reduce((acc, log) => { const device = parseUserAgent(log.user_agent); acc[device] = (acc[device] || 0) + 1; return acc; }, {});
            const topDevices = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]);
            const scansByDay = logs.reduce((acc, log) => { const day = new Date(log.created_at).toISOString().split('T')[0]; acc[day] = (acc[day] || 0) + 1; return acc; }, {});
            statsTotalScans.textContent = totalScans;
            statsScans7Days.textContent = scansLast7Days;
            statsTopCountry.textContent = topCountries.length > 0 ? topCountries[0][0] : 'N/A';
            topCountriesList.innerHTML = topCountries.slice(0, 5).map(c => `<li class="flex justify-between py-1 border-b dark:border-gray-700"><span>${c[0]}</span><strong>${c[1]}</strong></li>`).join('') || '<li>Nenhum dado</li>';
            topDevicesList.innerHTML = topDevices.slice(0, 5).map(d => `<li class="flex justify-between py-1 border-b dark:border-gray-700"><span>${d[0]}</span><strong>${d[1]}</strong></li>`).join('') || '<li>Nenhum dado</li>';
            if (scansChart) { scansChart.destroy(); }
            scansChart = new Chart(scansOverTimeChartCanvas, {
                type: 'line',
                data: { labels: Object.keys(scansByDay), datasets: [{ label: 'Scans por Dia', data: Object.values(scansByDay), borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.3 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        } catch(err) {
            console.error('Erro ao exibir estatísticas:', err);
            showErrorToast('Erro ao carregar estatísticas.');
        }
    }
    closeStatsModalButton.addEventListener('click', () => closeModal(statsModal));

    // --- FUNÇÕES GLOBAIS PARA onlick ---
    window.editProject = (buttonElement) => {
        const el = buttonElement.closest('[data-project]');
        const project = JSON.parse(el.dataset.project);
        editForm.querySelector('#edit-project-id').value = project.id;
        editForm.querySelector('#edit-project-name').value = project.name || '';
        editForm.querySelector('#edit-project-description').value = project.description || '';
        editForm.querySelector('#edit-project-status').value = project.status || 'pending';
        openModal(editModal);
    };
    window.rejectProject = (buttonElement) => {
        const el = buttonElement.closest('[data-project]');
        const project = JSON.parse(el.dataset.project);
        rejectForm.querySelector('#reject-project-id').value = project.id;
        rejectForm.querySelector('#reject-project-name').value = project.name || '';
        openModal(rejectModal);
    };
    window.statsQrCode = (buttonElement) => {
        const el = buttonElement.closest('[data-qr-link]');
        const link = JSON.parse(el.dataset.qrLink);
        displayStatsForQR(link.id, link.slug);
    };
    window.editQrCode = (buttonElement) => {
        const el = buttonElement.closest('[data-qr-link]');
        const link = JSON.parse(el.dataset.qrLink);
        qrCodeForm.querySelector('#edit-qrcode-id').value = link.id;
        qrCodeForm.querySelector('#qrcode-slug').value = link.slug;
        qrCodeForm.querySelector('#qrcode-destino').value = link.destino;
        qrCodeForm.querySelector('#qrcode-descricao').value = link.descricao || '';
        modalTitle.textContent = 'Editar QR Code';
        openModal(qrCodeModal);
    };
    window.deleteQrCode = async (buttonElement) => {
        const el = buttonElement.closest('[data-qr-link]');
        const link = JSON.parse(el.dataset.qrLink);
        if (confirm(`Tem certeza que deseja excluir o QR Code "${link.slug}"?`)) {
            try {
                const { error } = await supabase.from('qr_links').delete().eq('id', link.id);
                if (error) throw error;
                showSuccessToast('QR Code excluído com sucesso.');
                await renderQRCodes();
            } catch (err) {
                console.error('Erro ao deletar QR Code:', err);
                showErrorToast(err.message);
            }
        }
    };
    window.viewQrCode = (buttonElement) => {
        const el = buttonElement.closest('[data-qr-link]');
        const link = JSON.parse(el.dataset.qrLink);
        const qrUrl = `${window.location.origin}/api/qr/${link.slug}`;
        qrLinkDisplay.textContent = qrUrl;
        QRCode.toCanvas(qrCanvas, qrUrl, { width: 256 }, (error) => {
            if (error) console.error(error);
            downloadQrLink.href = qrCanvas.toDataURL('image/png');
        });
        openModal(viewQrModal);
    };

    // --- INICIALIZAÇÃO DA PÁGINA ---
    setActiveLink(navLinkProjects);
    showContent(contentProjects);
    await renderProjects();
    
    console.log('✅ Admin inicializado com sucesso');
}