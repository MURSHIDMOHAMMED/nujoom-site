// main.js
const PARTNERS = [
  {name:'Musthafa Mk',pct:60.75},
  {name:'Asees Mk',   pct:14},
  {name:'Mujeeb Mk',  pct:10},
  {name:'Ismail T',   pct:6.03},
  {name:'Kunjapu Mk', pct:5.72},
  {name:'Bavutty',    pct:3.5},
];

let allData = {};
let documents = [];
let sponsors = [];
let activeSponsorId = null;
let sponsorTransactions = [];
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
        'month-detail': 'Monthly Ledger', 
        'settings': 'Alert Settings', 
        'trash': 'Trash' 
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
    if(v === 'profit') renderProfitShares();
    if(v === 'sponsor') await loadSponsors();
    if(v === 'trash') renderTrash();
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

    const spMonth = document.getElementById('sp-month-filter');
    if (spMonth) spMonth.onchange = () => renderSponsorMonthly();
    
    const spYear = document.getElementById('sp-year-filter');
    if (spYear) spYear.onchange = () => renderSponsorMonthly();

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

    const calcToggle = document.getElementById('calculator-toggle');
    if (calcToggle) {
        calcToggle.onclick = () => {
            const panel = document.getElementById('calculator-panel');
            if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        };
    }

    safeSetClick('back-to-dashboard', () => switchView('dashboard'));
    safeSetClick('btn-print-ledger', () => window.print());
    
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
            el.addEventListener('input', renderProfitShares);
            el.addEventListener('change', renderProfitShares);
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

// Calculator Logic
let calcExpression = "";
function appendCalc(v) {
    const d = document.getElementById('calc-display');
    if (calcExpression === "" && "/*+-.".includes(v)) return;
    calcExpression += v;
    d.value = calcExpression;
}
function clearCalc() {
    calcExpression = "";
    document.getElementById('calc-display').value = "0";
    document.getElementById('calc-history').textContent = "";
}
function backspaceCalc() {
    calcExpression = calcExpression.slice(0, -1);
    document.getElementById('calc-display').value = calcExpression || "0";
}
function runCalc() {
    try {
        const result = eval(calcExpression);
        document.getElementById('calc-history').textContent = calcExpression + " =";
        calcExpression = result.toString();
        document.getElementById('calc-display').value = calcExpression;
    } catch (e) {
        alert("Invalid calculation");
        clearCalc();
    }
}

// Draggable Calculator Logic
const calcPanel = document.getElementById('calculator-panel');
const calcHeader = document.getElementById('calc-header');

if (calcHeader && calcPanel) {
    let isDragging = false;
    let offsetX, offsetY;

    calcHeader.onmousedown = function(e) {
        isDragging = true;
        offsetX = e.clientX - calcPanel.getBoundingClientRect().left;
        offsetY = e.clientY - calcPanel.getBoundingClientRect().top;
        calcPanel.style.bottom = 'auto'; // Reset bottom for absolute positioning
        calcPanel.style.right = 'auto';
    };

    document.onmousemove = function(e) {
        if (!isDragging) return;
        calcPanel.style.left = (e.clientX - offsetX) + 'px';
        calcPanel.style.top = (e.clientY - offsetY) + 'px';
    };

    document.onmouseup = function() {
        isDragging = false;
    };
}

