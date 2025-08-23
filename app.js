// CashBook Pro - Money Exchanger System Integration
class CashBookApp {
    constructor() {
        this.currentUser = null;
        this.API_BASE = 'http://localhost:5000';
        this.moneyExchangerData = {
            owners: [],
            customers: {},
            transactions: [],
            ownerBalance: 0
        };
        this.editingTransactionId = null;
        this.debugMode = false;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkAuthentication();
    }
    
    // Safe event listener helper method
    safeAddEventListener(selector, eventType, handler, options = {}) {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener(eventType, handler, options);
            return true;
        }
        
        if (this.debugMode) {
            const criticalElements = [
                '#login-form',
                '#register-form',
                '#logout-btn',
                '#forgot-password-form',
                '#reset-password-form'
            ];
            
            if (criticalElements.includes(selector)) {
                console.warn(`Critical element not found: ${selector}`);
            }
        }
        
        return false;
    }
    
    // API Helper Methods
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        const token = localStorage.getItem('cashbook_token');
        if (token) {
            options.headers.Authorization = `Bearer ${token}`;
        }
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            this.showLoading();
            const response = await fetch(`${this.API_BASE}${endpoint}`, options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'API request failed');
            }
            
            return result;
        } catch (error) {
            this.showToast('Error', error.message, 'error');
            throw error;
        } finally {
            this.hideLoading();
        }
    }
    
    // Authentication Methods
    async checkAuthentication() {
        const token = localStorage.getItem('cashbook_token');
        const userData = localStorage.getItem('cashbook_user');
        
        if (token && userData) {
            try {
                const user = await this.apiCall('/api/auth/me');
                this.currentUser = user.user;
                this.updateUserData();
                this.showDashboard();
            } catch (error) {
                this.logout();
            }
        } else {
            this.showLogin();
        }
    }
    
    async login(username, password) {
        try {
            const result = await this.apiCall('/api/auth/login', 'POST', {
                username,
                password
            });
            
            localStorage.setItem('cashbook_token', result.token);
            localStorage.setItem('cashbook_user', JSON.stringify(result.user));
            this.currentUser = result.user;
            
            this.showToast('Success', 'Logged in successfully! In-memory MongoDB simulation active.', 'success');
            this.updateUserData();
            this.showDashboard();
        } catch (error) {
            // Error already shown by apiCall
        }
    }
    
    async register(formData) {
        try {
            const result = await this.apiCall('/api/auth/register', 'POST', formData);
            
            localStorage.setItem('cashbook_token', result.token);
            localStorage.setItem('cashbook_user', JSON.stringify(result.user));
            this.currentUser = result.user;
            
            this.showToast('Success', result.message, 'success');
            this.updateUserData();
            this.showPaymentPage();
        } catch (error) {
            // Error already shown by apiCall
        }
    }
    
    async forgotPassword(email) {
        try {
            await this.apiCall('/api/auth/forgot-password', 'POST', { email });
            this.showToast('Success', 'Reset code sent to your email!', 'success');
            document.getElementById('reset-email').value = email;
            this.showPage('reset-password-page');
        } catch (error) {
            // Error already shown by apiCall
        }
    }
    
    async resetPassword(formData) {
        try {
            await this.apiCall('/api/auth/reset-password', 'POST', formData);
            this.showToast('Success', 'Password reset successful! You can now login.', 'success');
            this.showLogin();
        } catch (error) {
            // Error already shown by apiCall
        }
    }
    
    async updateAdminSettings(formData) {
        try {
            await this.apiCall('/api/auth/admin-settings', 'PUT', formData);
            this.showToast('Success', 'Admin settings updated successfully!', 'success');
            this.hideAdminSettings();
            
            const user = await this.apiCall('/api/auth/me');
            this.currentUser = user.user;
            localStorage.setItem('cashbook_user', JSON.stringify(this.currentUser));
            this.updateUserData();
        } catch (error) {
            // Error already shown by apiCall
        }
    }
    
    logout() {
        localStorage.removeItem('cashbook_token');
        localStorage.removeItem('cashbook_user');
        this.currentUser = null;
        this.showLogin();
        this.showToast('Info', 'Logged out successfully', 'info');
    }
    
    // UI Navigation Methods
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.add('hidden');
        });
        
        document.getElementById(pageId).classList.remove('hidden');
        
        const navbar = document.getElementById('navbar');
        if (this.currentUser && pageId !== 'login-page' && pageId !== 'register-page' && 
            pageId !== 'forgot-password-page' && pageId !== 'reset-password-page') {
            navbar.classList.remove('hidden');
        } else {
            navbar.classList.add('hidden');
        }
    }
    
    showLogin() {
        this.showPage('login-page');
    }
    
    showRegister() {
        this.showPage('register-page');
    }
    
    showPaymentPage() {
        this.updatePaymentPage();
        this.showPage('payment-page');
    }
    
    showDashboard() {
        if (this.currentUser.role === 'owner') {
            this.loadOwnerDashboard();
            this.showPage('owner-dashboard');
        } else {
            if (this.currentUser.accountStatus !== 'active') {
                this.showPaymentPage();
            } else {
                // Show Money Exchanger System directly
                this.showPage('client-dashboard');
                this.loadMoneyExchangerData();
                this.updateMoneyExchangerUI();
            }
        }
    }
    
    // Dashboard Loading Methods
    async loadOwnerDashboard() {
        try {
            const stats = await this.apiCall('/api/owner/stats');
            this.updateOwnerStats(stats);
            
            const clients = await this.apiCall('/api/owner/clients');
            this.updateClientsTable(clients);
        } catch (error) {
            console.error('Failed to load owner dashboard:', error);
        }
    }
    
    // Data Update Methods
    updateUserData() {
        if (this.currentUser) {
            const userInfo = `${this.currentUser.fullName} (${this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1)})`;
            document.getElementById('user-info').textContent = userInfo;
            
            const adminBtn = document.getElementById('admin-settings-btn');
            if (adminBtn) {
                if (this.currentUser.role === 'owner') {
                    adminBtn.classList.remove('hidden');
                } else {
                    adminBtn.classList.add('hidden');
                }
            }
        }
    }
    
    updateOwnerStats(stats) {
        const totalClientsEl = document.getElementById('total-clients');
        if (totalClientsEl) totalClientsEl.textContent = stats.totalClients || 0;
        
        const activeClientsEl = document.getElementById('active-clients');
        if (activeClientsEl) activeClientsEl.textContent = stats.activeClients || 0;
        
        const pendingPaymentsEl = document.getElementById('pending-payments');
        if (pendingPaymentsEl) pendingPaymentsEl.textContent = stats.pendingPayments || 0;
        
        const monthlyRevenueEl = document.getElementById('monthly-revenue');
        if (monthlyRevenueEl) monthlyRevenueEl.textContent = `$${stats.monthlyRevenue || 0}`;
    }
    
    updatePaymentPage() {
        if (!this.currentUser) return;
        
        const statusBadge = document.getElementById('account-status-badge');
        if (statusBadge) {
            statusBadge.textContent = this.currentUser.accountStatus.charAt(0).toUpperCase() + this.currentUser.accountStatus.slice(1);
            statusBadge.className = `status-badge ${this.currentUser.accountStatus}`;
        }
    }
    
    updateClientsTable(clients) {
        const tbody = document.getElementById('clients-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">No clients found</td></tr>';
            return;
        }
        
        clients.forEach(client => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="client-info">
                        <div class="client-avatar">
                            ${client.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div class="client-details">
                            <h4>${client.businessName || client.fullName}</h4>
                            <p>${client.email}</p>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${client.accountStatus}">
                        ${client.accountStatus.charAt(0).toUpperCase() + client.accountStatus.slice(1)}
                    </span>
                </td>
                <td>
                    <div>Expires: ${client.subscriptionEnd ? new Date(client.subscriptionEnd).toLocaleDateString() : 'N/A'}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">
                        ${this.getDaysRemainingForClient(client.subscriptionEnd)} remaining
                    </div>
                </td>
                <td>
                    ${client.lastPayment ? new Date(client.lastPayment).toLocaleDateString() : 'N/A'}
                </td>
                <td>
                    <div class="action-buttons">
                        ${client.accountStatus === 'pending' ? 
                            `<button class="btn-action btn-verify" onclick="app.verifyPayment('${client.id}')">Verify</button>` : ''}
                        ${client.accountStatus === 'active' ? 
                            `<button class="btn-action btn-deactivate" onclick="app.suspendClient('${client.id}')">Suspend</button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // Client Action Methods
    async verifyPayment(clientId) {
        try {
            await this.apiCall(`/api/owner/verify-payment/${clientId}`, 'POST');
            this.showToast('Success', 'Payment verified and account activated', 'success');
            this.loadOwnerDashboard();
        } catch (error) {
            // Error already shown by apiCall
        }
    }
    
    async suspendClient(clientId) {
        if (confirm('Are you sure you want to suspend this client account?')) {
            try {
                await this.apiCall(`/api/owner/suspend/${clientId}`, 'POST');
                this.showToast('Success', 'Client account suspended', 'success');
                this.loadOwnerDashboard();
            } catch (error) {
                // Error already shown by apiCall
            }
        }
    }
    
    // Money Exchanger System Methods
    async loadMoneyExchangerData() {
        try {
            const response = await this.apiCall('/api/money-exchanger/data');
            this.moneyExchangerData = response;
        } catch (error) {
            console.error('Error loading Money Exchanger data:', error);
            this.moneyExchangerData = {
                owners: [this.currentUser.fullName],
                customers: {},
                transactions: [],
                ownerBalance: 0
            };
        }
    }
    
    updateMoneyExchangerUI() {
        const currentOwner = document.getElementById('current-owner');
        const ownerBalance = document.getElementById('owner-balance');
        const modalOwnerName = document.getElementById('modal-owner-name');
        const modalOwnerBalance = document.getElementById('modal-owner-balance');
        
        if (currentOwner) {
            currentOwner.textContent = this.currentUser.fullName;
        }
        
        if (ownerBalance) {
            ownerBalance.textContent = this.moneyExchangerData.ownerBalance.toFixed(2);
        }
        
        if (modalOwnerName) {
            modalOwnerName.textContent = this.currentUser.fullName;
        }
        
        if (modalOwnerBalance) {
            modalOwnerBalance.textContent = this.moneyExchangerData.ownerBalance.toFixed(2);
        }
        
        this.updateAccountStatusUI();
        this.updateOwnersList();
        this.updateMoneyExchangerStats();
        this.updateCustomersList();
        
        if (document.getElementById('all-transactions-tab')?.classList.contains('active')) {
            this.displayMoneyExchangerTransactions();
        }
    }
    
    updateAccountStatusUI() {
        if (!this.currentUser) return;
        
        // Dashboard elements
        const accountStatusEl = document.getElementById('account-status');
        const expiryDateEl = document.getElementById('expiry-date');
        
        // Modal elements
        const modalAccountStatusEl = document.getElementById('modal-account-status');
        const modalExpiryDateEl = document.getElementById('modal-expiry-date');
        
        if (accountStatusEl) {
            accountStatusEl.textContent = this.currentUser.accountStatus.charAt(0).toUpperCase() + 
                                       this.currentUser.accountStatus.slice(1);
            accountStatusEl.className = `status-badge ${this.currentUser.accountStatus}`;
        }
        
        if (expiryDateEl && this.currentUser.subscriptionEnd) {
            expiryDateEl.textContent = new Date(this.currentUser.subscriptionEnd).toLocaleDateString();
        }
        
        if (modalAccountStatusEl) {
            modalAccountStatusEl.textContent = this.currentUser.accountStatus.charAt(0).toUpperCase() + 
                                            this.currentUser.accountStatus.slice(1);
            modalAccountStatusEl.className = `status-badge ${this.currentUser.accountStatus}`;
        }
        
        if (modalExpiryDateEl && this.currentUser.subscriptionEnd) {
            modalExpiryDateEl.textContent = new Date(this.currentUser.subscriptionEnd).toLocaleDateString();
        }
    }
    
    updateMoneyExchangerStats() {
        const activeCustomersCount = document.getElementById('active-customers-count');
        const todayTransactionsCount = document.getElementById('today-transactions-count');
        const systemBalance = document.getElementById('system-balance');
        
        if (activeCustomersCount) {
            activeCustomersCount.textContent = Object.keys(this.moneyExchangerData.customers).length;
        }
        
        if (todayTransactionsCount) {
            const today = new Date().toDateString();
            const todayTransactions = this.moneyExchangerData.transactions.filter(
                t => new Date(t.date).toDateString() === today
            );
            todayTransactionsCount.textContent = todayTransactions.length;
        }
        
        if (systemBalance) {
            systemBalance.textContent = `$${this.moneyExchangerData.ownerBalance.toFixed(2)}`;
        }
    }
    
    updateCustomersList() {
        // Update the datalist for existing customers
        const payerCustomersList = document.getElementById('payer-customers-list');
        const payeeCustomersList = document.getElementById('payee-customers-list');
        const geCustomerSelect = document.getElementById('ge-customer-select');
        const adjustmentCustomerSelect = document.getElementById('adjustment-customer-select');
        
        if (payerCustomersList) {
            payerCustomersList.innerHTML = '';
            Object.keys(this.moneyExchangerData.customers).forEach(customer => {
                const option = document.createElement('option');
                option.value = customer;
                payerCustomersList.appendChild(option);
            });
        }
        
        if (payeeCustomersList) {
            payeeCustomersList.innerHTML = '';
            Object.keys(this.moneyExchangerData.customers).forEach(customer => {
                const option = document.createElement('option');
                option.value = customer;
                payeeCustomersList.appendChild(option);
            });
        }
        
        if (geCustomerSelect) {
            geCustomerSelect.innerHTML = '<option value="">Select Customer</option>';
            Object.keys(this.moneyExchangerData.customers).forEach(customer => {
                const option = document.createElement('option');
                option.value = customer;
                option.textContent = customer;
                geCustomerSelect.appendChild(option);
            });
        }
        
        if (adjustmentCustomerSelect) {
            adjustmentCustomerSelect.innerHTML = '<option value="">Select Customer</option>';
            Object.keys(this.moneyExchangerData.customers).forEach(customer => {
                const option = document.createElement('option');
                option.value = customer;
                option.textContent = customer;
                adjustmentCustomerSelect.appendChild(option);
            });
        }
    }
    
    openMoneyExchanger() {
        const modal = document.getElementById('money-exchanger-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.loadMoneyExchangerData();
            this.updateMoneyExchangerUI();
        }
    }
    
    closeMoneyExchanger() {
        const modal = document.getElementById('money-exchanger-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    updateOwnersList() {
        const ownersList = document.getElementById('owners-list');
        const ownerSelects = document.querySelectorAll('[id$="-owner-select"]');
        
        if (ownersList) {
            ownersList.textContent = this.moneyExchangerData.owners.length > 0 
                ? this.moneyExchangerData.owners.join(', ') 
                : 'None';
        }
        
        ownerSelects.forEach(select => {
            select.innerHTML = '<option value="">Select Owner</option>';
            // Use a Set to ensure unique owners
            const uniqueOwners = [...new Set(this.moneyExchangerData.owners)];
            uniqueOwners.forEach(owner => {
                const option = document.createElement('option');
                option.value = owner;
                option.textContent = owner;
                select.appendChild(option);
            });
        });
    }
    
    async addOwner() {
        const nameInput = document.getElementById('new-owner-name');
        const name = nameInput.value.trim();
        
        if (!name) {
            this.showToast('Error', 'Please enter owner name', 'error');
            return;
        }
        
        // Check if owner already exists
        if (this.moneyExchangerData.owners.includes(name)) {
            this.showToast('Error', 'Owner already exists', 'error');
            return;
        }
        
        try {
            await this.apiCall('/api/money-exchanger/owners', 'POST', { name });
            this.moneyExchangerData.owners.push(name);
            nameInput.value = '';
            this.updateOwnersList();
            this.showToast('Success', 'Owner added successfully', 'success');
        } catch (error) {
            this.showToast('Error', error.message, 'error');
        }
    }
    
    setupCheckboxListeners(prefix) {
        const payerOwnerChk = document.getElementById(`${prefix}-payer-owner-chk`);
        const payerCustomerChk = document.getElementById(`${prefix}-payer-customer-chk`);
        
        if (payerOwnerChk) {
            payerOwnerChk.addEventListener('change', () => {
                this.handleCheckboxChange(prefix, 'payer', 'owner');
            });
        }
        
        if (payerCustomerChk) {
            payerCustomerChk.addEventListener('change', () => {
                this.handleCheckboxChange(prefix, 'payer', 'customer');
            });
        }
        
        const payeeOwnerChk = document.getElementById(`${prefix}-payee-owner-chk`);
        const payeeCustomerChk = document.getElementById(`${prefix}-payee-customer-chk`);
        
        if (payeeOwnerChk) {
            payeeOwnerChk.addEventListener('change', () => {
                this.handleCheckboxChange(prefix, 'payee', 'owner');
            });
        }
        
        if (payeeCustomerChk) {
            payeeCustomerChk.addEventListener('change', () => {
                this.handleCheckboxChange(prefix, 'payee', 'customer');
            });
        }
    }
    
    handleCheckboxChange(prefix, role, type) {
        const otherType = type === 'owner' ? 'customer' : 'owner';
        const checkbox = document.getElementById(`${prefix}-${role}-${type}-chk`);
        const otherCheckbox = document.getElementById(`${prefix}-${role}-${otherType}-chk`);
        const div = document.getElementById(`${prefix}-${role}-${type}-div`);
        const otherDiv = document.getElementById(`${prefix}-${role}-${otherType}-div`);
        
        if (checkbox.checked) {
            div.style.display = 'block';
            otherCheckbox.checked = false;
            otherDiv.style.display = 'none';
        } else {
            div.style.display = 'none';
        }
    }
    
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.classList.add('active');
        }
        
        const btn = document.querySelector(`[data-tab="${tabId}"]`);
        if (btn) {
            btn.classList.add('active');
        }
        
        if (tabId === 'all-transactions-tab') {
            this.displayMoneyExchangerTransactions();
        }
    }
    
    async addNewPersonTransaction() {
        const isPayerOwner = document.getElementById('np-payer-owner-chk').checked;
        const isPayerCustomer = document.getElementById('np-payer-customer-chk').checked;
        const isPayeeOwner = document.getElementById('np-payee-owner-chk').checked;
        const isPayeeCustomer = document.getElementById('np-payee-customer-chk').checked;
        
        if (!isPayerOwner && !isPayerCustomer) {
            this.showMessage('np-message', 'Please select who is paying (Payer)', 'error');
            return;
        }
        
        if (!isPayeeOwner && !isPayeeCustomer) {
            this.showMessage('np-message', 'Please select who is receiving (Payee)', 'error');
            return;
        }
        
        let payerName = '';
        let payerType = '';
        let receiverName = '';
        let receiverType = '';
        
        if (isPayerOwner) {
            payerName = document.getElementById('np-payer-owner-select').value;
            payerType = 'owner';
        } else {
            payerName = document.getElementById('np-payer-customer-name').value.trim();
            payerType = 'customer';
        }
        
        if (isPayeeOwner) {
            receiverName = document.getElementById('np-payee-owner-select').value;
            receiverType = 'owner';
        } else {
            receiverName = document.getElementById('np-payee-customer-name').value.trim();
            receiverType = 'customer';
        }
        
        if (payerName === receiverName) {
            this.showMessage('np-message', 'Payer and Payee cannot be the same person', 'error');
            return;
        }
        
        const amount = parseFloat(document.getElementById('np-amount').value);
        const desc = document.getElementById('np-desc').value.trim();
        const cashType = document.getElementById('np-cash-type').value;
        
        if (!amount || amount <= 0) {
            this.showMessage('np-message', 'Please enter valid amount', 'error');
            return;
        }
        
        if (!cashType) {
            this.showMessage('np-message', 'Please select cash type', 'error');
            return;
        }
        
        // Check if customer already exists
        if (payerType === 'customer' && this.moneyExchangerData.customers[payerName] !== undefined) {
            this.showMessage('np-message', 'Payer customer already exists. Use Old Person tab instead.', 'error');
            return;
        }
        
        if (receiverType === 'customer' && this.moneyExchangerData.customers[receiverName] !== undefined) {
            this.showMessage('np-message', 'Payee customer already exists. Use Old Person tab instead.', 'error');
            return;
        }
        
        // Debt Validation: Check if payer has outstanding debt before lending
        if (payerType === 'owner' && this.moneyExchangerData.ownerBalance < 0) {
            this.showMessage('np-message', 'You already have outstanding debt. Please clear your debt before lending to others.', 'error');
            return;
        }
        
        if (payerType === 'customer' && this.moneyExchangerData.customers[payerName] < 0) {
            this.showMessage('np-message', 'You already have outstanding debt. Please clear your debt before lending to others.', 'error');
            return;
        }
        
        const transaction = {
            date: new Date().toISOString(),
            type: 'New Person',
            payer: payerName,
            receiver: receiverName,
            amount: amount,
            description: desc,
            cashType: cashType
        };
        
        try {
            const response = await this.apiCall('/api/money-exchanger/transactions', 'POST', transaction);
            
            // Use the transaction returned from server (with ID)
            this.moneyExchangerData.transactions.push(response.transaction);
            
            // Debt Creation: Update balances according to rules
            if (payerType === 'owner') {
                this.moneyExchangerData.ownerBalance -= amount; // Payer's account decreases
                if (receiverType === 'customer') {
                    this.moneyExchangerData.customers[receiverName] = amount; // Receiver's account increases
                }
            } else if (payerType === 'customer') {
                if (receiverType === 'owner') {
                    this.moneyExchangerData.ownerBalance += amount; // Receiver's account increases
                    this.moneyExchangerData.customers[payerName] = -amount; // Payer's account decreases
                } else if (receiverType === 'customer') {
                    this.moneyExchangerData.customers[payerName] = -amount; // Payer's account decreases
                    this.moneyExchangerData.customers[receiverName] = amount; // Receiver's account increases
                }
            }
            
            await this.saveMoneyExchangerData();
            
            this.updateMoneyExchangerUI();
            this.clearNewPersonForm();
            this.showMessage('np-message', 'Transaction added successfully', 'success');
        } catch (error) {
            this.showMessage('np-message', error.message, 'error');
        }
    }
    
    // Show customer balance when selected in old person tab
    setupOldPersonCustomerListeners() {
        const payerCustomerInput = document.getElementById('op-payer-customer-name');
        const payeeCustomerInput = document.getElementById('op-payee-customer-name');
        
        if (payerCustomerInput) {
            payerCustomerInput.addEventListener('input', (e) => {
                const customerName = e.target.value.trim();
                const balanceDiv = document.getElementById('op-payer-customer-balance');
                
                if (customerName && this.moneyExchangerData.customers[customerName] !== undefined) {
                    const balance = this.moneyExchangerData.customers[customerName];
                    balanceDiv.textContent = `Balance: $${balance.toFixed(2)}`;
                    balanceDiv.style.display = 'block';
                } else {
                    balanceDiv.style.display = 'none';
                }
            });
        }
        
        if (payeeCustomerInput) {
            payeeCustomerInput.addEventListener('input', (e) => {
                const customerName = e.target.value.trim();
                const balanceDiv = document.getElementById('op-payee-customer-balance');
                
                if (customerName && this.moneyExchangerData.customers[customerName] !== undefined) {
                    const balance = this.moneyExchangerData.customers[customerName];
                    balanceDiv.textContent = `Balance: $${balance.toFixed(2)}`;
                    balanceDiv.style.display = 'block';
                } else {
                    balanceDiv.style.display = 'none';
                }
            });
        }
    }
    
    handleOldPersonTransaction(type) {
        // Get form values
        const isPayerOwner = document.getElementById('op-payer-owner-chk').checked;
        const isPayerCustomer = document.getElementById('op-payer-customer-chk').checked;
        const isPayeeOwner = document.getElementById('op-payee-owner-chk').checked;
        const isPayeeCustomer = document.getElementById('op-payee-customer-chk').checked;
        
        if (!isPayerOwner && !isPayerCustomer) {
            this.showMessage('op-message', 'Please select who is paying (Payer)', 'error');
            return;
        }
        
        if (!isPayeeOwner && !isPayeeCustomer) {
            this.showMessage('op-message', 'Please select who is receiving (Payee)', 'error');
            return;
        }
        
        let payerName = '';
        let payerType = '';
        let receiverName = '';
        let receiverType = '';
        
        if (isPayerOwner) {
            payerName = document.getElementById('op-payer-owner-select').value;
            payerType = 'owner';
        } else {
            payerName = document.getElementById('op-payer-customer-name').value.trim();
            payerType = 'customer';
        }
        
        if (isPayeeOwner) {
            receiverName = document.getElementById('op-payee-owner-select').value;
            receiverType = 'owner';
        } else {
            receiverName = document.getElementById('op-payee-customer-name').value.trim();
            receiverType = 'customer';
        }
        
        if (payerName === receiverName) {
            this.showMessage('op-message', 'Payer and Payee cannot be the same person', 'error');
            return;
        }
        
        const amount = parseFloat(document.getElementById('op-amount').value);
        const desc = document.getElementById('op-desc').value.trim();
        const cashType = document.getElementById('op-cash-type').value;
        
        if (!amount || amount <= 0) {
            this.showMessage('op-message', 'Please enter valid amount', 'error');
            return;
        }
        
        if (!cashType) {
            this.showMessage('op-message', 'Please select cash type', 'error');
            return;
        }
        
        // Check if customer exists
        if (payerType === 'customer' && this.moneyExchangerData.customers[payerName] === undefined) {
            this.showMessage('op-message', 'Payer customer does not exist. Use New Person tab instead.', 'error');
            return;
        }
        
        if (receiverType === 'customer' && this.moneyExchangerData.customers[receiverName] === undefined) {
            this.showMessage('op-message', 'Receiver customer does not exist. Use New Person tab instead.', 'error');
            return;
        }
        
        // Partial Payment Validation
        if (type === 'PR') {
            if (payerType === 'customer') {
                const currentBalance = this.moneyExchangerData.customers[payerName];
                if (currentBalance >= 0) {
                    this.showMessage('op-message', 'This customer does not have any debt to make a partial payment.', 'error');
                    return;
                }
                const debtAmount = Math.abs(currentBalance);
                if (amount >= debtAmount) {
                    this.showMessage('op-message', 'Amount must be less than the total debt for a partial payment. Use Full Payment for exact amount.', 'error');
                    return;
                }
            } else if (payerType === 'owner') {
                if (this.moneyExchangerData.ownerBalance >= 0) {
                    this.showMessage('op-message', 'Owner does not have any debt to make a partial payment.', 'error');
                    return;
                }
                const debtAmount = Math.abs(this.moneyExchangerData.ownerBalance);
                if (amount >= debtAmount) {
                    this.showMessage('op-message', 'Amount must be less than the total debt for a partial payment. Use Full Payment for exact amount.', 'error');
                    return;
                }
            }
        }
        
        // Full Payment Validation
        if (type === 'Full') {
            if (payerType === 'customer') {
                const currentBalance = this.moneyExchangerData.customers[payerName];
                if (currentBalance >= 0) {
                    this.showMessage('op-message', 'This customer does not have any debt to make a full payment.', 'error');
                    return;
                }
                const debtAmount = Math.abs(currentBalance);
                if (amount !== debtAmount) {
                    this.showMessage('op-message', `Amount must be exactly $${debtAmount.toFixed(2)} for a full payment.`, 'error');
                    return;
                }
            } else if (payerType === 'owner') {
                if (this.moneyExchangerData.ownerBalance >= 0) {
                    this.showMessage('op-message', 'Owner does not have any debt to make a full payment.', 'error');
                    return;
                }
                const debtAmount = Math.abs(this.moneyExchangerData.ownerBalance);
                if (amount !== debtAmount) {
                    this.showMessage('op-message', `Amount must be exactly $${debtAmount.toFixed(2)} for a full payment.`, 'error');
                    return;
                }
            }
        }
        
        // Debt Validation
        if (type === 'Debt') {
            if (payerType === 'owner' && this.moneyExchangerData.ownerBalance < 0) {
                this.showMessage('op-message', 'You already have outstanding debt. Please clear your debt before lending to others.', 'error');
                return;
            }
            
            if (payerType === 'customer' && this.moneyExchangerData.customers[payerName] < 0) {
                this.showMessage('op-message', 'You already have outstanding debt. Please clear your debt before lending to others.', 'error');
                return;
            }
        }
        
        // Create transaction
        const transaction = {
            date: new Date().toISOString(),
            type: `Old Person (${type})`,
            payer: payerName,
            receiver: receiverName,
            amount: amount,
            description: desc,
            cashType: cashType
        };
        
        // Add transaction and update balances based on transaction type
        this.moneyExchangerData.transactions.push(transaction);
        
        if (payerType === 'owner') {
            // Owner is paying
            this.moneyExchangerData.ownerBalance -= amount;
            if (receiverType === 'customer') {
                // Customer is receiving
                this.moneyExchangerData.customers[receiverName] += amount;
            }
        } else if (payerType === 'customer') {
            // Customer is paying
            const currentBalance = this.moneyExchangerData.customers[payerName];
            
            if (type === 'PR') {
                // Partial payment - reduce debt
                this.moneyExchangerData.customers[payerName] = currentBalance - amount;
                if (receiverType === 'owner') {
                    this.moneyExchangerData.ownerBalance += amount;
                }
            } else if (type === 'Full') {
                // Full payment - clear debt
                this.moneyExchangerData.customers[payerName] = 0;
                if (receiverType === 'owner') {
                    this.moneyExchangerData.ownerBalance += amount;
                }
            } else if (type === 'Debt') {
                if (payerType === 'customer') {
                    // Customer paying debt
                    if (currentBalance > 0) {
                        this.showMessage('op-message', 'You cannot pay debt because owner owes you money.', 'error');
                        return;
                    } else {
                        // allowed to pay debt
                        this.moneyExchangerData.customers[payerName] = currentBalance - amount;
                        if (receiverType === 'owner') {
                            this.moneyExchangerData.ownerBalance += amount;
                        }
                    }
                } else if (payerType === 'owner') {
                    // Owner giving debt to customer
                    const customerBalance = this.moneyExchangerData.customers[receiverName] || 0; // get customer's balance
                    if (customerBalance < 0) {
                        this.showMessage('op-message', 'Cannot issue debt because customer already owes money.', 'error');
                        return;
                    } else {
                        // allowed to issue debt
                        this.moneyExchangerData.customers[receiverName] = customerBalance - amount; // update customer balance
                        this.moneyExchangerData.ownerBalance += amount; // update owner balance
                    }
                }
            }
        }
        
        // Save and update UI
        this.saveMoneyExchangerData();
        this.updateMoneyExchangerUI();
        this.clearOldPersonForm();
        this.showMessage('op-message', `${type} transaction added successfully`, 'success');
    }
    
    // Show/hide adjustment options
    showAdjustmentOptions(show) {
        const adjustmentOptions = document.getElementById('adjustment-options');
        if (adjustmentOptions) {
            adjustmentOptions.style.display = show ? 'block' : 'none';
            console.log('Adjustment options shown:', show);
        }
    }

    handleGeneralEntry(type) {
    console.log('handleGeneralEntry called with type:', type);
    
    const amount = parseFloat(document.getElementById('ge-amount').value);
    const desc = document.getElementById('ge-desc').value.trim();
    
    if (!amount || amount <= 0) {
        this.showMessage('ge-message', 'Please enter valid amount', 'error');
        return;
    }
    
    if (!desc) {
        this.showMessage('ge-message', 'Please enter description', 'error');
        return;
    }
    
    let payer = 'System';
    let receiver = 'System';
    
    // For Adjustment transactions, set actual payer and receiver names
    if (type === 'Adjustment') {
        console.log('Processing adjustment transaction');
        
        // Get adjustment type (Owner or Customer)
        const isAdjustmentOwner = document.getElementById('adjustment-owner-chk').checked;
        const isAdjustmentCustomer = document.getElementById('adjustment-customer-chk').checked;
        
        console.log('Adjustment Owner checked:', isAdjustmentOwner);
        console.log('Adjustment Customer checked:', isAdjustmentCustomer);
        
        if (!isAdjustmentOwner && !isAdjustmentCustomer) {
            this.showMessage('ge-message', 'Please select who is being adjusted (Owner or Customer)', 'error');
            return;
        }
        
        let personName = '';
        let personType = '';
        
        if (isAdjustmentOwner) {
            personName = document.getElementById('adjustment-owner-select').value;
            personType = 'owner';
        } else {
            personName = document.getElementById('adjustment-customer-select').value;
            personType = 'customer';
        }
        
        console.log('Person name:', personName);
        console.log('Person type:', personType);
        
        if (!personName) {
            this.showMessage('ge-message', `Please select a ${personType}`, 'error');
            return;
        }
        
        // Check if customer exists
        if (personType === 'customer' && this.moneyExchangerData.customers[personName] === undefined) {
            this.showMessage('ge-message', `Customer ${personName} does not exist`, 'error');
            return;
        }
        
        // Get adjustment direction
        const adjustmentDirection = document.querySelector('input[name="adjustment-direction"]:checked')?.value;
        
        console.log('Adjustment direction:', adjustmentDirection);
        
        if (!adjustmentDirection) {
            this.showMessage('ge-message', 'Please select adjustment direction (+ or -)', 'error');
            return;
        }
        
        // Set payer and receiver based on adjustment type and direction
        if (personType === 'owner') {
            if (adjustmentDirection === '+') {
                // Money is added to owner's account (System → Owner)
                payer = 'System';
                receiver = personName;
            } else {
                // Money is deducted from owner's account (Owner → System)
                payer = personName;
                receiver = 'System';
            }
        } else if (personType === 'customer') {
            // Get current owner name
            const currentOwner = this.currentUser.fullName;
            
            if (adjustmentDirection === '+') {
                // Money is added to customer's account (Owner → Customer)
                payer = currentOwner;
                receiver = personName;
            } else {
                // Money is deducted from customer's account (Customer → Owner)
                payer = personName;
                receiver = currentOwner;
            }
        }
    }
    
    // Create transaction
    const transaction = {
        date: new Date().toISOString(),
        type: `General Entry (${type})`,
        payer: payer,
        receiver: receiver,
        amount: amount,
        description: desc,
        cashType: 'USD'
    };
    
    // Add transaction and update balance
    this.moneyExchangerData.transactions.push(transaction);
    
    if (type === 'IN') {
        this.moneyExchangerData.ownerBalance += amount;
    } else if (type === 'OUT') {
        this.moneyExchangerData.ownerBalance -= amount;
    } else if (type === 'Adjustment') {
        console.log('Processing adjustment transaction');
        
        // Get adjustment type (Owner or Customer)
        const isAdjustmentOwner = document.getElementById('adjustment-owner-chk').checked;
        const isAdjustmentCustomer = document.getElementById('adjustment-customer-chk').checked;
        
        let personName = '';
        let personType = '';
        
        if (isAdjustmentOwner) {
            personName = document.getElementById('adjustment-owner-select').value;
            personType = 'owner';
        } else {
            personName = document.getElementById('adjustment-customer-select').value;
            personType = 'customer';
        }
        
        // Get adjustment direction
        const adjustmentDirection = document.querySelector('input[name="adjustment-direction"]:checked')?.value;
        
        // Update balances based on adjustment type and direction
        if (personType === 'owner') {
            if (adjustmentDirection === '+') {
                // Owner's balance increases
                this.moneyExchangerData.ownerBalance += amount;
                console.log('Owner balance increased by', amount);
            } else {
                // Owner's balance decreases
                this.moneyExchangerData.ownerBalance -= amount;
                console.log('Owner balance decreased by', amount);
            }
        } else if (personType === 'customer') {
            if (adjustmentDirection === '+') {
                // Customer's balance increases, Owner's balance decreases
                this.moneyExchangerData.customers[personName] += amount;
                this.moneyExchangerData.ownerBalance -= amount;
                console.log('Customer balance increased by', amount, 'Owner balance decreased by', amount);
            } else {
                // Customer's balance decreases, Owner's balance increases
                this.moneyExchangerData.customers[personName] -= amount;
                this.moneyExchangerData.ownerBalance += amount;
                console.log('Customer balance decreased by', amount, 'Owner balance increased by', amount);
            }
        }
    }
    
    // Save and update UI
    this.saveMoneyExchangerData();
    this.updateMoneyExchangerUI();
    this.clearGeneralEntryForm();
    this.showMessage('ge-message', `${type} entry added successfully`, 'success');
}
    
    // handleGeneralEntry(type) {
    //     console.log('handleGeneralEntry called with type:', type);
        
    //     const amount = parseFloat(document.getElementById('ge-amount').value);
    //     const desc = document.getElementById('ge-desc').value.trim();
        
    //     if (!amount || amount <= 0) {
    //         this.showMessage('ge-message', 'Please enter valid amount', 'error');
    //         return;
    //     }
        
    //     if (!desc) {
    //         this.showMessage('ge-message', 'Please enter description', 'error');
    //         return;
    //     }
        
    //     // Create transaction
    //     const transaction = {
    //         date: new Date().toISOString(),
    //         type: `General Entry (${type})`,
    //         payer: 'System',
    //         receiver: 'System',
    //         amount: amount,
    //         description: desc,
    //         cashType: 'USD'
    //     };
        
    //     // Add transaction and update balance
    //     this.moneyExchangerData.transactions.push(transaction);
        
    //     if (type === 'IN') {
    //         this.moneyExchangerData.ownerBalance += amount;
    //     } else if (type === 'OUT') {
    //         this.moneyExchangerData.ownerBalance -= amount;
    //     } else if (type === 'Adjustment') {
    //         console.log('Processing adjustment transaction');
            
    //         // Get adjustment type (Owner or Customer)
    //         const isAdjustmentOwner = document.getElementById('adjustment-owner-chk').checked;
    //         const isAdjustmentCustomer = document.getElementById('adjustment-customer-chk').checked;
            
    //         console.log('Adjustment Owner checked:', isAdjustmentOwner);
    //         console.log('Adjustment Customer checked:', isAdjustmentCustomer);
            
    //         if (!isAdjustmentOwner && !isAdjustmentCustomer) {
    //             this.showMessage('ge-message', 'Please select who is being adjusted (Owner or Customer)', 'error');
    //             return;
    //         }
            
    //         let personName = '';
    //         let personType = '';
            
    //         if (isAdjustmentOwner) {
    //             personName = document.getElementById('adjustment-owner-select').value;
    //             personType = 'owner';
    //         } else {
    //             personName = document.getElementById('adjustment-customer-select').value;
    //             personType = 'customer';
    //         }
            
    //         console.log('Person name:', personName);
    //         console.log('Person type:', personType);
            
    //         if (!personName) {
    //             this.showMessage('ge-message', `Please select a ${personType}`, 'error');
    //             return;
    //         }
            
    //         // Check if customer exists
    //         if (personType === 'customer' && this.moneyExchangerData.customers[personName] === undefined) {
    //             this.showMessage('ge-message', `Customer ${personName} does not exist`, 'error');
    //             return;
    //         }
            
    //         // Get adjustment direction
    //         const adjustmentDirection = document.querySelector('input[name="adjustment-direction"]:checked')?.value;
            
    //         console.log('Adjustment direction:', adjustmentDirection);
            
    //         if (!adjustmentDirection) {
    //             this.showMessage('ge-message', 'Please select adjustment direction (+ or -)', 'error');
    //             return;
    //         }
            
    //         // Update balances based on adjustment type and direction
    //         if (personType === 'owner') {
    //             if (adjustmentDirection === '+') {
    //                 // Owner's balance increases
    //                 this.moneyExchangerData.ownerBalance += amount;
    //                 console.log('Owner balance increased by', amount);
    //             } else {
    //                 // Owner's balance decreases
    //                 this.moneyExchangerData.ownerBalance -= amount;
    //                 console.log('Owner balance decreased by', amount);
    //             }
    //         } else if (personType === 'customer') {
    //             if (adjustmentDirection === '+') {
    //                 // Customer's balance increases, Owner's balance decreases
    //                 this.moneyExchangerData.customers[personName] += amount;
    //                 this.moneyExchangerData.ownerBalance -= amount;
    //                 console.log('Customer balance increased by', amount, 'Owner balance decreased by', amount);
    //             } else {
    //                 // Customer's balance decreases, Owner's balance increases
    //                 this.moneyExchangerData.customers[personName] -= amount;
    //                 this.moneyExchangerData.ownerBalance += amount;
    //                 console.log('Customer balance decreased by', amount, 'Owner balance increased by', amount);
    //             }
    //         }
    //     }
        
    //     // Save and update UI
    //     this.saveMoneyExchangerData();
    //     this.updateMoneyExchangerUI();
    //     this.clearGeneralEntryForm();
    //     this.showMessage('ge-message', `${type} entry added successfully`, 'success');
    // }
    
    async saveMoneyExchangerData() {
        try {
            console.log('Saving Money Exchanger data');
            await this.apiCall('/api/money-exchanger/data', 'PUT', this.moneyExchangerData);
        } catch (error) {
            console.error('Error saving Money Exchanger data:', error);
        }
    }
    
    displayMoneyExchangerTransactions() {
        const tbody = document.getElementById('money-exchanger-transactions-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (this.moneyExchangerData.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No transactions found</td></tr>';
            return;
        }
        
        // Sort transactions by date (newest first)
        const sortedTransactions = [...this.moneyExchangerData.transactions].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        sortedTransactions.forEach((transaction, index) => {
            const row = tbody.insertRow();
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${transaction.type}</td>
                <td>${transaction.payer}</td>
                <td>${transaction.receiver}</td>
                <td>$${transaction.amount.toFixed(2)}</td>
                <td>${transaction.description}</td>
                <td>${transaction.cashType}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="app.openEditTransactionModal('${transaction.id}')">
                            Edit
                        </button>
                        <button class="btn-delete" onclick="app.deleteMoneyExchangerTransaction(${index})">
                            Delete
                        </button>
                    </div>
                </td>
            `;
        });
    }
    
    async deleteMoneyExchangerTransaction(index) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            try {
                // Find the actual index in the original array
                const transactionToDelete = this.moneyExchangerData.transactions[index];
                const actualIndex = this.moneyExchangerData.transactions.findIndex(
                    t => t.id === transactionToDelete.id
                );
                
                if (actualIndex !== -1) {
                    this.moneyExchangerData.transactions.splice(actualIndex, 1);
                    await this.saveMoneyExchangerData();
                    this.displayMoneyExchangerTransactions();
                    this.updateMoneyExchangerStats();
                    this.showToast('Success', 'Transaction deleted successfully', 'success');
                }
            } catch (error) {
                this.showToast('Error', error.message, 'error');
            }
        }
    }
    
    // Report Generation
    generatePDFReport(startDate, endDate) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Filter transactions by date range
        const filteredTransactions = this.moneyExchangerData.transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include end date
            return transactionDate >= start && transactionDate <= end;
        });
        
        if (filteredTransactions.length === 0) {
            this.showToast('Warning', 'No transactions found in the selected date range', 'warning');
            return;
        }
        
        // Add title
        doc.setFontSize(18);
        doc.text('CashBook Pro - Transaction Report', 105, 15, { align: 'center' });
        
        // Add date range
        doc.setFontSize(12);
        doc.text(`From: ${new Date(startDate).toLocaleDateString()} To: ${new Date(endDate).toLocaleDateString()}`, 
                105, 25, { align: 'center' });
        
        // Add account info
        doc.text(`Account: ${this.currentUser.fullName} (${this.currentUser.businessName || ''})`, 
                20, 35);
        doc.text(`Status: ${this.currentUser.accountStatus}`, 20, 42);
        
        // Add table headers
        doc.setFontSize(10);
        doc.text('Date', 20, 55);
        doc.text('Type', 50, 55);
        doc.text('Payer', 80, 55);
        doc.text('Receiver', 110, 55);
        doc.text('Amount', 150, 55);
        doc.text('Cash Type', 170, 55);
        
        // Add transaction data
        let yPosition = 65;
        filteredTransactions.forEach(transaction => {
            if (yPosition > 270) { // Add new page if needed
                doc.addPage();
                yPosition = 20;
            }
            
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString();
            
            doc.text(formattedDate, 20, yPosition);
            doc.text(transaction.type, 50, yPosition);
            doc.text(transaction.payer, 80, yPosition);
            doc.text(transaction.receiver, 110, yPosition);
            doc.text(`$${transaction.amount.toFixed(2)}`, 150, yPosition);
            doc.text(transaction.cashType, 170, yPosition);
            
            yPosition += 10;
        });
        
        // Add summary
        const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
        doc.text(`Total Transactions: ${filteredTransactions.length}`, 20, yPosition + 10);
        doc.text(`Total Amount: $${totalAmount.toFixed(2)}`, 20, yPosition + 20);
        
        // Save the PDF
        doc.save(`CashBook_Report_${new Date(startDate).toISOString().split('T')[0]}_to_${new Date(endDate).toISOString().split('T')[0]}.pdf`);
        
        this.showToast('Success', 'PDF report generated successfully', 'success');
    }
    
    generateExcelReport(startDate, endDate) {
        // Filter transactions by date range
        const filteredTransactions = this.moneyExchangerData.transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include end date
            return transactionDate >= start && transactionDate <= end;
        });
        
        if (filteredTransactions.length === 0) {
            this.showToast('Warning', 'No transactions found in the selected date range', 'warning');
            return;
        }
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Create transaction data
        const transactionData = [
            ['Date', 'Type', 'Payer', 'Receiver', 'Amount', 'Description', 'Cash Type']
        ];
        
        filteredTransactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString();
            
            transactionData.push([
                formattedDate,
                transaction.type,
                transaction.payer,
                transaction.receiver,
                transaction.amount,
                transaction.description,
                transaction.cashType
            ]);
        });
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(transactionData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
        
        // Create summary sheet
        const summaryData = [
            ['Report Summary'],
            ['Account Name', this.currentUser.fullName],
            ['Business Name', this.currentUser.businessName || ''],
            ['Account Status', this.currentUser.accountStatus],
            ['Report Period', `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`],
            ['Total Transactions', filteredTransactions.length],
            ['Total Amount', filteredTransactions.reduce((sum, t) => sum + t.amount, 0)]
        ];
        
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
        
        // Save the Excel file
        XLSX.writeFile(wb, `CashBook_Report_${new Date(startDate).toISOString().split('T')[0]}_to_${new Date(endDate).toISOString().split('T')[0]}.xlsx`);
        
        this.showToast('Success', 'Excel report generated successfully', 'success');
    }
    
    // Transaction Editing
    openEditTransactionModal(transactionId) {
        const transaction = this.moneyExchangerData.transactions.find(t => t.id === transactionId);
        if (!transaction) {
            this.showToast('Error', 'Transaction not found', 'error');
            return;
        }
        
        this.editingTransactionId = transactionId;
        
        // Populate form fields
        document.getElementById('edit-transaction-id').value = transaction.id;
        document.getElementById('edit-transaction-date').value = new Date(transaction.date).toLocaleString();
        document.getElementById('edit-transaction-type').value = transaction.type;
        document.getElementById('edit-transaction-payer').value = transaction.payer;
        document.getElementById('edit-transaction-receiver').value = transaction.receiver;
        document.getElementById('edit-transaction-amount').value = transaction.amount;
        document.getElementById('edit-transaction-description').value = transaction.description;
        document.getElementById('edit-transaction-cash-type').value = transaction.cashType;
        
        // Show modal
        document.getElementById('edit-transaction-modal').classList.remove('hidden');
    }
    
    closeEditTransactionModal() {
        document.getElementById('edit-transaction-modal').classList.add('hidden');
        this.editingTransactionId = null;
    }
    
    async updateTransaction(formData) {
        try {
            const transactionIndex = this.moneyExchangerData.transactions.findIndex(
                t => t.id === this.editingTransactionId
            );
            
            if (transactionIndex === -1) {
                throw new Error('Transaction not found');
            }
            
            // Update transaction
            this.moneyExchangerData.transactions[transactionIndex] = {
                ...this.moneyExchangerData.transactions[transactionIndex],
                amount: parseFloat(formData.amount),
                description: formData.description,
                cashType: formData.cashType
            };
            
            // Save data
            await this.saveMoneyExchangerData();
            
            // Update UI
            this.displayMoneyExchangerTransactions();
            this.updateMoneyExchangerStats();
            this.closeEditTransactionModal();
            
            this.showToast('Success', 'Transaction updated successfully', 'success');
        } catch (error) {
            this.showToast('Error', error.message, 'error');
        }
    }
    
    // Form Clearing Methods
    clearNewPersonForm() {
        document.getElementById('np-amount').value = '';
        document.getElementById('np-desc').value = '';
        document.getElementById('np-cash-type').selectedIndex = 0;
        
        document.getElementById('np-payer-owner-chk').checked = false;
        document.getElementById('np-payer-customer-chk').checked = false;
        document.getElementById('np-payee-owner-chk').checked = false;
        document.getElementById('np-payee-customer-chk').checked = false;
        
        document.getElementById('np-payer-owner-div').style.display = 'none';
        document.getElementById('np-payer-customer-div').style.display = 'none';
        document.getElementById('np-payee-owner-div').style.display = 'none';
        document.getElementById('np-payee-customer-div').style.display = 'none';
    }
    
    clearOldPersonForm() {
        document.getElementById('op-amount').value = '';
        document.getElementById('op-desc').value = '';
        document.getElementById('op-cash-type').selectedIndex = 0;
        
        document.getElementById('op-payer-owner-chk').checked = false;
        document.getElementById('op-payer-customer-chk').checked = false;
        document.getElementById('op-payee-owner-chk').checked = false;
        document.getElementById('op-payee-customer-chk').checked = false;
        
        document.getElementById('op-payer-owner-div').style.display = 'none';
        document.getElementById('op-payer-customer-div').style.display = 'none';
        document.getElementById('op-payee-owner-div').style.display = 'none';
        document.getElementById('op-payee-customer-div').style.display = 'none';
        
        // Hide balance displays
        document.getElementById('op-payer-customer-balance').style.display = 'none';
        document.getElementById('op-payee-customer-balance').style.display = 'none';
    }
    
    clearGeneralEntryForm() {
        document.getElementById('ge-amount').value = '';
        document.getElementById('ge-desc').value = '';
        
        // Hide adjustment options
        this.showAdjustmentOptions(false);
        
        // Reset adjustment fields
        document.getElementById('adjustment-owner-chk').checked = false;
        document.getElementById('adjustment-customer-chk').checked = false;
        document.getElementById('adjustment-owner-div').style.display = 'none';
        document.getElementById('adjustment-customer-div').style.display = 'none';
        
        // Clear radio buttons
        document.querySelectorAll('input[name="adjustment-direction"]').forEach(radio => {
            radio.checked = false;
        });
    }
    
    showMessage(containerId, message, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `<div class="message ${type}">${message}</div>`;
        setTimeout(() => {
            container.innerHTML = '';
        }, 5000);
    }
    
    // Modal Methods
    showAdminSettings() {
        const modal = document.getElementById('admin-settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
            
            const adminUsernameEl = document.getElementById('admin-username');
            if (adminUsernameEl) adminUsernameEl.value = this.currentUser.username;
            
            const adminEmailEl = document.getElementById('admin-email');
            if (adminEmailEl) adminEmailEl.value = this.currentUser.email;
        }
    }
    
    hideAdminSettings() {
        const modal = document.getElementById('admin-settings-modal');
        if (modal) {
            modal.classList.add('hidden');
            
            const adminSettingsForm = document.getElementById('admin-settings-form');
            if (adminSettingsForm) adminSettingsForm.reset();
        }
    }
    
    // Utility Methods
    getDaysRemaining() {
        if (!this.currentUser?.subscriptionEnd) return 'N/A';
        const days = Math.max(0, Math.ceil((new Date(this.currentUser.subscriptionEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
        return `${days} days`;
    }
    
    getDaysRemainingForClient(subscriptionEnd) {
        if (!subscriptionEnd) return 'Payment pending';
        const days = Math.max(0, Math.ceil((new Date(subscriptionEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
        return `${days} days`;
    }
    
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Success', 'Copied to clipboard!', 'success');
        }).catch(() => {
            this.showToast('Error', 'Failed to copy to clipboard', 'error');
        });
    }
    
    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    }
    
    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
    
    showToast(title, message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        toast.innerHTML = `
            <div class="toast-header">
                <div class="toast-title">${title}</div>
                <button class="toast-close">&times;</button>
            </div>
            <div class="toast-message">${message}</div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        const toastCloseBtn = toast.querySelector('.toast-close');
        if (toastCloseBtn) {
            toastCloseBtn.addEventListener('click', () => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            });
        }
    }
    
    // Event Listeners
    setupEventListeners() {
        this.setupGlobalEventListeners();
        this.setupPageSpecificEventListeners();
        this.setupModalEventListeners();
        this.setupAdjustmentEventListeners();
    }
    
    setupGlobalEventListeners() {
        this.safeAddEventListener('#logout-btn', 'click', () => this.logout());
        
        this.safeAddEventListener('#show-register', 'click', (e) => {
            e.preventDefault();
            this.showRegister();
        });
        
        this.safeAddEventListener('#show-login', 'click', (e) => {
            e.preventDefault();
            this.showLogin();
        });
        
        this.safeAddEventListener('#show-forgot-password', 'click', (e) => {
            e.preventDefault();
            this.showPage('forgot-password-page');
        });
        
        this.safeAddEventListener('#back-to-login', 'click', (e) => {
            e.preventDefault();
            this.showLogin();
        });
        
        this.safeAddEventListener('#back-to-dashboard', 'click', () => {
            this.showDashboard();
        });
        
        this.safeAddEventListener('#open-money-exchanger-btn', 'click', () => {
            this.openMoneyExchanger();
        });
        
        this.safeAddEventListener('#close-money-exchanger', 'click', () => {
            this.closeMoneyExchanger();
        });
        
        this.safeAddEventListener('#add-owner-btn', 'click', () => {
            this.addOwner();
        });
        
        this.safeAddEventListener('#add-new-transaction-btn', 'click', () => {
            this.addNewPersonTransaction();
        });
        
        // Report generation buttons
        this.safeAddEventListener('#generate-pdf-report', 'click', () => {
            const startDate = document.getElementById('report-start-date').value;
            const endDate = document.getElementById('report-end-date').value;
            
            if (!startDate || !endDate) {
                this.showToast('Error', 'Please select both start and end dates', 'error');
                return;
            }
            
            this.generatePDFReport(startDate, endDate);
        });
        
        this.safeAddEventListener('#generate-excel-report', 'click', () => {
            const startDate = document.getElementById('report-start-date').value;
            const endDate = document.getElementById('report-end-date').value;
            
            if (!startDate || !endDate) {
                this.showToast('Error', 'Please select both start and end dates', 'error');
                return;
            }
            
            this.generateExcelReport(startDate, endDate);
        });
        
        // Modal report buttons
        this.safeAddEventListener('#modal-generate-pdf-report', 'click', () => {
            const startDate = document.getElementById('modal-report-start-date').value;
            const endDate = document.getElementById('modal-report-end-date').value;
            
            if (!startDate || !endDate) {
                this.showToast('Error', 'Please select both start and end dates', 'error');
                return;
            }
            
            this.generatePDFReport(startDate, endDate);
        });
        
        this.safeAddEventListener('#modal-generate-excel-report', 'click', () => {
            const startDate = document.getElementById('modal-report-start-date').value;
            const endDate = document.getElementById('modal-report-end-date').value;
            
            if (!startDate || !endDate) {
                this.showToast('Error', 'Please select both start and end dates', 'error');
                return;
            }
            
            this.generateExcelReport(startDate, endDate);
        });
        
        // Edit transaction modal
        this.safeAddEventListener('#close-edit-transaction', 'click', () => {
            this.closeEditTransactionModal();
        });
        
        this.safeAddEventListener('#cancel-edit-transaction', 'click', () => {
            this.closeEditTransactionModal();
        });
        
        this.safeAddEventListener('#edit-transaction-form', 'submit', (e) => {
            e.preventDefault();
            
            const formData = {
                amount: document.getElementById('edit-transaction-amount').value,
                description: document.getElementById('edit-transaction-description').value,
                cashType: document.getElementById('edit-transaction-cash-type').value
            };
            
            this.updateTransaction(formData);
        });
        
        // Old Person transaction type buttons
        this.safeAddEventListener('#op-pr-btn', 'click', () => {
            this.handleOldPersonTransaction('PR');
        });
        
        this.safeAddEventListener('#op-full-btn', 'click', () => {
            this.handleOldPersonTransaction('Full');
        });
        
        this.safeAddEventListener('#op-debt-btn', 'click', () => {
            this.handleOldPersonTransaction('Debt');
        });
        
        // General Entry buttons
        this.safeAddEventListener('#ge-in-btn', 'click', () => {
            this.showAdjustmentOptions(false);
            this.handleGeneralEntry('IN');
        });
        
        this.safeAddEventListener('#ge-out-btn', 'click', () => {
            this.showAdjustmentOptions(false);
            this.handleGeneralEntry('OUT');
        });
        
        // Use event delegation for the adjustment button since it might not be in the DOM initially
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'ge-adjustment-btn') {
                console.log('Adjustment button clicked');
                this.showAdjustmentOptions(true);
            }
        });
        
        // Add event listener for the actual adjustment submission button
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'ge-adjustment-submit-btn') {
                console.log('Adjustment submit button clicked');
                this.handleGeneralEntry('Adjustment');
            }
        });
        
        // Tab switching
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // New person transaction checkboxes
        this.setupCheckboxListeners('np');
        
        // Old person transaction checkboxes
        this.setupCheckboxListeners('op');
        
        // Setup old person customer input listeners for balance display
        this.setupOldPersonCustomerListeners();
    }
    
    setupPageSpecificEventListeners() {
        if (document.querySelector('#login-page')) {
            this.safeAddEventListener('#login-form', 'submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('login-username').value;
                const password = document.getElementById('login-password').value;
                this.login(username, password);
            });
        }
        
        if (document.querySelector('#register-page')) {
            this.safeAddEventListener('#register-form', 'submit', (e) => {
                e.preventDefault();
                const formData = {
                    businessName: document.getElementById('business-name').value,
                    fullName: document.getElementById('full-name').value,
                    username: document.getElementById('username').value,
                    email: document.getElementById('email').value,
                    phone: document.getElementById('phone').value,
                    password: document.getElementById('password').value,
                    confirmPassword: document.getElementById('confirm-password').value,
                };
                
                if (formData.password !== formData.confirmPassword) {
                    this.showToast('Error', 'Passwords do not match', 'error');
                    return;
                }
                
                this.register(formData);
            });
        }
        
        if (document.querySelector('#forgot-password-page')) {
            this.safeAddEventListener('#forgot-password-form', 'submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('reset-email').value;
                this.forgotPassword(email);
            });
        }
        
        if (document.querySelector('#reset-password-page')) {
            this.safeAddEventListener('#reset-password-form', 'submit', (e) => {
                e.preventDefault();
                const formData = {
                    email: document.getElementById('reset-email').value,
                    code: document.getElementById('reset-code').value,
                    newPassword: document.getElementById('new-password').value,
                    confirmPassword: document.getElementById('confirm-new-password').value,
                };
                
                if (formData.newPassword !== formData.confirmPassword) {
                    this.showToast('Error', 'Passwords do not match', 'error');
                    return;
                }
                
                this.resetPassword(formData);
            });
        }
        
        if (document.querySelector('#owner-dashboard')) {
            this.setupOwnerDashboardListeners();
        }
    }
    
    setupOwnerDashboardListeners() {
        this.safeAddEventListener('#admin-settings-btn', 'click', () => {
            this.showAdminSettings();
        });
        
        this.safeAddEventListener('#search-clients', 'input', () => this.filterClients());
        this.safeAddEventListener('#status-filter', 'change', () => this.filterClients());
    }
    
    setupModalEventListeners() {
        if (document.querySelector('#admin-settings-modal')) {
            this.safeAddEventListener('#admin-settings-form', 'submit', (e) => {
                e.preventDefault();
                const formData = {
                    username: document.getElementById('admin-username').value,
                    email: document.getElementById('admin-email').value,
                    currentPassword: document.getElementById('admin-current-password').value,
                    newPassword: document.getElementById('admin-new-password').value,
                    confirmPassword: document.getElementById('admin-confirm-password').value,
                };
                
                if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
                    this.showToast('Error', 'New passwords do not match', 'error');
                    return;
                }
                
                this.updateAdminSettings(formData);
            });
            
            this.safeAddEventListener('#close-admin-settings', 'click', () => this.hideAdminSettings());
            this.safeAddEventListener('#cancel-admin-settings', 'click', () => this.hideAdminSettings());
            this.safeAddEventListener('#admin-settings-modal .modal-overlay', 'click', () => this.hideAdminSettings());
        }
    }
    
    setupAdjustmentEventListeners() {
        // Setup adjustment checkboxes
        const adjustmentOwnerChk = document.getElementById('adjustment-owner-chk');
        const adjustmentCustomerChk = document.getElementById('adjustment-customer-chk');
        
        if (adjustmentOwnerChk) {
            adjustmentOwnerChk.addEventListener('change', () => {
                this.handleAdjustmentCheckboxChange('owner');
            });
        }
        
        if (adjustmentCustomerChk) {
            adjustmentCustomerChk.addEventListener('change', () => {
                this.handleAdjustmentCheckboxChange('customer');
            });
        }
    }
    
    handleAdjustmentCheckboxChange(type) {
        const otherType = type === 'owner' ? 'customer' : 'owner';
        const checkbox = document.getElementById(`adjustment-${type}-chk`);
        const otherCheckbox = document.getElementById(`adjustment-${otherType}-chk`);
        const div = document.getElementById(`adjustment-${type}-div`);
        const otherDiv = document.getElementById(`adjustment-${otherType}-div`);
        
        if (checkbox.checked) {
            div.style.display = 'block';
            otherCheckbox.checked = false;
            otherDiv.style.display = 'none';
        } else {
            div.style.display = 'none';
        }
    }
    
    async filterClients() {
        const searchClientsEl = document.getElementById('search-clients');
        const statusFilterEl = document.getElementById('status-filter');
        
        if (!searchClientsEl || !statusFilterEl) return;
        
        const searchTerm = searchClientsEl.value;
        const statusFilter = statusFilterEl.value;
        
        try {
            const clients = await this.apiCall('/api/owner/clients', 'GET');
            let filteredClients = clients;
            
            if (searchTerm) {
                filteredClients = filteredClients.filter(client => 
                    client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    client.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    client.email.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            
            if (statusFilter) {
                filteredClients = filteredClients.filter(client => 
                    client.accountStatus === statusFilter
                );
            }
            
            this.updateClientsTable(filteredClients);
        } catch (error) {
            console.error('Failed to filter clients:', error);
        }
    }
}
// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CashBookApp();
});