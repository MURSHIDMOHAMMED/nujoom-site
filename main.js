// main.js
let branchPartners = [];
let partnerExpenses = {};
let partnerExpenseItems = [];

let allData = {};
let documents = [];
let sponsors = [];
let activeSponsorId = null;
let sponsorTransactions = [];
let editingPartnerId = null;
let currentBranch = localStorage.getItem('nujoom_current_branch') || null;
let editingId = null, editingDocId = null, activeDocType = 'employee', selectedMonth = null;
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Export to window for email-alerts.js
window.allData = allData;
window.documents = documents;

window.onload = async function() {
    console.log("🚀 Nujoom Ledger Initializing...");
    
    // Wait for auth
    if (!window.fb) {
        console.error("❌ Firebase not initialized! Check firebase-app.js");
        // Don't show alert immediately, maybe it's just slow. 
        // But if it's really missing after onload, it's a problem.
        setTimeout(() => {
            if (!window.fb) alert("Firebase initialization failed. Please check your internet connection and refresh.");
        }, 2000);
        return;
    }

    console.log("🔑 Setting up Auth State Listener...");
    window.fb.onAuthStateChanged(window.fb.auth, async (user) => {
        try {
            if (user) {
                console.log("✅ User logged in:", user.email);
                const loginView = document.getElementById('login-view');
                if (loginView) loginView.classList.remove('active');
                
                document.querySelectorAll('.logout-btn').forEach(b => b.style.display = 'block');
                
                await loadDataFromFirestore(user.uid);
                
                if (!currentBranch || !allData[currentBranch]) {
                    showBranchPicker();
                } else {
                    startApp(currentBranch);
                }
                if (typeof checkExpiryAlerts === 'function') checkExpiryAlerts();
            } else {
                console.log("👤 No user logged in");
                const loginView = document.getElementById('login-view');
                if (loginView) loginView.classList.add('active');
                
                const branchView = document.getElementById('branch-selection-view');
                if (branchView) branchView.classList.remove('active');
                
                const content = document.querySelector('.content');
                if (content) content.style.display = 'none';
                
                document.querySelectorAll('.logout-btn').forEach(b => b.style.display = 'none');
            }
        } catch (err) {
            console.error("💥 Auth State Error:", err);
            alert("Error loading your data: " + err.message);
        }
    });
};

async function loadDataFromFirestore(uid) {
    const settingsRef = window.fb.doc(window.fb.db, `users/${uid}/settings/main`);
    const settingsSnap = await window.fb.getDoc(settingsRef);
    
    // Clear current data before loading
    for (let key in allData) delete allData[key];
    documents.length = 0;

    if (settingsSnap.exists() && settingsSnap.data().branches) {
        settingsSnap.data().branches.forEach(b => allData[b] = []);
    } else {
        allData["Branch 1"] = [];
        await saveBranchesList();
    }
    
    // Load documents
    const docSnap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/documents`));
    docSnap.forEach(d => documents.push(d.data()));
}

async function loadEntriesForBranch(branch) {
    const uid = window.fb.auth.currentUser.uid;
    const entriesSnap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/branches/${branch}/entries`));
    const entries = [];
    entriesSnap.forEach(d => entries.push(d.data()));
    allData[branch] = entries;
}

async function saveBranchesList() {
    const uid = window.fb.auth.currentUser.uid;
    await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/settings/main`), { branches: Object.keys(allData) }, { merge: true });
}

function showBranchPicker() { 
    document.getElementById('branch-selection-view').classList.add('active'); 
    document.querySelector('.content').style.display = 'none';
    renderBranchButtons(); 
}

function renderBranchButtons() {
    const container = document.getElementById('branch-buttons'); container.innerHTML = '';
    Object.keys(allData).forEach(name => {
        const col = document.createElement('div'); col.className = 'col-6 mb-3';
        col.innerHTML = `<div class="branch-item-btn shadow-sm"><div class="fw-bold h5 mb-2">${name}</div><div class="d-flex gap-2 justify-content-center"><button class="btn btn-sm btn-primary px-3 b-sel rounded-pill">Open</button><button class="btn btn-sm btn-light b-del rounded-pill">🗑️</button></div></div>`;
        col.querySelector('.b-sel').onclick = () => selectBranch(name);
        col.querySelector('.b-del').onclick = (e) => { e.stopPropagation(); deleteBranch(name); };
        container.appendChild(col);
    });
}

async function selectBranch(n) { 
    currentBranch = n; 
    localStorage.setItem('nujoom_current_branch', n); 
    // Always attempt to load if allData[n] is not present or empty.
    // To be safer, we can force load if it was just initialized as [] but never fetched.
    if(!allData[n] || allData[n].length === 0) {
        await loadEntriesForBranch(n);
    }
    startApp(n); 
}

function startApp(n) { 
    document.getElementById('branch-selection-view').classList.remove('active'); 
    document.querySelector('.content').style.display = 'block'; 
    document.querySelectorAll('.active-branch-display').forEach(el => el.textContent = n); 
    switchView('dashboard'); 
}

// Make switchView global so it can be called from anywhere
window.switchView = switchView;

async function deleteBranch(n) { 
    if(confirm(`Delete "${n}"?`)) { 
        delete allData[n]; 
        await saveBranchesList(); 
        renderBranchButtons(); 
    } 
}

async function switchView(v) {
    if (v === 'profit' || v === 'sponsor') {
        const viewName = v === 'profit' ? 'Partner Shares' : 'Sponsor Manager';
        const code = prompt(`Enter secret code to view ${viewName}:`);
        if (code !== 'Nujoom@61') {
            alert("Incorrect secret code!");
            return;
        }
    }
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    const targetId = v.endsWith('-view') ? v : v + '-view';
    const target = document.getElementById(targetId);
    if(target) target.classList.add('active');
    
    const titleMap = { 
        'dashboard': 'Dashboard', 
        'profit': 'Partner Shares',
        'sponsor': 'Sponsor Manager (إدارة الكفلاء)',
        'employee-docs': 'Employee Documents', 
        'company-docs': 'Company Documents', 
        'settings': 'Alert Settings', 
        'trash': 'Trash',
        'salary': 'Employee Salary'
    };
    document.getElementById('page-title').textContent = titleMap[v] || 'Nujoom Ledger';
    
    // Toggle header buttons
    const csvBtn = document.getElementById('csv-upload-btn');
    const addBtn = document.getElementById('add-entry-btn');
    const printBtn = document.getElementById('btn-print-ledger');

    if (csvBtn) csvBtn.style.setProperty('display', v === 'dashboard' ? 'block' : 'none', 'important');
    if (addBtn) addBtn.style.setProperty('display', (v === 'dashboard' || v === 'month-detail') ? 'block' : 'none', 'important');
    if (printBtn) printBtn.style.setProperty('display', v === 'month-detail' ? 'block' : 'none', 'important');
    
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    const navBase = v.split('-')[0];
    document.querySelectorAll(`.nav-trigger-${navBase}`).forEach(x => x.classList.add('active'));

    if(v.includes('dashboard')) renderDashboard();
    if(v.includes('docs')) { const type = v.includes('employee') ? 'employee' : 'company'; activeDocType = type; renderDocuments(type); }
    if(v === 'profit') { await loadBranchPartners(currentBranch); await loadPartnerExpensesForPeriod(); renderProfitShares(); }
    if(v === 'sponsor') await loadSponsors();
    if(v === 'trash') renderTrash();
    if(v === 'salary') {
        if (window.initSalaryPayroll) window.initSalaryPayroll();
    }
    window.scrollTo(0,0);
}

function getMonthFromDate(dateInput) {
    if (!dateInput) return -1;
    let dateStr = String(dateInput);
    let parts = dateStr.split(/[-/]/);
    if (parts.length >= 2) {
        if (parts[0].length === 4) return parseInt(parts[1]) - 1;
        return parseInt(parts[1]) - 1;
    }
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? -1 : d.getMonth();
}

function calculateEntry(e) {
    const bb = Number(e.bb) || 0;
    const cb = Number(e.cb) || 0;
    const cas = Number(e.cas) || 0;
    const ba = Number(e.ba) || 0;

    return {
        bk: bb + cb,
        inc: (bb + cb) + cas,
        cas,
        ba,
        cb,
        bb
    };
}

function renderDashboard() {
    const grid = document.getElementById('months-grid'); grid.innerHTML = '';
    let yi=0, yb=0; const entries = allData[currentBranch] || [];
    for(let m=0; m<12; m++) {
        const mEntries = entries.filter(e => getMonthFromDate(e.date) === m);
        let mi=0, mb=0; mEntries.forEach(e => { const c = calculateEntry(e); mi+=c.inc; mb+=c.bk; });
        yi+=mi; yb+=mb;
        const col = document.createElement('div'); col.className = 'col-6 col-md-3';
        col.innerHTML = `<div class="card p-4 border-0 shadow-sm stat-card h-100" style="cursor:pointer"><h5>${monthNames[m]}</h5><div class="text-success small fw-bold">₹${mi.toLocaleString()}</div><div class="text-danger small">Bills: ₹${mb.toLocaleString()}</div></div>`;
        grid.appendChild(col);
        col.onclick = () => { selectedMonth = m; switchView('month-detail'); renderMonthDetail(m); };
    }
    document.getElementById('year-income').textContent = `₹${yi.toLocaleString()}`;
    document.getElementById('year-expense').textContent = `₹${yb.toLocaleString()}`;
    document.getElementById('year-profit').textContent = `₹${(yi-yb).toLocaleString()}`;
}

function renderMonthDetail(m) {
    const body = document.getElementById('daily-entries-body'); body.innerHTML = '';
    const allEntries = allData[currentBranch] || [];
    const entries = allEntries.filter(e => getMonthFromDate(e.date) === m)
        .sort((a,b) => new Date(a.date)-new Date(b.date));
    
    console.log(`Monthly Ledger: Found ${entries.length} entries for month index ${m}`);
    if (entries.length > 0) console.log("Sample Entry Date:", entries[0].date);

    let cbk=0, ccs=0, cin=0, tcas=0, tcb=0, tba=0, tbb=0; const summary = {};
    entries.forEach(e => {
        const c = calculateEntry(e); cbk+=c.bk; ccs+=c.cas; cin+=c.inc; tcas+=c.cas; tcb+=c.cb; tba+=c.ba; tbb+=c.bb;
        if(e.otherExpenses) {
            e.otherExpenses.forEach(x => {
                const type = x.type || 'Other';
                if(!summary[type]) summary[type] = { total: 0, date: null };
                summary[type].total += (Number(x.amt) || 0);
                if (e.date && (!summary[type].date || new Date(e.date) > new Date(summary[type].date))) {
                    summary[type].date = e.date;
                }
            });
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="ps-4"><strong>${e.date}</strong></td><td>₹${c.bk}</td><td>₹${c.cas}</td><td>₹${c.ba}</td><td>₹${c.cb}</td><td>₹${c.bb}</td><td class="text-success fw-bold">₹${c.inc}</td><td>₹${cbk}</td><td>₹${ccs}</td><td class="text-primary fw-bold">₹${cin}</td><td class="text-center pe-4 d-flex gap-2"><button class="btn btn-sm btn-light" onclick="editEntry(${e.id})">✏️</button><button class="btn btn-sm btn-light" onclick="deleteEntry(${e.id})">🗑️</button></td>`;
        body.appendChild(tr);
    });
    document.getElementById('cash-inflow').textContent = `₹${tcas.toLocaleString()}`;
    document.getElementById('cash-outflow').textContent = `₹${tcb.toLocaleString()}`;
    document.getElementById('cash-closing').textContent = `₹${(tcas-tcb).toLocaleString()}`;
    document.getElementById('bank-inflow').textContent = `₹${tba.toLocaleString()}`;
    document.getElementById('bank-outflow').textContent = `₹${tbb.toLocaleString()}`;
    document.getElementById('bank-closing').textContent = `₹${(tba-tbb).toLocaleString()}`;
    document.getElementById('selected-month-name').textContent = monthNames[m];
    document.getElementById('print-month-name').textContent = monthNames[m];
    document.getElementById('month-net-badge').textContent = `Net: ₹${(cin - cbk).toLocaleString()}`;
    const sGrid = document.getElementById('expense-summary-grid'); sGrid.innerHTML = '';
    Object.entries(summary).forEach(([k,v]) => { 
        const col = document.createElement('div'); col.className = 'col-6 col-md-3 mb-3'; 
        col.innerHTML = `
            <div class="card p-3 border-0 bg-light rounded-4 shadow-sm h-100">
                <div class="fw-bold text-dark text-truncate mb-1" title="${k}">${k}</div>
                <div class="text-muted small mb-2" style="font-size: 0.75rem;">Last: ${v.date || 'No date'}</div>
                <div class="h6 mb-0 text-primary fw-bold">₹${v.total.toLocaleString()}</div>
            </div>`; 
        sGrid.appendChild(col); 
    });
}

