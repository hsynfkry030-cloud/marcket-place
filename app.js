// یک متغیر سراسری برای نگهداری وضعیت Toggle (شروع با false = خاموش)
let isToggledOn = false;

// تابعی که هنگام کلیک روی دکمه اول اجرا می شود
function showMessage() {
    // المان پاراگراف را با ID "message" پیدا می کند
    const messageElement = document.getElementById('message');

    // محتوای متنی المان را تغییر می دهد
    messageElement.textContent = 'این پیام با موفقیت توسط جاوا اسکریپت تغییر یافت!';
    
    // رنگ متن را به آبی تغییر می دهد
    messageElement.style.color = 'blue';
}

// تابعی که هنگام کلیک روی دکمه Toggle اجرا می شود
function toggleStatus() {
    // وضعیت را برعکس می کند (اگر true است، false می شود و برعکس)
    isToggledOn = !isToggledOn;

    // المان پاراگراف نمایش وضعیت را پیدا می کند
    const statusElement = document.getElementById('toggle-status');
    const buttonElement = document.getElementById('toggle-button');
    
    // بر اساس وضعیت جدید، متن و استایل را به‌روزرسانی می کند
    if (isToggledOn) {
        statusElement.textContent = 'وضعیت: **روشن**';
        statusElement.style.color = 'green';
        buttonElement.style.backgroundColor = '#dc3545'; // قرمز برای خاموش کردن
    } else {
        statusElement.textContent = 'وضعیت: **خاموش**';
        statusElement.style.color = 'red';
        buttonElement.style.backgroundColor = '#28a745'; // سبز برای روشن کردن
    }
}
