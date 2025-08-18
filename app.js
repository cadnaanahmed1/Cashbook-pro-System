// CashBook Pro - Enhanced Multi-Currency Vanilla JavaScript Frontend

class CashBookApp {
    constructor() {
        this.currentUser = null;
        this.API_BASE = 'http://localhost:5000';
        this.currencies = this.initializeCurrencies();
        this.exchangeRates = {};
        this.editingTransaction = null;
        this.init();
    }

    init() {
        this.loadExchangeRates();
        this.setupEventListeners();
        this.checkAuthentication();
    }

    // Initialize supported currencies with realistic exchange rates
    initializeCurrencies() {
        return {
            'USD': { name: 'US Dollar', symbol: '$', baseRate: 1.0000 },
            'EUR': { name: 'Euro', symbol: '€', baseRate: 0.8500 },
            'GBP': { name: 'British Pound', symbol: '£', baseRate: 0.7800 },
            'UGX': { name: 'Ugandan Shilling', symbol: 'USh', baseRate: 3750.0000 },
            'SOS': { name: 'Somali Shilling', symbol: 'S', baseRate: 575.0000 },
            'KES': { name: 'Kenyan Shilling', symbol: 'KSh', baseRate: 130.0000 },
            'ETB': { name: 'Ethiopian Birr', symbol: 'Br', baseRate: 55.0000 },
            'DJF': { name: 'Djibouti Franc', symbol: 'Fdj', baseRate: 177.7000 },
            'ERN': { name: 'Eritrean Nakfa', symbol: 'Nfk', baseRate: 15.0000 },
            'SDG': { name: 'Sudanese Pound', symbol: 'SDG', baseRate: 600.0000 }
        };
    }

    // Load realistic exchange rates with small profit margins
    loadExchangeRates() {
        Object.keys(this.currencies).forEach(fromCurrency => {
            this.exchangeRates[fromCurrency] = {};
            Object.keys(this.currencies).forEach(toCurrency => {
                if (fromCurrency === toCurrency) {
                    this.exchangeRates[fromCurrency][toCurrency] = 1.0000;
                } else {
                    // Calculate base rate
                    const baseRate = this.currencies[toCurrency].baseRate / this.currencies[fromCurrency].baseRate;
                    // Add small realistic profit margin (1-3%)
                    const profitMargin = 1 + (Math.random() * 0.02 + 0.01);
                    this.exchangeRates[fromCurrency][toCurrency] = parseFloat((baseRate * profitMargin).toFixed(4));
                }
            });
        });
    }