function renderDocuments(type) {
    const body = document.querySelector(`.docs-list-body[data-type="${type}"]`); body.innerHTML = '';
    const stats = document.getElementById(`${type}-stats`);
    let exp=0, soon=0, act=0; const today = new Date(); today.setHours(0,0,0,0);
    documents.filter(d => d.docType === type && d.branch === currentBranch).forEach(d => {
        const expiry = new Date(d.expiryDate + 'T00:00:00'); const diff = Math.ceil((expiry - today)/(1000*60*60*24));
        let s = 'Active', sc = 'status-active', txt = `In ${diff} days`;
        if(diff < 0) { s = 'Expired'; sc = 'status-expired'; txt = `Expired ${Math.abs(diff)}d ago`; exp++; } else if(diff <= 30) { s = 'Soon'; sc = 'status-soon'; soon++; } else { act++; }
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="ps-4"><strong>${d.personName}</strong></td><td>${d.docName}</td><td>${d.expiryDate}<br><small class="${diff<0?'text-danger':(diff<=30?'text-warning':'text-muted')}">${txt}</small></td><td><span class="status-badge ${sc}">${s}</span></td><td class="pe-4 text-center d-flex gap-2 justify-content-center"><button class="btn btn-sm btn-light border shadow-sm" onclick="editDoc(${d.id})">✏️</button><button class="btn btn-sm btn-light border shadow-sm" onclick="deleteDoc(${d.id}, '${type}')">🗑️</button></td>`;
        body.appendChild(tr);
    });
    stats.querySelector('.count-expired').textContent = exp; stats.querySelector('.count-soon').textContent = soon; stats.querySelector('.count-active').textContent = act;
}

function editDoc(id) {
    editingDocId = id; const d = documents.find(x => x.id == id); activeDocType = d.docType;
    const isC = activeDocType === 'company';
    document.getElementById('lblDocName').textContent = isC ? 'COMPANY DOC' : 'DOC NAME';
    document.getElementById('lblPersonName').textContent = isC ? 'OWNER NAME' : 'EMPLOYEE NAME';
    document.getElementById('doc-form').reset();
    Object.keys(d).forEach(k => { if(document.getElementById('doc-form').elements[k]) document.getElementById('doc-form').elements[k].value = d[k]; });
    document.getElementById('btn-save-doc').textContent = 'Update Document';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('doc-modal')).show();
}

function updateLiveCalc() { 
    const bb = Number(document.getElementById('bb').value) || 0;
    const cb = Number(document.getElementById('cb').value) || 0;
    const cas = Number(document.getElementById('cas').value) || 0;
    const bill = bb + cb;
    const inc = bill + cas;
    document.getElementById('preview-bk').textContent = `₹${bill.toLocaleString()}`; 
    document.getElementById('preview-inc').textContent = `₹${inc.toLocaleString()}`; 
}

function setupListeners() {
    console.log("🛠️ Setting up Event Listeners...");

    // Auth listeners
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.onclick = async () => {
            const emailInput = document.getElementById('login-email');
            const pwdInput = document.getElementById('login-pwd');
            if (!emailInput || !pwdInput) {
                console.error("Login inputs missing!");
                return;
            }
            const e = emailInput.value.trim().toLowerCase();
            const p = pwdInput.value.trim();
            
            if (!e || !p) {
                alert("Please enter both email and password.");
                return;
            }

            console.log("📫 Attempting login for:", e);
            try { 
                await window.fb.signInWithEmailAndPassword(window.fb.auth, e, p); 
                console.log("👋 Login call successful");
            } catch (err) { 
                console.error("❌ Login Error:", err);
                alert("Login Error: " + err.message); 
            }
        };
    } else {
        console.warn("⚠️ login-btn not found in DOM");
    }

    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
        signupBtn.onclick = async () => {
            const emailInput = document.getElementById('login-email');
            const pwdInput = document.getElementById('login-pwd');
            if (!emailInput || !pwdInput) return;
            
            const e = emailInput.value.trim().toLowerCase();
            const p = pwdInput.value.trim();
            if (!e || !p) { alert("Please enter email and password"); return; }
            
            console.log("📝 Attempting signup for:", e);
            try { 
                await window.fb.createUserWithEmailAndPassword(window.fb.auth, e, p); 
                console.log("👋 Signup call successful");
            } catch (err) { 
                console.error("❌ Signup Error:", err);
                alert("Signup Error: " + err.message); 
            }
        };
    }

    // Enter key support for login
    const loginEmailInput = document.getElementById('login-email');
    const loginPwdInput = document.getElementById('login-pwd');
    [loginEmailInput, loginPwdInput].forEach(input => {
        if (input && loginBtn) {
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    console.log("⌨️ Enter key detected on login input");
                    loginBtn.click();
                }
            };
        }
    });
    
    document.querySelectorAll('.logout-btn').forEach(b => {
        b.onclick = () => {
            console.log("🚪 Logging out...");
            window.fb.signOut(window.fb.auth);
        };
    });

    // Other listeners with safe checks
    const safeSetClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };

    safeSetClick('add-branch-btn', async () => { 
        const nInput = document.getElementById('new-branch-name');
        const n = nInput ? nInput.value.trim() : ""; 
        if(n){ 
            try {
                if(!allData[n]) allData[n]=[]; 
                await saveBranchesList(); 
                renderBranchButtons(); 
                if (nInput) nInput.value = ''; 
            } catch (err) {
                alert("Failed to add branch: " + err.message);
            }
        } 
    });
    
    const entryForm = document.getElementById('entry-form');
    if (entryForm) {
        entryForm.onsubmit = async (e) => { 
            e.preventDefault(); 
            try {
                const f = new FormData(e.target); 
                const d = Object.fromEntries(f.entries()); 
                d.otherExpenses = []; 
                document.querySelectorAll('.exp-row').forEach(r => d.otherExpenses.push({type: r.querySelector('.e-t').value, amt: r.querySelector('.e-a').value})); 
                d.id = editingId || Date.now(); 

                const uid = window.fb.auth.currentUser.uid;
                if(!currentBranch) throw new Error("Please select a branch first.");
                await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/branches/${currentBranch}/entries`, d.id.toString()), d);
                if(editingId) allData[currentBranch] = allData[currentBranch].map(x => x.id == editingId ? d : x); 
                else { if(!allData[currentBranch]) allData[currentBranch]=[]; allData[currentBranch].push(d); } 
                bootstrap.Modal.getOrCreateInstance(document.getElementById('entry-modal')).hide(); 
                if (selectedMonth !== null) renderMonthDetail(selectedMonth); else renderDashboard();
                if (typeof checkExpiryAlerts === 'function') checkExpiryAlerts(); 
            } catch (err) {
                alert("Failed to save entry: " + err.message);
            }
        };
    }

    const docForm = document.getElementById('doc-form');
    if (docForm) {
        docForm.onsubmit = async (e) => { 
            e.preventDefault(); 
            try {
                const formData = new FormData(e.target); 
                const d = Object.fromEntries(formData.entries()); 
                if(!editingDocId) { d.id = Date.now(); d.docType = activeDocType; d.branch = currentBranch; } 
                else { d.id = editingDocId; d.docType = activeDocType; d.branch = currentBranch; }
                const uid = window.fb.auth.currentUser.uid;
                await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/documents`, d.id.toString()), d);
                if(editingDocId) {
                     const idx = documents.findIndex(x => x.id == editingDocId);
                     if(idx !== -1) documents[idx] = {...documents[idx], ...d};
                } else documents.push(d); 
                bootstrap.Modal.getOrCreateInstance(document.getElementById('doc-modal')).hide(); 
                renderDocuments(activeDocType); 
                editingDocId = null; 
                if (typeof checkExpiryAlerts === 'function') checkExpiryAlerts(); 
            } catch (err) {
                alert("Failed to save document: " + err.message);
            }
        };
    }
    
    document.querySelectorAll('.nav-trigger-dashboard').forEach(el => el.onclick = () => switchView('dashboard'));
    document.querySelectorAll('.nav-trigger-profit').forEach(el => el.onclick = () => switchView('profit'));
    document.querySelectorAll('.nav-trigger-sponsor').forEach(el => el.onclick = () => switchView('sponsor'));
    document.querySelectorAll('.nav-trigger-employee').forEach(el => el.onclick = () => switchView('employee-docs'));
    document.querySelectorAll('.nav-trigger-salary').forEach(el => el.onclick = () => switchView('salary'));
    document.querySelectorAll('.nav-trigger-company').forEach(el => el.onclick = () => switchView('company-docs'));
    document.querySelectorAll('.nav-trigger-settings').forEach(el => el.onclick = () => switchView('settings'));
    document.querySelectorAll('.nav-trigger-trash').forEach(el => el.onclick = () => switchView('trash'));
    document.querySelectorAll('.branch-switch-trigger').forEach(el => el.onclick = () => showBranchPicker());
    
    const csvBtn = document.getElementById('csv-upload-btn');
    const csvInput = document.getElementById('csv-file-input');
    if (csvBtn && csvInput) {
        csvBtn.onclick = () => csvInput.click();
        csvInput.onchange = (e) => handleCSVUpload(e);
    }

    document.querySelectorAll('.csv-doc-upload-btn').forEach(btn => {
        btn.onclick = () => {
            activeDocType = btn.dataset.type;
            document.getElementById('csv-doc-file-input').click();
        };
    });
    const csvDocInput = document.getElementById('csv-doc-file-input');
    if (csvDocInput) csvDocInput.onchange = (e) => handleDocCSVUpload(e);

    const spSelect = document.getElementById('active-sponsor-select');
    if (spSelect) {
        spSelect.onchange = (e) => {
            activeSponsorId = e.target.value;
            refreshSponsorUI();
        };
    }


    const newSponsorForm = document.getElementById('new-sponsor-form');
    if (newSponsorForm) {
        newSponsorForm.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const name = fd.get('name');
            const openingBalance = Number(fd.get('openingBalance')) || 0;
            const uid = window.fb.auth.currentUser.uid;
            const id = 'SP' + Date.now();
            await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/sponsors`, id), { id, name, openingBalance });
            activeSponsorId = id; 
            e.target.reset();
            bootstrap.Modal.getInstance(document.getElementById('new-sponsor-modal')).hide();
            await loadSponsors();
        };
    }

    const ledgerForm = document.getElementById('form-ledger-entry');
    if (ledgerForm) {
        ledgerForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!activeSponsorId) return;
            try {
                const fd = new FormData(e.target);
                const uid = window.fb.auth.currentUser.uid;
                const id = 'TX' + Date.now();
                
                // Collect dynamic deductions
                const deductions = [];
                let totalDeduction = 0;
                document.querySelectorAll('.sp-deduction-row').forEach(row => {
                    const name = row.querySelector('.sp-d-n').value.trim();
                    const amount = Number(row.querySelector('.sp-d-a').value) || 0;
                    if (amount > 0) {
                        deductions.push({ name: name || "مصروفات", amount });
                        totalDeduction += amount;
                    }
                });

                const data = {
                    id,
                    date: fd.get('date'),
                    ahli: Number(fd.get('ahli')) || 0,
                    bilad: Number(fd.get('bilad')) || 0,
                    expense: totalDeduction, // Total for backward compatibility
                    deductions: deductions,   // Detailed list
                    notes: fd.get('notes'),
                    createdAt: Date.now()
                };

                await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/sponsors/${activeSponsorId}/transactions`, id), data);
                e.target.reset();
                const container = document.getElementById('sp-deductions-container');
                if (container) container.innerHTML = ''; 
                loadSponsorTransactions(activeSponsorId);
            } catch (err) {
                alert("Failed to save ledger entry: " + err.message);
            }
        };
    }

    const checkBtn = document.getElementById('check-expiry-btn');
    if (checkBtn) checkBtn.onclick = () => { checkExpiryAlerts(); alert('Expiry check triggered.'); };

    const editSponsorForm = document.getElementById('edit-sponsor-form');
    if (editSponsorForm) {
        editSponsorForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!activeSponsorId) return;
            const fd = new FormData(e.target);
            const name = fd.get('name');
            const openingBalance = Number(fd.get('openingBalance')) || 0;
            const uid = window.fb.auth.currentUser.uid;
            await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/sponsors`, activeSponsorId), { id: activeSponsorId, name, openingBalance }, { merge: true });
            bootstrap.Modal.getInstance(document.getElementById('edit-sponsor-modal')).hide();
            await loadSponsors();
        };
    }



    safeSetClick('back-to-dashboard', () => switchView('dashboard'));
    safeSetClick('btn-print-ledger', () => window.print());
    safeSetClick('dash-get-report-btn', () => generateCustomReport());
    
    const addEntryBtn = document.getElementById('add-entry-btn');
    if (addEntryBtn) {
        addEntryBtn.onclick = () => { 
            editingId = null; 
            const form = document.getElementById('entry-form');
            if (form) form.reset(); 
            const container = document.getElementById('other-expenses-container');
            if (container) container.innerHTML = ''; 
            updateLiveCalc(); 
        };
    }

    ['cas','ba','cb','bb'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = updateLiveCalc;
    });

    // Profit Share Live Update Listeners
    ['profit-total-input', 'profit-month', 'profit-year'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'profit-total-input') {
                el.addEventListener('input', renderProfitShares);
                el.addEventListener('change', renderProfitShares);
            } else {
                el.addEventListener('change', async () => {
                    await loadPartnerExpensesForPeriod();
                    renderProfitShares();
                });
            }
        }
    });

    document.querySelectorAll('.add-doc-btn').forEach(b => {
        b.onclick = () => { 
            editingDocId = null; 
            const form = document.getElementById('doc-form');
            if (form) form.reset(); 
            const saveBtn = document.getElementById('btn-save-doc');
            if (saveBtn) saveBtn.textContent = 'Save Document'; 
            activeDocType = b.dataset.type; 
            const isC = activeDocType === 'company'; 
            const lblD = document.getElementById('lblDocName');
            const lblP = document.getElementById('lblPersonName');
            if (lblD) lblD.textContent = isC ? 'COMPANY DOC' : 'DOC NAME'; 
            if (lblP) lblP.textContent = isC ? 'OWNER NAME' : 'EMPLOYEE NAME'; 
            const cat = document.getElementById('docCategory');
            if (cat) cat.value = isC ? 'License' : 'Passport'; 
        };
    });

    const addPartnerForm = document.getElementById('add-partner-form');
    if (addPartnerForm) {
        addPartnerForm.onsubmit = handleAddPartnerFormSubmit;
    }

    const cancelPartnerEditBtn = document.getElementById('partner-cancel-edit-btn');
    if (cancelPartnerEditBtn) {
        cancelPartnerEditBtn.onclick = resetPartnerForm;
    }

    const partnerExpenseForm = document.getElementById('partner-expense-form');
    if (partnerExpenseForm) {
        partnerExpenseForm.onsubmit = handlePartnerExpenseFormSubmit;
    }

    console.log("✅ Event Listeners Ready");
}

