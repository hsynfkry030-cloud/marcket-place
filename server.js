// server.js

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
// استفاده از dotenv برای خواندن متغیرهای محیطی از فایل .env در لوکال
require('dotenv').config(); 

const app = express();
// تنظیم پورت سرور. Koyeb از متغیر محیطی PORT استفاده می‌کند.
const port = process.env.PORT || 3000; 

// ----------------- تنظیمات MongoDB -----------------

// آدرس اتصال Atlas شما. 
// در لوکال از MONGODB_URI در فایل .env و در Koyeb از Secret استفاده می‌شود.
const uri = process.env.MONGODB_URI; 
const client = new MongoClient(uri);

let db; // متغیر سراسری برای دسترسی به دیتابیس

// ----------------- Middleware -----------------
// برای پارس کردن درخواست‌های JSON
app.use(express.json()); 
// سرویس‌دهی فایل‌های ثابت (HTML, CSS, JS فرانت‌اند) از پوشه public
app.use(express.static(path.join(__dirname, 'public')));


// ----------------- توابع اتصال به دیتابیس -----------------
async function connectDB() {
    try {
        await client.connect();
        // نام دیتابیس را 'gameAccountDB' قرار می‌دهیم.
        db = client.db('gameAccountDB'); 
        console.log("✅ با موفقیت به MongoDB متصل شد!");
    } catch (error) {
        console.error("❌ خطای اتصال به MongoDB:", error.message);
        // اگر نتوانستیم به دیتابیس وصل شویم، سرور را متوقف می‌کنیم.
        process.exit(1); 
    }
}

// ----------------- مسیرهای API (Backend Logic) -----------------

// API برای دریافت لیست تمام آگهی‌ها
app.get('/api/accounts', async (req, res) => {
    if (!db) return res.status(503).json({ message: "Database service unavailable." });
    try {
        const collection = db.collection('accounts');
        // دریافت تمام آگهی‌ها و مرتب‌سازی بر اساس تاریخ جدیدتر
        const accounts = await collection.find({}).sort({ dateAdded: -1 }).toArray();
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ message: "خطا در دریافت آگهی‌ها", error: error.message });
    }
});

// API برای افزودن آگهی جدید
app.post('/api/accounts', async (req, res) => {
    if (!db) return res.status(503).json({ message: "Database service unavailable." });

    try {
        const newAccount = {
            ...req.body,
            dateAdded: new Date(),
            // ما فرض می‌کنیم داده‌های اعتبارسنجی شده (title, price, game, etc.) در req.body هستند
        };
        
        const collection = db.collection('accounts');
        const result = await collection.insertOne(newAccount);
        
        res.status(201).json({ 
            message: "آگهی با موفقیت ثبت شد.", 
            accountId: result.insertedId 
        });
        
    } catch (error) {
        res.status(500).json({ message: "خطا در ثبت آگهی", error: error.message });
    }
});

// API برای حذف یک آگهی
app.delete('/api/accounts/:id', async (req, res) => {
    if (!db) return res.status(503).json({ message: "Database service unavailable." });

    try {
        const id = req.params.id;
        // مطمئن می‌شویم که ID فرستاده شده معتبر است
        const collection = db.collection('accounts');
        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "آگهی مورد نظر یافت نشد." });
        }
        
        res.status(200).json({ message: "آگهی با موفقیت حذف شد." });

    } catch (error) {
        // اگر فرمت ID اشتباه باشد (مثلاً کوتاه‌تر از ۲۴ کاراکتر)، ObjectId خطا می‌دهد.
        if (error.name === 'BSONTypeError') {
            return res.status(400).json({ message: "فرمت ID آگهی ارسالی اشتباه است." });
        }
        res.status(500).json({ message: "خطا در حذف آگهی", error: error.message });
    }
});

// مسیر اصلی: فایل index.html را از پوشه public ارسال می‌کند
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ----------------- شروع سرور -----------------
async function startServer() {
    // اگر URI دیتابیس تنظیم نشده باشد، هشدار می‌دهیم
    if (!uri) {
        console.error("❌ MONGODB_URI در فایل .env یا Environment Variables تنظیم نشده است!");
        console.error("سرور را متوقف می‌کنیم. لطفاً Connection String را وارد کنید.");
        process.exit(1); 
    }
    
    await connectDB(); // ابتدا به دیتابیس متصل می‌شود
    
    app.listen(port, () => {
        console.log(`🚀 سرور با موفقیت بر روی پورت ${port} اجرا شد!`);
        console.log(`برای دسترسی محلی: http://localhost:${port}`);
    });
}

startServer();
