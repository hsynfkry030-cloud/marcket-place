const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();

// تنظیم پورت: ابتدا از متغیر محیطی Koyeb استفاده کن، در غیر این صورت از 3000 استفاده کن
const app = express();
const PORT = process.env.PORT || 3000; 

// --- [ اتصال به MongoDB ] ---
const uri = process.env.MONGODB_URI; // استفاده از متغیر محیطی تنظیم شده در Koyeb
const client = new MongoClient(uri);
let db; // متغیر سراسری برای نگهداری اتصال به دیتابیس

// --- [ Middleware ] ---
// برای خواندن داده‌های JSON از بدنه درخواست
app.use(express.json()); 
// برای خواندن داده‌های فرمی (مانند لاگین)
app.use(express.urlencoded({ extended: true }));
// برای سرویس دهی فایل‌های استاتیک (HTML, CSS, JS, تصاویر) از پوشه public
app.use(express.static(path.join(__dirname, 'public')));


// تابع اتصال به دیتابیس
async function connectDB() {
    try {
        await client.connect();
        db = client.db("gameAccountDB"); // اتصال به دیتابیس gameAccountDB (نام دیتابیس شما)
        console.log("✅ متصل به MongoDB.");
    } catch (error) {
        console.error("❌ خطای اتصال به MongoDB:", error);
        // در صورت عدم اتصال، برنامه را متوقف کن
        process.exit(1); 
    }
}

// --- [ API Endpoint: Login ] ---
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!db) {
        return res.status(503).send('Database connection error.');
    }

    try {
        // جستجوی کاربر در کالکشن 'accounts'
        const account = await db.collection('accounts').findOne({ 
            username: username,
            password: password 
        });

        if (account) {
            // ورود موفق: ارسال صفحه اصلی (index.html)
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        } else {
            // ورود ناموفق: ارسال پیام خطا
            res.status(401).send('نام کاربری یا رمز عبور اشتباه است.');
        }

    } catch (error) {
        console.error("Login failed:", error);
        res.status(500).send('خطای داخلی سرور در هنگام احراز هویت.');
    }
});


// --- [ API Endpoint: Get All Accounts ] ---
app.get('/api/accounts', async (req, res) => {
    if (!db) return res.status(503).json({ message: "Database not ready." });

    try {
        const collection = db.collection('accounts');
        const accounts = await collection.find({}).sort({ dateAdded: -1 }).toArray();
        res.json(accounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error." });
    }
});


// --- [ API Endpoint: Create New Account ] ---
app.post('/api/accounts', async (req, res) => {
    if (!db) return res.status(503).json({ message: "Database not ready." });

    try {
        const newAccount = {
            ...req.body,
            dateAdded: new Date(), // افزودن تاریخ ثبت
        };
        const collection = db.collection('accounts');
        const result = await collection.insertOne(newAccount);

        res.status(201).json({
            message: "حساب کاربری با موفقیت ثبت شد.",
            accountId: result.insertedId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "خطای داخلی در ثبت کاربر." });
    }
});


// --- [ API Endpoint: Delete Account ] ---
app.delete('/api/accounts/:id', async (req, res) => {
    if (!db) return res.status(503).json({ message: "Database not ready." });

    try {
        const accountId = req.params.id;
        const collection = db.collection('accounts');
        const result = await collection.deleteOne({ _id: new ObjectId(accountId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "حساب کاربری یافت نشد." });
        }

        res.status(200).json({ message: "حذف با موفقیت انجام شد." });
    } catch (error) {
        if (error.name === 'BSONTypeError') {
            return res.status(400).json({ message: "شناسه (ID) نامعتبر است." });
        }
        console.error(error);
        res.status(500).json({ message: "خطای داخلی در حذف کاربر." });
    }
});


// --- [ Home Route: ریدایرکت به صفحه ورود ] ---
app.get('/', (req, res) => {
    // صفحه اصلی را به جای index.html، صفحه login.html (فرض بر وجود این صفحه در public) قرار می دهیم
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// --- [ شروع سرور ] ---
async function startServer() {
    await connectDB(); // ابتدا به دیتابیس متصل شو
    
    app.listen(PORT, () => {
        console.log(`🚀 سرور با موفقیت بر روی پورت ${PORT} شروع شد.`);
        console.log(`🌐 وبسایت در حال اجرا: http://localhost:${PORT}`);
    });
}

startServer();