function addExpenseRow(t='', a='') { const div = document.createElement('div'); div.className = 'exp-row d-flex gap-2'; div.innerHTML = `<input type="text" class="e-t form-control form-control-sm border-0 bg-transparent" placeholder="Type" value="${t}"><input type="number" class="e-a form-control form-control-sm border-0 bg-transparent" placeholder="₹" value="${a}"><button type="button" class="btn btn-sm text-danger" onclick="this.parentElement.remove()">✕</button>`; document.getElementById('other-expenses-container').appendChild(div); }

function editEntry(id) { editingId = id; const e = allData[currentBranch].find(x => x.id == id); Object.keys(e).forEach(k => { if(document.getElementById('entry-form').elements[k]) document.getElementById('entry-form').elements[k].value = e[k]; }); document.getElementById('other-expenses-container').innerHTML = ''; if(e.otherExpenses) e.otherExpenses.forEach(x => addExpenseRow(x.type, x.amt)); updateLiveCalc(); bootstrap.Modal.getOrCreateInstance(document.getElementById('entry-modal')).show(); }

async function deleteEntry(id) {
    if(confirm('Delete?')) {
        const uid = window.fb.auth.currentUser.uid;
        const e = allData[currentBranch].find(x => x.id == id);
        await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/trash`, id.toString()), { originalType: 'entry', deletedAt: Date.now(), originalData: e, branch: currentBranch });
        await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/branches/${currentBranch}/entries`, id.toString()));
        allData[currentBranch] = allData[currentBranch].filter(x => x.id != id);
        if (selectedMonth !== null) renderMonthDetail(selectedMonth); else renderDashboard();
    }
}

async function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentBranch) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) return;

        // Detect delimiter (comma or semicolon)
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].toLowerCase().split(delimiter).map(h => h.replace(/["']/g, "").trim());
        
        const dateIdx = headers.indexOf('date');
        const baIdx = headers.indexOf('ba');
        const casIdx = headers.indexOf('cas');
        const cbIdx = headers.indexOf('cb');
        const bbIdx = headers.indexOf('bb');

        if (dateIdx === -1) { 
            alert("CSV must have a 'Date' column. Found headers: " + headers.join(', ')); 
            return; 
        }

        let addedCount = 0;
        let skippedCount = 0;
        const uid = window.fb.auth.currentUser.uid;
        if (!allData[currentBranch]) allData[currentBranch] = [];
        const existingDates = new Set(allData[currentBranch].map(entry => entry.date));

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map(c => c.replace(/["']/g, "").trim());
            const rowDate = cols[dateIdx];
            if (!rowDate) continue;

            if (existingDates.has(rowDate)) {
                skippedCount++;
                continue;
            }

            const newEntry = {
                id: Date.now() + i,
                date: rowDate,
                ba: baIdx !== -1 && cols[baIdx] ? cols[baIdx] : "0",
                cas: casIdx !== -1 && cols[casIdx] ? cols[casIdx] : "0",
                cb: cbIdx !== -1 && cols[cbIdx] ? cols[cbIdx] : "0",
                bb: bbIdx !== -1 && cols[bbIdx] ? cols[bbIdx] : "0",
                otherExpenses: []
            };

            try {
                await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/branches/${currentBranch}/entries`, newEntry.id.toString()), newEntry);
                allData[currentBranch].push(newEntry);
                existingDates.add(rowDate);
                addedCount++;
            } catch (err) {
                console.error("Error importing row:", rowDate, err);
            }
        }

        alert(`Import Complete!\nAdded: ${addedCount}\nSkipped (Duplicates): ${skippedCount}`);
        event.target.value = '';
        if (selectedMonth !== null) renderMonthDetail(selectedMonth); else renderDashboard();
    };
    reader.readAsText(file);
}

async function handleDocCSVUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentBranch) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) return;

        const delimiter = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].toLowerCase().split(delimiter).map(h => h.replace(/["']/g, "").trim());
        
        const nameIdx = headers.indexOf('name');
        const docIdx = headers.indexOf('document');
        const catIdx = headers.indexOf('category');
        const expIdx = headers.indexOf('expiry');

        if (nameIdx === -1 || expIdx === -1) { 
            alert("CSV must have 'Name' and 'Expiry' columns."); 
            return; 
        }

        let addedCount = 0;
        let skippedCount = 0;
        const uid = window.fb.auth.currentUser.uid;
        
        const existingDocs = new Set(documents.filter(d => d.docType === activeDocType && d.branch === currentBranch).map(d => `${d.personName}|${d.docName}`));

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map(c => c.replace(/["']/g, "").trim());
            const pName = cols[nameIdx];
            const dName = docIdx !== -1 && cols[docIdx] ? cols[docIdx] : "Document";
            
            if (!pName || !cols[expIdx]) continue;

            const key = `${pName}|${dName}`;
            if (existingDocs.has(key)) {
                skippedCount++;
                continue;
            }

            const newDoc = {
                id: Date.now() + i,
                docType: activeDocType,
                branch: currentBranch,
                personName: pName,
                docName: dName,
                docCategory: catIdx !== -1 && cols[catIdx] ? cols[catIdx] : "Other",
                expiryDate: cols[expIdx]
            };

            try {
                await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/documents`, newDoc.id.toString()), newDoc);
                documents.push(newDoc);
                existingDocs.add(key);
                addedCount++;
            } catch (err) {
                console.error("Error importing document:", pName, err);
            }
        }

        alert(`Import Complete!\nAdded: ${addedCount}\nSkipped (Duplicates): ${skippedCount}`);
        event.target.value = '';
        renderDocuments(activeDocType);
        if (typeof checkExpiryAlerts === 'function') checkExpiryAlerts();
    };
    reader.readAsText(file);
}

async function deleteDoc(id, type) { 
    if(confirm('Delete?')){ 
        const uid = window.fb.auth.currentUser.uid;
        const d = documents.find(x => x.id == id);
        await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/trash`, id.toString()), { originalType: 'document', deletedAt: Date.now(), originalData: d });
        await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/documents`, id.toString()));
        const idx = documents.findIndex(x => x.id == id);
        if(idx !== -1) documents.splice(idx, 1);
        renderDocuments(type); 
    } 
}

