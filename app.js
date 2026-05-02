// State Management
function loadAllData() {
    try {
        const data = localStorage.getItem('nujoom_branch_data');
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Error loading data:", e);
        return {};
    }
}

let allData = loadAllData();
let currentBranch = localStorage.getItem('nujoom_current_branch') || null;

// Initial Setup & Migration
function initializeData() {
    if (Object.keys(allData).length === 0) {
        const oldEntries = localStorage.getItem('nujoom_entries');
        if (oldEntries) {
            try {
                allData["Branch 1"] = JSON.parse(oldEntries);
                allData["Branch 2"] = [];
                localStorage.removeItem('nujoom_entries');
            } catch(e) {
                allData = { "Branch 1": [], "Branch 2": [] };
            }
        } else {
            allData = { "Branch 1": [], "Branch 2": [] };
        }
        localStorage.setItem('nujoom_branch_data', JSON.stringify(allData));
    }

    // Cleanup any accidental "null" branch
    if (allData["null"]) delete allData["null"];
    if (allData[null]) delete allData[null];
}

initializeData();

let currentYear = new Date().getFullYear();
let activeView = 'dashboard';
let selectedMonth = null; 
let editingId = null;
let editingDocId = null;
let activeDocType = 'employee';

let entries = currentBranch ? (allData[currentBranch] || []) : [];
let documents = [];
try {
    const savedDocs = localStorage.getItem('nujoom_documents');
    documents = savedDocs ? JSON.parse(savedDocs) : [];
} catch (e) {
    console.error("Error loading documents:", e);
}

// DOM Elements
let desktopSidebar, mobileNavbar, mainContent, branchSelectionView, branchButtonsContainer;
let displayBranchNames = [];
let dashboardView, monthDetailView, employeeDocsView, companyDocsView;
let entryModalEl, docModalEl, entryForm, docForm;
let monthsGrid, dailyEntriesBody, previewInc, otherExpContainer, addExpItemBtn;
let entryModal, docModal;

// Immediate Init Attempt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    try {
        // Lookup DOM Elements
        desktopSidebar = document.getElementById('desktop-sidebar');
        mobileNavbar = document.getElementById('mobile-navbar');
        mainContent = document.querySelector('.content');
        branchSelectionView = document.getElementById('branch-selection-view');
        branchButtonsContainer = document.getElementById('branch-buttons');
        displayBranchNames = [
            document.getElementById('display-branch-name'),
            document.getElementById('display-branch-name-mobile')
        ];
        dashboardView = document.getElementById('dashboard-view');
        monthDetailView = document.getElementById('month-detail-view');
        employeeDocsView = document.getElementById('employee-docs-view');
        companyDocsView = document.getElementById('company-docs-view');
        entryModalEl = document.getElementById('entry-modal');
        docModalEl = document.getElementById('doc-modal');
        entryForm = document.getElementById('entry-form');
        docForm = document.getElementById('doc-form');
        monthsGrid = document.getElementById('months-grid');
        dailyEntriesBody = document.getElementById('daily-entries-body');
        previewInc = document.getElementById('preview-inc');
        otherExpContainer = document.getElementById('other-expenses-container');
        addExpItemBtn = document.getElementById('add-expense-item');

        // Render branches first thing!
        if (!currentBranch || !allData[currentBranch]) {
            showBranchPicker();
        } else {
            startApp(currentBranch);
        }

        // Initialize Bootstrap Modals safely
        if (typeof bootstrap !== 'undefined') {
            if (entryModalEl) entryModal = new bootstrap.Modal(entryModalEl);
            if (docModalEl) docModal = new bootstrap.Modal(docModalEl);
        }

        setupEventListeners();
    } catch (err) {
        console.error("Initialization error:", err);
        // Emergency render if something failed
        if (branchButtonsContainer && branchButtonsContainer.innerHTML === '') {
            renderBranchButtons();
        }
    }
}