// Profit Share Logic
function renderProfitShares() {
    const profit = parseFloat(document.getElementById('profit-total-input').value) || 0;
    const month = document.getElementById('profit-month').value;
    const year = document.getElementById('profit-year').value;
    const grid = document.getElementById('profit-partners-grid');
    const summaryBar = document.getElementById('profit-summary-bar');
    const actionRow = document.getElementById('profit-action-row');
    
    summaryBar.style.setProperty('display', profit > 0 ? 'flex' : 'none', 'important');
    actionRow.style.setProperty('display', profit > 0 ? 'flex' : 'none', 'important');
    document.getElementById('profit-summary-amt').textContent = 'Rs. ' + profit.toLocaleString('en-IN', {minimumFractionDigits:2});
    
    grid.innerHTML = '';
    if(!profit) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-muted small">Enter the total profit above to calculate each partner\'s share</div>';
        return;
    }

    PARTNERS.forEach(p => {
        const amt = profit * (p.pct / 100);
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
                            <div class="text-muted small" style="font-size: 10px;">${p.pct}% Share</div>
                        </div>
                    </div>
                    <span class="badge rounded-pill bg-light text-primary border" style="color: var(--primary) !important; border-color: var(--border-color) !important;">${p.pct}%</span>
                </div>
                <hr class="opacity-10 my-3">
                <div class="d-flex justify-content-between align-items-end mb-4">
                    <div class="small text-muted fw-bold" style="font-size: 9px; letter-spacing: 1px;">MONTHLY SHARE</div>
                    <div class="h4 mb-0 fw-bold text-main">
                        <span class="small fw-normal me-1" style="font-size: 12px; color: var(--primary);">Rs.</span>${amt.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </div>
                </div>
                <div class="row g-2">
                    <div class="col-6"><button class="btn btn-light btn-sm w-100 rounded-3 fw-bold" style="font-size: 10px; border: 1px solid var(--border-color);" onclick="printShare('${p.name}', ${p.pct})">🖨️ Print</button></div>
                    <div class="col-6"><button class="btn btn-primary btn-sm w-100 rounded-3 fw-bold shadow-sm" style="font-size: 10px;" onclick="downloadShare('${p.name}', ${p.pct})">📥 PDF</button></div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });
}