async function renderTrash() {
    const uid = window.fb.auth.currentUser.uid;
    const trashSnap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/trash`));
    const tbody = document.getElementById('trash-list-body'); tbody.innerHTML = '';
    trashSnap.forEach(d => {
        const item = d.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.originalType}</td><td>${new Date(item.deletedAt).toLocaleDateString()}</td><td>${item.originalType === 'document' ? (item.originalData.docName || 'Doc') : 'Entry from ' + item.originalData.date}</td><td><button class="btn btn-sm btn-success mx-1" onclick="restoreTrash('${d.id}')">Restore</button><button class="btn btn-sm btn-danger mx-1" onclick="permanentDelete('${d.id}')">Delete</button></td>`;
        tbody.appendChild(tr);
    });
}

async function restoreTrash(id) {
    const uid = window.fb.auth.currentUser.uid;
    const trashDoc = await window.fb.getDoc(window.fb.doc(window.fb.db, `users/${uid}/trash`, id));
    if(!trashDoc.exists()) return;
    const item = trashDoc.data();
    if(item.originalType === 'document') {
        await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/documents`, id), item.originalData);
        documents.push(item.originalData);
    } else {
        await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/branches/${item.branch}/entries`, id), item.originalData);
        if(allData[item.branch]) allData[item.branch].push(item.originalData);
    }
    await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/trash`, id));
    renderTrash();
}

async function permanentDelete(id) {
    if(confirm("Permanent Delete?")) {
        const uid = window.fb.auth.currentUser.uid;
        await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/trash`, id));
        renderTrash();
    }
}



