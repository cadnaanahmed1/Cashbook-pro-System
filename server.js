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
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['owner', 'client'], default: 'client' },
    businessName: String,
    fullName: { type: String, required: true },
    phone: String,
    accountStatus: { type: String, enum: ['active', 'pending', 'suspended'], default: 'pending' },
    subscriptionEnd: Date,
    lastPayment: Date,
    moneyExchangerData: {
        owners: [String],
        customers: { type: Map, of: Number },
        transactions: [{
            id: String,
            date: String,
            type: String,
            payer: String,
            receiver: String,
            amount: Number,
            description: String,
            cashType: String
        }],
        ownerBalance: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = bcrypt.hashSync(this.password, 10);
    next();
});

const User = mongoose.model('User', userSchema);

// Password Reset Schema
const passwordResetSchema = new mongoose.Schema({
    email: { type: String, required: true },
    code: { type: String, required: true },
    expires: { type: Date, required: true },
    used: { type: Boolean, default: false }
}, {
    timestamps: true
});

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

// JWT Secret
const JWT_SECRET = 'cashbook-pro-enhanced-secret';

// Helper Functions
const generateToken = (user) => {
    return jwt.sign(
        { 
            userId: user._id, 
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
        
        const user = await User.findById(req.user.userId);
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

// Seed initial data
const seedDatabase = async () => {
    try {
        // Check if admin exists
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const admin = new User({
                username: 'admin',
                email: 'admin@cashbookpro.com',
                password: 'admin123',
                role: 'owner',
                fullName: 'System Administrator',
                accountStatus: 'active',
                subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                moneyExchangerData: {
                    owners: ['System Administrator'],
                    customers: new Map(),
                    transactions: [],
                    ownerBalance: 0
                }
            });
            await admin.save();
            console.log('Admin user created');
        }

        // Check if demo client exists
        const demoClientExists = await User.findOne({ username: 'democlient' });
        if (!demoClientExists) {
            const demoClient = new User({
                username: 'democlient',
                email: 'client@demo.com',
                password: 'client123',
                role: 'client',
                businessName: 'Money Exchange Demo',
                fullName: 'Demo Client',
                phone: '+256700123456',
                accountStatus: 'active',
                subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastPayment: new Date(),
                moneyExchangerData: {
                    owners: ['Demo Client'],
                    customers: new Map(),
                    transactions: [],
                    ownerBalance: 0
                }
            });
            await demoClient.save();
            console.log('Demo client created');
        }
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

// Call seed function after DB connection
mongoose.connection.once('open', () => {
    seedDatabase();
});

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ 
            $or: [
                { username: username },
                { email: username }
            ]
        });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user);
        const userResponse = user.toObject();
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
        
        const existingUser = await User.findOne({ 
            $or: [
                { username: username },
                { email: email }
            ]
        });
        
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        
        const newUser = new User({
            username,
            email,
            password,
            role: 'client',
            businessName,
            fullName,
            phone,
            accountStatus: 'pending',
            moneyExchangerData: {
                owners: [fullName],
                customers: new Map(),
                transactions: [],
                ownerBalance: 0
            }
        });
        
        await newUser.save();
        
        const token = generateToken(newUser);
        const userResponse = newUser.toObject();
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
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const resetCode = generateResetCode();
        const resetEntry = new PasswordReset({
            email,
            code: resetCode,
            expires: new Date(Date.now() + 15 * 60 * 1000),
            used: false
        });
        await resetEntry.save();
        
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
        const resetEntry = await PasswordReset.findOne({ 
            email: email,
            code: code,
            used: false,
            expires: { $gt: new Date() }
        });
        
        if (!resetEntry) {
            return res.status(400).json({ message: 'Invalid or expired reset code' });
        }
        
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        user.password = newPassword;
        await user.save();
        
        resetEntry.used = true;
        await resetEntry.save();
        
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during password reset' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const userResponse = user.toObject();
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
        const user = await User.findById(req.user.userId);
        
        if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        
        if (username !== user.username && await User.findOne({ username: username, _id: { $ne: user._id } })) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        
        if (email !== user.email && await User.findOne({ email: email, _id: { $ne: user._id } })) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        
        user.username = username;
        user.email = email;
        if (newPassword) {
            user.password = newPassword;
        }
        await user.save();
        
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during settings update' });
    }
});

// Owner Routes
app.get('/api/owner/stats', authenticateToken, requireOwner, async (req, res) => {
    try {
        const totalClients = await User.countDocuments({ role: 'client' });
        const activeClients = await User.countDocuments({ role: 'client', accountStatus: 'active' });
        const pendingPayments = await User.countDocuments({ role: 'client', accountStatus: 'pending' });
        
        const monthlyRevenue = activeClients * 29.99;
        res.json({
            totalClients,
            activeClients,
            pendingPayments,
            monthlyRevenue
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching stats' });
    }
});

app.get('/api/owner/clients', authenticateToken, requireOwner, async (req, res) => {
    try {
        const clients = await User.find({ role: 'client' }).select('-password');
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching clients' });
    }
});

app.post('/api/owner/verify-payment/:clientId', authenticateToken, requireOwner, async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.params.clientId, role: 'client' });
        
        if (!user) {
            return res.status(404).json({ message: 'Client not found' });
        }
        
        user.accountStatus = 'active';
        user.subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        user.lastPayment = new Date();
        await user.save();
        
        res.json({ message: 'Payment verified and account activated' });
    } catch (error) {
        res.status(500).json({ message: 'Server error verifying payment' });
    }
});

app.post('/api/owner/suspend/:clientId', authenticateToken, requireOwner, async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.params.clientId, role: 'client' });
        
        if (!user) {
            return res.status(404).json({ message: 'Client not found' });
        }
        
        user.accountStatus = 'suspended';
        await user.save();
        
        res.json({ message: 'Client account suspended' });
    } catch (error) {
        res.status(500).json({ message: 'Server error suspending client' });
    }
});

// Money Exchanger System Routes
app.get('/api/money-exchanger/data', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert Map to Object for JSON serialization
        const customersObject = {};
        user.moneyExchangerData.customers.forEach((value, key) => {
            customersObject[key] = value;
        });

        res.json({
            owners: user.moneyExchangerData.owners,
            customers: customersObject,
            transactions: user.moneyExchangerData.transactions,
            ownerBalance: user.moneyExchangerData.ownerBalance
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching Money Exchanger data' });
    }
});

app.put('/api/money-exchanger/data', authenticateToken, requireActiveAccount, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update money exchanger data
        user.moneyExchangerData.owners = req.body.owners;
        user.moneyExchangerData.customers = new Map(Object.entries(req.body.customers));
        user.moneyExchangerData.transactions = req.body.transactions;
        user.moneyExchangerData.ownerBalance = req.body.ownerBalance;

        await user.save();

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
        
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.moneyExchangerData.owners.includes(name)) {
            user.moneyExchangerData.owners.push(name);
            await user.save();
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
        
        transaction.id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        transaction.date = new Date().toLocaleString();
        
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.moneyExchangerData.transactions.push(transaction);
        await user.save();
        
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Enhanced CashBook Pro Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Money Exchanger System integrated`);
    console.log(`🔐 Default admin: username=admin, password=admin123`);
    console.log(`👤 Demo client: username=democlient, password=client123`);
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn(`⚠️ Email service not configured. Set EMAIL_USER and EMAIL_PASS in .env for password reset emails.`);
    }
});

module.exports = app;
