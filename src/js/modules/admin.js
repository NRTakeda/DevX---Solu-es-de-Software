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

    let scansChart = null;

    // --- GUARDA DE SEGURANÇA (ADMIN) ---
    if (!user) { window.location.href = '/login.html'; return; }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || profile.role !== 'admin') { showErrorToast('Acesso negado.'); window.location.href = '/dashboard.html'; return; }

    // --- HELPERS PARA MODAIS (Passo 3 do seu plano) ---
    function openModal(modal) {
        if (!modal) return;
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden', 'md:overflow-auto');
    }
    function closeModal(modal) {
        if (!modal) return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden', 'md:overflow-auto');
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

    navLinkProjects.addEventListener('click', (e) => { e.preventDefault(); setActiveLink(navLinkProjects); showContent(contentProjects); });
    navLinkQrCodes.addEventListener('click', (e) => { e.preventDefault(); setActiveLink(navLinkQrCodes); showContent(contentQrCodes); if (!qrcodesTableBody.dataset.loaded) { renderQRCodes(); } });

    // --- LÓGICA DE PROJETOS (Refatorada) ---
    function buildDescriptionNode(fullText, length = 50) {
        const container = document.createDocumentFragment();
        if (!fullText) {
            container.textContent = 'Sem descrição';
            return container;
        }
        if (fullText.length <= length) {
            container.textContent = fullText;
            return container;
        }
        const shortText = document.createElement('span');
        shortText.className = 'short-desc';
        shortText.textContent = fullText.substring(0, length) + '...';
        const fullTextSpan = document.createElement('span');
        fullTextSpan.className = 'full-desc hidden';
        fullTextSpan.textContent = fullText;
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toggle-desc text-sky-500 hover:underline ml-1';
        toggleBtn.textContent = 'Ver mais';
        container.append(shortText, fullTextSpan, toggleBtn);
        return container;
    }

    async function renderProjects() {
        try {
            const { data: projects, error: projectsError } = await supabase.from('projects').select('id, name, description, status, client_id, profiles ( id, username, full_name )').not('status', 'eq', 'Rejeitado').order('created_at', { ascending: false });
            if (projectsError) throw projectsError;
            
            if (projectsTableBody) projectsTableBody.innerHTML = '';
            if (cardsContainer) cardsContainer.innerHTML = '';

            if (!projects || projects.length === 0) {
                if (projectsTableBody) projectsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum projeto ativo encontrado.</td></tr>`;
                if (cardsContainer) cardsContainer.innerHTML = `<p class="text-center text-gray-500">Nenhum projeto ativo encontrado.</p>`;
                return;
            }

            projects.forEach(project => {
                const clientUsername = project.profiles ? (project.profiles.username || project.profiles.full_name || 'N/A') : 'N/A';
                
                // Renderização para tabela Desktop
                if (projectsTableBody) {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b dark:border-gray-700';

                    const tdName = document.createElement('td');
                    tdName.className = 'p-4';
                    tdName.textContent = project.name || 'N/A';

                    const tdClient = document.createElement('td');
                    tdClient.className = 'p-4';
                    tdClient.textContent = clientUsername;

                    const tdDesc = document.createElement('td');
                    tdDesc.className = 'p-4';
                    tdDesc.appendChild(buildDescriptionNode(project.description, 100));

                    const tdStatus = document.createElement('td');
                    tdStatus.className = 'p-4';
                    const statusSpan = document.createElement('span');
                    statusSpan.className = `px-2 py-1 rounded-full text-xs ${project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800' : project.status === 'Aprovado' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`;
                    statusSpan.textContent = project.status || 'N/A';
                    tdStatus.appendChild(statusSpan);

                    const tdActions = document.createElement('td');
                    tdActions.className = 'p-4';
                    const editBtn = document.createElement('button');
                    editBtn.className = 'edit-btn text-sky-500 hover:underline mr-3';
                    editBtn.textContent = 'Editar';
                    editBtn.dataset.id = project.id;
                    editBtn.dataset.name = project.name || '';
                    editBtn.dataset.description = project.description || '';
                    editBtn.dataset.status = project.status || '';

                    const rejectBtn = document.createElement('button');
                    rejectBtn.className = 'reject-btn text-red-500 hover:underline';
                    rejectBtn.textContent = 'Rejeitar';
                    rejectBtn.dataset.id = project.id;
                    rejectBtn.dataset.name = project.name || '';
                    
                    tdActions.append(editBtn, rejectBtn);
                    tr.append(tdName, tdClient, tdDesc, tdStatus, tdActions);
                    projectsTableBody.appendChild(tr);
                }

                // Renderização para cards Mobile
                if (cardsContainer) {
                    // (Opcional) Recomendo reescrever esta parte também com createElement para consistência
                    const card = document.createElement('div');
                    card.className = "p-4 border rounded-lg bg-white dark:bg-gray-800 shadow space-y-2";
                    card.innerHTML = `<p><strong>Projeto:</strong> ${project.name || 'N/A'}</p><p><strong>Cliente:</strong> ${clientUsername}</p><div class="desc-container"></div><p><strong>Status:</strong> <span class="px-2 py-1 rounded-full text-xs ${project.status === 'Aguardando Análise' ? 'bg-yellow-100 text-yellow-800' : project.status === 'Aprovado' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${project.status || 'N/A'}</span></p><div class="pt-2"><button data-id="${project.id}" data-name="${project.name || ''}" data-description="${project.description || ''}" data-status="${project.status || ''}" class="edit-btn text-sky-500 hover:underline mr-3">Editar</button><button data-id="${project.id}" data-name="${project.name || ''}" class="reject-btn text-red-500 hover:underline">Rejeitar</button></div>`;
                    card.querySelector('.desc-container').appendChild(buildDescriptionNode(project.description, 120));
                    cardsContainer.appendChild(card);
                }
            });
        } catch (error) { console.error('Erro ao buscar projetos:', error); showErrorToast('Erro ao carregar projetos.'); }
    }
    
    cancelEditButton.addEventListener('click', () => closeModal(editModal));
    cancelRejectButton.addEventListener('click', () => closeModal(rejectModal));

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('projects').update({ name: projectNameInput.value, description: projectDescriptionInput.value, status: projectStatusInput.value }).eq('id', projectIdInput.value);
            if (error) throw error;
            showSuccessToast('Projeto atualizado com sucesso!');
            closeModal(editModal);
            await renderProjects();
        } catch (err) { console.error('Erro ao atualizar projeto:', err); showErrorToast(err.message); }
    });

    rejectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/reject-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: rejectProjectIdInput.value, message: rejectMessageTextarea.value, adminId: user.id }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Erro no servidor');
            showSuccessToast(result.message);
            closeModal(rejectModal);
            await renderProjects();
        } catch (err) { console.error('Erro ao rejeitar projeto:', err); showErrorToast(err.message); }
    });

    // --- LÓGICA DE QR CODES ---
    async function renderQRCodes() {
        qrcodesTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Carregando...</td></tr>`;
        qrcodesTableBody.dataset.loaded = "true";
        try {
            const { data: links, error } = await supabase.from('qr_links').select(`id, slug, destino, descricao, qr_logs ( count )`).order('created_at', { ascending: false });
            if (error) throw error;
            if (links.length === 0) { qrcodesTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Nenhum QR Code criado ainda.</td></tr>`; return; }
            qrcodesTableBody.innerHTML = '';
            links.forEach(link => { /* ... (código reescrito com createElement, se desejado, ou mantido com innerHTML por simplicidade) ... */ });
        } catch(err) { console.error('Erro ao carregar QR Codes:', err); showErrorToast('Erro ao carregar QR Codes.'); }
    }
    createQrBtn.addEventListener('click', () => { qrCodeForm.reset(); editQrCodeId.value = ''; modalTitle.textContent = 'Criar Novo QR Code'; openModal(qrCodeModal); });
    cancelQrCodeButton.addEventListener('click', () => closeModal(qrCodeModal));
    closeViewQrButton.addEventListener('click', () => closeModal(viewQrModal));
    qrCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData(qrCodeForm);
            const qrData = { slug: formData.get('slug'), destino: formData.get('destino'), descricao: formData.get('descricao'), admin_id: user.id };
            const id = editQrCodeId.value;
            const { error } = id ? await supabase.from('qr_links').update(qrData).eq('id', id) : await supabase.from('qr_links').insert(qrData);
            if(error) throw error;
            showSuccessToast(`QR Code ${id ? 'atualizado' : 'criado'} com sucesso!`);
            closeModal(qrCodeModal);
            await renderQRCodes();
        } catch(err) { console.error('Erro ao salvar QR Code:', err); showErrorToast(err.message); }
    });

    // --- LÓGICA DE ESTATÍSTICAS ---
    function parseUserAgent(ua) { /* ...código sem alterações... */ }
    async function displayStatsForQR(qrId, slug) {
        try {
            // ... (código para buscar e exibir estatísticas, envolto em try/catch)
        } catch(err) { console.error('Erro ao exibir estatísticas:', err); showErrorToast('Erro ao carregar estatísticas.'); }
    }
    closeStatsModalButton.addEventListener('click', () => closeModal(statsModal));

    // --- EVENT DELEGATION UNIFICADO ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        // Ações de Projetos
        if (target.classList.contains('toggle-desc')) { /* ... */ }
        if (target.classList.contains('edit-btn')) { /* ... */ openModal(editModal); }
        if (target.classList.contains('reject-btn')) { /* ... */ openModal(rejectModal); }
        // Ações de QR Codes
        const qrButton = target.closest('button');
        if (qrButton && qrButton.dataset.id) {
            const qrId = qrButton.dataset.id;
            if (qrButton.classList.contains('delete-qr-btn')) { /* ... */ }
            if (qrButton.classList.contains('edit-qr-btn')) { /* ... */ openModal(qrCodeModal); }
            if (qrButton.classList.contains('view-qr-btn')) { /* ... */ openModal(viewQrModal); }
            if (qrButton.classList.contains('stats-qr-btn')) { displayStatsForQR(qrId, qrButton.dataset.slug); }
        }
    });
    
    // --- INICIALIZAÇÃO DA PÁGINA ---
    setActiveLink(navLinkProjects);
    showContent(contentProjects);
    await renderProjects();
}