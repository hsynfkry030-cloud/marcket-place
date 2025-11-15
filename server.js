const express = require('express');
const session = require('express-session'); // برای مدیریت امن نشست‌ها
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcrypt'); // برای هش کردن و مقایسه امن رمز عبور

// تنظیمات
const app = express();
const PORT = process.env.PORT || 3000; 

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
    secret: process.env.SESSION_SECRET || 'a-very-secret-key-that-you-must-change', // این کلید باید در متغیر محیطی باشد
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // کوکی فقط روی HTTPS ارسال شود
        httpOnly: true, // از دسترسی جاوااسکریپت سمت کلاینت جلوگیری می‌کند
        maxAge: 1000 * 60 * 60 * 24 // ۲۴ ساعت
    }
}));


// تابع اتصال به دیتابیس
async function connectDB() {
    // ... (همانند قبل) ...
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
        next(); // کاربر احراز هویت شده است
    } else {
        // هدایت به صفحه ورود و ارسال پیام خطای 401
        res.status(401).redirect('/'); 
    }
}


// --- [ روت اصلی احراز هویت (نسخه امن) ] ---
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!db) return res.status(503).send('Database connection error.');

    try {
        // ۱. جستجوی کاربر فقط بر اساس نام کاربری (امن در برابر NoSQL Injection)
        const account = await db.collection('accounts').findOne({ 
            username: username
        });

        if (account) {
            // ۲. مقایسه امن رمز عبور ارسالی با رمز عبور هش شده
            const isMatch = await bcrypt.compare(password, account.password);

            if (isMatch) {
                // ۳. ورود موفق: تنظیم سشن و هدایت
                req.session.userId = account._id; // ذخیره ID کاربر در سشن
                req.session.username = account.username; 
                
                // بجای ارسال فایل، ریدایرکت به صفحه محافظت شده بازی
                return res.status(200).json({ success: true, redirectUrl: '/game' }); 
            }
        }
        
        // نام کاربری یا رمز عبور اشتباه (پیام مبهم برای امنیت بیشتر)
        res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });

    } catch (error) {
        console.error("Login failed:", error);
        res.status(500).json({ success: false, message: 'خطای داخلی سرور در هنگام احراز هویت.' });
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


// --- [ روت خروج از حساب کاربری ] ---
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: "خروج با خطا مواجه شد." });
        }
        // ریدایرکت به صفحه ورود
        res.json({ success: true, redirectUrl: '/' }); 
    });
});


// --- [ API برای مدیریت حساب‌ها ] ---
app.get('/api/accounts', isAuthenticated, async (req, res) => { // 🔒 محافظت از روت
    if (!db) return res.status(503).json({ message: "Database not ready." });
    try {
        const accounts = await db.collection('accounts').find({}).sort({ dateAdded: -1 }).project({ password: 0 }).toArray(); // ⚠️ حذف فیلد پسورد از خروجی
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ message: "Internal server error." });
    }
});

app.delete('/api/accounts/:id', isAuthenticated, async (req, res) => { // 🔒 محافظت از روت
    if (!db) return res.status(503).json({ message: "Database not ready." });
    // ⚠️ (نکته امنیتی): در یک سیستم واقعی باید اینجا چک کنید که آیا کاربر فعلی اجازه حذف این اکانت را دارد یا خیر
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
