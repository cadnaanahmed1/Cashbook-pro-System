const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5000', 'http://0.0.0.0:5000'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// Enhanced In-Memory Database for Multi-Currency Support
const users = [];
const transactions = [];
const balances = [];
const passwordResets = [];

// JWT Secret
const JWT_SECRET = 'cashbook-pro-enhanced-secret';

// Enhanced Multi-Currency Support
const supportedCurrencies = {
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

// Helper Functions
const generateToken = (user) => {
    return jwt.sign(
        { 
            userId: user.id, 
            username: user.username, 
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

const generateResetCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateId = (prefix = 'id') => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Enhanced date handling
const getCurrentDateTime = () => {
    return new Date().toISOString();
};

const isToday = (date) => {
    const today = new Date();
    const checkDate = new Date(date);
    return today.toDateString() === checkDate.toDateString();
};

// Currency conversion helper
const convertCurrency = (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;
    const baseAmount = amount / supportedCurrencies[fromCurrency].baseRate;
    return baseAmount * supportedCurrencies[toCurrency].baseRate;
};

// Middleware Functions
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

const requireOwner = (req, res, next) => {
    if (req.user.role !== 'owner') {
        return res.status(403).json({ message: 'Owner access required' });
    }
    next();
};

const requireActiveAccount = async (req, res, next) => {
    if (req.user.role === 'owner') {
        return next();
    }

    const user = users.find(u => u.id === req.user.userId);
    if (!user || user.accountStatus !== 'active') {
        return res.status(403).json({ 
            message: 'Account is not active. Please complete your subscription payment.',
            accountStatus: user?.accountStatus || 'inactive'
        });
    }
    next();
};

// Initialize Enhanced Demo Data
const initializeDemoData = () => {
    // Create default owner account
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    users.push({
        id: 'user_1',
        username: 'admin',
        email: 'admin@cashbookpro.com',
        password: hashedPassword,
        role: 'owner',
        fullName: 'System Administrator',
        accountStatus: 'active',
        createdAt: getCurrentDateTime(),
        updatedAt: getCurrentDateTime()
    });

    // Create enhanced demo client
    const clientPassword = bcrypt.hashSync('client123', 10);
    const demoClient = {
        id: 'user_2',
        username: 'democlient',
        email: 'client@demo.com',
        password: clientPassword,
        role: 'client',
        businessName: 'Multi-Currency Exchange Demo',
        fullName: 'Demo Client',
        phone: '+256700123456',
        accountStatus: 'active',
        subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastPayment: new Date(),
        createdAt: getCurrentDateTime(),
        updatedAt: getCurrentDateTime()
    };
    users.push(demoClient);

    // Create enhanced multi-currency balance for demo client
    const demoBalance = {
        id: 'balance_1',
        clientId: 'user_2',
        currencies: {
            'USD': 1000.00,
            'EUR': 850.00,
            'GBP': 780.00,
            'UGX': 3750000.00,
            'SOS': 575000.00,
            'KES': 130000.00,
            'ETB': 55000.00,
            'DJF': 177700.00,
            'ERN': 15000.00,
            'SDG': 600000.00
        },
        updatedAt: getCurrentDateTime()
    };
    balances.push(demoBalance);

    // Add sample multi-currency transactions
    const sampleTransactions = [
        {
            id: generateId('tx'),
            clientId: 'user_2',
            customerName: 'John Doe',
            fromCurrency: 'USD',
            toCurrency: 'UGX',
            fromAmount: 100.00,
            toAmount: 375000.00,
            exchangeRate: 3750.00,
            profitUSD: 5.00,
            notes: 'Tourism exchange',
            createdAt: getCurrentDateTime(),
            updatedAt: getCurrentDateTime()
        },
        {
            id: generateId('tx'),
            clientId: 'user_2',
            customerName: 'Maria Garcia',
            fromCurrency: 'EUR',
            toCurrency: 'KES',
            fromAmount: 200.00,
            toAmount: 26520.00,
            exchangeRate: 132.60,
            profitUSD: 8.50,
            notes: 'Business transfer',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
    ];
    transactions.push(...sampleTransactions);

    console.log('Enhanced demo data initialized');
    console.log('Multi-currency support: USD, EUR, GBP, UGX, SOS, KES, ETB, DJF, ERN, SDG');
    console.log('Default owner - Username: admin, Password: admin123');
    console.log('Demo client - Username: democlient, Password: client123');
};

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = users.find(u => 
            u.username === username || u.email === username
        );

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user);
        const userResponse = { ...user };
        delete userResponse.password;

        res.json({
            token,
            user: userResponse,
            message: 'Login successful'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { businessName, fullName, username, email, phone, password } = req.body;

        // Check if user already exists
        if (users.find(u => u.username === username || u.email === email)) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = {
            id: generateId('user'),
            username,
            email,
            password: hashedPassword,
            role: 'client',
            businessName,
            fullName,
            phone,
            accountStatus: 'pending',
            createdAt: getCurrentDateTime(),
            updatedAt: getCurrentDateTime()
        };

        users.push(newUser);

        // Create initial empty balance
        balances.push({
            id: generateId('balance'),
            clientId: newUser.id,
            currencies: {},
            updatedAt: getCurrentDateTime()
        });

        const token = generateToken(newUser);
        const userResponse = { ...newUser };
        delete userResponse.password;

        res.status(201).json({
            token,
            user: userResponse,
            message: 'Account created successfully. Please complete payment to activate.'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetCode = generateResetCode();
        const resetEntry = {
            email,
            code: resetCode,
            expires: new Date(Date.now() + 15 * 60 * 1000),
            used: false
        };

        passwordResets.push(resetEntry);
        console.log(`Password reset code for ${email}: ${resetCode}`);

        res.json({ message: 'Reset code sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during password reset' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        const resetEntry = passwordResets.find(r => 
            r.email === email && 
            r.code === code && 
            !r.used && 
            new Date() < new Date(r.expires)
        );

        if (!resetEntry) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }

        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = bcrypt.hashSync(newPassword, 10);
        user.updatedAt = getCurrentDateTime();
        resetEntry.used = true;

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during password reset' });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const userResponse = { ...user };
    delete userResponse.password;
    res.json({ user: userResponse });
});

app.put('/api/auth/admin-settings', authenticateToken, requireOwner, async (req, res) => {
    try {
        const { username, email, currentPassword, newPassword } = req.body;
        const user = users.find(u => u.id === req.user.userId);

        if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        if (username !== user.username && users.find(u => u.username === username && u.id !== user.id)) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        if (email !== user.email && users.find(u => u.email === email && u.id !== user.id)) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        user.username = username;
        user.email = email;
        if (newPassword) {
            user.password = bcrypt.hashSync(newPassword, 10);
        }
        user.updatedAt = getCurrentDateTime();

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during settings update' });
    }
});

// Owner Routes
app.get('/api/owner/stats', authenticateToken, requireOwner, (req, res) => {
    const totalClients = users.filter(u => u.role === 'client').length;
    const activeClients = users.filter(u => u.role === 'client' && u.accountStatus === 'active').length;
    const pendingPayments = users.filter(u => u.role === 'client' && u.accountStatus === 'pending').length;
    
    // Calculate monthly revenue (simplified)
    const monthlyRevenue = activeClients * 29.99;

    res.json({
        totalClients,
        activeClients,
        pendingPayments,
        monthlyRevenue
    });
});

app.get('/api/owner/clients', authenticateToken, requireOwner, (req, res) => {
    const clients = users.filter(u => u.role === 'client').map(user => {
        const userResponse = { ...user };
        delete userResponse.password;
        return userResponse;
    });

    res.json(clients);
});

app.post('/api/owner/verify-payment/:clientId', authenticateToken, requireOwner, (req, res) => {
    const user = users.find(u => u.id === req.params.clientId && u.role === 'client');
    
    if (!user) {
        return res.status(404).json({ message: 'Client not found' });
    }

    user.accountStatus = 'active';
    user.subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.lastPayment = new Date();
    user.updatedAt = getCurrentDateTime();

    res.json({ message: 'Payment verified and account activated' });
});

app.post('/api/owner/suspend/:clientId', authenticateToken, requireOwner, (req, res) => {
    const user = users.find(u => u.id === req.params.clientId && u.role === 'client');
    
    if (!user) {
        return res.status(404).json({ message: 'Client not found' });
    }

    user.accountStatus = 'suspended';
    user.updatedAt = getCurrentDateTime();

    res.json({ message: 'Client account suspended' });
});

// Enhanced Client Routes
app.get('/api/client/stats', authenticateToken, requireActiveAccount, (req, res) => {
    const clientTransactions = transactions.filter(t => 
        t.clientId === req.user.userId && isToday(t.createdAt)
    );
    
    const todayProfit = clientTransactions.reduce((sum, t) => sum + (t.profitUSD || 0), 0);
    const transactionCount = clientTransactions.length;

    res.json({
        todayProfit,
        transactionCount
    });
});

app.get('/api/client/balance', authenticateToken, requireActiveAccount, (req, res) => {
    const balance = balances.find(b => b.clientId === req.user.userId);
    
    if (!balance) {
        return res.json({ currencies: {} });
    }

    res.json(balance.currencies || {});
});

app.post('/api/client/currencies', authenticateToken, requireActiveAccount, (req, res) => {
    try {
        const { currency, amount } = req.body;
        
        if (!supportedCurrencies[currency]) {
            return res.status(400).json({ message: 'Unsupported currency' });
        }

        let balance = balances.find(b => b.clientId === req.user.userId);
        
        if (!balance) {
            balance = {
                id: generateId('balance'),
                clientId: req.user.userId,
                currencies: {},
                updatedAt: getCurrentDateTime()
            };
            balances.push(balance);
        }

        balance.currencies[currency] = (balance.currencies[currency] || 0) + amount;
        balance.updatedAt = getCurrentDateTime();

        res.json({ message: 'Currency balance updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error updating currency balance' });
    }
});

app.get('/api/client/transactions', authenticateToken, requireActiveAccount, (req, res) => {
    const clientTransactions = transactions.filter(t => t.clientId === req.user.userId);
    res.json(clientTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/client/transactions/:id', authenticateToken, requireActiveAccount, (req, res) => {
    const transaction = transactions.find(t => 
        t.id === req.params.id && t.clientId === req.user.userId
    );
    
    if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
});

app.post('/api/client/transactions', authenticateToken, requireActiveAccount, (req, res) => {
    try {
        const {
            customerName,
            fromCurrency,
            toCurrency,
            fromAmount,
            toAmount,
            exchangeRate,
            profitUSD,
            notes
        } = req.body;

        if (!supportedCurrencies[fromCurrency] || !supportedCurrencies[toCurrency]) {
            return res.status(400).json({ message: 'Unsupported currency' });
        }

        const newTransaction = {
            id: generateId('tx'),
            clientId: req.user.userId,
            customerName,
            fromCurrency,
            toCurrency,
            fromAmount: parseFloat(fromAmount),
            toAmount: parseFloat(toAmount),
            exchangeRate: parseFloat(exchangeRate),
            profitUSD: parseFloat(profitUSD),
            notes: notes || '',
            createdAt: getCurrentDateTime(),
            updatedAt: getCurrentDateTime()
        };

        transactions.push(newTransaction);

        res.status(201).json({
            message: 'Transaction created successfully',
            transaction: newTransaction
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error creating transaction' });
    }
});

app.put('/api/client/transactions/:id', authenticateToken, requireActiveAccount, (req, res) => {
    try {
        const transaction = transactions.find(t => 
            t.id === req.params.id && t.clientId === req.user.userId
        );
        
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const {
            customerName,
            fromCurrency,
            toCurrency,
            fromAmount,
            toAmount,
            exchangeRate,
            profitUSD,
            notes
        } = req.body;

        transaction.customerName = customerName;
        transaction.fromCurrency = fromCurrency;
        transaction.toCurrency = toCurrency;
        transaction.fromAmount = parseFloat(fromAmount);
        transaction.toAmount = parseFloat(toAmount);
        transaction.exchangeRate = parseFloat(exchangeRate);
        transaction.profitUSD = parseFloat(profitUSD);
        transaction.notes = notes || '';
        transaction.updatedAt = getCurrentDateTime();

        res.json({
            message: 'Transaction updated successfully',
            transaction
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error updating transaction' });
    }
});

app.post('/api/client/reset-profit', authenticateToken, requireActiveAccount, (req, res) => {
    try {
        // In a real implementation, this might mark transactions as "profit reset"
        // For demo purposes, we'll just acknowledge the reset
        res.json({ 
            message: 'Today\'s profit has been reset successfully',
            resetAt: getCurrentDateTime()
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error resetting profit' });
    }
});

// Enhanced Report Generation (Simplified for demo)
app.post('/api/client/reports/generate', authenticateToken, requireActiveAccount, (req, res) => {
    try {
        const { startDate, endDate, format, includeProfit, includeCurrency, includeCustomers } = req.body;
        
        const clientTransactions = transactions.filter(t => {
            const txDate = new Date(t.createdAt);
            const start = new Date(startDate);
            const end = new Date(endDate);
            return t.clientId === req.user.userId && txDate >= start && txDate <= end;
        });

        // For demo purposes, return a simple text report
        // In production, you would use libraries like jsPDF or ExcelJS
        let reportContent = `CashBook Pro Report\n`;
        reportContent += `Period: ${startDate} to ${endDate}\n`;
        reportContent += `Generated: ${new Date().toISOString()}\n\n`;
        
        reportContent += `Total Transactions: ${clientTransactions.length}\n`;
        
        if (includeProfit) {
            const totalProfit = clientTransactions.reduce((sum, t) => sum + (t.profitUSD || 0), 0);
            reportContent += `Total Profit: $${totalProfit.toFixed(2)}\n`;
        }
        
        if (includeCurrency) {
            const currencies = [...new Set(clientTransactions.flatMap(t => [t.fromCurrency, t.toCurrency]))];
            reportContent += `Currencies Used: ${currencies.join(', ')}\n`;
        }
        
        reportContent += `\nTransaction Details:\n`;
        clientTransactions.forEach(tx => {
            reportContent += `${new Date(tx.createdAt).toLocaleDateString()} - ${tx.customerName} - ${tx.fromCurrency} ${tx.fromAmount} → ${tx.toCurrency} ${tx.toAmount}\n`;
        });

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=report-${startDate}-to-${endDate}.txt`);
        res.send(reportContent);
    } catch (error) {
        res.status(500).json({ message: 'Server error generating report' });
    }
});

// Static file serving for frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize demo data and start server
initializeDemoData();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Enhanced CashBook Pro Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Multi-currency MongoDB simulation active`);
    console.log(`💱 Supported currencies: ${Object.keys(supportedCurrencies).join(', ')}`);
    console.log(`🔐 Default admin: username=admin, password=admin123`);
    console.log(`👤 Demo client: username=democlient, password=client123`);
});

module.exports = app;