function setupEventListeners() {
    const addEntryBtn = document.getElementById('add-entry-btn');
    if (addEntryBtn) {
        addEntryBtn.addEventListener('click', () => {
            editingId = null;
            if (entryForm) entryForm.reset();
            if (otherExpContainer) otherExpContainer.innerHTML = '';
            const dateEl = document.getElementById('date');
            if (dateEl) dateEl.valueAsDate = new Date();
            updatePreview();
        });
    }

    if (entryForm) entryForm.addEventListener('submit', handleEntrySubmit);
    
    const backBtn = document.getElementById('back-to-dashboard');
    if (backBtn) backBtn.addEventListener('click', () => switchView('dashboard'));

    ['cas', 'ba', 'cb', 'bb'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePreview);
    });

    if (addExpItemBtn) addExpItemBtn.addEventListener('click', () => addExpenseRow());
    
    ['switch-branch-btn', 'switch-branch-btn-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', showBranchPicker);
    });

    const addBranchBtn = document.getElementById('add-branch-btn');
    if (addBranchBtn) addBranchBtn.addEventListener('click', addNewBranch);

    ['theme-toggle', 'theme-toggle-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', nextTheme);
            });
        }
    });

    const navMapping = {
        'nav-dashboard': 'dashboard',
        'nav-dashboard-mobile': 'dashboard',
        'nav-employee-docs': 'employee-docs',
        'nav-employee-docs-mobile': 'employee-docs',
        'nav-company-docs': 'company-docs',
        'nav-company-docs-mobile': 'company-docs'
    };

    Object.keys(navMapping).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => switchView(navMapping[id]));
        }
    });

    document.querySelectorAll('.add-doc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeDocType = btn.dataset.type;
            editingDocId = null;
            if (docForm) docForm.reset();
            updateDocFormLabels(activeDocType);
        });
    });

    if (docForm) docForm.addEventListener('submit', handleDocSubmit);

    const downloadBtn = document.getElementById('download-report-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadMonthlyReport);
}

function showBranchPicker() {
    if (branchSelectionView) {
        branchSelectionView.classList.add('active');
        branchSelectionView.style.display = 'flex';
    }
    if (desktopSidebar) desktopSidebar.style.display = 'none';
    if (mobileNavbar) mobileNavbar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    renderBranchButtons();
}

function renderBranchButtons() {
    if (!branchButtonsContainer) return;
    branchButtonsContainer.innerHTML = '';
    
    // Safety check data
    if (Object.keys(allData).length === 0) {
        allData = { "Branch 1": [], "Branch 2": [] };
        localStorage.setItem('nujoom_branch_data', JSON.stringify(allData));
    }

    Object.keys(allData).forEach(name => {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 mb-3';
        col.innerHTML = `
            <div class="branch-item h-100">
                <button class="branch-btn shadow-sm" style="background-color: #f8fafc; border: 2px solid #e2e8f0;">
                    <span class="branch-name d-block mb-1 text-truncate" style="color: #1e293b;">${name}</span>
                    <small class="text-muted d-block">${allData[name].length} Entries</small>
                </button>
                <div class="branch-actions d-flex gap-2 justify-content-center mt-3">
                    <button class="btn btn-sm btn-white bg-white shadow-sm border edit-branch-btn rounded-pill px-3" title="Rename Branch">
                        <small class="fw-bold">✏️ Edit</small>
                    </button>
                    <button class="btn btn-sm btn-white bg-white shadow-sm border text-danger delete-branch-btn rounded-pill px-3" title="Delete Branch">
                        <small class="fw-bold">🗑️ Delete</small>
                    </button>
                </div>
            </div>
        `;
        
        const mainBtn = col.querySelector('.branch-btn');
        if (mainBtn) mainBtn.onclick = () => selectBranch(name);
        
        const editBtn = col.querySelector('.edit-branch-btn');
        if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); editBranch(name); };
        
        const delBtn = col.querySelector('.delete-branch-btn');
        if (delBtn) delBtn.onclick = (e) => { e.stopPropagation(); deleteBranch(name); };
        
        branchButtonsContainer.appendChild(col);
    });
}

