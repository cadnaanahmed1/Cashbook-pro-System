const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5000', 'http://0.0.0.0:5000', 'http://127.0.0.1:5000'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// In-Memory Database (simulates MongoDB)
const users = [];
const transactions = [];
const balances = [];
const passwordResets = [];

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'cashbook-pro-demo-secret-key-2024';

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
        return next(); // Owners always have access
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

// Initialize Demo Data
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
        createdAt: new Date(),
        updatedAt: new Date()
    });

    // Create demo client
    const clientPassword = bcrypt.hashSync('client123', 10);
    users.push({
        id: 'user_2',
        username: 'democlient',
        email: 'client@demo.com',
        password: clientPassword,
        role: 'client',
        businessName: 'Demo Money Exchange',
        fullName: 'Demo Client',
        phone: '+256700123456',
        accountStatus: 'active',
        subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        lastPayment: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
    });

    // Create balance for demo client
    balances.push({
        id: 'balance_1',
        clientId: 'user_2',
        usdBalance: 1000,
        ugxBalance: 3750000,
        updatedAt: new Date()
    });

    // Create demo transactions
    transactions.push({
        id: 'tx_1',
        clientId: 'user_2',
        customerName: 'John Doe',
        transactionType: 'usd_to_ugx',
        amount: 100,
        exchangeRate: 3750,
        convertedAmount: 375000,
        profit: 5000,
        notes: 'Regular customer',
        createdAt: new Date()
    });

    console.log('Demo data initialized');
    console.log('Default owner - Username: admin, Password: admin123');
    console.log('Demo client - Username: democlient, Password: client123');
};

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { 
            username, 
            email, 
            password, 
            confirmPassword, 
            businessName, 
            fullName, 
            phone 
        } = req.body;

        // Validation
        if (!username || !email || !password || !fullName) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = users.find(u => u.username === username || u.email === email);
        if (existingUser) {
            return res.status(400).json({ 
                message: existingUser.username === username ? 
                    'Username already exists' : 'Email already exists' 
            });
        }

        // Hash password and create user
        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = {
            id: `user_${Date.now()}`,
            username,
            email,
            password: hashedPassword,
            role: 'client',
            businessName,
            fullName,
            phone,
            accountStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        users.push(newUser);

        // Create initial balance
        balances.push({
            id: `balance_${Date.now()}`,
            clientId: newUser.id,
            usdBalance: 0,
            ugxBalance: 0,
            updatedAt: new Date()
        });

        const token = generateToken(newUser);
        
        res.status(201).json({
            message: 'Account created successfully. Please complete payment to activate.',
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                businessName: newUser.businessName,
                fullName: newUser.fullName,
                accountStatus: newUser.accountStatus,
                subscriptionEnd: newUser.subscriptionEnd
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user by username or email
        const user = users.find(u => u.username === username || u.email === username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = bcrypt.compareSync(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                businessName: user.businessName,
                fullName: user.fullName,
                accountStatus: user.accountStatus,
                subscriptionEnd: user.subscriptionEnd
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ message: 'Email not found' });
        }

        const code = generateResetCode();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minutes

        passwordResets.push({
            id: `reset_${Date.now()}`,
            email,
            code,
            expiresAt,
            used: false,
            createdAt: new Date()
        });

        console.log(`Password reset code for ${email}: ${code}`);
        res.json({ message: 'Reset code sent to your email (check console in demo mode)' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Password reset failed' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const resetRecord = passwordResets.find(r => 
            r.email === email && 
            r.code === code && 
            !r.used &&
            r.expiresAt > new Date()
        );

        if (!resetRecord) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }

        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.password = bcrypt.hashSync(newPassword, 10);
        user.updatedAt = new Date();
        resetRecord.used = true;

        res.json({ message: 'Password reset successful' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Password reset failed' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                businessName: user.businessName,
                fullName: user.fullName,
                accountStatus: user.accountStatus,
                subscriptionEnd: user.subscriptionEnd
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Failed to get user data' });
    }
});

app.put('/api/auth/admin-settings', authenticateToken, requireOwner, async (req, res) => {
    try {
        const { username, email, currentPassword, newPassword, confirmPassword } = req.body;

        const user = users.find(u => u.id === req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isValidPassword = bcrypt.compareSync(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        if (newPassword && newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }

        // Update user data
        user.username = username;
        user.email = email;
        if (newPassword) {
            user.password = bcrypt.hashSync(newPassword, 10);
        }
        user.updatedAt = new Date();

        res.json({ message: 'Admin settings updated successfully' });

    } catch (error) {
        console.error('Update admin settings error:', error);
        res.status(500).json({ message: 'Failed to update settings' });
    }
});

// Owner Routes
app.get('/api/owner/stats', authenticateToken, requireOwner, async (req, res) => {
    try {
        const totalClients = users.filter(u => u.role === 'client').length;
        const activeClients = users.filter(u => u.role === 'client' && u.accountStatus === 'active').length;
        const pendingPayments = users.filter(u => u.role === 'client' && u.accountStatus === 'pending').length;
        const monthlyRevenue = activeClients * 25; // $25 per client

        res.json({
            totalClients,
            activeClients,
            pendingPayments,
            monthlyRevenue
        });

    } catch (error) {
        console.error('Get owner stats error:', error);
        res.status(500).json({ message: 'Failed to get statistics' });
    }
});

app.get('/api/owner/clients', authenticateToken, requireOwner, async (req, res) => {
    try {
        const clients = users
            .filter(u => u.role === 'client')
            .map(client => ({
                id: client.id,
                username: client.username,
                email: client.email,
                businessName: client.businessName,
                fullName: client.fullName,
                phone: client.phone,
                accountStatus: client.accountStatus,
                subscriptionEnd: client.subscriptionEnd,
                lastPayment: client.lastPayment,
                createdAt: client.createdAt
            }));

        res.json(clients);

    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ message: 'Failed to get clients' });
    }
});

app.post('/api/owner/verify-payment/:clientId', authenticateToken, requireOwner, async (req, res) => {
    try {
        const { clientId } = req.params;

        const client = users.find(u => u.id === clientId && u.role === 'client');
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        // Update client status
        client.accountStatus = 'active';
        client.subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        client.lastPayment = new Date();
        client.updatedAt = new Date();

        res.json({ message: 'Payment verified successfully' });

    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ message: 'Failed to verify payment' });
    }
});