// Profit Share Logic
function getProfitPeriodKey() {
    const month = document.getElementById('profit-month')?.value || monthNames[new Date().getMonth()];
    const year = document.getElementById('profit-year')?.value || new Date().getFullYear();
    return `${year}-${month}`;
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

async function loadPartnerExpensesForPeriod() {
    partnerExpenses = {};
    partnerExpenseItems = [];
    if (!window.fb || !window.fb.auth.currentUser || !currentBranch) return;

    const uid = window.fb.auth.currentUser.uid;
    const periodKey = getProfitPeriodKey();
    const expenseRef = window.fb.doc(window.fb.db, `users/${uid}/branches/${currentBranch}/partnerExpenses`, periodKey);
    const expenseSnap = await window.fb.getDoc(expenseRef);

    if (expenseSnap.exists()) {
        const data = expenseSnap.data();
        partnerExpenses = {};
        partnerExpenseItems = data.items || [];
    }
}

async function persistPartnerExpenses() {
    if (!window.fb || !window.fb.auth.currentUser || !currentBranch) return;

    const uid = window.fb.auth.currentUser.uid;
    const periodKey = getProfitPeriodKey();
    await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/branches/${currentBranch}/partnerExpenses`, periodKey), {
        branch: currentBranch,
        period: periodKey,
        expenses: {},
        items: partnerExpenseItems,
        updatedAt: Date.now()
    });
}

function getPartnerExpenseShare(partner) {
    return getPartnerExpenseDetails(partner).reduce((sum, item) => sum + item.amount, 0);
}

function getPartnerExpenseDetails(partner) {
    const details = [];
    const totalPct = branchPartners.reduce((sum, p) => sum + (Number(p.pct) || 0), 0) || 100;
    const partnerPct = Number(partner.pct) || 0;
    partnerExpenseItems.forEach(item => {
        const amount = Number(item.amount) || 0;
        const shareAmount = amount * partnerPct / totalPct;
        if (shareAmount > 0) {
            details.push({ name: item.name || 'Expense', amount: shareAmount });
        }
    });

    return details;
}

function renderPartnerExpenseItems() {
    const list = document.getElementById('partner-expense-list');
    const badge = document.getElementById('partner-expense-total-badge');
    if (!list) return;

    const total = partnerExpenseItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    if (badge) badge.textContent = 'Rs. ' + total.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});

    if (partnerExpenseItems.length === 0) {
        list.innerHTML = '<div class="small text-muted text-center py-2">No partner expenses added for this month.</div>';
        return;
    }

    list.innerHTML = partnerExpenseItems.map(item => `
        <div class="d-flex justify-content-between align-items-center gap-3 p-3 rounded-3 bg-light border">
            <div class="text-start">
                <div class="fw-bold small">${escapeHTML(item.name)}</div>
                <div class="text-muted small">Split across partners by share percentage</div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <div class="fw-bold">Rs. ${(Number(item.amount) || 0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                <button class="btn btn-sm btn-light text-danger border" onclick="deletePartnerExpenseItem('${item.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function handlePartnerExpenseFormSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('partner-expense-name-input');
    const amountInput = document.getElementById('partner-expense-amount-input');
    if (!nameInput || !amountInput) return;

    const name = nameInput.value.trim();
    const amount = Math.max(0, parseFloat(amountInput.value) || 0);
    if (!name || amount <= 0) return;

    partnerExpenseItems.push({
        id: 'PEX-' + Date.now(),
        name,
        amount
    });

    nameInput.value = '';
    amountInput.value = '';
    await persistPartnerExpenses();
    renderProfitShares();
}

async function deletePartnerExpenseItem(id) {
    partnerExpenseItems = partnerExpenseItems.filter(item => item.id !== id);
    await persistPartnerExpenses();
    renderProfitShares();
}

function renderProfitShares() {
    const profit = parseFloat(document.getElementById('profit-total-input').value) || 0;
    const month = document.getElementById('profit-month').value;
    const year = document.getElementById('profit-year').value;
    const grid = document.getElementById('profit-partners-grid');
    const summaryBar = document.getElementById('profit-summary-bar');
    const actionRow = document.getElementById('profit-action-row');
    renderPartnerExpenseItems();
    
    summaryBar.style.setProperty('display', profit > 0 ? 'flex' : 'none', 'important');
    actionRow.style.setProperty('display', profit > 0 ? 'flex' : 'none', 'important');
    document.getElementById('profit-summary-amt').textContent = 'Rs. ' + profit.toLocaleString('en-IN', {minimumFractionDigits:2});
    
    grid.innerHTML = '';
    if(!profit) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-muted small">Enter the total profit above to calculate each partner\'s share</div>';
        return;
    }

    branchPartners.forEach(p => {
        const amt = profit * (p.pct / 100);
        const expense = getPartnerExpenseShare(p);
        const netAmt = amt - expense;
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        col.innerHTML = `
            <div class="card h-100 border-0 shadow-sm rounded-4 p-4 overflow-hidden position-relative">
                <div class="position-absolute top-0 start-0 w-100" style="height: 4px; background: linear-gradient(to right, var(--primary), #a855f7);"></div>
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle bg-light d-flex align-items-center justify-content-center fw-bold text-primary" style="width: 45px; height: 45px; border: 1.5px solid var(--border-color); color: var(--primary) !important;">${p.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                        <div>
                            <div class="fw-bold small text-main">${p.name}</div>
                            <div class="d-flex align-items-center gap-1 mt-1">
                                <span class="badge ${p.category === 'working' ? 'bg-success' : 'bg-secondary'}" style="font-size: 8px; padding: 2px 6px; color: white !important;">${p.category === 'working' ? 'Working' : 'Non-working'}</span>
                                <span class="text-muted small" style="font-size: 10px;">${p.pct}% Share</span>
                            </div>
                        </div>
                    </div>
                    <span class="badge rounded-pill bg-light text-primary border" style="color: var(--primary) !important; border-color: var(--border-color) !important;">${p.pct}%</span>
                </div>
                <hr class="opacity-10 my-3">
                <div class="d-flex justify-content-between align-items-end mb-3">
                    <div class="small text-muted fw-bold" style="font-size: 9px; letter-spacing: 1px;">GROSS SHARE</div>
                    <div class="h5 mb-0 fw-bold text-main">
                        <span class="small fw-normal me-1" style="font-size: 12px; color: var(--primary);">Rs.</span>${amt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-end mb-3">
                    <div class="small text-muted fw-bold" style="font-size: 9px; letter-spacing: 1px;">EXPENSE SHARE</div>
                    <div class="h6 mb-0 fw-bold text-danger">
                        <span class="small fw-normal me-1" style="font-size: 12px;">Rs.</span>${expense.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-end mb-4 p-3 rounded-3" style="background: #f8fafc; border: 1px solid var(--border-color);">
                    <div class="small text-muted fw-bold" style="font-size: 9px; letter-spacing: 1px;">NET PAYABLE</div>
                    <div class="h4 mb-0 fw-bold ${netAmt < 0 ? 'text-danger' : 'text-success'}">
                        <span class="small fw-normal me-1" style="font-size: 12px;">Rs.</span>${netAmt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </div>
                </div>
                <div class="row g-2">
                    <div class="col-6"><button class="btn btn-light btn-sm w-100 rounded-3 fw-bold" style="font-size: 10px; border: 1px solid var(--border-color);" onclick="printShareById('${p.id}')">🖨️ Print</button></div>
                    <div class="col-6"><button class="btn btn-primary btn-sm w-100 rounded-3 fw-bold shadow-sm" style="font-size: 10px;" onclick="downloadShareById('${p.id}')">📥 PDF</button></div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
}

function sealSVG(branchName = 'Safa Branch', size = 160) {
    const cx=size/2, cy=size/2, sc=size/160;
    let radials='';
    for(let i=0;i<72;i++){
        const angle=(i/72)*360;
        const rad=angle*(Math.PI/180);
        const r1=49*sc, r2=59*sc;
        radials+=`<line x1="${(cx+r1*Math.cos(rad)).toFixed(2)}" y1="${(cy+r1*Math.sin(rad)).toFixed(2)}" x2="${(cx+r2*Math.cos(rad)).toFixed(2)}" y2="${(cy+r2*Math.sin(rad)).toFixed(2)}" stroke="#D9A441" stroke-width="${0.8*sc}"/>`;
    }
    const textR=66*sc;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><path id="topP" d="M ${cx - textR},${cy} A ${textR},${textR} 0 0,1 ${cx + textR},${cy}"/><path id="botP" d="M ${cx - textR},${cy} A ${textR},${textR} 0 0,0 ${cx + textR},${cy}"/></defs>
    <circle cx="${cx}" cy="${cy}" r="${75*sc}" fill="none" stroke="#004236" stroke-width="${3.5*sc}"/><circle cx="${cx}" cy="${cy}" r="${70*sc}" fill="none" stroke="#D9A441" stroke-width="${1.5*sc}"/>
    ${radials}
    <circle cx="${cx}" cy="${cy}" r="${48*sc}" fill="none" stroke="#D9A441" stroke-width="${1.5*sc}"/><circle cx="${cx}" cy="${cy}" r="${62*sc}" fill="none" stroke="#004236" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${47*sc}" fill="#FFFDF5"/>
    <text x="${cx}" y="${cy - 6*sc}" text-anchor="middle" font-family="Georgia,serif" font-size="${12*sc}" font-weight="bold" fill="#004236">Est. 2023</text>
    <line x1="${cx - 18*sc}" y1="${cy - 1*sc}" x2="${cx + 18*sc}" y2="${cy - 1*sc}" stroke="#D9A441" stroke-width="1"/>
    <text x="${cx}" y="${cy + 11*sc}" text-anchor="middle" font-family="Georgia,serif" font-size="${13*sc}" font-weight="bold" fill="#004236">nujoom</text>
    <text font-family="sans-serif" font-size="${11.5*sc}" font-weight="bold" fill="#004236"><textPath href="#topP" startOffset="50%" text-anchor="middle">Boofiya Nujoom</textPath></text>
    <text font-family="sans-serif" font-size="${11*sc}" font-weight="bold" fill="#004236"><textPath href="#botP" startOffset="50%" text-anchor="middle">${branchName}</textPath></text>
    </svg>`;
}

async function makeSharePDF(pName, pPct, pCategory, pExpense = 0, pExpenseDetails = []) {
    const profit = parseFloat(document.getElementById('profit-total-input').value) || 0;
    const month = document.getElementById('profit-month').value;
    const year = document.getElementById('profit-year').value;
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF({unit:'mm', format:'a5'});
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const grossAmt = profit * (pPct/100);
    const expenseAmt = Math.max(0, parseFloat(pExpense) || 0);
    const netAmt = grossAmt - expenseAmt;
    const grossStr = 'Rs. ' + grossAmt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
    const expenseStr = 'Rs. ' + expenseAmt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
    const amtStr = 'Rs. ' + netAmt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
    const initials = pName.split(' ').map(n=>n[0]).join('').toUpperCase();
    const ref = `BNS-${month.slice(0,3).toUpperCase()}${year}-${initials}`;
    const catLabel = (pCategory || 'working') === 'working' ? 'Working Partner' : 'Non-Working Partner';
    const today = new Date().toLocaleDateString('en-IN', {day:'2-digit', month:'long', year:'numeric'});

    // Premium Color Palette
    const emerald = [0, 66, 54];
    const gold = [217, 164, 65];
    const goldLight = [235, 200, 130];
    const cream = [255, 248, 234];
    const softCard = [255, 253, 245];
    const white = [255, 255, 255];
    const darkText = [16, 46, 42];
    const mutedText = [120, 130, 128];
    const danger = [185, 28, 28];
    const expenseDetailItems = (pExpenseDetails || [])
        .filter(item => (Number(item.amount) || 0) > 0)
        .map(item => ({
            name: item.name || 'Expense',
            amount: Number(item.amount) || 0
        }));

    return new Promise((resolve) => {
        const svgStr = sealSVG(currentBranch || 'Safa Branch', 400);
        const blob = new Blob([svgStr], {type:'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function() {
            const cv = document.createElement('canvas'); cv.width=400; cv.height=400;
            cv.getContext('2d').drawImage(img,0,0,400,400);
            const sealPng = cv.toDataURL('image/png');

            // === PAGE BACKGROUND ===
            doc.setFillColor(...cream);
            doc.rect(0, 0, W, H, 'F');

            // === DECORATIVE DOUBLE BORDER ===
            doc.setDrawColor(...gold);
            doc.setLineWidth(1.2);
            doc.rect(2, 2, W-4, H-4);
            doc.setLineWidth(0.3);
            doc.rect(4, 4, W-8, H-8);

            // Corner gold dots
            doc.setFillColor(...gold);
            [[6,6],[W-6,6],[6,H-6],[W-6,H-6]].forEach(([cx,cy]) => doc.circle(cx, cy, 0.8, 'F'));

            // === HEADER SECTION (y: 4 → 30) ===
            doc.setFillColor(...emerald);
            doc.rect(4.3, 4.3, W-8.6, 26, 'F');

            // Gold accent line at top of header
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.4);
            doc.line(8, 6.5, W-8, 6.5);

            // BN Monogram (left)
            doc.setFillColor(...gold);
            doc.circle(12, 17, 4.5, 'F');
            doc.setFillColor(...emerald);
            doc.circle(12, 17, 4, 'F');
            doc.setTextColor(...cream);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('BN', 12, 18.5, {align:'center'});

            // Company Name
            doc.setTextColor(...cream);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('BOOFIYA NUJOOM', W/2, 14, {align:'center'});

            // Branch Name
            doc.setTextColor(...gold);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text((currentBranch || 'Safa Branch').toUpperCase(), W/2, 18, {align:'center'});

            // Subtitle
            doc.setTextColor(...goldLight);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'italic');
            doc.text('Profit Share Receipt', W/2, 21.5, {align:'center'});

            // PRIVATE & CONFIDENTIAL badge
            doc.setFillColor(...gold);
            doc.roundedRect(W-26, 8, 20, 5, 1, 1, 'F');
            doc.setTextColor(...emerald);
            doc.setFontSize(4.5);
            doc.setFont('helvetica', 'bold');
            doc.text('PRIVATE &', W-16, 10.2, {align:'center'});
            doc.text('CONFIDENTIAL', W-16, 12.5, {align:'center'});

            // Date & Ref in header bottom
            doc.setTextColor(...goldLight);
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.text('Date: ' + today, W-8, 25, {align:'right'});
            doc.text('Ref: ' + ref, W-8, 28, {align:'right'});

            // === GOLD ACCENT BAR ===
            doc.setFillColor(...gold);
            doc.rect(4.3, 30.3, W-8.6, 1.5, 'F');

            // === TITLE PILL (y: 34) ===
            doc.setFillColor(...emerald);
            doc.roundedRect(W/2-30, 34, 60, 7, 2, 2, 'F');
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.6);
            doc.roundedRect(W/2-30, 34, 60, 7, 2, 2);
            // Ornamental lines flanking
            doc.setLineWidth(0.3);
            doc.line(12, 37.5, W/2-32, 37.5);
            doc.line(W/2+32, 37.5, W-12, 37.5);
            doc.setTextColor(...cream);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('PROFIT SHARE RECEIPT', W/2, 38.5, {align:'center'});

            // === RECIPIENT CARD (y: 44 → 72) ===
            doc.setFillColor(...softCard);
            doc.roundedRect(8, 44, W-16, 28, 2, 2, 'F');
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.5);
            doc.roundedRect(8, 44, W-16, 28, 2, 2);

            // "ISSUED TO" label
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...mutedText);
            doc.text('ISSUED TO', 12, 49);

            // Partner Name (large)
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text(pName, 12, 54.5);

            // Category Badge
            const isWorking = (pCategory || 'working') === 'working';
            doc.setFillColor(isWorking ? 22 : 107, isWorking ? 163 : 114, isWorking ? 74 : 128);
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'bold');
            const badgeW = doc.getTextWidth(catLabel) + 5;
            doc.roundedRect(12, 56, badgeW, 4.5, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(catLabel, 14.5, 59);

            // Gold divider inside card
            doc.setDrawColor(...goldLight);
            doc.setLineWidth(0.3);
            doc.line(12, 62.5, W-12, 62.5);

            // Info row: Period | Branch | Reference
            const infoY = 65.5;
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...mutedText);
            doc.text('PERIOD', 12, infoY);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text(month + ' ' + year, 12, infoY + 3.5);

            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...mutedText);
            doc.text('BRANCH', W/2 - 10, infoY);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text(currentBranch || 'Safa Branch', W/2 - 10, infoY + 3.5);

            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...mutedText);
            doc.text('REFERENCE', W - 40, infoY);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text(ref, W - 40, infoY + 3.5);

            // === FINANCIAL SUMMARY (y: 76 → 113) ===
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...emerald);
            doc.text('FINANCIAL SUMMARY', 12, 78);
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.3);
            doc.line(12, 79.5, W - 12, 79.5);

            // Row 1: Gross Share
            doc.setFillColor(...softCard);
            doc.rect(8, 81, W - 16, 9, 'F');
            doc.setDrawColor(...goldLight);
            doc.setLineWidth(0.15);
            doc.rect(8, 81, W - 16, 9);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...mutedText);
            doc.text(`Gross Share (${pPct}%)`, 12, 86.5);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text(grossStr, W - 12, 86.5, {align:'right'});

            // Row 2: Partner Expense
            doc.setFillColor(...white);
            doc.rect(8, 90, W - 16, 9, 'F');
            doc.setDrawColor(...goldLight);
            doc.setLineWidth(0.15);
            doc.rect(8, 90, W - 16, 9);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...mutedText);
            doc.text('Partner Expense Deduction', 12, 95.5);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...danger);
            doc.text('- ' + expenseStr, W - 12, 95.5, {align:'right'});

            let amountBoxY = 101;
            let descriptionY = 118;
            let sealY = 115;
            let dividerY = 143;
            let signatureY = 158;
            let thankY = 172;

            if (expenseDetailItems.length > 0) {
                const visibleExpenseItems = expenseDetailItems.slice(0, 5);
                const hiddenExpenseCount = Math.max(0, expenseDetailItems.length - visibleExpenseItems.length);
                const detailBoxY = 100.5;
                const detailBoxH = 7.5 + ((visibleExpenseItems.length + (hiddenExpenseCount ? 1 : 0)) * 4.2);

                doc.setFillColor(255, 246, 238);
                doc.rect(8, detailBoxY, W - 16, detailBoxH, 'F');
                doc.setDrawColor(...danger);
                doc.setLineWidth(0.2);
                doc.rect(8, detailBoxY, W - 16, detailBoxH);

                doc.setFontSize(5.2);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...danger);
                doc.text('EXPENSE BREAKDOWN', 12, detailBoxY + 4.2);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5.8);

                visibleExpenseItems.forEach((item, index) => {
                    const rowY = detailBoxY + 8.2 + (index * 4.2);
                    const nameLines = doc.splitTextToSize(item.name, W - 48);
                    doc.setTextColor(...darkText);
                    doc.text(nameLines[0], 12, rowY);
                    doc.setTextColor(...danger);
                    doc.text('Rs. ' + item.amount.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}), W - 12, rowY, {align:'right'});
                });

                if (hiddenExpenseCount) {
                    doc.setTextColor(...mutedText);
                    doc.text(`+${hiddenExpenseCount} more expense item(s)`, 12, detailBoxY + 8.2 + (visibleExpenseItems.length * 4.2));
                }

                amountBoxY = detailBoxY + detailBoxH + 2;
                descriptionY = amountBoxY + 17;
                sealY = descriptionY - 3;
                dividerY = descriptionY + 22;
                signatureY = dividerY + 13;
                thankY = signatureY + 14;
            }

            // Row 3: Amount Payable (highlighted emerald)
            doc.setFillColor(...emerald);
            doc.roundedRect(8, amountBoxY, W - 16, 12, 1.5, 1.5, 'F');
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.6);
            doc.roundedRect(8, amountBoxY, W - 16, 12, 1.5, 1.5);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...cream);
            doc.text('AMOUNT PAYABLE', 12, amountBoxY + 6.5);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...(netAmt < 0 ? [220, 53, 69] : gold));
            doc.text(amtStr, W - 12, amountBoxY + 8, {align:'right'});

            // === DESCRIPTION & SEAL (y: 115 → 142) ===
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...darkText);
            const expenseNote = expenseAmt > 0 ? ' after deducting your partner expense for this period' : '';
            const greetingText = `Dear ${pName.split(' ')[0]}, we are pleased to inform you that for the month of ${month} ${year}, your profit share from Boofiya Nujoom \u2013 ${currentBranch || 'Safa Branch'} has been calculated based on your ${pPct}% shareholding${expenseNote}. Please retain this receipt for your personal records.`;
            doc.text(greetingText, 12, descriptionY, {maxWidth: W/2 - 4});

            // Seal (right side)
            doc.addImage(sealPng, 'PNG', W/2 + 14, sealY, 25, 25);

            // === GOLD ORNAMENTAL DIVIDER (y: 143) ===
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.3);
            doc.line(12, dividerY, W/2 - 4, dividerY);
            doc.line(W/2 + 4, dividerY, W - 12, dividerY);
            doc.setFillColor(...gold);
            doc.circle(W/2, dividerY, 1.2, 'F');

            // === SIGNATURE SECTION (y: 148 → 165) ===
            // Left: Authorized signature
            doc.setDrawColor(...darkText);
            doc.setLineWidth(0.4);
            doc.line(12, signatureY, 48, signatureY);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text('For Boofiya Nujoom', 12, signatureY + 3);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...mutedText);
            doc.text('Authorized Signature', 12, signatureY + 6);

            // Right: Partner acknowledgment
            doc.setDrawColor(...darkText);
            doc.line(W - 50, signatureY, W - 12, signatureY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text('Partner Acknowledgment', W - 50, signatureY + 3);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...mutedText);
            doc.text('Signature / Date', W - 50, signatureY + 6);

            // === THANK YOU (y: 170) ===
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...gold);
            doc.text('\u201C Together we grow, together we succeed \u201D', W/2, thankY, {align:'center'});
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text('Thank you for your trust and partnership.', W/2, thankY + 5, {align:'center'});

            // === FOOTER BAR ===
            doc.setFillColor(...emerald);
            doc.roundedRect(4.3, H - 16, W - 8.6, 11.7, 1.5, 1.5, 'F');
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.8);
            doc.roundedRect(4.3, H - 16, W - 8.6, 11.7, 1.5, 1.5);

            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...cream);
            doc.text('+91 87147 47561', 12, H - 10);
            doc.text(`Boofiya Nujoom \u2013 ${currentBranch || 'Safa Branch'}`, W/2, H - 10, {align:'center'});
            doc.text('boofiyanujooom@gmail.com', W - 12, H - 10, {align:'right'});

            doc.setFontSize(5);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...goldLight);
            doc.text('This is a computer-generated document. No physical signature is required for validation.', W/2, H - 6.5, {align:'center'});

            resolve(doc);
        };
        img.src = url;
    });
}

