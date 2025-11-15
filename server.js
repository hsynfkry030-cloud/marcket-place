const express = require('express');
const session = require('express-session'); // برای مدیریت امن نشست‌ها
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcrypt'); // برای هش کردن و مقایسه امن رمز عبور

// تنظیمات
const app = express();
const PORT = process.env.PORT || 8000; // تنظیم پورت Koyeb برای اطمینان

// --- [ اتصال به MongoDB ] ---
const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);
let db; 

// --- [ Middleware ] ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ⚠️ پیکربندی امن مدیریت نشست
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-secret-key-that-you-must-change', 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 
    }
}));


// تابع اتصال به دیتابیس
async function connectDB() {
    try {
        await client.connect();
        db = client.db("gameAccountDB"); 
        console.log("✅ متصل به MongoDB.");
    } catch (error) {
        console.error("❌ خطای اتصال به MongoDB:", error);
        process.exit(1); 
    }
}


// 🔒 Middleware برای محافظت از روت‌های نیاز به احراز هویت
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next(); 
    } else {
        // اگر احراز هویت نشده بود، به صفحه ورود ریدایرکت کن
        res.status(401).redirect('/'); 
    }
}


// --- [ روت اصلی احراز هویت (نسخه امن) ] ---
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!db) return res.status(503).json({ success: false, message: 'Database connection error.' });

    try {
        const account = await db.collection('accounts').findOne({ 
            username: username
        });

        if (account) {
            const isMatch = await bcrypt.compare(password, account.password);

            if (isMatch) {
                req.session.userId = account._id; 
                req.session.username = account.username; 
                
                return res.status(200).json({ success: true, redirectUrl: '/game' }); 
            }
        }
        
        res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });

    } catch (error) {
        console.error("Login failed:", error);
        res.status(500).json({ success: false, message: 'خطای داخلی سرور در هنگام احراز هویت.' });
    }
});


// --- [ روت موقت برای ایجاد یوزر تست (فقط یکبار اجرا شود) ] ---
app.get('/create-test-user', async (req, res) => {
    if (!db) return res.status(503).json({ message: "Database not ready." });

    try {
        const hashedPassword = await bcrypt.hash('password', 10);
        const newAccount = {
            username: 'test',
            password: hashedPassword,
            dateAdded: new Date()
        };
        
        // حذف هر کاربر تست قبلی و ساخت کاربر جدید
        await db.collection('accounts').deleteMany({ username: 'test' });
        await db.collection('accounts').insertOne(newAccount);
        
        res.json({ message: "✅ کاربر تست (test/password) با موفقیت در دیتابیس ایجاد شد." });
    } catch (error) {
        console.error("Error creating test user:", error);
        res.status(500).json({ message: "خطا در ایجاد کاربر تست." });
    }
});


// --- [ Home Route: نمایش صفحه ورود ] ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// --- [ Game Route: روت محافظت شده بازی ] ---
// 🔒 فقط کاربران احراز هویت شده به این فایل دسترسی دارند
app.get('/game', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});


// --- [ API برای مدیریت حساب‌ها ] ---
app.get('/api/accounts', isAuthenticated, async (req, res) => { 
    if (!db) return res.status(503).json({ message: "Database not ready." });
    try {
        const accounts = await db.collection('accounts').find({}).sort({ dateAdded: -1 }).project({ password: 0 }).toArray(); 
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ message: "Internal server error." });
    }
});

app.delete('/api/accounts/:id', isAuthenticated, async (req, res) => { 
    if (!db) return res.status(503).json({ message: "Database not ready." });
    try {
        const result = await db.collection('accounts').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ message: "حساب کاربری یافت نشد." });
        res.status(200).json({ message: "حذف با موفقیت انجام شد." });
    } catch (error) {
        res.status(500).json({ message: "خطای داخلی در حذف کاربر." });
    }
});


// --- [ شروع سرور ] ---
async function startServer() {
    await connectDB();
    
    app.listen(PORT, () => {
        console.log(`🚀 سرور با موفقیت بر روی پورت ${PORT} شروع شد.`);
    });
}

startServer();