function editBranch(oldName) {
    const newName = prompt('Enter new branch name:', oldName);
    if (newName && newName !== oldName && !allData[newName]) {
        allData[newName] = allData[oldName];
        delete allData[oldName];
        if (currentBranch === oldName) currentBranch = newName;
        localStorage.setItem('nujoom_current_branch', currentBranch);
        saveAllData();
        renderBranchButtons();
    }
}

function deleteBranch(name) {
    if (confirm(`Are you sure you want to delete "${name}"? All entries will be lost.`)) {
        delete allData[name];
        if (currentBranch === name) {
            currentBranch = null;
            localStorage.removeItem('nujoom_current_branch');
        }
        saveAllData();
        renderBranchButtons();
    }
}

function selectBranch(name) {
    currentBranch = name;
    entries = allData[name] || [];
    localStorage.setItem('nujoom_current_branch', name);
    startApp(name);
}

function addNewBranch() {
    const input = document.getElementById('new-branch-name');
    if (!input) return;
    const name = input.value.trim();
    if (name && name.toLowerCase() !== 'null' && !allData[name]) {
        allData[name] = [];
        saveAllData();
        renderBranchButtons();
        input.value = '';
    }
}

function startApp(branchName) {
    if (branchSelectionView) {
        branchSelectionView.classList.remove('active');
        branchSelectionView.style.display = 'none';
    }
    if (desktopSidebar) desktopSidebar.style.display = 'flex';
    if (mobileNavbar) mobileNavbar.style.display = 'block';
    if (mainContent) mainContent.style.display = 'block';
    
    displayBranchNames.forEach(el => {
        if (el) el.textContent = branchName;
    });
    
    switchView('dashboard');
    updateYearlyStats();
}

function saveAllData() {
    localStorage.setItem('nujoom_branch_data', JSON.stringify(allData));
}

function saveEntries() {
    if (currentBranch) {
        allData[currentBranch] = entries;
        saveAllData();
    }
    updateYearlyStats();
}

function switchView(viewName) {
    activeView = viewName;
    if (dashboardView) dashboardView.classList.toggle('active', viewName === 'dashboard');
    if (monthDetailView) monthDetailView.classList.toggle('active', viewName === 'month-detail');
    if (employeeDocsView) employeeDocsView.classList.toggle('active', viewName === 'employee-docs');
    if (companyDocsView) companyDocsView.classList.toggle('active', viewName === 'company-docs');
    
    const titles = {
        'dashboard': 'Dashboard',
        'month-detail': 'Month Detail',
        'employee-docs': 'Employee Documents',
        'company-docs': 'Company Documents'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    const activeNavIds = {
        'dashboard': ['nav-dashboard', 'nav-dashboard-mobile'],
        'employee-docs': ['nav-employee-docs', 'nav-employee-docs-mobile'],
        'company-docs': ['nav-company-docs', 'nav-company-docs-mobile']
    };

    if (activeNavIds[viewName]) {
        activeNavIds[viewName].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
        });
    }

    if (viewName === 'dashboard') {
        renderDashboard();
    } else if (viewName === 'employee-docs') {
        renderDocuments('employee');
    } else if (viewName === 'company-docs') {
        renderDocuments('company');
    }
    
    window.scrollTo(0, 0);
}