async function downloadShare(name, pct, category) {
    const doc = await makeSharePDF(name, pct, category);
    doc.save(`Receipt_${name.replace(/\s+/g,'_')}.pdf`);
}

async function printShare(name, pct, category) {
    const doc = await makeSharePDF(name, pct, category);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}

async function downloadShareById(partnerId) {
    const partner = branchPartners.find(p => p.id === partnerId);
    if (!partner) return;
    const expenseDetails = getPartnerExpenseDetails(partner);
    const doc = await makeSharePDF(partner.name, partner.pct, partner.category, getPartnerExpenseShare(partner), expenseDetails);
    doc.save(`Receipt_${partner.name.replace(/\s+/g,'_')}.pdf`);
}

async function printShareById(partnerId) {
    const partner = branchPartners.find(p => p.id === partnerId);
    if (!partner) return;
    const expenseDetails = getPartnerExpenseDetails(partner);
    const doc = await makeSharePDF(partner.name, partner.pct, partner.category, getPartnerExpenseShare(partner), expenseDetails);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}

async function downloadAllShares() {
    const {jsPDF} = window.jspdf;
    const master = new jsPDF({unit:'mm', format:'a5'});
    for(let i=0; i<branchPartners.length; i++) {
        const expenseDetails = getPartnerExpenseDetails(branchPartners[i]);
        const doc = await makeSharePDF(branchPartners[i].name, branchPartners[i].pct, branchPartners[i].category, getPartnerExpenseShare(branchPartners[i]), expenseDetails);
        if(i > 0) master.addPage();
        master.internal.pages[i+1] = doc.internal.pages[1];
    }
    master.save('All_Partner_Receipts.pdf');
}

async function printAllShares() {
    const {jsPDF} = window.jspdf;
    const master = new jsPDF({unit:'mm', format:'a5'});
    for(let i=0; i<branchPartners.length; i++) {
        const expenseDetails = getPartnerExpenseDetails(branchPartners[i]);
        const doc = await makeSharePDF(branchPartners[i].name, branchPartners[i].pct, branchPartners[i].category, getPartnerExpenseShare(branchPartners[i]), expenseDetails);
        if(i > 0) master.addPage();
        master.internal.pages[i+1] = doc.internal.pages[1];
    }
    master.autoPrint();
    window.open(master.output('bloburl'), '_blank');
}

// Sponsor Manager Logic
async function loadSponsors() {
    const uid = window.fb.auth.currentUser.uid;
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/sponsors`));
    sponsors = snap.docs.map(d => d.data());
    const select = document.getElementById('active-sponsor-select');
    select.innerHTML = '<option value="">Select Sponsor (اختر الكفيل)</option>';
    sponsors.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        if (s.id === activeSponsorId) opt.selected = true;
        select.appendChild(opt);
    });
    refreshSponsorUI();
}

function refreshSponsorUI() {
    const editBtn = document.getElementById('edit-sponsor-btn');
    if (activeSponsorId) {
        document.getElementById('sponsor-tabs-container').style.display = 'block';
        document.getElementById('no-sponsor-selected').style.display = 'none';
        if (editBtn) editBtn.style.display = 'block';
        loadSponsorTransactions(activeSponsorId);
    } else {
        document.getElementById('sponsor-tabs-container').style.display = 'none';
        document.getElementById('no-sponsor-selected').style.display = 'block';
        if (editBtn) editBtn.style.display = 'none';
    }
}

function openEditSponsorModal() {
    if (!activeSponsorId) return;
    const sp = sponsors.find(s => s.id === activeSponsorId);
    document.getElementById('edit-sp-name').value = sp.name;
    document.getElementById('edit-sp-bal').value = sp.openingBalance || 0;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('edit-sponsor-modal')).show();
}

async function loadSponsorTransactions(spId) {
    const uid = window.fb.auth.currentUser.uid;
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/sponsors/${spId}/transactions`));
    sponsorTransactions = snap.docs.map(d => d.data()).sort((a,b) => new Date(b.date) - new Date(a.date));
    renderSponsorAll();
}

async function handleSponsorTx(e, type) {
    e.preventDefault();
    if (!activeSponsorId) return;
    const fd = new FormData(e.target);
    const uid = window.fb.auth.currentUser.uid;
    const id = 'TX' + Date.now();
    const data = {
        id,
        type,
        date: fd.get('date'),
        amount: Number(fd.get('amount')),
        detail: type === 'withdrawal' ? fd.get('bank') : fd.get('category'),
        createdAt: Date.now()
    };
    await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/sponsors/${activeSponsorId}/transactions`, id), data);
    e.target.reset();
    loadSponsorTransactions(activeSponsorId);
}

function renderSponsorAll() {
    renderSponsorRecords();
}

function renderSponsorRecords() {
    const body = document.getElementById('sponsor-records-body');
    body.innerHTML = '';
    const sp = sponsors.find(s => s.id === activeSponsorId);
    const openingBal = Number(sp.openingBalance) || 0;
    
    let totalW = 0, totalE = 0;
    
    // Sort transactions by date descending
    const sorted = [...sponsorTransactions].sort((a,b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(tx => {
        // Support both old format and new ledger format
        const ahli = tx.ahli || (tx.type === 'withdrawal' && tx.detail === 'الأهلي' ? tx.amount : 0);
        const bilad = tx.bilad || (tx.type === 'withdrawal' && tx.detail === 'البلاد' ? tx.amount : 0);
        // Handle "Both" split from old format
        const splitW = (tx.type === 'withdrawal' && tx.detail === 'كلاهما') ? tx.amount/2 : 0;
        
        const finalAhli = ahli + splitW;
        const finalBilad = bilad + splitW;
        const expense = tx.expense || (tx.type === 'expense' ? tx.amount : 0);
        
        totalW += (finalAhli + finalBilad);
        totalE += expense;
        const net = (finalAhli + finalBilad) - expense;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4 text-start small fw-bold text-muted">${tx.date}</td>
            <td class="fw-bold text-primary">₹${finalAhli.toLocaleString()}</td>
            <td class="fw-bold text-primary">₹${finalBilad.toLocaleString()}</td>
            <td class="fw-bold text-danger">₹${expense.toLocaleString()}</td>
            <td class="fw-bold bg-light">₹${net.toLocaleString()}</td>
            <td class="text-center pe-4"><button class="btn btn-sm btn-light text-danger" onclick="deleteSponsorTx('${tx.id}')">🗑️</button></td>
        `;
        body.appendChild(tr);
    });
    
    document.getElementById('sp-opening-bal').textContent = '₹' + openingBal.toLocaleString();
    document.getElementById('sp-total-withdrawal').textContent = '₹' + totalW.toLocaleString();
    document.getElementById('sp-total-expense').textContent = '₹' + totalE.toLocaleString();
    const finalNet = (totalW - totalE) + openingBal;
    document.getElementById('sp-total-net').textContent = '₹' + finalNet.toLocaleString();
}