app.post('/api/owner/suspend/:clientId', authenticateToken, requireOwner, async (req, res) => {
    try {
        const { clientId } = req.params;

        const client = users.find(u => u.id === clientId && u.role === 'client');
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        client.accountStatus = 'inactive';
        client.updatedAt = new Date();

        res.json({ message: 'Client suspended successfully' });

    } catch (error) {
        console.error('Suspend client error:', error);
        res.status(500).json({ message: 'Failed to suspend client' });
    }
});

// Client Routes
app.get('/api/client/stats', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const clientTransactions = transactions.filter(t => t.clientId === req.user.userId);
        
        // Calculate today's transactions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTransactions = clientTransactions.filter(t => 
            new Date(t.createdAt) >= today
        );
        
        const todayProfit = todayTransactions.reduce((sum, t) => sum + (t.profit || 0), 0);
        const transactionCount = todayTransactions.length;

        res.json({
            todayProfit,
            transactionCount
        });

    } catch (error) {
        console.error('Get client stats error:', error);
        res.status(500).json({ message: 'Failed to get statistics' });
    }
});

app.get('/api/client/balance', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const balance = balances.find(b => b.clientId === req.user.userId);
        
        if (!balance) {
            return res.json({ usdBalance: 0, ugxBalance: 0 });
        }

        res.json({
            usdBalance: balance.usdBalance,
            ugxBalance: balance.ugxBalance
        });

    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ message: 'Failed to get balance' });
    }
});

app.get('/api/client/transactions', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const clientTransactions = transactions
            .filter(t => t.clientId === req.user.userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(clientTransactions);

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ message: 'Failed to get transactions' });
    }
});

app.post('/api/client/transactions', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const {
            customerName,
            transactionType,
            amount,
            exchangeRate,
            notes
        } = req.body;

        // Validation
        if (!customerName || !transactionType || !amount || !exchangeRate) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (amount <= 0 || exchangeRate <= 0) {
            return res.status(400).json({ message: 'Amount and exchange rate must be positive' });
        }

        // Calculate converted amount and profit
        let convertedAmount, profit;
        
        if (transactionType === 'usd_to_ugx') {
            convertedAmount = amount * exchangeRate;
            profit = amount * 50; // $0.50 profit per USD
        } else if (transactionType === 'ugx_to_usd') {
            convertedAmount = amount / exchangeRate;
            profit = convertedAmount * 50; // $0.50 profit per USD equivalent
        }

        // Create transaction
        const newTransaction = {
            id: `tx_${Date.now()}`,
            clientId: req.user.userId,
            customerName,
            transactionType,
            amount: parseFloat(amount),
            exchangeRate: parseFloat(exchangeRate),
            convertedAmount,
            profit,
            notes: notes || '',
            createdAt: new Date()
        };

        transactions.push(newTransaction);

        // Update balance
        let balance = balances.find(b => b.clientId === req.user.userId);
        if (!balance) {
            balance = {
                id: `balance_${Date.now()}`,
                clientId: req.user.userId,
                usdBalance: 0,
                ugxBalance: 0,
                updatedAt: new Date()
            };
            balances.push(balance);
        }

        if (transactionType === 'usd_to_ugx') {
            balance.usdBalance -= amount;
            balance.ugxBalance += convertedAmount;
        } else if (transactionType === 'ugx_to_usd') {
            balance.ugxBalance -= amount;
            balance.usdBalance += convertedAmount;
        }

        balance.updatedAt = new Date();

        res.status(201).json({
            message: 'Transaction created successfully',
            transaction: newTransaction
        });

    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ message: 'Failed to create transaction' });
    }
});

app.put('/api/client/balance', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const { usdBalance, ugxBalance } = req.body;

        if (usdBalance < 0 || ugxBalance < 0) {
            return res.status(400).json({ message: 'Balances cannot be negative' });
        }

        let balance = balances.find(b => b.clientId === req.user.userId);
        if (!balance) {
            balance = {
                id: `balance_${Date.now()}`,
                clientId: req.user.userId,
                usdBalance: 0,
                ugxBalance: 0,
                updatedAt: new Date()
            };
            balances.push(balance);
        }

        balance.usdBalance = parseFloat(usdBalance);
        balance.ugxBalance = parseFloat(ugxBalance);
        balance.updatedAt = new Date();

        res.json({
            message: 'Balance updated successfully',
            balance: {
                usdBalance: balance.usdBalance,
                ugxBalance: balance.ugxBalance
            }
        });

    } catch (error) {
        console.error('Update balance error:', error);
        res.status(500).json({ message: 'Failed to update balance' });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize demo data and start server
initializeDemoData();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ CashBook Pro Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 In-memory MongoDB simulation active`);
    console.log(`🔐 Default admin: username=admin, password=admin123`);
    console.log(`👤 Demo client: username=democlient, password=client123`);
});