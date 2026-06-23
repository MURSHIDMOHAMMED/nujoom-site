// salary-payroll.js
// Completely separated Employee Salary & Payroll Module

(function() {
    console.log("💰 Salary & Payroll Module Loading...");

    // Isolated State Management
    let salaryState = {
        employees: [],
        advances: [],
        debts: [],
        payments: [],
        history: []
    };

    let currentBranch = localStorage.getItem('nujoom_current_branch') || null;
    let currentSlipData = null; // Holds data of the last processed/viewed salary slip
    let employeeModal = null;
    let slipModal = null;

    // Inject Custom Styles to HEAD to maintain aesthetic separation
    const styleContent = `
        #salary-view .nav-link {
            color: var(--text-muted) !important;
            border: 1px solid transparent;
            background: transparent;
            transition: all 0.2s ease;
        }
        #salary-view .nav-link:hover {
            background-color: rgba(99, 102, 241, 0.05);
            color: var(--text-main) !important;
        }
        #salary-view .nav-link.active {
            background-color: var(--primary) !important;
            color: white !important;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }
        .salary-subview {
            animation: fadeIn 0.2s ease-in-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .salary-subview.d-none {
            display: none !important;
        }
        /* Color themes for paid statuses */
        .badge-paid { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #bbf7d0; }
        .badge-partial { background: #ffedd5 !important; color: #c2410c !important; border: 1px solid #fed7aa; }
        .badge-pending { background: #f1f5f9 !important; color: #475569 !important; border: 1px solid #e2e8f0; }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = styleContent;
    document.head.appendChild(styleEl);

    // Initializer function called when switching to the 'salary' view
    window.initSalaryPayroll = async function() {
        console.log("💰 initSalaryPayroll triggered");
        currentBranch = localStorage.getItem('nujoom_current_branch') || null;
        if (!currentBranch) {
            alert("Please select a branch first.");
            window.switchView('dashboard');
            return;
        }

        // Initialize Bootstrap Modal objects if not done yet
        if (!employeeModal) {
            const empModalEl = document.getElementById('salary-employee-modal');
            if (empModalEl) employeeModal = new bootstrap.Modal(empModalEl);
        }
        if (!slipModal) {
            const slipModalEl = document.getElementById('salary-slip-modal');
            if (slipModalEl) slipModal = new bootstrap.Modal(slipModalEl);
        }

        // Fetch data
        await loadAllPayrollData();

        // Setup DOM event listeners (done once)
        setupPayrollListeners();

        // Render current active tab (default to Employees)
        const activeTabButton = document.querySelector('#salary-view .nav-link.active');
        if (activeTabButton) {
            const tabId = activeTabButton.id.replace('salary-pill-', '');
            renderSubView(tabId);
        } else {
            renderSubView('employees');
        }
    };

    // Load data from Firebase
    async function loadAllPayrollData() {
        if (!window.fb || !window.fb.auth.currentUser) {
            console.warn("Firebase not ready or user not authenticated yet");
            return;
        }
        const uid = window.fb.auth.currentUser.uid;
        
        try {
            // Load Employees
            const empSnap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/employees`));
            salaryState.employees = empSnap.docs.map(d => d.data());

            // Load Advances
            const advSnap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/salary_advances`));
            salaryState.advances = advSnap.docs.map(d => d.data());

            // Load Personal Debt
            const debtSnap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/personal_debts`));
            salaryState.debts = debtSnap.docs.map(d => d.data());

            // Load Payments
            const paySnap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/salary_payments`));
            salaryState.payments = paySnap.docs.map(d => d.data());

            // Load History
            const histSnap = await window.fb.getDocs(window.fb.collection(window.fb.db, `users/${uid}/salary_history`));
            salaryState.history = histSnap.docs.map(d => d.data());

            console.log("💰 Payroll State Updated:", salaryState);
        } catch (err) {
            console.error("Error loading payroll details:", err);
            alert("Error loading payroll details: " + err.message);
        }
    }

    // Helper: Render sub-view based on tab selection
    function renderSubView(tab) {
        console.log("Switching sub-view to:", tab);
        
        // Hide all subviews, show target
        const subviews = ['employees', 'advance', 'debt', 'payment', 'history', 'reports'];
        subviews.forEach(s => {
            const viewEl = document.getElementById(`salary-subview-${s}`);
            const pillEl = document.getElementById(`salary-pill-${s}`);
            if (viewEl) {
                if (s === tab) {
                    viewEl.classList.remove('d-none');
                    viewEl.classList.add('active');
                } else {
                    viewEl.classList.remove('active');
                    viewEl.classList.add('d-none');
                }
            }
            if (pillEl) {
                if (s === tab) pillEl.classList.add('active');
                else pillEl.classList.remove('active');
            }
        });

        // Run sub-view renders
        if (tab === 'employees') renderEmployeesSubview();
        if (tab === 'advance') renderAdvanceSubview();
        if (tab === 'debt') renderDebtSubview();
        if (tab === 'payment') renderPaymentSubview();
        if (tab === 'history') renderHistorySubview();
        if (tab === 'reports') renderReportsSubview();
    }

    // --- Sub-view: Employees ---
    function renderEmployeesSubview() {
        const branchEmps = salaryState.employees.filter(e => e.branch === currentBranch);
        const searchQuery = document.getElementById('emp-search-input').value.trim().toLowerCase();
        const statusFilter = document.getElementById('emp-status-filter').value;

        // Apply filters
        let filtered = branchEmps;
        if (statusFilter !== 'all') {
            const statusUpper = statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
            filtered = filtered.filter(e => e.status === statusUpper);
        }
        if (searchQuery) {
            filtered = filtered.filter(e => 
                e.name.toLowerCase().includes(searchQuery) || 
                e.role.toLowerCase().includes(searchQuery) ||
                (e.empId && e.empId.toLowerCase().includes(searchQuery))
            );
        }

        // Render Table
        const tbody = document.getElementById('employees-table-body');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No employees found.</td></tr>`;
        } else {
            filtered.forEach(emp => {
                const tr = document.createElement('tr');
                const statusBadge = emp.status === 'Active' ? 'status-active' : 'status-expired';
                
                tr.innerHTML = `
                    <td class="ps-4 text-start fw-bold text-muted">${emp.empId || 'N/A'}</td>
                    <td><strong>${emp.name}</strong></td>
                    <td>${emp.phone}</td>
                    <td><span class="badge bg-light text-dark border">${emp.role}</span></td>
                    <td class="fw-bold text-primary">₹${Number(emp.monthlySalary).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td>${emp.joiningDate}</td>
                    <td><span class="status-badge ${statusBadge}">${emp.status}</span></td>
                    <td class="pe-4 text-center">
                        <button class="btn btn-sm btn-light border edit-emp-btn" data-id="${emp.id}">✏️</button>
                        <button class="btn btn-sm btn-light border text-danger delete-emp-btn" data-id="${emp.id}">🗑️</button>
                    </td>
                `;

                // Event Listeners for actions
                tr.querySelector('.edit-emp-btn').onclick = () => openEditEmployeeModal(emp.id);
                tr.querySelector('.delete-emp-btn').onclick = () => deleteEmployeeProfile(emp.id);

                tbody.appendChild(tr);
            });
        }

        // Render Stats
        const total = branchEmps.length;
        const active = branchEmps.filter(e => e.status === 'Active').length;
        const inactive = total - active;
        const payroll = branchEmps.filter(e => e.status === 'Active').reduce((sum, e) => sum + (Number(e.monthlySalary) || 0), 0);

        document.getElementById('emp-stat-total').textContent = total;
        document.getElementById('emp-stat-active').textContent = active;
        document.getElementById('emp-stat-inactive').textContent = inactive;
        document.getElementById('emp-stat-payroll').textContent = '₹' + payroll.toLocaleString('en-IN', {maximumFractionDigits:0});
    }

    function openAddEmployeeModal() {
        const form = document.getElementById('salary-employee-form');
        form.reset();
        document.getElementById('emp-db-id').value = '';
        document.getElementById('employee-modal-title').textContent = "Add Employee Profile";

        // Generate unique Employee ID
        let uniqueIdStr = '';
        let isUnique = false;
        while (!isUnique) {
            const rand = Math.floor(1000 + Math.random() * 9000);
            uniqueIdStr = `EMP-${rand}`;
            isUnique = !salaryState.employees.some(e => e.empId === uniqueIdStr);
        }
        document.getElementById('emp-id').value = uniqueIdStr;

        if (employeeModal) employeeModal.show();
    }

    function openEditEmployeeModal(dbId) {
        const emp = salaryState.employees.find(e => e.id === dbId);
        if (!emp) return;

        document.getElementById('employee-modal-title').textContent = "Edit Employee Profile";
        document.getElementById('emp-db-id').value = emp.id;
        document.getElementById('emp-id').value = emp.empId || '';
        document.getElementById('emp-name').value = emp.name || '';
        document.getElementById('emp-phone').value = emp.phone || '';
        document.getElementById('emp-role').value = emp.role || '';
        document.getElementById('emp-salary').value = emp.monthlySalary || '';
        document.getElementById('emp-joining').value = emp.joiningDate || '';
        document.getElementById('emp-status').value = emp.status || 'Active';
        document.getElementById('emp-notes').value = emp.notes || '';

        if (employeeModal) employeeModal.show();
    }

    async function saveEmployeeProfile(e) {
        e.preventDefault();
        const uid = window.fb.auth.currentUser.uid;
        const dbId = document.getElementById('emp-db-id').value;
        const empId = document.getElementById('emp-id').value;
        
        const data = {
            id: dbId || 'EMP-' + Date.now(),
            empId: empId,
            name: document.getElementById('emp-name').value.trim(),
            phone: document.getElementById('emp-phone').value.trim(),
            role: document.getElementById('emp-role').value.trim(),
            monthlySalary: Number(document.getElementById('emp-salary').value) || 0,
            joiningDate: document.getElementById('emp-joining').value,
            status: document.getElementById('emp-status').value,
            notes: document.getElementById('emp-notes').value.trim(),
            branch: currentBranch,
            updatedAt: Date.now()
        };

        try {
            await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/employees`, data.id), data);
            if (employeeModal) employeeModal.hide();
            
            await loadAllPayrollData();
            renderSubView('employees');
        } catch (err) {
            alert("Error saving employee profile: " + err.message);
        }
    }

    async function deleteEmployeeProfile(dbId) {
        const emp = salaryState.employees.find(e => e.id === dbId);
        if (!emp) return;

        if (confirm(`Are you sure you want to delete the employee "${emp.name}"? Historical salary payments and advance records will remain safe.`)) {
            const uid = window.fb.auth.currentUser.uid;
            try {
                await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/employees`, dbId));
                await loadAllPayrollData();
                renderSubView('employees');
            } catch (err) {
                alert("Error deleting employee: " + err.message);
            }
        }
    }


    // --- Sub-view: Salary Advance ---
    function renderAdvanceSubview() {
        const branchEmps = salaryState.employees.filter(e => e.branch === currentBranch && e.status === 'Active');
        
        // Fill dropdown
        const select = document.getElementById('advance-emp-select');
        select.innerHTML = '<option value="">Select Employee</option>';
        branchEmps.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = `${emp.name} (${emp.role})`;
            select.appendChild(opt);
        });

        // Set default date to today
        document.getElementById('advance-date').value = new Date().toISOString().substring(0, 10);
        
        // Set default month to current month (YYYY-MM)
        const now = new Date();
        const currentMonthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('advance-month').value = currentMonthVal;

        // Render Advances Table
        renderAdvancesTable();
    }

    function renderAdvancesTable() {
        const branchAdvances = salaryState.advances.filter(a => a.branch === currentBranch);
        const filterMonth = document.getElementById('advance-filter-month').value;
        
        let filtered = branchAdvances;
        if (filterMonth) {
            filtered = filtered.filter(a => a.salaryMonth === filterMonth);
        }

        // Sort descending by date
        filtered.sort((a,b) => new Date(b.advanceDate) - new Date(a.advanceDate));

        const tbody = document.getElementById('advances-table-body');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No salary advances recorded.</td></tr>`;
        } else {
            filtered.forEach(adv => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${adv.advanceDate}</strong></td>
                    <td>${adv.employeeName}</td>
                    <td>${formatMonthDisplay(adv.salaryMonth)}</td>
                    <td class="fw-bold text-danger">₹${Number(adv.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td><span class="badge bg-light text-dark border">${adv.paymentMode}</span></td>
                    <td class="text-muted small">${adv.note || '-'}</td>
                    <td class="text-center pe-4">
                        <button class="btn btn-sm btn-light border text-danger delete-adv-btn" data-id="${adv.id}">🗑️</button>
                    </td>
                `;

                tr.querySelector('.delete-adv-btn').onclick = () => deleteAdvanceRecord(adv.id);
                tbody.appendChild(tr);
            });
        }
    }

    async function saveSalaryAdvance(e) {
        e.preventDefault();
        const uid = window.fb.auth.currentUser.uid;
        const empId = document.getElementById('advance-emp-select').value;
        const emp = salaryState.employees.find(x => x.id === empId);
        
        if (!emp) return;

        const data = {
            id: 'ADV-' + Date.now(),
            employeeId: emp.empId,
            employeeDbId: empId,
            employeeName: emp.name,
            advanceDate: document.getElementById('advance-date').value,
            salaryMonth: document.getElementById('advance-month').value, // YYYY-MM
            amount: Number(document.getElementById('advance-amount').value) || 0,
            paymentMode: document.getElementById('advance-mode').value,
            note: document.getElementById('advance-note').value.trim(),
            branch: currentBranch,
            createdAt: Date.now()
        };

        try {
            await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/salary_advances`, data.id), data);
            document.getElementById('salary-advance-form').reset();
            
            await loadAllPayrollData();
            renderSubView('advance');
        } catch (err) {
            alert("Error saving advance: " + err.message);
        }
    }

    async function deleteAdvanceRecord(id) {
        if (confirm("Are you sure you want to delete this salary advance record? This will adjust the salary calculation for that month.")) {
            const uid = window.fb.auth.currentUser.uid;
            try {
                await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/salary_advances`, id));
                await loadAllPayrollData();
                renderAdvancesTable();

                // If the payment form is currently showing a selected employee/month,
                // refresh the live salary calculation so the deleted advance no longer appears.
                const payEmpSelect = document.getElementById('payment-emp-select');
                const payMonthSelect = document.getElementById('payment-month');
                if (payEmpSelect && payMonthSelect && payEmpSelect.value && payMonthSelect.value) {
                    handleEmployeeMonthChange();
                }
            } catch (err) {
                alert("Error deleting advance: " + err.message);
            }
        }
    }


    // --- Sub-view: Personal Debt Records ---
    function renderDebtSubview() {
        const branchEmps = salaryState.employees.filter(e => e.branch === currentBranch);
        
        // Fill dropdown (both Active and Inactive)
        const select = document.getElementById('debt-emp-select');
        select.innerHTML = '<option value="">Select Employee</option>';
        branchEmps.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = `${emp.name} (${emp.role}) ${emp.status === 'Inactive' ? '[Inactive]' : ''}`;
            select.appendChild(opt);
        });

        // Set default date to today
        document.getElementById('debt-date').value = new Date().toISOString().substring(0, 10);
        
        // Render Debts Table
        renderDebtsTable();
    }

    function renderDebtsTable() {
        const branchDebts = salaryState.debts.filter(d => d.branch === currentBranch);
        
        // Sort descending by date
        branchDebts.sort((a,b) => new Date(b.date) - new Date(a.date));

        const tbody = document.getElementById('debts-table-body');
        tbody.innerHTML = '';

        if (branchDebts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No personal debt records.</td></tr>`;
        } else {
            branchDebts.forEach(debt => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${debt.date}</strong></td>
                    <td>${debt.employeeName}</td>
                    <td class="fw-bold text-warning">₹${Number(debt.amount).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td class="text-muted small">${debt.note}</td>
                    <td class="text-center pe-4">
                        <button class="btn btn-sm btn-light border text-danger delete-debt-btn" data-id="${debt.id}">🗑️</button>
                    </td>
                `;

                tr.querySelector('.delete-debt-btn').onclick = () => deleteDebtRecord(debt.id);
                tbody.appendChild(tr);
            });
        }
    }

    async function savePersonalDebt(e) {
        e.preventDefault();
        const uid = window.fb.auth.currentUser.uid;
        const empId = document.getElementById('debt-emp-select').value;
        const emp = salaryState.employees.find(x => x.id === empId);

        if (!emp) return;

        const data = {
            id: 'DEB-' + Date.now(),
            employeeId: emp.empId,
            employeeDbId: empId,
            employeeName: emp.name,
            date: document.getElementById('debt-date').value,
            amount: Number(document.getElementById('debt-amount').value) || 0,
            note: document.getElementById('debt-note').value.trim(),
            branch: currentBranch,
            createdAt: Date.now()
        };

        try {
            await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/personal_debts`, data.id), data);
            document.getElementById('personal-debt-form').reset();
            
            await loadAllPayrollData();
            renderSubView('debt');
        } catch (err) {
            alert("Error saving debt: " + err.message);
        }
    }

    async function deleteDebtRecord(id) {
        if (confirm("Are you sure you want to delete this debt record?")) {
            const uid = window.fb.auth.currentUser.uid;
            try {
                await window.fb.deleteDoc(window.fb.doc(window.fb.db, `users/${uid}/personal_debts`, id));
                await loadAllPayrollData();
                renderDebtsTable();
            } catch (err) {
                alert("Error deleting debt: " + err.message);
            }
        }
    }


    // --- Sub-view: Salary Payment ---
    function renderPaymentSubview() {
        const branchEmps = salaryState.employees.filter(e => e.branch === currentBranch && e.status === 'Active');
        
        // Fill dropdown
        const select = document.getElementById('payment-emp-select');
        select.innerHTML = '<option value="">Choose Employee</option>';
        branchEmps.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = `${emp.name} (${emp.role})`;
            select.appendChild(opt);
        });

        // Set default month
        const now = new Date();
        const currentMonthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('payment-month').value = currentMonthVal;
        
        // Set payment date to today
        document.getElementById('payment-date').value = new Date().toISOString().substring(0, 10);

        // Reset details
        resetPaymentFormValues();
    }

    function resetPaymentFormValues() {
        // Reset labels
        document.getElementById('calc-monthly-salary').textContent = '₹0';
        document.getElementById('calc-salary-advance').textContent = '₹0';
        document.getElementById('calc-net-salary').textContent = '₹0';
        document.getElementById('preview-payment-paid').textContent = '₹0';
        document.getElementById('preview-payment-balance').textContent = '₹0';
        
        const statusBadge = document.getElementById('preview-payment-status');
        statusBadge.textContent = 'Pending';
        statusBadge.className = 'badge badge-pending px-3 py-2 fs-6 rounded-pill';

        // Reset inputs
        document.getElementById('payment-cash-paid').value = '0';
        document.getElementById('payment-bank-paid').value = '0';
        document.getElementById('payment-notes').value = '';

        // Disable save button and gray calculations
        document.getElementById('payment-calculation-area').style.opacity = '0.5';
        document.getElementById('payment-calculation-area').style.pointerEvents = 'none';
        document.getElementById('btn-save-payment').disabled = true;
    }

    function calculateLivePayment() {
        const empId = document.getElementById('payment-emp-select').value;
        const month = document.getElementById('payment-month').value; // YYYY-MM
        const emp = salaryState.employees.find(e => e.id === empId);

        if (!emp || !month) {
            resetPaymentFormValues();
            return;
        }

        // 1. Get Monthly Salary
        const monthlySalary = Number(emp.monthlySalary) || 0;

        // 2. Sum Advances for selected month
        const totalAdvances = salaryState.advances
            .filter(a => a.employeeDbId === empId && a.salaryMonth === month && a.branch === currentBranch)
            .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

        // 3. Calc Net Salary
        const netSalary = monthlySalary - totalAdvances;

        // Fill calculation cards
        document.getElementById('calc-monthly-salary').textContent = '₹' + monthlySalary.toLocaleString('en-IN', {minimumFractionDigits:2});
        document.getElementById('calc-salary-advance').textContent = '₹' + totalAdvances.toLocaleString('en-IN', {minimumFractionDigits:2});
        document.getElementById('calc-net-salary').textContent = '₹' + netSalary.toLocaleString('en-IN', {minimumFractionDigits:2});
        
        // 4. Look if payment record already exists
        const existingPayment = salaryState.payments.find(p => p.employeeDbId === empId && p.salaryMonth === month && p.branch === currentBranch);
        
        // Setup values
        let cashPaid = Number(document.getElementById('payment-cash-paid').value) || 0;
        let bankPaid = Number(document.getElementById('payment-bank-paid').value) || 0;

        // Enable area
        document.getElementById('payment-calculation-area').style.opacity = '1';
        document.getElementById('payment-calculation-area').style.pointerEvents = 'auto';
        document.getElementById('btn-save-payment').disabled = false;

        // Calc Live Totals
        const totalPaid = cashPaid + bankPaid;
        const balance = netSalary - totalPaid;

        // Status calculation
        let status = 'Pending';
        let badgeClass = 'badge-pending';
        if (totalPaid > 0) {
            if (totalPaid >= netSalary) {
                status = 'Paid';
                badgeClass = 'badge-paid';
            } else {
                status = 'Partial';
                badgeClass = 'badge-partial';
            }
        }

        // Fill live previews
        document.getElementById('preview-payment-paid').textContent = '₹' + totalPaid.toLocaleString('en-IN', {minimumFractionDigits:2});
        document.getElementById('preview-payment-balance').textContent = '₹' + balance.toLocaleString('en-IN', {minimumFractionDigits:2});
        
        const statusBadge = document.getElementById('preview-payment-status');
        statusBadge.textContent = status;
        statusBadge.className = `badge ${badgeClass} px-3 py-2 fs-6 rounded-pill`;
    }

    async function handleEmployeeMonthChange() {
        const empId = document.getElementById('payment-emp-select').value;
        const month = document.getElementById('payment-month').value;
        const emp = salaryState.employees.find(e => e.id === empId);

        if (emp && month) {
            // Check if there is an existing payment record
            const existing = salaryState.payments.find(p => p.employeeDbId === empId && p.salaryMonth === month && p.branch === currentBranch);
            if (existing) {
                // Pre-fill fields to edit
                document.getElementById('payment-cash-paid').value = existing.cashPaid;
                document.getElementById('payment-bank-paid').value = existing.bankPaid;
                document.getElementById('payment-date').value = existing.paymentDate;
                document.getElementById('payment-notes').value = existing.notes || '';
                
                // Highlight text to let manager know
                console.log("Existing payment record loaded for edit.");
            } else {
                document.getElementById('payment-cash-paid').value = '0';
                document.getElementById('payment-bank-paid').value = '0';
                document.getElementById('payment-date').value = new Date().toISOString().substring(0, 10);
                document.getElementById('payment-notes').value = '';
            }
            calculateLivePayment();
        } else {
            resetPaymentFormValues();
        }
    }

    async function saveSalaryPayment(e) {
        e.preventDefault();
        const uid = window.fb.auth.currentUser.uid;
        const empId = document.getElementById('payment-emp-select').value;
        const month = document.getElementById('payment-month').value;
        const emp = salaryState.employees.find(x => x.id === empId);

        if (!emp || !month) return;

        // Calculate values
        const monthlySalary = Number(emp.monthlySalary) || 0;
        const totalAdvances = salaryState.advances
            .filter(a => a.employeeDbId === empId && a.salaryMonth === month && a.branch === currentBranch)
            .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
        const netSalary = monthlySalary - totalAdvances;

        const cashPaid = Number(document.getElementById('payment-cash-paid').value) || 0;
        const bankPaid = Number(document.getElementById('payment-bank-paid').value) || 0;
        const totalPaid = cashPaid + bankPaid;
        const balance = netSalary - totalPaid;

        let status = 'Pending';
        if (totalPaid > 0) {
            status = totalPaid >= netSalary ? 'Paid' : 'Partial';
        }

        const paymentDate = document.getElementById('payment-date').value;
        const notes = document.getElementById('payment-notes').value.trim();

        // 1. Save main payment record (one per employee/month combo)
        // Doc ID format: PAY-{EmployeeDbId}-{Month}
        const payDocId = `PAY-${empId}-${month}`;
        const paymentData = {
            id: payDocId,
            employeeDbId: empId,
            employeeId: emp.empId,
            employeeName: emp.name,
            salaryMonth: month,
            monthlySalary: monthlySalary,
            salaryAdvanceDeducted: totalAdvances,
            netSalary: netSalary,
            cashPaid: cashPaid,
            bankPaid: bankPaid,
            totalPaid: totalPaid,
            balance: balance,
            paymentStatus: status,
            paymentDate: paymentDate,
            notes: notes,
            branch: currentBranch,
            updatedAt: Date.now()
        };

        // 2. Save history record (creates a historical audit trail)
        const histDocId = `HIST-${Date.now()}`;
        const historyData = {
            id: histDocId,
            employeeDbId: empId,
            employeeId: emp.empId,
            employeeName: emp.name,
            salaryMonth: month,
            monthlySalary: monthlySalary,
            salaryAdvanceDeducted: totalAdvances,
            netSalary: netSalary,
            cashPaid: cashPaid,
            bankPaid: bankPaid,
            totalPaid: totalPaid,
            balance: balance,
            paymentStatus: status,
            paymentDate: paymentDate,
            notes: notes,
            branch: currentBranch,
            whatsappSentStatus: 'Pending',
            createdAt: Date.now()
        };

        try {
            // Write both records
            await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/salary_payments`, payDocId), paymentData);
            await window.fb.setDoc(window.fb.doc(window.fb.db, `users/${uid}/salary_history`, histDocId), historyData);

            // Set current slip data for print/WhatsApp preview
            // Add employee mobile, role, and joining date to this payload for PDF building
            currentSlipData = {
                ...paymentData,
                phone: emp.phone,
                role: emp.role,
                joiningDate: emp.joiningDate
            };

            // Update slip modal texts
            document.getElementById('slip-preview-emp-name').textContent = currentSlipData.employeeName;
            document.getElementById('slip-preview-month').textContent = formatMonthDisplay(currentSlipData.salaryMonth);
            document.getElementById('slip-preview-net').textContent = '₹' + currentSlipData.netSalary.toLocaleString('en-IN', {minimumFractionDigits:2});

            // Show slip modal
            if (slipModal) slipModal.show();

            // Refresh state & fields
            await loadAllPayrollData();
            document.getElementById('salary-payment-form').reset();
            resetPaymentFormValues();
        } catch (err) {
            alert("Error saving salary payment: " + err.message);
        }
    }


    // --- Sub-view: Salary History ---
    function renderHistorySubview() {
        const branchEmps = salaryState.employees.filter(e => e.branch === currentBranch);
        
        // Fill employee filter
        const select = document.getElementById('history-filter-emp');
        select.innerHTML = '<option value="all">All Employees</option>';
        branchEmps.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.name;
            select.appendChild(opt);
        });

        renderHistoryTable();
    }

    function renderHistoryTable() {
        const branchHistory = salaryState.history.filter(h => h.branch === currentBranch);
        const empFilter = document.getElementById('history-filter-emp').value;
        const monthFilter = document.getElementById('history-filter-month').value;
        const statusFilter = document.getElementById('history-filter-status').value;

        // Apply filters
        let filtered = branchHistory;
        if (empFilter !== 'all') {
            filtered = filtered.filter(h => h.employeeDbId === empFilter);
        }
        if (monthFilter) {
            filtered = filtered.filter(h => h.salaryMonth === monthFilter);
        }
        if (statusFilter !== 'all') {
            filtered = filtered.filter(h => h.paymentStatus === statusFilter);
        }

        // Sort descending by created date
        filtered.sort((a,b) => b.createdAt - a.createdAt);

        // Render Table
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No salary payment logs found.</td></tr>`;
        } else {
            filtered.forEach(log => {
                const tr = document.createElement('tr');
                
                let statusBadgeClass = 'badge-pending';
                if (log.paymentStatus === 'Paid') statusBadgeClass = 'badge-paid';
                else if (log.paymentStatus === 'Partial') statusBadgeClass = 'badge-partial';

                tr.innerHTML = `
                    <td><strong>${formatMonthDisplay(log.salaryMonth)}</strong></td>
                    <td>${log.employeeName}</td>
                    <td>₹${Number(log.monthlySalary).toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td class="text-danger">-₹${Number(log.salaryAdvanceDeducted).toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td class="fw-bold text-dark">₹${Number(log.netSalary).toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td class="text-success fw-bold">₹${Number(log.totalPaid).toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td class="text-danger fw-bold">₹${Number(log.balance).toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td><span class="badge ${statusBadgeClass} px-2.5 py-1.5 rounded-pill">${log.paymentStatus}</span></td>
                    <td>${log.paymentDate}</td>
                    <td class="pe-4 text-center">
                        <button class="btn btn-sm btn-light border download-slip-btn" title="Download PDF Slip">📄</button>
                        <button class="btn btn-sm btn-light border whatsapp-slip-btn" title="Send WhatsApp">💬</button>
                    </td>
                `;

                tr.querySelector('.download-slip-btn').onclick = () => downloadHistoricalSlipPDF(log);
                tr.querySelector('.whatsapp-slip-btn').onclick = () => sendHistoricalSlipWhatsApp(log);

                tbody.appendChild(tr);
            });
        }

        // Render Summary Metrics
        const totalExpense = filtered.reduce((sum, h) => sum + (Number(h.netSalary) || 0), 0);
        const totalCash = filtered.reduce((sum, h) => sum + (Number(h.cashPaid) || 0), 0);
        const totalBank = filtered.reduce((sum, h) => sum + (Number(h.bankPaid) || 0), 0);
        const totalBalance = filtered.reduce((sum, h) => sum + (Number(h.balance) || 0), 0);

        document.getElementById('history-stat-expense').textContent = '₹' + totalExpense.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('history-stat-cash').textContent = '₹' + totalCash.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('history-stat-bank').textContent = '₹' + totalBank.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('history-stat-balance').textContent = '₹' + totalBalance.toLocaleString('en-IN', {maximumFractionDigits:0});
    }

    function downloadHistoricalSlipPDF(log) {
        // Find full employee details for the PDF slip
        const emp = salaryState.employees.find(e => e.id === log.employeeDbId);
        const pdfPayload = {
            ...log,
            phone: emp ? emp.phone : '-',
            role: emp ? emp.role : '-',
            joiningDate: emp ? emp.joiningDate : '-'
        };
        generateSalarySlipPDF(pdfPayload);
    }

    function sendHistoricalSlipWhatsApp(log) {
        const emp = salaryState.employees.find(e => e.id === log.employeeDbId);
        if (emp && emp.phone) {
            const pdfPayload = {
                ...log,
                phone: emp.phone,
                role: emp.role,
                joiningDate: emp.joiningDate
            };
            generateSalarySlipPDF(pdfPayload);
            shareOnWhatsApp(emp.name, emp.phone, log.salaryMonth, log.netSalary, log.paymentStatus);
        } else {
            alert("No WhatsApp phone number found for this employee.");
        }
    }


    // --- Sub-view: Reports ---
    function renderReportsSubview() {
        // Set default month to current
        const now = new Date();
        const currentMonthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const reportMonthInput = document.getElementById('report-selected-month');
        if (reportMonthInput && !reportMonthInput.value) {
            reportMonthInput.value = currentMonthVal;
        }

        document.getElementById('salary-report-preview-container').style.display = 'none';
        document.getElementById('report-download-btn-area').style.display = 'none';
    }

    function generateMonthlySalaryReport() {
        const month = document.getElementById('report-selected-month').value;
        if (!month) {
            alert("Please select a month first.");
            return;
        }

        const activeBranchEmps = salaryState.employees.filter(e => e.branch === currentBranch && e.status === 'Active');
        
        let repRows = [];
        let totals = {
            base: 0,
            advances: 0,
            net: 0,
            cash: 0,
            bank: 0,
            paid: 0,
            balance: 0,
            paidCount: 0,
            partialCount: 0,
            pendingCount: 0
        };

        activeBranchEmps.forEach(emp => {
            const baseSalary = Number(emp.monthlySalary) || 0;
            const advances = salaryState.advances
                .filter(a => a.employeeDbId === emp.id && a.salaryMonth === month && a.branch === currentBranch)
                .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
            const netSalary = baseSalary - advances;

            // Find payment record
            const pay = salaryState.payments.find(p => p.employeeDbId === emp.id && p.salaryMonth === month && p.branch === currentBranch);
            
            const cash = pay ? Number(pay.cashPaid) : 0;
            const bank = pay ? Number(pay.bankPaid) : 0;
            const paid = cash + bank;
            const balance = netSalary - paid;
            
            let status = 'Pending';
            if (paid > 0) {
                status = paid >= netSalary ? 'Paid' : 'Partial';
            }

            if (status === 'Paid') totals.paidCount++;
            else if (status === 'Partial') totals.partialCount++;
            else totals.pendingCount++;

            totals.base += baseSalary;
            totals.advances += advances;
            totals.net += netSalary;
            totals.cash += cash;
            totals.bank += bank;
            totals.paid += paid;
            totals.balance += balance;

            repRows.push({
                employeeId: emp.empId || '-',
                employeeName: emp.name,
                role: emp.role,
                monthlySalary: baseSalary,
                salaryAdvanceDeducted: advances,
                netSalary: netSalary,
                cashPaid: cash,
                bankPaid: bank,
                totalPaid: paid,
                balance: balance,
                paymentStatus: status
            });
        });

        // Show UI container
        document.getElementById('salary-report-preview-container').style.display = 'block';
        document.getElementById('report-download-btn-area').style.display = 'block';
        document.getElementById('report-month-title').textContent = formatMonthDisplay(month);

        // Fill Stats
        document.getElementById('rep-stat-employees').textContent = activeBranchEmps.length;
        document.getElementById('rep-stat-base-salary').textContent = '₹' + totals.base.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('rep-stat-advances').textContent = '₹' + totals.advances.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('rep-stat-net-salary').textContent = '₹' + totals.net.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('rep-stat-cash-paid').textContent = '₹' + totals.cash.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('rep-stat-bank-paid').textContent = '₹' + totals.bank.toLocaleString('en-IN', {maximumFractionDigits:0});
        document.getElementById('rep-stat-balance-pending').textContent = '₹' + totals.balance.toLocaleString('en-IN', {maximumFractionDigits:0});
        
        document.getElementById('rep-stat-paid-count').textContent = totals.paidCount;
        document.getElementById('rep-stat-partial-count').textContent = totals.partialCount;
        document.getElementById('rep-stat-pending-count').textContent = totals.pendingCount;

        // Render Table
        const tbody = document.getElementById('report-table-body');
        tbody.innerHTML = '';

        if (repRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No active employees to report in this branch.</td></tr>`;
        } else {
            repRows.forEach(row => {
                const tr = document.createElement('tr');
                
                let badgeClass = 'badge-pending';
                if (row.paymentStatus === 'Paid') badgeClass = 'badge-paid';
                else if (row.paymentStatus === 'Partial') badgeClass = 'badge-partial';

                tr.innerHTML = `
                    <td><strong>${row.employeeId}</strong></td>
                    <td class="text-start">${row.employeeName}</td>
                    <td>₹${row.monthlySalary.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td class="text-danger">-₹${row.salaryAdvanceDeducted.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td class="fw-bold text-dark">₹${row.netSalary.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td>₹${row.cashPaid.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td>₹${row.bankPaid.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td class="text-success fw-bold">₹${row.totalPaid.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td class="text-danger fw-bold">₹${row.balance.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                    <td><span class="badge ${badgeClass} px-2.5 py-1">${row.paymentStatus}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Store generated report details on download button click
        document.getElementById('btn-download-monthly-report-pdf').onclick = () => {
            downloadMonthlyReportPDF(month, currentBranch, repRows, totals);
        };
    }


    // --- Core PDF Slip Generation ---
    function generateSalarySlipPDF(data) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            
            // Core Page specs: Width 210, Height 297
            // Primary Color: Customs Green (1, 62, 55), Creamy Lemon (255, 238, 178), Soft Gold (212, 178, 106)
            // Soft Light Cream for card backgrounds: (252, 249, 236)
            // Headings: times (resembles Playfair Display)
            // Body: helvetica (resembles Poppins)

            // 1. Sleek Outer Borders (Double border layout for luxury feel)
            // Outermost Gold line
            doc.setDrawColor(212, 178, 106);
            doc.setLineWidth(0.45);
            doc.rect(10, 10, 190, 277);
            
            // Innermost Customs Green line
            doc.setDrawColor(1, 62, 55);
            doc.setLineWidth(0.2);
            doc.rect(11, 11, 188, 275);

            // 2. Solid Customs Green Header Banner
            doc.setFillColor(1, 62, 55);
            doc.rect(11, 11, 188, 38, 'F');

            // Soft Gold line accent below header
            doc.setFillColor(212, 178, 106);
            doc.rect(11, 49, 188, 1.2, 'F');

            // 3. Soft Gold Watermark "NUJOOM" (Background watermark)
            doc.setTextColor(249, 246, 233); // Very faint cream/gold
            doc.setFont("times", "bold");
            doc.setFontSize(85);
            // Rotated at 35 degrees centered in page
            doc.text("NUJOOM", 35, 180, { angle: 35 });

            // 4. Header Branding Texts (Inside Header Banner)
            doc.setTextColor(255, 238, 178); // Creamy Lemon
            doc.setFont("times", "bold");
            doc.setFontSize(24);
            doc.text("N U J O O M", 18, 27);
            
            doc.setTextColor(212, 178, 106); // Soft Gold
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.text("PAYROLL & SALARY STATEMENT", 18, 33);

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.text(`Branch: ${data.branch || currentBranch || '-'}  |  Period: ${formatMonthDisplay(data.salaryMonth)}`, 18, 41);

            // Private & Confidential Gold Badge (Top-Right)
            doc.setFillColor(212, 178, 106);
            doc.roundedRect(144, 20, 48, 7, 1.5, 1.5, 'F');
            
            doc.setTextColor(1, 62, 55); // Customs Green
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.text("PRIVATE & CONFIDENTIAL", 168, 25, { align: "center" });

            // Statement Metadata (Right-Aligned in Header)
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.text("Date: " + (data.paymentDate || new Date().toLocaleDateString()), 192, 35, { align: "right" });
            doc.text("Ref: PAY-" + data.salaryMonth.replace('-', '') + "-" + (data.employeeId || 'EMP'), 192, 41, { align: "right" });

            // 5. Employee Details Card (Cream background with Gold borders)
            doc.setFillColor(252, 249, 236);
            doc.roundedRect(15, 57, 180, 36, 2, 2, 'F');
            doc.setDrawColor(212, 178, 106);
            doc.setLineWidth(0.35);
            doc.roundedRect(15, 57, 180, 36, 2, 2, 'D');

            // Left Column
            doc.setTextColor(212, 178, 106); // Gold label
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text("Name:", 22, 64);
            doc.text("Staff Code:", 22, 72);
            doc.text("Role:", 22, 80);
            doc.text("Branch:", 22, 88);

            doc.setTextColor(1, 62, 55); // Dark Green values
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.text(data.employeeName || '-', 44, 64);
            doc.text(data.employeeId || '-', 44, 72);
            doc.text(data.role || '-', 44, 80);
            doc.text(data.branch || currentBranch || '-', 44, 88);

            // Right Column
            doc.setTextColor(212, 178, 106);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text("Statement Date:", 115, 64);
            doc.text("Joining Date:", 115, 72);
            doc.text("Contact Number:", 115, 80);

            doc.setTextColor(1, 62, 55);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.text(data.paymentDate || new Date().toLocaleDateString(), 145, 64);
            doc.text(data.joiningDate || '-', 145, 72);
            doc.text(data.phone || '-', 145, 80);

            // 6. Section: Salary Breakdown Table
            doc.setTextColor(1, 62, 55);
            doc.setFont("times", "bold");
            doc.setFontSize(10.5);
            doc.text("PAYROLL COMPUTATION", 15, 96);

            // Table Header Bar (Customs Green with Gold line bottom)
            doc.setFillColor(1, 62, 55);
            doc.rect(15, 100, 180, 8, 'F');
            doc.setFillColor(212, 178, 106);
            doc.rect(15, 108, 180, 0.6, 'F');
            
            doc.setTextColor(255, 238, 178); // Creamy text
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.text("DESCRIPTION", 20, 105.5);
            doc.text("EARNINGS", 105, 105.5, { align: "right" });
            doc.text("DEDUCTIONS", 145, 105.5, { align: "right" });
            doc.text("NET AMOUNT", 190, 105.5, { align: "right" });

            // Table row borders (Soft light cream)
            doc.setDrawColor(241, 238, 220);
            doc.setLineWidth(0.4);

            // Row 1: Base Salary
            doc.setTextColor(1, 62, 55);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.text("Monthly Base Salary", 20, 115);
            doc.text("INR " + Number(data.monthlySalary).toLocaleString('en-IN', {minimumFractionDigits:2}), 105, 115, { align: "right" });
            doc.text("-", 145, 115, { align: "right" });
            doc.text("INR " + Number(data.monthlySalary).toLocaleString('en-IN', {minimumFractionDigits:2}), 190, 115, { align: "right" });
            doc.line(15, 118, 195, 118);

            // Row 2: Advances
            doc.text("Salary Advances Deducted", 20, 124);
            doc.text("-", 105, 124, { align: "right" });
            doc.setTextColor(185, 28, 28);
            doc.text("INR " + Number(data.salaryAdvanceDeducted).toLocaleString('en-IN', {minimumFractionDigits:2}), 145, 124, { align: "right" });
            doc.setTextColor(1, 62, 55);
            doc.text("-INR " + Number(data.salaryAdvanceDeducted).toLocaleString('en-IN', {minimumFractionDigits:2}), 190, 124, { align: "right" });
            doc.line(15, 127, 195, 127);

            // 7. Highlight Net Salary (Creamy Lemon Banner with Customs Green Border)
            doc.setFillColor(255, 238, 178); // Creamy Lemon
            doc.roundedRect(15, 131, 180, 14, 1.5, 1.5, 'F');
            doc.setDrawColor(1, 62, 55); // Customs Green
            doc.setLineWidth(0.45);
            doc.roundedRect(15, 131, 180, 14, 1.5, 1.5, 'D');
            
            doc.setTextColor(1, 62, 55);
            doc.setFont("times", "bold");
            doc.setFontSize(10.5);
            doc.text("NET SALARY DISBURSED (INR)", 22, 140);
            
            doc.setFontSize(15.5);
            doc.text("INR " + Number(data.netSalary).toLocaleString('en-IN', {minimumFractionDigits:2}), 188, 141, { align: "right" });

            // 8. Section: Payment & Disbursal details
            doc.setTextColor(1, 62, 55);
            doc.setFont("times", "bold");
            doc.setFontSize(11);
            doc.text("SETTLEMENT LOG", 15, 156);

            // Table Header Bar (Cream Card Background with Gold line)
            doc.setFillColor(252, 249, 236);
            doc.rect(15, 160, 180, 8, 'F');
            doc.setFillColor(212, 178, 106);
            doc.rect(15, 168, 180, 0.4, 'F');
            
            doc.setTextColor(1, 62, 55);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.text("PAYMENT METHOD", 20, 165.5);
            doc.text("TRANSACTION DATE", 90, 165.5);
            doc.text("AMOUNT PAID", 190, 165.5, { align: "right" });

            // Row 1: Cash Paid
            doc.setTextColor(1, 62, 55);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.text("Cash Payment", 20, 175);
            doc.text(data.paymentDate || '-', 90, 175);
            doc.text("INR " + Number(data.cashPaid).toLocaleString('en-IN', {minimumFractionDigits:2}), 190, 175, { align: "right" });
            doc.setDrawColor(241, 238, 220);
            doc.setLineWidth(0.4);
            doc.line(15, 178, 195, 178);

            // Row 2: Bank Paid
            doc.text("Bank Transfer / Cheque", 20, 184);
            doc.text(data.paymentDate || '-', 90, 184);
            doc.text("INR " + Number(data.bankPaid).toLocaleString('en-IN', {minimumFractionDigits:2}), 190, 184, { align: "right" });
            doc.line(15, 187, 196, 187);

            // 9. Payment Summary Card (Light Cream background and Gold Border)
            doc.setFillColor(252, 249, 236);
            doc.roundedRect(15, 191, 180, 17, 1.5, 1.5, 'F');
            doc.setDrawColor(212, 178, 106);
            doc.roundedRect(15, 191, 180, 17, 1.5, 1.5, 'D');

            doc.setTextColor(212, 178, 106); // Gold Labels
            doc.setFontSize(9);
            doc.text("Total Amount Settled:", 22, 197);
            doc.text("Disbursement Status:", 22, 204);

            doc.setTextColor(1, 62, 55); // Dark Green Values
            doc.setFont("helvetica", "bold");
            doc.text("INR " + Number(data.totalPaid).toLocaleString('en-IN', {minimumFractionDigits:2}), 60, 197);
            
            // Color status (Paid: Green, Partial: Gold, Pending: Red)
            if (data.paymentStatus === 'Paid') doc.setTextColor(22, 101, 52);
            else if (data.paymentStatus === 'Partial') doc.setTextColor(212, 178, 106);
            else doc.setTextColor(153, 27, 27);
            doc.text(data.paymentStatus, 60, 204);

            // Right side: Balance outstanding
            doc.setTextColor(212, 178, 106);
            doc.setFont("helvetica", "normal");
            doc.text("Balance Outstanding:", 112, 197);
            
            if (data.balance > 0) {
                doc.setTextColor(185, 28, 28);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text("INR " + Number(data.balance).toLocaleString('en-IN', {minimumFractionDigits:2}), 148, 197);
            } else {
                doc.setTextColor(22, 101, 52);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10.5);
                doc.text("INR 0.00 (Fully Disbursed)", 148, 197);
            }

            // 10. Section: Remarks
            let remarksOffset = 0;
            if (data.notes) {
                doc.setTextColor(1, 62, 55);
                doc.setFont("times", "bold");
                doc.setFontSize(9.5);
                doc.text("REMARKS / NOTES", 15, 215);

                doc.setFillColor(255, 238, 178); // Creamy Lemon Remarks card
                doc.roundedRect(15, 218, 180, 11, 1, 1, 'F');
                doc.setDrawColor(212, 178, 106);
                doc.roundedRect(15, 218, 180, 11, 1, 1, 'D');

                doc.setTextColor(1, 62, 55);
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8);
                doc.text(data.notes, 19, 225, { maxWidth: 172 });
                remarksOffset = 18;
            }

            // 11. Section: Appreciation Message (Center aligned luxury block)
            const appreciationY = 214 + remarksOffset;
            
            // Gold horizontal divider line above appreciation block
            doc.setDrawColor(212, 178, 106);
            doc.setLineWidth(0.3);
            doc.line(75, appreciationY, 135, appreciationY);

            // Lines of text
            doc.setTextColor(212, 178, 106); // Soft Gold
            doc.setFont("times", "bolditalic");
            doc.setFontSize(9.5);
            doc.text("Thank you for being an important part of NUJOOM.", 105, appreciationY + 5.5, { align: "center" });

            doc.setTextColor(1, 62, 55); // Dark Green
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7.5);
            doc.text("Your dedication, hard work, and commitment continue to add value to our journey and growth.", 105, appreciationY + 10.5, { align: "center" });
            doc.text("We truly appreciate your contribution and the trust you bring to our team every day.", 105, appreciationY + 14, { align: "center" });

            doc.setTextColor(212, 178, 106); // Soft Gold
            doc.setFont("times", "bolditalic");
            doc.setFontSize(9);
            doc.text("Wishing you continued success and prosperity with NUJOOM.", 105, appreciationY + 19.5, { align: "center" });

            // Gold horizontal divider line below appreciation block
            doc.line(75, appreciationY + 22.5, 135, appreciationY + 22.5);

            // 12. Luxury Signatures Block
            const signaturesY = 247 + (remarksOffset ? 6 : 0);
            doc.setDrawColor(212, 178, 106); // Gold lines
            doc.setLineWidth(0.35);

            doc.line(20, signaturesY, 75, signaturesY);
            doc.setTextColor(1, 62, 55);
            doc.setFont("times", "bold");
            doc.setFontSize(8.5);
            doc.text("EMPLOYEE SIGNATURE", 47.5, signaturesY + 5, { align: "center" });

            doc.line(135, signaturesY, 190, signaturesY);
            doc.text("AUTHORIZED SIGNATURE", 162.5, signaturesY + 5, { align: "center" });

            // 13. Elegant Footer Brand
            doc.setFont("times", "italic");
            doc.setFontSize(8);
            doc.setTextColor(212, 178, 106); // Gold footer text
            doc.text("NUJOOM LEDGER - ABU DHABI, UAE. PRIVATE & CONFIDENTIAL PAYROLL DOCUMENT.", 105, 282, { align: "center" });

            // Save PDF slip
            doc.save(`SalarySlip_${data.employeeName.replace(/\s+/g, '_')}_${data.salaryMonth}.pdf`);
        } catch (err) {
            console.error("PDF generation failed:", err);
            alert("Failed to generate PDF. Make sure jsPDF is loaded correctly.");
        }
    }

    // --- Core Monthly Report PDF (Landscape) ---
    function downloadMonthlyReportPDF(month, branch, rows, totals) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
            // A4 Landscape: Width 297, Height 210

            // 1. Red Header
            doc.setFillColor(184, 32, 32);
            doc.rect(0, 0, 297, 32, 'F');

            // Text Header
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("NUJOOM LEDGER", 15, 13);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.5);
            doc.text(`Monthly Payroll Report | Month: ${formatMonthDisplay(month)}`, 15, 20);
            doc.text(`Branch: ${branch}`, 15, 26);
            
            doc.setFontSize(9.5);
            doc.text("Generated: " + new Date().toLocaleDateString(), 282, 13, { align: "right" });

            // 2. Table Headers
            doc.setFillColor(240, 240, 240);
            doc.rect(10, 42, 277, 9, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(40, 40, 40);
            
            doc.text("Emp ID", 13, 48);
            doc.text("Employee Name", 35, 48);
            doc.text("Role", 82, 48);
            doc.text("Base Salary", 125, 48, { align: "right" });
            doc.text("Advances", 155, 48, { align: "right" });
            doc.text("Net Payable", 185, 48, { align: "right" });
            doc.text("Cash Paid", 215, 48, { align: "right" });
            doc.text("Bank Paid", 242, 48, { align: "right" });
            doc.text("Pending Balance", 270, 48, { align: "right" });
            doc.text("Status", 285, 48, { align: "right" });

            // 3. Rows
            let y = 46;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.2);

            rows.forEach((r, index) => {
                y += 8;

                // Draw bottom border
                doc.line(10, y + 2.5, 287, y + 2.5);

                doc.text(r.employeeId, 13, y);
                doc.text(r.employeeName, 35, y);
                doc.text(r.role || "-", 82, y);
                
                doc.text("INR " + Number(r.monthlySalary).toFixed(2), 125, y, { align: "right" });
                doc.text("INR " + Number(r.salaryAdvanceDeducted).toFixed(2), 155, y, { align: "right" });
                doc.text("INR " + Number(r.netSalary).toFixed(2), 185, y, { align: "right" });
                doc.text("INR " + Number(r.cashPaid).toFixed(2), 215, y, { align: "right" });
                doc.text("INR " + Number(r.bankPaid).toFixed(2), 242, y, { align: "right" });
                
                // Color pending balance
                if (r.balance > 0) {
                    doc.setTextColor(184, 32, 32);
                } else {
                    doc.setTextColor(16, 124, 65);
                }
                doc.text("INR " + Number(r.balance).toFixed(2), 270, y, { align: "right" });
                
                // Color status text
                doc.setTextColor(40, 40, 40);
                doc.text(r.paymentStatus, 285, y, { align: "right" });

                // Check for Page Overflow
                if (y > 185 && index < rows.length - 1) {
                    doc.addPage();
                    // Redraw Table Headers on next page
                    doc.setFillColor(240, 240, 240);
                    doc.rect(10, 15, 277, 9, 'F');
                    doc.setFont("helvetica", "bold");
                    doc.text("Emp ID", 13, 21);
                    doc.text("Employee Name", 35, 21);
                    doc.text("Role", 82, 21);
                    doc.text("Base Salary", 125, 21, { align: "right" });
                    doc.text("Advances", 155, 21, { align: "right" });
                    doc.text("Net Payable", 185, 21, { align: "right" });
                    doc.text("Cash Paid", 215, 21, { align: "right" });
                    doc.text("Bank Paid", 242, 21, { align: "right" });
                    doc.text("Pending Balance", 270, 21, { align: "right" });
                    doc.text("Status", 285, 21, { align: "right" });
                    
                    y = 19;
                    doc.setFont("helvetica", "normal");
                }
            });

            // 4. Totals Row
            y += 11;
            doc.setFillColor(245, 245, 245);
            doc.rect(10, y - 5, 277, 9, 'F');
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            
            doc.text("GRAND TOTALS", 13, y);
            doc.text("INR " + totals.base.toFixed(2), 125, y, { align: "right" });
            doc.text("INR " + totals.advances.toFixed(2), 155, y, { align: "right" });
            doc.text("INR " + totals.net.toFixed(2), 185, y, { align: "right" });
            doc.text("INR " + totals.cash.toFixed(2), 215, y, { align: "right" });
            doc.text("INR " + totals.bank.toFixed(2), 242, y, { align: "right" });
            doc.text("INR " + totals.balance.toFixed(2), 270, y, { align: "right" });

            doc.save(`PayrollReport_${branch.replace(/\s+/g, '_')}_${month}.pdf`);
        } catch (err) {
            console.error("PDF generation failed:", err);
            alert("Failed to download PDF report.");
        }
    }


    // --- WhatsApp Sharing Helper ---
    function shareOnWhatsApp(name, phone, month, netSalary, status) {
        // Clear phone number characters (leave only digits for protocol URI format)
        const cleanedPhone = phone.replace(/[^0-9]/g, '');
        
        const message = `Hello ${name},
Your salary statement for ${formatMonthDisplay(month)} has been generated.

Net Salary: ₹${Number(netSalary).toLocaleString('en-IN', {minimumFractionDigits:2})}
Payment Status: ${status}

Please find the salary PDF shared by NUJOOM Management.`;

        const encodedMessage = encodeURIComponent(message);
        const url = `whatsapp://send?phone=${cleanedPhone}&text=${encodedMessage}`;
        window.open(url, '_blank');
    }

    function handleSlipDownloadBtn() {
        if (currentSlipData) {
            generateSalarySlipPDF(currentSlipData);
        }
    }

    function handleSlipWhatsAppBtn() {
        if (currentSlipData && currentSlipData.phone) {
            generateSalarySlipPDF(currentSlipData);
            shareOnWhatsApp(
                currentSlipData.employeeName,
                currentSlipData.phone,
                currentSlipData.salaryMonth,
                currentSlipData.netSalary,
                currentSlipData.paymentStatus
            );
        } else {
            alert("Employee WhatsApp phone number missing.");
        }
    }


    // --- General Event Listeners Setup ---
    let listenersHooked = false;
    function setupPayrollListeners() {
        if (listenersHooked) return;
        
        console.log("Hooking Payroll DOM Events...");

        // Tab selection pills clicks
        const subviews = ['employees', 'advance', 'debt', 'payment', 'history', 'reports'];
        subviews.forEach(s => {
            const pill = document.getElementById(`salary-pill-${s}`);
            if (pill) {
                pill.onclick = () => renderSubView(s);
            }
        });

        // Employees page search & filter input events
        const empSearch = document.getElementById('emp-search-input');
        if (empSearch) empSearch.oninput = renderEmployeesSubview;
        
        const empFilter = document.getElementById('emp-status-filter');
        if (empFilter) empFilter.onchange = renderEmployeesSubview;

        // Save Employee Modal triggers
        const btnAddEmp = document.getElementById('btn-add-employee-modal');
        if (btnAddEmp) btnAddEmp.onclick = openAddEmployeeModal;

        const formEmployee = document.getElementById('salary-employee-form');
        if (formEmployee) formEmployee.onsubmit = saveEmployeeProfile;

        // Advances Form triggers
        const formAdvance = document.getElementById('salary-advance-form');
        if (formAdvance) formAdvance.onsubmit = saveSalaryAdvance;

        const advMonthFilter = document.getElementById('advance-filter-month');
        if (advMonthFilter) advMonthFilter.onchange = renderAdvancesTable;

        // Debt Form triggers
        const formDebt = document.getElementById('personal-debt-form');
        if (formDebt) formDebt.onsubmit = savePersonalDebt;

        // Payment Form Live triggers
        const payEmpSelect = document.getElementById('payment-emp-select');
        const payMonthSelect = document.getElementById('payment-month');
        if (payEmpSelect) payEmpSelect.onchange = handleEmployeeMonthChange;
        if (payMonthSelect) payMonthSelect.onchange = handleEmployeeMonthChange;

        const payCashInput = document.getElementById('payment-cash-paid');
        const payBankInput = document.getElementById('payment-bank-paid');
        if (payCashInput) payCashInput.oninput = calculateLivePayment;
        if (payBankInput) payBankInput.oninput = calculateLivePayment;

        const formPayment = document.getElementById('salary-payment-form');
        if (formPayment) formPayment.onsubmit = saveSalaryPayment;

        // History Filters triggers
        const histEmpFilter = document.getElementById('history-filter-emp');
        const histMonthFilter = document.getElementById('history-filter-month');
        const histStatusFilter = document.getElementById('history-filter-status');
        
        if (histEmpFilter) histEmpFilter.onchange = renderHistoryTable;
        if (histMonthFilter) histMonthFilter.onchange = renderHistoryTable;
        if (histStatusFilter) histStatusFilter.onchange = renderHistoryTable;

        const btnClearHist = document.getElementById('btn-clear-history-filters');
        if (btnClearHist) {
            btnClearHist.onclick = () => {
                document.getElementById('history-filter-emp').value = 'all';
                document.getElementById('history-filter-month').value = '';
                document.getElementById('history-filter-status').value = 'all';
                renderHistoryTable();
            };
        }

        // Slip Saved Dialog Actions triggers
        const btnSlipPdf = document.getElementById('btn-slip-download-pdf');
        const btnSlipWa = document.getElementById('btn-slip-send-whatsapp');
        if (btnSlipPdf) btnSlipPdf.onclick = handleSlipDownloadBtn;
        if (btnSlipWa) btnSlipWa.onclick = handleSlipWhatsAppBtn;

        // Reports generation triggers
        const btnGenReport = document.getElementById('btn-generate-salary-report');
        if (btnGenReport) btnGenReport.onclick = generateMonthlySalaryReport;

        listenersHooked = true;
    }

    // Helper: format YYYY-MM to MonthName YYYY
    function formatMonthDisplay(monthStr) {
        if (!monthStr) return '';
        const parts = monthStr.split('-');
        if (parts.length < 2) return monthStr;
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthIdx = parseInt(parts[1], 10) - 1;
        return `${monthNames[monthIdx]} ${parts[0]}`;
    }

})();