function sealSVG(size = 160) {
    const cx=size/2, cy=size/2, sc=size/160;
    let radials='';
    for(let i=0;i<72;i++){
        const angle=(i/72)*360;
        const rad=angle*(Math.PI/180);
        const r1=49*sc, r2=59*sc;
        radials+=`<line x1="${(cx+r1*Math.cos(rad)).toFixed(2)}" y1="${(cy+r1*Math.sin(rad)).toFixed(2)}" x2="${(cx+r2*Math.cos(rad)).toFixed(2)}" y2="${(cy+r2*Math.sin(rad)).toFixed(2)}" stroke="#b8922a" stroke-width="${0.8*sc}"/>`;
    }
    const textR=66*sc;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><path id="topP" d="M ${cx - textR},${cy} A ${textR},${textR} 0 0,1 ${cx + textR},${cy}"/><path id="botP" d="M ${cx - textR},${cy} A ${textR},${textR} 0 0,0 ${cx + textR},${cy}"/></defs>
    <circle cx="${cx}" cy="${cy}" r="${75*sc}" fill="none" stroke="#8a5e1a" stroke-width="${3.5*sc}"/><circle cx="${cx}" cy="${cy}" r="${70*sc}" fill="none" stroke="#b8922a" stroke-width="${1.5*sc}"/>
    ${radials}
    <circle cx="${cx}" cy="${cy}" r="${48*sc}" fill="none" stroke="#b8922a" stroke-width="${1.5*sc}"/><circle cx="${cx}" cy="${cy}" r="${62*sc}" fill="none" stroke="#8a5e1a" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${47*sc}" fill="#fffcf5"/>
    <text x="${cx}" y="${cy - 6*sc}" text-anchor="middle" font-family="Georgia,serif" font-size="${12*sc}" font-weight="bold" fill="#8a5e1a">Est. 2017</text>
    <line x1="${cx - 18*sc}" y1="${cy - 1*sc}" x2="${cx + 18*sc}" y2="${cy - 1*sc}" stroke="#b8922a" stroke-width="1"/>
    <text x="${cx}" y="${cy + 11*sc}" text-anchor="middle" font-family="Georgia,serif" font-size="${13*sc}" font-weight="bold" fill="#8a5e1a">nujoom</text>
    <text font-family="sans-serif" font-size="${11.5*sc}" font-weight="bold" fill="#8a5e1a"><textPath href="#topP" startOffset="50%" text-anchor="middle">Boofiya Nujoom</textPath></text>
    <text font-family="sans-serif" font-size="${11*sc}" font-weight="bold" fill="#8a5e1a"><textPath href="#botP" startOffset="50%" text-anchor="middle">Safa Branch</textPath></text>
    </svg>`;
}

async function makeSharePDF(pName, pPct) {
    const profit = parseFloat(document.getElementById('profit-total-input').value) || 0;
    const month = document.getElementById('profit-month').value;
    const year = document.getElementById('profit-year').value;
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF({unit:'mm', format:'a5'});
    const W = doc.internal.pageSize.getWidth();
    const amt = profit * (pPct/100);
    const initials = pName.split(' ').map(n=>n[0]).join('').toUpperCase();
    const ref = `BNS-${month.slice(0,3).toUpperCase()}${year}-${initials}`;
    const today = new Date().toLocaleDateString('en-IN', {day:'2-digit', month:'long', year:'numeric'});

    return new Promise((resolve) => {
        const svgStr = sealSVG(400);
        const blob = new Blob([svgStr], {type:'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function() {
            const cv = document.createElement('canvas'); cv.width=400; cv.height=400;
            cv.getContext('2d').drawImage(img,0,0,400,400);
            const sealPng = cv.toDataURL('image/png');
            
            doc.setFillColor(255,252,245); doc.rect(0,0,W,210,'F');
            doc.setFillColor(138,94,26); doc.rect(0,0,W,2,'F');
            doc.setFillColor(184,146,42); doc.rect(0,2,W,3,'F');
            
            doc.setFillColor(138,94,26); doc.circle(W/2, 21, 8, 'F');
            doc.setTextColor(255,232,160); doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.text('BN', W/2, 23, {align:'center'});
            
            doc.setTextColor(26,18,8); doc.setFontSize(16); doc.text('Boofiya Nujoom', W/2, 36, {align:'center'});
            doc.setFontSize(6); doc.setTextColor(160,130,80); doc.text('S A F A   B R A N C H', W/2, 41, {align:'center'});
            
            doc.setFillColor(138,94,26); doc.roundedRect(W/2-28, 50, 56, 8, 2, 2, 'F');
            doc.setTextColor(255,232,160); doc.setFontSize(6.5); doc.text('PROFIT SHARE RECEIPT', W/2, 55.5, {align:'center'});
            
            doc.setFontSize(7); doc.setTextColor(140,110,60);
            doc.text('Ref: '+ref, 18, 64); doc.text('Period: '+month+' '+year, W-18, 64, {align:'right'});
            
            doc.setFontSize(8.5); doc.setTextColor(50,32,8); doc.text('Dear '+pName.split(' ')[0]+',', 18, 74);
            doc.setFontSize(7.8); doc.setTextColor(80,60,20); doc.setFont('helvetica','normal');
            doc.text(`We are pleased to inform you that for the month of ${month} ${year}, your profit share has been calculated based on your ${pPct}% shareholding.`, 18, 80, {maxWidth: W-36});

            let y = 95;
            [[ 'Partner Name', pName ], [ 'Profit Share', pPct+'%' ]].forEach((row, i) => {
                doc.setFillColor(250,245,232); doc.rect(18, y, W-36, 9, 'F');
                doc.setFontSize(7.5); doc.text(row[0], 22, y+6);
                doc.setFont('helvetica','bold'); doc.text(row[1], W-22, y+6, {align:'right'});
                y+=9;
            });

            doc.setFillColor(138,94,26); doc.roundedRect(18, y, W-36, 14, 1, 1, 'F');
            doc.setFontSize(8); doc.setTextColor(255,218,130); doc.text('Amount Payable', 22, y+6);
            doc.setFontSize(13); doc.setTextColor(255,238,170); doc.text('Rs. '+(profit*(pPct/100)).toLocaleString('en-IN'), W-22, y+11, {align:'right'});
            
            doc.addImage(sealPng, 'PNG', (W-28)/2, y+20, 28, 28);
            resolve(doc);
        };
        img.src = url;
    });
}

async function downloadShare(name, pct) {
    const doc = await makeSharePDF(name, pct);
    doc.save(`Receipt_${name.replace(/\s+/g,'_')}.pdf`);
}

async function printShare(name, pct) {
    const doc = await makeSharePDF(name, pct);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}

async function downloadAllShares() {
    const {jsPDF} = window.jspdf;
    const master = new jsPDF({unit:'mm', format:'a5'});
    for(let i=0; i<PARTNERS.length; i++) {
        const doc = await makeSharePDF(PARTNERS[i].name, PARTNERS[i].pct);
        if(i > 0) master.addPage();
        master.internal.pages[i+1] = doc.internal.pages[1];
    }
    master.save('All_Partner_Receipts.pdf');
}

async function printAllShares() {
    const {jsPDF} = window.jspdf;
    const master = new jsPDF({unit:'mm', format:'a5'});
    for(let i=0; i<PARTNERS.length; i++) {
        const doc = await makeSharePDF(PARTNERS[i].name, PARTNERS[i].pct);
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
    renderSponsorMonthly();
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

function renderSponsorMonthly() {
    const m = parseInt(document.getElementById('sp-month-filter').value);
    const y = parseInt(document.getElementById('sp-year-filter').value);
    const body = document.getElementById('sp-monthly-body');
    body.innerHTML = '';
    
    // Group by day
    const daily = {};
    sponsorTransactions.forEach(tx => {
        const txMonth = getMonthFromDate(tx.date);
        const txYear = parseInt(tx.date.split('-')[0]);
        if (txMonth === m && txYear === y) {
            const dateStr = tx.date;
            if (!daily[dateStr]) daily[dateStr] = { w: 0, e: 0 };
            if (tx.type === 'withdrawal') daily[dateStr].w += tx.amount; else daily[dateStr].e += tx.amount;
        }
    });

    Object.keys(daily).sort().reverse().forEach(date => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4 small fw-bold">${date}</td>
            <td class="text-primary fw-bold">₹${daily[date].w.toLocaleString()}</td>
            <td class="text-success fw-bold">₹${daily[date].e.toLocaleString()}</td>
            <td class="text-center pe-4 fw-bold">₹${(daily[date].w - daily[date].e).toLocaleString()}</td>
        `;
        body.appendChild(tr);
    });
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
            <div class="p-5 bg-white">
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

                <div class="mt-4 p-4 rounded-4 bg-light border border-2">
                    <div class="row g-3 text-end">
                        <div class="col-6 fw-bold">إجمالي الأهلي + البلاد:</div><div class="col-6 text-start fw-bold">₹${subtotal.toLocaleString()}</div>
                        <div class="col-6 text-danger fw-bold">إجمالي الخصومات:</div><div class="col-6 text-start text-danger fw-bold">- ₹${totalExp.toLocaleString()}</div>
                        <div class="col-6 text-muted fw-bold">كشف قديم (الرصيد):</div><div class="col-6 text-start text-muted fw-bold">+ ₹${openingBal.toLocaleString()}</div>
                        <div class="col-12"><hr class="my-1"></div>
                        <div class="col-6 h5 fw-bold text-primary">كشف جديد:</div><div class="col-6 text-start h5 fw-bold text-primary">₹${finalNet.toLocaleString()}</div>
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

window.addSponsorDeductionRow = addSponsorDeductionRow;
window.openEditSponsorModal = openEditSponsorModal;
window.downloadSponsorPDF = downloadSponsorPDF; window.generateSponsorReport = generateSponsorReport; window.deleteSponsorTx = deleteSponsorTx;
window.printShare = printShare; window.downloadShare = downloadShare;
window.printAllShares = printAllShares; window.downloadAllShares = downloadAllShares;
window.editEntry = editEntry; window.deleteEntry = deleteEntry; 
window.deleteDoc = deleteDoc; window.editDoc = editDoc; window.addExpenseRow = addExpenseRow; window.restoreTrash = restoreTrash; window.permanentDelete = permanentDelete;
window.refreshSponsorUI = refreshSponsorUI;
window.appendCalc = appendCalc; window.clearCalc = clearCalc; window.backspaceCalc = backspaceCalc; window.runCalc = runCalc;

// Initialize immediately since this is a module
setupListeners();

