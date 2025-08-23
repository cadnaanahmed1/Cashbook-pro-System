const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5500;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'https://cashbook-pro-system.onrender.com/', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// In-Memory Database for Demo
const users = [];
const transactions = [];
const balances = [];
const passwordResets = [];
const moneyExchangerData = {
    owners: [],
    customers: {},
    transactions: [],
    ownerBalance: 0
};

// JWT Secret
const JWT_SECRET = 'cashbook-pro-enhanced-secret';

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

const getCurrentDateTime = () => {
    return new Date().toISOString();
};

// Email transporter (optional)
const createEmailTransporter = () => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    if (!emailUser || !emailPass) {
        console.warn('Email credentials not found. Email functionality will not work.');
        return null;
    }
    
    try {
        let nodemailer;
        try {
            nodemailer = require('nodemailer');
        } catch (e) {
            console.error('Nodemailer package not found. Please install it: npm install nodemailer');
            return null;
        }
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: emailUser,
                pass: emailPass
            }
        });
        
        transporter.verify(function(error, success) {
            if (error) {
                console.error('Email transporter verification failed:', error);
            } else {
                console.log('Email transporter is ready to send messages');
            }
        });
        
        return transporter;
    } catch (error) {
        console.error('Error creating email transporter:', error);
        return null;
    }
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
    try {
        if (req.user.role === 'owner') {
            return next();
        }
        
        const user = users.find(u => u.id === req.user.userId);
        if (!user) {
            return res.status(403).json({ message: 'User not found' });
        }
        
        if (user.accountStatus !== 'active') {
            return res.status(403).json({ 
                message: 'Account is not active. Please complete your subscription payment.',
                accountStatus: user.accountStatus || 'inactive'
            });
        }
        
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error checking account status' });
    }
};

// Initialize Demo Data
const initializeDemoData = () => {
    console.log('Initializing demo data...');
    
    // Clear existing data
    users.length = 0;
    transactions.length = 0;
    balances.length = 0;
    passwordResets.length = 0;
    
    // Create default owner account
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const adminUser = {
        id: 'user_1',
        username: 'admin',
        email: 'admin@cashbookpro.com',
        password: hashedPassword,
        role: 'owner',
        fullName: 'System Administrator',
        accountStatus: 'active',
        createdAt: getCurrentDateTime(),
        updatedAt: getCurrentDateTime()
    };
    users.push(adminUser);
    console.log('Created admin user:', adminUser.username);
    
    // Create demo client
    const clientPassword = bcrypt.hashSync('client123', 10);
    const demoClient = {
        id: 'user_2',
        username: 'democlient',
        email: 'client@demo.com',
        password: clientPassword,
        role: 'client',
        businessName: 'Money Exchange Demo',
        fullName: 'Demo Client',
        phone: '+256700123456',
        accountStatus: 'active',
        subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastPayment: new Date(),
        createdAt: getCurrentDateTime(),
        updatedAt: getCurrentDateTime()
    };
    users.push(demoClient);
    console.log('Created demo client:', demoClient.username);
    
    // Initialize Money Exchanger data
    moneyExchangerData.owners = [adminUser.fullName];
    moneyExchangerData.customers = {};
    moneyExchangerData.transactions = [];
    moneyExchangerData.ownerBalance = 0;
    
    console.log('Demo data initialization complete');
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
        
        const transporter = createEmailTransporter();
        
        if (transporter) {
            try {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'CashBook Pro Password Reset',
                    text: `Your password reset code is: ${resetCode}\n\nThis code will expire in 15 minutes.`
                };
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending email:', error);
                        res.json({ 
                            message: 'Reset code generated. Email service unavailable. Please check console for code.',
                            fallback: true
                        });
                    } else {
                        console.log('Email sent successfully to:', email);
                        res.json({ message: 'Reset code sent successfully to your email' });
                    }
                });
            } catch (emailError) {
                console.error('Error in email sending process:', emailError);
                res.json({ 
                    message: 'Reset code generated. Email service error. Please check console for code.',
                    fallback: true
                });
            }
        } else {
            res.json({ 
                message: 'Reset code generated. Email service not configured. Please check console for code.',
                fallback: true
            });
        }
    } catch (error) {
        console.error('Server error during password reset:', error);
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
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        
        const user = users.find(u => u.id === req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const userResponse = { ...user };
        delete userResponse.password;
        
        res.json({ user: userResponse });
    } catch (error) {
        console.error('Error in /api/auth/me:', error);
        res.status(500).json({ message: 'Server error fetching user data' });
    }
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

// Money Exchanger System Routes
app.get('/api/money-exchanger/data', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.userId);
        const defaultOwner = user ? user.fullName : 'Default Owner';
        
        res.json({
            owners: [defaultOwner, ...moneyExchangerData.owners],
            customers: moneyExchangerData.customers,
            transactions: moneyExchangerData.transactions,
            ownerBalance: moneyExchangerData.ownerBalance
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching Money Exchanger data' });
    }
});

app.put('/api/money-exchanger/data', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        moneyExchangerData.owners = req.body.owners;
        moneyExchangerData.customers = req.body.customers;
        moneyExchangerData.transactions = req.body.transactions;
        moneyExchangerData.ownerBalance = req.body.ownerBalance;
        
        console.log('Saving Money Exchanger data for user:', req.user.userId);
        res.json({ message: 'Money Exchanger data saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error saving Money Exchanger data' });
    }
});

app.post('/api/money-exchanger/owners', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ message: 'Owner name is required' });
        }
        
        if (!moneyExchangerData.owners.includes(name)) {
            moneyExchangerData.owners.push(name);
        }
        
        console.log('Adding owner:', name, 'for user:', req.user.userId);
        res.json({ message: 'Owner added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding owner' });
    }
});

app.post('/api/money-exchanger/transactions', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const transaction = req.body;
        
        if (!transaction.payer || !transaction.receiver || !transaction.amount) {
            return res.status(400).json({ message: 'Missing required transaction fields' });
        }
        
        transaction.id = generateId('tx');
        transaction.date = new Date().toLocaleString();
        
        moneyExchangerData.transactions.push(transaction);
        
        console.log('Adding transaction:', transaction, 'for user:', req.user.userId);
        res.status(201).json({ 
            message: 'Transaction added successfully',
            transaction: transaction
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error adding transaction' });
    }
});

// Static file serving
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize demo data and start server
try {
    initializeDemoData();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Enhanced CashBook Pro Server running on http://0.0.0.0:${PORT}`);
        console.log(`📊 Money Exchanger System integrated`);
        console.log(`🔐 Default admin: username=admin, password=admin123`);
        console.log(`👤 Demo client: username=democlient, password=client123`);
        
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn(`⚠️ Email service not configured. Set EMAIL_USER and EMAIL_PASS in .env for password reset emails.`);
        }
    });
} catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
}

module.exports = app;
