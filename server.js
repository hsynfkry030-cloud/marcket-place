const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
// require('dotenv').config(); // این خط در Koyeb نیاز نیست چون متغیرها مستقیماً تنظیم شده‌اند

// تنظیم پورت: ابتدا از متغیر محیطی Koyeb استفاده کن، در غیر این صورت از 3000 استفاده کن
const app = express();
const PORT = process.env.PORT || 3000; 

// --- [ اتصال به MongoDB ] ---
const uri = process.env.MONGODB_URI; // استفاده از متغیر محیطی تنظیم شده در Koyeb
const client = new MongoClient(uri);
let db; // متغیر سراسری برای نگهداری اتصال به دیتابیس

// --- [ Middleware ] ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
// برای سرویس دهی فایل‌های استاتیک از پوشه public
app.use(express.static(path.join(__dirname, 'public')));


// تابع اتصال به دیتابیس
async function connectDB() {
    try {
        await client.connect();
        db = client.db("gameAccountDB"); // اتصال به دیتابیس gameAccountDB (نام دیتابیس شما)
        console.log("✅ متصل به MongoDB.");
    } catch (error) {
        console.error("❌ خطای اتصال به MongoDB:", error);
        process.exit(1); 
    }
}


// --- [ TEMPORARY API Endpoint: Create Test User ] ---
// این روت موقت است و بعداً حذف خواهد شد.
app.get('/create-test-user', async (req, res) => {
    if (!db) return res.status(503).json({ message: "Database not ready." });

    try {
        const testAccount = {
            username: "test", 
            password: "password", 
            dateAdded: new Date(),
        };
        const collection = db.collection('accounts');
        
        const existingUser = await collection.findOne({ username: "test" });
        if (existingUser) {
            return res.json({ message: "کاربر تست قبلاً ایجاد شده است." });
        }

        await collection.insertOne(testAccount);
        res.status(201).json({ message: "✅ کاربر تست (test/password) با موفقیت در دیتابیس ایجاد شد." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "خطای داخلی در ایجاد کاربر تست." });
    }
});
// ----------------------------------------------------


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
            dateAdded: new Date(),
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