async function deleteSponsorTx(id) {
    if (confirm('Delete transaction?')) {
        const uid = window.fb.auth.currentUser.uid;
        await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/sponsors/${activeSponsorId}/transactions`, id));
        loadSponsorTransactions(activeSponsorId);
    }
}




async function generateSponsorReport() {
    const from = document.getElementById('sp-date-from').value;
    const to = document.getElementById('sp-date-to').value;
    if (!from || !to) { alert('Select date range'); return; }

    const sp = sponsors.find(s => s.id === activeSponsorId);
    const openingBal = Number(sp.openingBalance) || 0;
    
    // Group transactions by date for the table
    const dailyData = {};
    const deductionList = []; // Track individual deductions
    const filtered = sponsorTransactions.filter(tx => tx.date >= from && tx.date <= to);
    
    filtered.forEach(tx => {
        if (!dailyData[tx.date]) dailyData[tx.date] = { ahli: 0, bilad: 0, exp: 0 };
        
        // Handle New Ledger Format
        const lAhli = Number(tx.ahli) || 0;
        const lBilad = Number(tx.bilad) || 0;
        const lExp = Number(tx.expense) || 0;
        
        // Process Detailed Deductions List
        if (tx.deductions && Array.isArray(tx.deductions)) {
            tx.deductions.forEach(d => {
                deductionList.push({ date: tx.date, name: d.name, amount: Number(d.amount) || 0 });
            });
        } else if (lExp > 0) {
            // Fallback for single expense entries without the new 'deductions' array
            deductionList.push({ date: tx.date, name: tx.notes || "مصروفات عامة", amount: lExp });
        }
        
        // Handle Old Format Compatibility (Before Ledger conversion)
        let oAhli = 0, oBilad = 0, oExp = 0;
        if (tx.type === 'withdrawal') {
            if (tx.detail === 'الأهلي') oAhli = Number(tx.amount) || 0;
            else if (tx.detail === 'البلاد') oBilad = Number(tx.amount) || 0;
            else { oAhli = (Number(tx.amount) || 0) / 2; oBilad = (Number(tx.amount) || 0) / 2; }
        } else if (tx.type === 'expense') {
            oExp = Number(tx.amount) || 0;
            deductionList.push({ date: tx.date, name: tx.detail || "مصروفات", amount: oExp });
        }

        dailyData[tx.date].ahli += (lAhli + oAhli);
        dailyData[tx.date].bilad += (lBilad + oBilad);
        dailyData[tx.date].exp += (lExp + oExp);
    });

    const sortedDates = Object.keys(dailyData).sort();
    let totalAhli = 0, totalBilad = 0, totalExp = 0;
    sortedDates.forEach(d => {
        totalAhli += dailyData[d].ahli;
        totalBilad += dailyData[d].bilad;
        totalExp += dailyData[d].exp;
    });

    const subtotal = totalAhli + totalBilad;
    const finalNet = (subtotal - totalExp) + openingBal;

    // UI Preview
    const preview = document.getElementById('sp-report-preview');
    preview.style.display = 'block';
    preview.innerHTML = `
        <div class="card border-0 shadow-lg rounded-5 overflow-hidden" dir="rtl" id="sponsor-report-card">
            <div class="p-3 p-md-5 bg-white">
                <div class="no-print-btn text-start mb-4">
                    <button class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" onclick="downloadSponsorPDF('${from}','${to}')">📥 تحميل PDF</button>
                </div>
                
                <h6 class="fw-bold mb-3 text-muted border-bottom pb-2">جدول السحب اليومي (Daily Withdrawal)</h6>
                <div class="table-responsive mb-4">
                    <table class="table table-sm table-bordered align-middle text-center small">
                        <thead class="bg-light">
                            <tr><th>التاريخ</th><th>الأهلي</th><th>البلاد</th><th>المصروفات</th></tr>
                        </thead>
                        <tbody>
                            ${sortedDates.map(d => `
                                <tr>
                                    <td>${d}</td>
                                    <td>${dailyData[d].ahli || '-'}</td>
                                    <td>${dailyData[d].bilad || '-'}</td>
                                    <td class="text-danger">${dailyData[d].exp || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                ${deductionList.length > 0 ? `
                    <h6 class="fw-bold mb-3 text-muted">تفاصيل الخصومات (Deduction Details)</h6>
                    <div class="table-responsive mb-4">
                        <table class="table table-sm table-bordered align-middle text-center small">
                            <thead class="bg-light">
                                <tr><th>التاريخ</th><th>بيان المصروف</th><th>المبلغ</th></tr>
                            </thead>
                            <tbody>
                                ${deductionList.map(d => `
                                    <tr>
                                        <td>${d.date}</td>
                                        <td>${d.name}</td>
                                        <td class="text-danger fw-bold">₹${d.amount.toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                <div class="mt-4 p-3 p-md-4 rounded-4 bg-light border border-2">
                    <div class="row g-2 g-md-3 text-end">
                        <div class="col-7 col-md-6 fw-bold">إجمالي الأهلي + البلاد:</div><div class="col-5 col-md-6 text-start fw-bold">₹${subtotal.toLocaleString()}</div>
                        <div class="col-7 col-md-6 text-danger fw-bold">إجمالي الخصومات:</div><div class="col-5 col-md-6 text-start text-danger fw-bold">- ₹${totalExp.toLocaleString()}</div>
                        <div class="col-7 col-md-6 text-muted fw-bold">كشف قديم (الرصيد):</div><div class="col-5 col-md-6 text-start text-muted fw-bold">+ ₹${openingBal.toLocaleString()}</div>
                        <div class="col-12"><hr class="my-1"></div>
                        <div class="col-7 col-md-6 h5 fw-bold text-primary">كشف جديد:</div><div class="col-5 col-md-6 text-start h5 fw-bold text-primary">₹${finalNet.toLocaleString()}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    preview.scrollIntoView({ behavior: 'smooth' });
}

async function downloadSponsorPDF(from, to) {
    const previewElement = document.getElementById('sponsor-report-card');
    if (!previewElement) {
        alert("Please generate the report preview first.");
        return;
    }

    const sp = sponsors.find(s => s.id === activeSponsorId);
    console.log("📸 Capturing formal report for PDF...");
    
    try {
        const canvas = await html2canvas(previewElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            onclone: (clonedDoc) => {
                // Hide the download button in the PDF version
                const btn = clonedDoc.querySelector('.no-print-btn');
                if (btn) btn.style.display = 'none';
            }
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Statement_${sp.name.replace(/\s+/g,'_')}.pdf`);
        console.log("✅ Formal PDF Downloaded");
    } catch (error) {
        console.error("❌ PDF Generation Error:", error);
        alert("Failed to generate PDF. Please try again.");
    }
}

async function generateCustomReport() {
    const from = document.getElementById('dash-date-from').value;
    const to = document.getElementById('dash-date-to').value;
    if (!from || !to) { alert('Please select date range'); return; }

    const entries = allData[currentBranch] || [];
    const filtered = entries.filter(e => e.date >= from && e.date <= to)
                           .sort((a,b) => new Date(a.date) - new Date(b.date));

    const preview = document.getElementById('dash-report-preview');
    if (filtered.length === 0) {
        preview.style.display = 'block';
        preview.innerHTML = `<div class="alert alert-warning text-center fw-bold rounded-4 shadow-sm p-4">No entries found for the selected range.</div>`;
        return;
    }

    let cbk=0, ccs=0, cin=0, tcas=0, tcb=0, tba=0, tbb=0;
    const summary = {};

    let tableRows = '';
    filtered.forEach(e => {
        const c = calculateEntry(e);
        cbk += c.bk;
        ccs += c.cas;
        cin += c.inc;
        tcas += c.cas;
        tcb += c.cb;
        tba += c.ba;
        tbb += c.bb;

        if (e.otherExpenses) {
            e.otherExpenses.forEach(x => {
                const type = x.type || 'Other';
                if (!summary[type]) summary[type] = { total: 0, date: null };
                summary[type].total += (Number(x.amt) || 0);
                if (e.date && (!summary[type].date || new Date(e.date) > new Date(summary[type].date))) {
                    summary[type].date = e.date;
                }
            });
        }

        tableRows += `
            <tr>
                <td class="ps-4"><strong>${e.date}</strong></td>
                <td>₹${c.bk.toLocaleString()}</td>
                <td>₹${c.cas.toLocaleString()}</td>
                <td>₹${c.ba.toLocaleString()}</td>
                <td>₹${c.cb.toLocaleString()}</td>
                <td>₹${c.bb.toLocaleString()}</td>
                <td class="text-success fw-bold">₹${c.inc.toLocaleString()}</td>
                <td>₹${cbk.toLocaleString()}</td>
                <td>₹${ccs.toLocaleString()}</td>
                <td class="text-primary fw-bold">₹${cin.toLocaleString()}</td>
            </tr>
        `;
    });

    const netGrowth = cin - cbk;

    let expensesGridHtml = '';
    const summaryEntries = Object.entries(summary);
    if (summaryEntries.length > 0) {
        expensesGridHtml = `
            <div class="card border-0 shadow-sm p-4 mt-4">
                <h5 class="fw-bold mb-4 text-muted">Expenses Analysis (تحليل المصروفات)</h5>
                <div class="row g-3">
                    ${summaryEntries.map(([k, v]) => `
                        <div class="col-6 col-md-3 mb-3">
                            <div class="card p-3 border-0 bg-light rounded-4 shadow-sm h-100">
                                <div class="fw-bold text-dark text-truncate mb-1" title="${k}">${k}</div>
                                <div class="text-muted small mb-2" style="font-size: 0.75rem;">Last: ${v.date || 'No date'}</div>
                                <div class="h6 mb-0 text-primary fw-bold">₹${v.total.toLocaleString()}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    preview.style.display = 'block';
    preview.innerHTML = `
        <div class="border-top pt-4">
            <div class="d-flex justify-content-end mb-3 no-print-btn">
                <button class="btn btn-primary rounded-pill px-4 fw-bold shadow-sm" onclick="downloadCustomRangePDF('${from}','${to}')">📥 Download PDF Report</button>
            </div>
            
            <div class="card border-0 shadow-lg rounded-5 overflow-hidden p-4 p-md-5 bg-white text-dark" id="dash-report-card" style="font-family: 'Outfit', sans-serif;">
                <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                    <div>
                        <h4 class="fw-bold mb-1 text-primary">${currentBranch}</h4>
                        <p class="text-muted small mb-0">Custom Ledger Report | Period: ${from} to ${to}</p>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-primary px-3 py-2 rounded-pill shadow-sm fs-6">Net: ₹${netGrowth.toLocaleString()}</span>
                    </div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-lg-6">
                        <div class="card balance-card p-4 shadow-sm" style="background: linear-gradient(135deg, #059669, #10b981); border: none; border-radius: 20px;">
                            <h6 class="text-white-50 small fw-bold mb-4">Cash Ledger</h6>
                            <div class="row g-2 text-center text-white">
                                <div class="col-4 balance-item"><small>In</small><div class="fw-bold">₹${tcas.toLocaleString()}</div></div>
                                <div class="col-4 balance-item"><small>Out</small><div class="fw-bold">₹${tcb.toLocaleString()}</div></div>
                                <div class="col-4 balance-item"><small>Bal</small><div class="h5 fw-bold mb-0">₹${(tcas - tcb).toLocaleString()}</div></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card balance-card p-4 shadow-sm" style="background: linear-gradient(135deg, #4f46e5, #6366f1); border: none; border-radius: 20px;">
                            <h6 class="text-white-50 small fw-bold mb-4">Bank Ledger</h6>
                            <div class="row g-2 text-center text-white">
                                <div class="col-4 balance-item"><small>In</small><div class="fw-bold">₹${tba.toLocaleString()}</div></div>
                                <div class="col-4 balance-item"><small>Out</small><div class="fw-bold">₹${tbb.toLocaleString()}</div></div>
                                <div class="col-4 balance-item"><small>Bal</small><div class="h5 fw-bold mb-0">₹${(tba - tbb).toLocaleString()}</div></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0 text-center">
                            <thead class="bg-light small">
                                <tr>
                                    <th class="ps-4 text-start">Date</th>
                                    <th>BILL</th>
                                    <th>CAS</th>
                                    <th>BA</th>
                                    <th>CB</th>
                                    <th>BB</th>
                                    <th>INC</th>
                                    <th>C.BILL</th>
                                    <th>C.CAS</th>
                                    <th>C.INC</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                ${expensesGridHtml}
            </div>
        </div>
    `;

    preview.scrollIntoView({ behavior: 'smooth' });
}

async function downloadCustomRangePDF(from, to) {
    const previewElement = document.getElementById('dash-report-card');
    if (!previewElement) {
        alert("Please generate the report preview first.");
        return;
    }
    
    console.log("📸 Capturing custom ledger report for PDF...");
    
    try {
        const canvas = await html2canvas(previewElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff"
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let position = 0;
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        let heightLeft = pdfHeight - pageHeight;
        
        while (heightLeft > 0) {
            position = - (pdfHeight - heightLeft);
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
        }

        const fileName = `Ledger_Report_${currentBranch.replace(/\s+/g,'_')}_${from}_to_${to}.pdf`;
        pdf.save(fileName);
        console.log("✅ Custom Range PDF Downloaded:", fileName);
    } catch (error) {
        console.error("❌ PDF Generation Error:", error);
        alert("Failed to generate PDF. Please try again.");
    }
}

function addSponsorDeductionRow(t='', a='') { 
    const div = document.createElement('div'); 
    div.className = 'sp-deduction-row d-flex gap-2 align-items-center mb-2'; 
    div.innerHTML = `
        <input type="text" class="sp-d-n form-control form-control-sm border-2 rounded-3" placeholder="نوع المصروف (Category)" list="sponsor-expense-cats" value="${t}">
        <input type="number" class="sp-d-a form-control form-control-sm border-2 rounded-3" placeholder="₹" style="width: 100px;" value="${a}">
        <button type="button" class="btn btn-sm btn-light text-danger rounded-circle" onclick="this.parentElement.remove()">✕</button>
    `; 
    document.getElementById('sp-deductions-container').appendChild(div); 
}

async function loadBranchPartners(branch) {
    if (!window.fb || !window.fb.auth.currentUser) return;
    const uid = window.fb.auth.currentUser.uid;
    const snap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/branches/${branch}/partners`));
    branchPartners = snap.docs.map(d => d.data());
    refreshPartnersListUI();
}

function refreshPartnersListUI() {
    const body = document.getElementById('partners-list-body');
    if (!body) return;
    body.innerHTML = '';
    let totalPct = 0;
    
    if (branchPartners.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No partners configured for this branch.</td></tr>`;
    } else {
        branchPartners.forEach(p => {
            totalPct += Number(p.pct) || 0;
            const tr = document.createElement('tr');
            const categoryLabel = p.category === 'working' ? 'Working Partner' : 'Non-working Partner';
            const badgeClass = p.category === 'working' ? 'bg-success text-white' : 'bg-secondary text-white';
            tr.innerHTML = `
                <td class="ps-3 text-start"><strong>${p.name}</strong></td>
                <td><span class="badge ${badgeClass}">${categoryLabel}</span></td>
                <td class="fw-bold">${p.pct}%</td>
                <td class="pe-3">
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-sm btn-light text-primary border" onclick="editBranchPartner('${p.id}')">Edit</button>
                        <button class="btn btn-sm btn-light text-danger border" onclick="deleteBranchPartner('${p.id}')">🗑️</button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    }
    
    const badge = document.getElementById('partners-total-share-badge');
    if (badge) {
        badge.textContent = totalPct.toFixed(2) + '%';
        if (Math.abs(totalPct - 100) < 0.01) {
            badge.className = 'h5 fw-bold mb-0 text-success';
        } else {
            badge.className = 'h5 fw-bold mb-0 text-danger';
        }
    }
}

function resetPartnerForm() {
    editingPartnerId = null;

    const form = document.getElementById('add-partner-form');
    const nameInput = document.getElementById('partner-name-input');
    const catSelect = document.getElementById('partner-category-select');
    const pctInput = document.getElementById('partner-pct-input');
    const title = document.getElementById('partner-form-title');
    const submitBtn = document.getElementById('partner-submit-btn');
    const cancelWrap = document.getElementById('partner-cancel-edit-wrap');

    if (form) form.reset();
    if (nameInput) nameInput.value = '';
    if (catSelect) catSelect.value = 'working';
    if (pctInput) pctInput.value = '';
    if (title) title.textContent = 'Add New Partner (شريك جديد)';
    if (submitBtn) submitBtn.textContent = '+ Add';
    if (cancelWrap) cancelWrap.style.display = 'none';
}

function editBranchPartner(id) {
    const partner = branchPartners.find(p => p.id === id);
    if (!partner) {
        alert('Partner not found. Please refresh and try again.');
        return;
    }

    editingPartnerId = id;

    const nameInput = document.getElementById('partner-name-input');
    const catSelect = document.getElementById('partner-category-select');
    const pctInput = document.getElementById('partner-pct-input');
    const title = document.getElementById('partner-form-title');
    const submitBtn = document.getElementById('partner-submit-btn');
    const cancelWrap = document.getElementById('partner-cancel-edit-wrap');

    if (nameInput) nameInput.value = partner.name || '';
    if (catSelect) catSelect.value = partner.category || 'working';
    if (pctInput) pctInput.value = partner.pct || '';
    if (title) title.textContent = 'Edit Partner';
    if (submitBtn) submitBtn.textContent = 'Update';
    if (cancelWrap) cancelWrap.style.display = 'block';
    if (nameInput) nameInput.focus();
}

async function deleteBranchPartner(id) {
    if (confirm('Are you sure you want to delete this partner?')) {
        const uid = window.fb.auth.currentUser.uid;
        await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/branches/${currentBranch}/partners`, id));
        await loadBranchPartners(currentBranch);
        renderProfitShares();
        if (editingPartnerId === id) resetPartnerForm();
    }
}

async function handleAddPartnerFormSubmit(e) {
    e.preventDefault();
    if (!currentBranch) {
        alert("Please select a branch first.");
        return;
    }
    const nameInput = document.getElementById('partner-name-input');
    const catSelect = document.getElementById('partner-category-select');
    const pctInput = document.getElementById('partner-pct-input');
    if (!nameInput || !catSelect || !pctInput) return;
    
    const name = nameInput.value.trim();
    const category = catSelect.value;
    const pct = parseFloat(pctInput.value) || 0;
    
    if (!name) return;
    
    const id = editingPartnerId || 'PT-' + Date.now();
    const uid = window.fb.auth.currentUser.uid;
    const partnerData = {
        id,
        name,
        category,
        pct
    };
    
    try {
        await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/branches/${currentBranch}/partners`, id), partnerData);
        resetPartnerForm();
        await loadBranchPartners(currentBranch);
        renderProfitShares();
    } catch (err) {
        alert("Failed to save partner: " + err.message);
    }
}

window.addSponsorDeductionRow = addSponsorDeductionRow;
window.openEditSponsorModal = openEditSponsorModal;
window.generateCustomReport = generateCustomReport;
window.downloadCustomRangePDF = downloadCustomRangePDF;
window.downloadSponsorPDF = downloadSponsorPDF; window.generateSponsorReport = generateSponsorReport; window.deleteSponsorTx = deleteSponsorTx;
window.printShare = printShare; window.downloadShare = downloadShare;
window.printShareById = printShareById; window.downloadShareById = downloadShareById;
window.deletePartnerExpenseItem = deletePartnerExpenseItem;
window.printAllShares = printAllShares; window.downloadAllShares = downloadAllShares;
window.editEntry = editEntry; window.deleteEntry = deleteEntry; 
window.deleteDoc = deleteDoc; window.editDoc = editDoc; window.addExpenseRow = addExpenseRow; window.restoreTrash = restoreTrash; window.permanentDelete = permanentDelete;
window.refreshSponsorUI = refreshSponsorUI;
window.editBranchPartner = editBranchPartner;
window.deleteBranchPartner = deleteBranchPartner;
window.loadBranchPartners = loadBranchPartners;


// Initialize immediately since this is a module
setupListeners();