function updateDocFormLabels(type) {
    const lblDocName = document.getElementById('lblDocName');
    const lblPersonName = document.getElementById('lblPersonName');
    const categorySelect = document.getElementById('docCategory');
    const title = docModalEl ? docModalEl.querySelector('h2') : null;
    
    if (type === 'company') {
        if (title) title.textContent = 'Manage Company Document';
        if (lblDocName) lblDocName.textContent = 'Company Document Name';
        if (lblPersonName) lblPersonName.textContent = 'Company/Owner Name';
        if (categorySelect) categorySelect.innerHTML = `
            <option value="Trade License">Trade License</option>
            <option value="VAT/Tax Paper">VAT/Tax Paper</option>
            <option value="Rental Contract">Rental Contract</option>
            <option value="Vehicle Mulkia">Vehicle Mulkia (Registration)</option>
            <option value="Insurance Policy">Insurance Policy</option>
            <option value="Civil Defense">Civil Defense</option>
            <option value="Municipality Card">Municipality Card</option>
            <option value="Other">Other Company Doc</option>
        `;
    } else {
        if (title) title.textContent = 'Manage Employee Document';
        if (lblDocName) lblDocName.textContent = 'Document Name';
        if (lblPersonName) lblPersonName.textContent = 'Employee Name';
        if (categorySelect) categorySelect.innerHTML = `
            <option value="Passport">Passport</option>
            <option value="Visa">Visa</option>
            <option value="Emirates ID">Emirates ID / ID Card</option>
            <option value="Labor Card">Labor Card</option>
            <option value="Health Insurance">Health Insurance</option>
            <option value="Driving License">Driving License</option>
            <option value="Other">Other Employee Doc</option>
        `;
    }
}

function calculateEntry(entry) {
    const bb = Number(entry.bb) || 0, cb = Number(entry.cb) || 0, cas = Number(entry.cas) || 0, ba = Number(entry.ba) || 0;
    let otherAmt = 0, otherDetails = [];
    if (entry.otherExpenses) {
        entry.otherExpenses.forEach(exp => {
            otherAmt += Number(exp.amt) || 0;
            if (exp.type) otherDetails.push(`${exp.type}: ₹${exp.amt}`);
        });
    }
    const bk = bb + cb, inc = bk + cas;
    return { bk, cas, ba, cb, bb, inc, otherAmt, otherText: otherDetails.join(', ') || '-' };
}

function updatePreview() {
    const bbEl = document.getElementById('bb');
    const cbEl = document.getElementById('cb');
    const casEl = document.getElementById('cas');
    if (!bbEl || !cbEl || !casEl) return;

    const data = { 
        bb: bbEl.value, 
        cb: cbEl.value, 
        cas: casEl.value, 
        otherExpenses: [] 
    };
    document.querySelectorAll('.expense-row').forEach(row => {
        data.otherExpenses.push({ type: row.querySelector('.exp-type').value, amt: row.querySelector('.exp-amt').value });
    });
    const calc = calculateEntry(data);
    const bkEl = document.getElementById('bk');
    if (bkEl) bkEl.value = calc.bk.toFixed(2);
    if (previewInc) previewInc.textContent = `₹${calc.inc.toFixed(2)}`;
}

function handleEntrySubmit(e) {
    e.preventDefault();
    if (!entryForm) return;
    const formData = new FormData(entryForm);
    const entryData = Object.fromEntries(formData.entries());
    entryData.otherExpenses = [];
    document.querySelectorAll('.expense-row').forEach(row => {
        const type = row.querySelector('.exp-type').value, amt = row.querySelector('.exp-amt').value;
        if (type || amt) entryData.otherExpenses.push({ type, amt });
    });
    if (editingId) {
        const index = entries.findIndex(ent => ent.id === editingId);
        if (index !== -1) entries[index] = { ...entryData, id: editingId };
        editingId = null;
    } else {
        entryData.id = Date.now();
        entries.push(entryData);
    }
    saveEntries();
    if (entryModal) entryModal.hide();
    if (activeView === 'month-detail') renderMonthDetail(selectedMonth.month, selectedMonth.year); else renderDashboard();
}

function addExpenseRow(type = '', amt = '') {
    const div = document.createElement('div');
    div.className = 'expense-row mb-2';
    div.innerHTML = `
        <input type="text" placeholder="Description" class="exp-type form-control form-control-sm" value="${type}">
        <input type="number" placeholder="Amt" class="exp-amt form-control form-control-sm" value="${amt}" step="0.01">
        <button type="button" class="btn btn-sm btn-link text-danger remove-row p-0">✕</button>
    `;
    div.querySelector('.remove-row').onclick = () => { div.remove(); updatePreview(); };
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', updatePreview));
    if (otherExpContainer) otherExpContainer.appendChild(div);
}