    // API Helper Methods
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        // Add auth token if available
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
            this.showToast('Success', 'Reset code sent (check console in demo mode)!', 'success');
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
            // Update current user data
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
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.add('hidden');
        });
        
        // Show selected page
        document.getElementById(pageId).classList.remove('hidden');
        
        // Show/hide navbar based on authentication
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
                this.loadClientDashboard();
                this.showPage('client-dashboard');
            }
        }
    }

    // Dashboard Loading Methods
    async loadOwnerDashboard() {
        try {
            // Load owner stats
            const stats = await this.apiCall('/api/owner/stats');
            this.updateOwnerStats(stats);
            
            // Load clients
            const clients = await this.apiCall('/api/owner/clients');
            this.updateClientsTable(clients);
        } catch (error) {
            console.error('Failed to load owner dashboard:', error);
        }
    }

    async loadClientDashboard() {
        try {
            // Load client stats
            const stats = await this.apiCall('/api/client/stats');
            this.updateClientStats(stats);
            
            // Load balance
            const balance = await this.apiCall('/api/client/balance');
            this.updateClientBalance(balance);
            
            // Load transactions
            const transactions = await this.apiCall('/api/client/transactions');
            this.updateTransactionsTable(transactions);
            
            // Update account status
            this.updateAccountStatus();
        } catch (error) {
            console.error('Failed to load client dashboard:', error);
        }
    }

    // Data Update Methods
    updateUserData() {
        if (this.currentUser) {
            const userInfo = `${this.currentUser.fullName} (${this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1)})`;
            document.getElementById('user-info').textContent = userInfo;
            
            // Show/hide admin settings button
            const adminBtn = document.getElementById('admin-settings-btn');
            if (this.currentUser.role === 'owner') {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }
    }

    updateOwnerStats(stats) {
        document.getElementById('total-clients').textContent = stats.totalClients || 0;
        document.getElementById('active-clients').textContent = stats.activeClients || 0;
        document.getElementById('pending-payments').textContent = stats.pendingPayments || 0;
        document.getElementById('monthly-revenue').textContent = `$${stats.monthlyRevenue || 0}`;
    }

    updateClientStats(stats) {
        document.getElementById('today-profit').textContent = this.formatCurrency(stats.todayProfit || 0, 'USD');
        document.getElementById('transaction-count').textContent = stats.transactionCount || 0;
    }

    updateClientBalance(balance) {
        document.getElementById('usd-balance').textContent = this.formatCurrency(balance.usdBalance || 0, 'USD');
        document.getElementById('ugx-balance').textContent = this.formatCurrency(balance.ugxBalance || 0, 'UGX');
    }

    updateAccountStatus() {
        if (!this.currentUser) return;
        
        const statusElement = document.getElementById('current-status');
        const subscriptionElement = document.getElementById('subscription-end');
        const daysElement = document.getElementById('days-remaining');
        
        if (statusElement) {
            statusElement.textContent = this.currentUser.accountStatus.charAt(0).toUpperCase() + this.currentUser.accountStatus.slice(1);
            statusElement.className = `status-badge ${this.currentUser.accountStatus}`;
        }
        
        if (subscriptionElement) {
            subscriptionElement.textContent = this.currentUser.subscriptionEnd ? 
                new Date(this.currentUser.subscriptionEnd).toLocaleDateString() : 'N/A';
        }
        
        if (daysElement) {
            daysElement.textContent = this.getDaysRemaining();
        }
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

    updateTransactionsTable(transactions) {
        const tbody = document.getElementById('transactions-tbody');
        tbody.innerHTML = '';
        
        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #64748b;">No transactions found</td></tr>';
            return;
        }
        
        transactions.forEach(tx => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatDateTime(tx.createdAt)}</td>
                <td>${tx.customerName}</td>
                <td>
                    <span class="status-badge info">
                        ${tx.fromCurrency} → ${tx.toCurrency}
                    </span>
                </td>
                <td>${this.formatCurrency(tx.fromAmount, tx.fromCurrency)}</td>
                <td>${tx.exchangeRate.toLocaleString()}</td>
                <td>${this.formatCurrency(tx.toAmount, tx.toCurrency)}</td>
                <td>${this.formatCurrency(tx.profitUSD, 'USD')}</td>
                <td>${tx.notes || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" onclick="app.editTransaction('${tx.id}')">Edit</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updateCurrencyBalances(balances) {
        const container = document.getElementById('currency-balances');
        container.innerHTML = '';
        
        if (!balances || Object.keys(balances).length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 2rem;">No currency balances found</div>';
            return;
        }
        
        Object.entries(balances).forEach(([currency, amount]) => {
            if (amount > 0) {
                const currencyItem = document.createElement('div');
                currencyItem.className = 'currency-item';
                currencyItem.innerHTML = `
                    <div class="currency-code">${currency}</div>
                    <div class="currency-amount">${this.formatCurrency(amount, currency)}</div>
                `;
                container.appendChild(currencyItem);
            }
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

    async addTransaction(formData) {
        try {
            // Calculate exchange details
            const exchangeCalc = this.calculateExchange(
                formData.fromAmount, 
                formData.fromCurrency, 
                formData.toCurrency, 
                formData.profitMargin
            );
            
            const transactionData = {
                customerName: formData.customerName,
                fromCurrency: formData.fromCurrency,
                toCurrency: formData.toCurrency,
                fromAmount: formData.fromAmount,
                toAmount: exchangeCalc.toAmount,
                exchangeRate: exchangeCalc.rate,
                profitUSD: exchangeCalc.profitUSD,
                notes: formData.notes,
                createdAt: new Date().toISOString()
            };
            
            await this.apiCall('/api/client/transactions', 'POST', transactionData);
            this.showToast('Success', 'Transaction added successfully', 'success');
            this.hideAddTransaction();
            this.loadClientDashboard();
        } catch (error) {
            // Error already shown by apiCall
        }
    }

    async editTransaction(transactionId) {
        try {
            const transaction = await this.apiCall(`/api/client/transactions/${transactionId}`);
            this.editingTransaction = transaction;
            
            // Pre-fill edit form
            document.getElementById('edit-transaction-id').value = transaction.id;
            document.getElementById('edit-customer-name').value = transaction.customerName;
            document.getElementById('edit-from-currency').value = transaction.fromCurrency;
            document.getElementById('edit-to-currency').value = transaction.toCurrency;
            document.getElementById('edit-from-amount').value = transaction.fromAmount;
            document.getElementById('edit-exchange-rate').value = transaction.exchangeRate;
            document.getElementById('edit-to-amount').value = transaction.toAmount;
            document.getElementById('edit-profit-margin').value = ((transaction.exchangeRate / this.exchangeRates[transaction.fromCurrency][transaction.toCurrency] - 1) * 100).toFixed(2);
            document.getElementById('edit-notes').value = transaction.notes || '';
            
            this.showEditTransaction();
        } catch (error) {
            // Error already shown by apiCall
        }
    }

    async updateTransaction(formData) {
        try {
            const exchangeCalc = this.calculateExchange(
                formData.fromAmount, 
                formData.fromCurrency, 
                formData.toCurrency, 
                formData.profitMargin
            );
            
            const transactionData = {
                id: formData.id,
                customerName: formData.customerName,
                fromCurrency: formData.fromCurrency,
                toCurrency: formData.toCurrency,
                fromAmount: formData.fromAmount,
                toAmount: exchangeCalc.toAmount,
                exchangeRate: exchangeCalc.rate,
                profitUSD: exchangeCalc.profitUSD,
                notes: formData.notes,
                updatedAt: new Date().toISOString()
            };
            
            await this.apiCall(`/api/client/transactions/${formData.id}`, 'PUT', transactionData);
            this.showToast('Success', 'Transaction updated successfully', 'success');
            this.hideEditTransaction();
            this.loadClientDashboard();
        } catch (error) {
            // Error already shown by apiCall
        }
    }

    async resetTodayProfit() {
        if (confirm('Are you sure you want to reset today\'s profit? This action cannot be undone.')) {
            try {
                await this.apiCall('/api/client/reset-profit', 'POST');
                this.showToast('Success', 'Today\'s profit has been reset', 'success');
                this.loadClientDashboard();
            } catch (error) {
                // Error already shown by apiCall
            }
        }
    }

    async addCurrency(formData) {
        try {
            await this.apiCall('/api/client/currencies', 'POST', formData);
            this.showToast('Success', 'Currency balance added successfully', 'success');
            this.hideAddCurrency();
            this.loadClientDashboard();
        } catch (error) {
            // Error already shown by apiCall
        }
    }

    async generateReport(formData) {
        try {
            const reportData = {
                startDate: formData.startDate,
                endDate: formData.endDate,
                format: formData.format,
                includeProfit: formData.includeProfit,
                includeCurrency: formData.includeCurrency,
                includeCustomers: formData.includeCustomers
            };
            
            this.showLoading();
            const response = await fetch(`${this.API_BASE}/api/client/reports/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('cashbook_token')}`
                },
                body: JSON.stringify(reportData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `cashbook-report-${formData.startDate}-to-${formData.endDate}.${formData.format === 'pdf' ? 'pdf' : 'xlsx'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.hideLoading();
            this.showToast('Success', 'Report generated successfully', 'success');
            this.hideGenerateReport();
        } catch (error) {
            this.hideLoading();
            this.showToast('Error', error.message, 'error');
        }
    }

    // Modal Methods
    showAdminSettings() {
        const modal = document.getElementById('admin-settings-modal');
        modal.classList.remove('hidden');
        
        // Pre-fill form with current user data
        document.getElementById('admin-username').value = this.currentUser.username;
        document.getElementById('admin-email').value = this.currentUser.email;
    }

    hideAdminSettings() {
        const modal = document.getElementById('admin-settings-modal');
        modal.classList.add('hidden');
        
        // Clear form
        document.getElementById('admin-settings-form').reset();
    }

    showAddTransaction() {
        const modal = document.getElementById('add-transaction-modal');
        modal.classList.remove('hidden');
    }

    hideAddTransaction() {
        const modal = document.getElementById('add-transaction-modal');
        modal.classList.add('hidden');
        
        // Clear form
        document.getElementById('add-transaction-form').reset();
    }

    showUpdateBalance() {
        const modal = document.getElementById('update-balance-modal');
        modal.classList.remove('hidden');
        
        // Pre-fill with current balance
        document.getElementById('usd-balance-input').value = this.formatCurrency(0, 'USD').replace(/[$,]/g, '');
        document.getElementById('ugx-balance-input').value = 0;
    }

    hideUpdateBalance() {
        const modal = document.getElementById('update-balance-modal');
        modal.classList.add('hidden');
        
        // Clear form
        document.getElementById('update-balance-form').reset();
    }

    showEditTransaction() {
        const modal = document.getElementById('edit-transaction-modal');
        modal.classList.remove('hidden');
    }

    hideEditTransaction() {
        const modal = document.getElementById('edit-transaction-modal');
        modal.classList.add('hidden');
        this.editingTransaction = null;
        
        // Clear form
        document.getElementById('edit-transaction-form').reset();
    }

    showAddCurrency() {
        const modal = document.getElementById('add-currency-modal');
        modal.classList.remove('hidden');
    }

    hideAddCurrency() {
        const modal = document.getElementById('add-currency-modal');
        modal.classList.add('hidden');
        
        // Clear form
        document.getElementById('add-currency-form').reset();
    }

    showGenerateReport() {
        const modal = document.getElementById('generate-report-modal');
        modal.classList.remove('hidden');
        
        // Set default dates (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        document.getElementById('report-start-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('report-end-date').value = endDate.toISOString().split('T')[0];
    }

    hideGenerateReport() {
        const modal = document.getElementById('generate-report-modal');
        modal.classList.add('hidden');
        
        // Clear form
        document.getElementById('generate-report-form').reset();
    }

    // Enhanced exchange calculator
    updateExchangeCalculator() {
        const fromAmount = parseFloat(document.getElementById('from-amount').value) || 0;
        const fromCurrency = document.getElementById('from-currency').value;
        const toCurrency = document.getElementById('to-currency').value;
        
        if (fromAmount > 0 && fromCurrency && toCurrency) {
            const exchangeCalc = this.calculateExchange(fromAmount, fromCurrency, toCurrency, 2.0);
            
            document.getElementById('to-amount').value = exchangeCalc.toAmount.toFixed(4);
            document.getElementById('current-rate').textContent = exchangeCalc.rate.toFixed(4);
            document.getElementById('calculated-profit').textContent = this.formatCurrency(exchangeCalc.profitUSD, 'USD');
        } else {
            document.getElementById('to-amount').value = '';
            document.getElementById('current-rate').textContent = '0.00';
            document.getElementById('calculated-profit').textContent = '$0.00';
        }
    }

    // Enhanced transaction form calculator
    updateTransactionCalculator(formPrefix = '') {
        const prefix = formPrefix ? formPrefix + '-' : '';
        const fromAmount = parseFloat(document.getElementById(prefix + 'from-amount-tx').value) || 0;
        const fromCurrency = document.getElementById(prefix + 'from-currency-tx').value;
        const toCurrency = document.getElementById(prefix + 'to-currency-tx').value;
        const profitMargin = parseFloat(document.getElementById(prefix + 'profit-margin-tx').value) || 2.0;
        
        if (fromAmount > 0 && fromCurrency && toCurrency) {
            const exchangeCalc = this.calculateExchange(fromAmount, fromCurrency, toCurrency, profitMargin);
            
            document.getElementById(prefix + 'to-amount-tx').value = exchangeCalc.toAmount.toFixed(4);
            document.getElementById(prefix + 'exchange-rate-tx').value = exchangeCalc.rate.toFixed(4);
            document.getElementById(prefix + 'expected-profit-tx').textContent = this.formatCurrency(exchangeCalc.profitUSD, 'USD');
        }
    }

    // Enhanced Multi-Currency Utility Methods
    formatCurrency(amount, currency) {
        const currencyInfo = this.currencies[currency];
        if (!currencyInfo) return `${amount}`;
        
        if (['USD', 'EUR', 'GBP'].includes(currency)) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
            }).format(amount);
        }
        
        return `${currencyInfo.symbol} ${new Intl.NumberFormat().format(amount)}`;
    }

    // Calculate exchange amount with realistic rates
    calculateExchange(fromAmount, fromCurrency, toCurrency, profitMargin = 2.0) {
        const baseRate = this.exchangeRates[fromCurrency]?.[toCurrency] || 1;
        const adjustedRate = baseRate * (1 + profitMargin / 100);
        const toAmount = fromAmount * adjustedRate;
        const profit = (toAmount - (fromAmount * baseRate)) * 0.5; // 50% of margin as profit
        
        return {
            toAmount: parseFloat(toAmount.toFixed(4)),
            rate: parseFloat(adjustedRate.toFixed(4)),
            profit: parseFloat(profit.toFixed(4)),
            profitUSD: toCurrency === 'USD' ? profit : profit / (this.exchangeRates[toCurrency]?.['USD'] || 1)
        };
    }

    // Format full date and time
    formatDateTime(date) {
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    // Copy to clipboard utility
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Success', 'Copied to clipboard!', 'success');
        }).catch(() => {
            this.showToast('Error', 'Failed to copy to clipboard', 'error');
        });
    }

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

    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showToast(title, message, type = 'success') {
        const container = document.getElementById('toast-container');
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
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        // Manual close
        toast.querySelector('.toast-close').addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    // Event Listeners
    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            this.login(username, password);
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', (e) => {
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

        // Forgot password form
        document.getElementById('forgot-password-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('reset-email').value;
            this.forgotPassword(email);
        });

        // Reset password form
        document.getElementById('reset-password-form').addEventListener('submit', (e) => {
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

        // Admin settings form
        document.getElementById('admin-settings-form').addEventListener('submit', (e) => {
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

        // Add transaction form
        document.getElementById('add-transaction-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                customerName: document.getElementById('customer-name').value,
                fromCurrency: document.getElementById('from-currency-tx').value,
                toCurrency: document.getElementById('to-currency-tx').value,
                fromAmount: parseFloat(document.getElementById('from-amount-tx').value),
                profitMargin: parseFloat(document.getElementById('profit-margin-tx').value),
                notes: document.getElementById('notes-tx').value,
            };
            
            this.addTransaction(formData);
        });

        // Edit transaction form
        document.getElementById('edit-transaction-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                id: document.getElementById('edit-transaction-id').value,
                customerName: document.getElementById('edit-customer-name').value,
                fromCurrency: document.getElementById('edit-from-currency').value,
                toCurrency: document.getElementById('edit-to-currency').value,
                fromAmount: parseFloat(document.getElementById('edit-from-amount').value),
                profitMargin: parseFloat(document.getElementById('edit-profit-margin').value),
                notes: document.getElementById('edit-notes').value,
            };
            
            this.updateTransaction(formData);
        });

        // Add currency form
        document.getElementById('add-currency-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                currency: document.getElementById('currency-select').value,
                amount: parseFloat(document.getElementById('currency-amount').value),
            };
            
            this.addCurrency(formData);
        });

        // Generate report form
        document.getElementById('generate-report-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                startDate: document.getElementById('report-start-date').value,
                endDate: document.getElementById('report-end-date').value,
                format: document.getElementById('report-format').value,
                includeProfit: document.getElementById('include-profit').checked,
                includeCurrency: document.getElementById('include-currency').checked,
                includeCustomers: document.getElementById('include-customers').checked,
            };
            
            this.generateReport(formData);
        });

        // Update balance form
        document.getElementById('update-balance-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                usdBalance: parseFloat(document.getElementById('usd-balance-input').value),
                ugxBalance: parseFloat(document.getElementById('ugx-balance-input').value),
            };
            
            this.updateBalance(formData);
        });

        // Navigation links
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegister();
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });

        document.getElementById('show-forgot-password').addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('forgot-password-page');
        });

        document.getElementById('back-to-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLogin();
        });

        document.getElementById('back-to-forgot').addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('forgot-password-page');
        });

        // Buttons
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('admin-settings-btn').addEventListener('click', () => {
            this.showAdminSettings();
        });

        document.getElementById('add-transaction-btn').addEventListener('click', () => {
            this.showAddTransaction();
        });

        document.getElementById('update-balance-btn').addEventListener('click', () => {
            this.showUpdateBalance();
        });

        document.getElementById('reset-profit-btn').addEventListener('click', () => {
            this.resetTodayProfit();
        });

        document.getElementById('add-currency-btn').addEventListener('click', () => {
            this.showAddCurrency();
        });

        document.getElementById('generate-report-btn').addEventListener('click', () => {
            this.showGenerateReport();
        });

        document.getElementById('back-to-dashboard').addEventListener('click', () => {
            this.showDashboard();
        });

        // Modal controls
        document.getElementById('close-admin-settings').addEventListener('click', () => {
            this.hideAdminSettings();
        });

        document.getElementById('cancel-admin-settings').addEventListener('click', () => {
            this.hideAdminSettings();
        });

        document.getElementById('close-add-transaction').addEventListener('click', () => {
            this.hideAddTransaction();
        });

        document.getElementById('cancel-add-transaction').addEventListener('click', () => {
            this.hideAddTransaction();
        });

        document.getElementById('close-update-balance').addEventListener('click', () => {
            this.hideUpdateBalance();
        });

        document.getElementById('cancel-update-balance').addEventListener('click', () => {
            this.hideUpdateBalance();
        });

        // Edit transaction modal controls
        document.getElementById('close-edit-transaction').addEventListener('click', () => {
            this.hideEditTransaction();
        });

        document.getElementById('cancel-edit-transaction').addEventListener('click', () => {
            this.hideEditTransaction();
        });

        // Add currency modal controls
        document.getElementById('close-add-currency').addEventListener('click', () => {
            this.hideAddCurrency();
        });

        document.getElementById('cancel-add-currency').addEventListener('click', () => {
            this.hideAddCurrency();
        });

        // Generate report modal controls
        document.getElementById('close-generate-report').addEventListener('click', () => {
            this.hideGenerateReport();
        });

        document.getElementById('cancel-generate-report').addEventListener('click', () => {
            this.hideGenerateReport();
        });

        // Modal overlay clicks
        document.querySelector('#admin-settings-modal .modal-overlay').addEventListener('click', () => {
            this.hideAdminSettings();
        });

        document.querySelector('#add-transaction-modal .modal-overlay').addEventListener('click', () => {
            this.hideAddTransaction();
        });

        document.querySelector('#update-balance-modal .modal-overlay').addEventListener('click', () => {
            this.hideUpdateBalance();
        });

        document.querySelector('#edit-transaction-modal .modal-overlay').addEventListener('click', () => {
            this.hideEditTransaction();
        });

        document.querySelector('#add-currency-modal .modal-overlay').addEventListener('click', () => {
            this.hideAddCurrency();
        });

        document.querySelector('#generate-report-modal .modal-overlay').addEventListener('click', () => {
            this.hideGenerateReport();
        });

        // Enhanced calculator event listeners
        document.getElementById('from-amount').addEventListener('input', () => {
            this.updateExchangeCalculator();
        });

        document.getElementById('from-currency').addEventListener('change', () => {
            this.updateExchangeCalculator();
        });

        document.getElementById('to-currency').addEventListener('change', () => {
            this.updateExchangeCalculator();
        });

        // Transaction form calculators
        document.getElementById('from-amount-tx').addEventListener('input', () => {
            this.updateTransactionCalculator();
        });

        document.getElementById('from-currency-tx').addEventListener('change', () => {
            this.updateTransactionCalculator();
        });

        document.getElementById('to-currency-tx').addEventListener('change', () => {
            this.updateTransactionCalculator();
        });

        document.getElementById('profit-margin-tx').addEventListener('input', () => {
            this.updateTransactionCalculator();
        });

        // Edit transaction form calculators
        document.getElementById('edit-from-amount').addEventListener('input', () => {
            this.updateTransactionCalculator('edit');
        });

        document.getElementById('edit-from-currency').addEventListener('change', () => {
            this.updateTransactionCalculator('edit');
        });

        document.getElementById('edit-to-currency').addEventListener('change', () => {
            this.updateTransactionCalculator('edit');
        });

        document.getElementById('edit-profit-margin').addEventListener('input', () => {
            this.updateTransactionCalculator('edit');
        });

        // Search and filter
        document.getElementById('search-clients').addEventListener('input', (e) => {
            this.filterClients();
        });

        document.getElementById('status-filter').addEventListener('change', (e) => {
            this.filterClients();
        });
    }

    async filterClients() {
        const searchTerm = document.getElementById('search-clients').value;
        const statusFilter = document.getElementById('status-filter').value;
        
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