function editEntry(id) {
    const entry = entries.find(ent => ent.id == id);
    if (!entry) return;
    editingId = id;
    if (otherExpContainer) otherExpContainer.innerHTML = '';
    Object.keys(entry).forEach(key => {
        if (key !== 'otherExpenses') {
            if (entryForm) {
                const input = entryForm.elements[key];
                if (input) input.value = entry[key];
            }
        }
    });
    if (entry.otherExpenses) entry.otherExpenses.forEach(exp => addExpenseRow(exp.type, exp.amt));
    updatePreview();
    if (entryModal) entryModal.show();
}

function deleteEntry(id) {
    if (confirm('Delete this entry?')) {
        entries = entries.filter(e => e.id != id);
        saveEntries();
        if (selectedMonth) renderMonthDetail(selectedMonth.month, selectedMonth.year);
    }
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function renderDashboard() {
    if (!monthsGrid) return;
    monthsGrid.innerHTML = '';
    for (let m = 0; m < 12; m++) {
        const monthEntries = entries.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === m && d.getFullYear() === currentYear;
        });
        let totalInc = 0, totalBk = 0;
        monthEntries.forEach(e => {
            const calc = calculateEntry(e);
            totalInc += calc.inc; totalBk += calc.bk;
        });
        
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 col-xl-3';
        col.innerHTML = `
            <div class="month-card shadow-sm border-0">
                <h3 class="h5 fw-bold mb-4">${monthNames[m]} ${currentYear}</h3>
                <div class="month-stat">
                    <span class="text-muted">INC</span>
                    <span class="income-text">₹${totalInc.toLocaleString()}</span>
                </div>
                <div class="month-stat">
                    <span class="text-muted">BK</span>
                    <span class="expense-text">₹${totalBk.toLocaleString()}</span>
                </div>
                <div class="month-stat profit border-top pt-3 mt-3">
                    <span class="text-muted">Growth</span>
                    <span class="text-primary">₹${(totalInc - totalBk).toLocaleString()}</span>
                </div>
            </div>
        `;
        col.querySelector('.month-card').onclick = () => openMonthDetail(m, currentYear);
        monthsGrid.appendChild(col);
    }
}

function updateYearlyStats() {
    let inc = 0, bk = 0;
    entries.filter(e => new Date(e.date).getFullYear() === currentYear).forEach(e => {
        const c = calculateEntry(e); inc += c.inc; bk += c.bk;
    });
    const incEl = document.getElementById('year-income');
    const expEl = document.getElementById('year-expense');
    const proEl = document.getElementById('year-profit');
    if (incEl) incEl.textContent = `₹${inc.toLocaleString()}`;
    if (expEl) expEl.textContent = `₹${bk.toLocaleString()}`;
    if (proEl) proEl.textContent = `₹${(inc - bk).toLocaleString()}`;
}

function openMonthDetail(m, y) {
    selectedMonth = { month: m, year: y };
    const monthEl = document.getElementById('selected-month-name');
    if (monthEl) monthEl.textContent = `${monthNames[m]} ${y}`;
    renderMonthDetail(m, y);
    switchView('month-detail');
}

function renderMonthDetail(m, y) {
    if (!dailyEntriesBody) return;
    const monthEntries = entries.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === m && d.getFullYear() === y;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    dailyEntriesBody.innerHTML = '';
    let cbk = 0, ccs = 0, cin = 0, tba = 0, tbb = 0, tcs = 0, tcb = 0;
    
    monthEntries.forEach(e => {
        const c = calculateEntry(e);
        cbk += c.bk; ccs += c.cas; cin += c.inc; tba += c.ba; tbb += c.bb; tcs += c.cas; tcb += c.cb;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="text-nowrap">${new Date(e.date).toLocaleDateString()}</span></td>
            <td>₹${c.bk.toFixed(0)}</td>
            <td>₹${c.cas.toFixed(0)}</td>
            <td>₹${c.ba.toFixed(0)}</td>
            <td>₹${c.cb.toFixed(0)}</td>
            <td>₹${c.bb.toFixed(0)}</td>
            <td class="income-text">₹${c.inc.toFixed(0)}</td>
            <td class="small text-muted">${c.otherText}</td>
            <td>₹${cbk.toFixed(0)}</td>
            <td>₹${ccs.toFixed(0)}</td>
            <td class="profit-text text-primary">₹${cin.toFixed(0)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon edit" title="Edit">✏️</button>
                    <button class="btn-icon delete" title="Delete">🗑️</button>
                </div>
            </td>
        `;
        
        const eBtn = tr.querySelector('.edit');
        if (eBtn) eBtn.onclick = () => editEntry(e.id);
        const dBtn = tr.querySelector('.delete');
        if (dBtn) dBtn.onclick = () => deleteEntry(e.id);
        dailyEntriesBody.appendChild(tr);
    });

    const ci = document.getElementById('cash-inflow');
    const co = document.getElementById('cash-outflow');
    const cc = document.getElementById('cash-closing');
    const bi = document.getElementById('bank-inflow');
    const bo = document.getElementById('bank-outflow');
    const bc = document.getElementById('bank-closing');
    if (ci) ci.textContent = `₹${tcs.toLocaleString()}`;
    if (co) co.textContent = `₹${tcb.toLocaleString()}`;
    if (cc) cc.textContent = `₹${(tcs - tcb).toLocaleString()}`;
    if (bi) bi.textContent = `₹${tba.toLocaleString()}`;
    if (bo) bo.textContent = `₹${tbb.toLocaleString()}`;
    if (bc) bc.textContent = `₹${(tba - tbb).toLocaleString()}`;
    renderExpenseSummary(monthEntries);
}

function renderExpenseSummary(monthEntries) {
    const summaryGrid = document.getElementById('expense-summary-grid');
    if (!summaryGrid) return;
    summaryGrid.innerHTML = '';
    const totals = {};
    monthEntries.forEach(e => {
        if (e.otherExpenses) {
            e.otherExpenses.forEach(exp => {
                const name = (exp.type || 'Other').trim().toLowerCase();
                const amt = Number(exp.amt) || 0;
                if (!totals[name]) totals[name] = { display: exp.type || 'Other', total: 0 };
                totals[name].total += amt;
            });
        }
    });
    const items = Object.values(totals);
    const container = document.getElementById('expense-summary-container');
    if (container) container.style.display = items.length ? 'block' : 'none';
    items.forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-6 col-sm-4 col-md-3 col-lg-2';
        col.innerHTML = `
            <div class="card border-0 bg-light p-3 h-100 shadow-sm">
                <span class="text-muted small fw-bold text-uppercase mb-1">${item.display}</span>
                <span class="h5 fw-bold mb-0 text-primary">₹${item.total.toLocaleString()}</span>
            </div>
        `;
        summaryGrid.appendChild(col);
    });
}

function handleDocSubmit(e) {
    e.preventDefault();
    if (!docForm) return;
    const formData = new FormData(docForm);
    const docData = Object.fromEntries(formData.entries());
    docData.docType = activeDocType;
    if (editingDocId) {
        const index = documents.findIndex(d => d.id == editingDocId);
        if (index !== -1) documents[index] = { ...docData, id: editingDocId, docType: activeDocType };
        editingDocId = null;
    } else {
        docData.id = Date.now();
        documents.push(docData);
    }
    saveDocuments();
    if (docModal) docModal.hide();
    renderDocuments(activeDocType);
}

function saveDocuments() { localStorage.setItem('nujoom_documents', JSON.stringify(documents)); }

function renderDocuments(type) {
    const listBody = document.querySelector(`.docs-list-body[data-type="${type}"]`);
    const statsContainer = document.getElementById(`${type}-stats`);
    if (!listBody || !statsContainer) return;
    listBody.innerHTML = '';
    const today = new Date(); today.setHours(0,0,0,0);
    let expired = 0, soon = 0, activeCount = 0;
    
    documents.filter(d => d.docType === type).forEach(doc => {
        const expiry = new Date(doc.expiryDate); expiry.setHours(0,0,0,0);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        let status = 'Active', statusClass = 'status-active', timeText = '';
        
        if (diffDays < 0) { 
            status = 'Expired'; statusClass = 'status-expired'; timeText = `(${Math.abs(diffDays)} days ago)`; expired++; 
        } else if (diffDays === 0) { 
            status = 'Expires Today'; statusClass = 'status-soon'; timeText = '(Today)'; soon++; 
        } else if (diffDays <= 30) { 
            status = 'Expiring Soon'; statusClass = 'status-soon'; timeText = `(In ${diffDays} days)`; soon++; 
        } else { 
            timeText = `(In ${diffDays} days)`; activeCount++; 
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${doc.docName}</strong></td>
            <td>${doc.personName}</td>
            <td><span class="badge bg-light text-dark fw-normal border">${doc.docCategory}</span></td>
            <td>${doc.docNumber || '-'}</td>
            <td>
                <span class="text-nowrap">${new Date(doc.expiryDate).toLocaleDateString()}</span><br>
                <small class="text-muted">${timeText}</small>
            </td>
            <td><span class="status-badge ${statusClass}">${status}</span></td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon edit" title="Edit">✏️</button>
                    <button class="btn-icon delete" title="Delete">🗑️</button>
                </div>
            </td>
        `;
        
        const eBtn = tr.querySelector('.edit');
        if (eBtn) eBtn.onclick = () => editDoc(doc.id);
        const dBtn = tr.querySelector('.delete');
        if (dBtn) dBtn.onclick = () => deleteDoc(doc.id);
        listBody.appendChild(tr);
    });
    
    const expEl = statsContainer.querySelector('.count-expired');
    const soonEl = statsContainer.querySelector('.count-soon');
    const actEl = statsContainer.querySelector('.count-active');
    if (expEl) expEl.textContent = expired;
    if (soonEl) soonEl.textContent = soon;
    if (actEl) actEl.textContent = activeCount;
}

function editDoc(id) {
    const doc = documents.find(d => d.id == id);
    if (!doc) return;
    editingDocId = id; activeDocType = doc.docType;
    updateDocFormLabels(activeDocType);
    if (docForm) {
        Object.keys(doc).forEach(key => { 
            const input = docForm.elements[key]; 
            if (input) input.value = doc[key]; 
        });
    }
    if (docModal) docModal.show();
}

function deleteDoc(id) {
    if (confirm('Delete this document?')) {
        documents = documents.filter(d => d.id != id);
        saveDocuments();
        renderDocuments(activeDocType);
    }
}

function downloadMonthlyReport() {
    if (!selectedMonth) return;
    const m = selectedMonth.month, y = selectedMonth.year;
    const monthEntries = entries.filter(e => { const d = new Date(e.date); return d.getMonth() === m && d.getFullYear() === y; }).sort((a,b) => new Date(a.date)-new Date(b.date));
    if (!monthEntries.length) return alert('No data');
    let csv = 'Date,BK,CAS,BA,CB,BB,INC,T.B,T.C,T.I\n';
    let cbk = 0, ccs = 0, cin = 0;
    monthEntries.forEach(e => {
        const c = calculateEntry(e); cbk += c.bk; ccs += c.cas; cin += c.inc;
        csv += `${e.date},${c.bk},${c.cas},${c.ba},${c.cb},${c.bb},${c.inc},${cbk},${ccs},${cin}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Report_${monthNames[m]}_${y}.csv`; a.click();
}
