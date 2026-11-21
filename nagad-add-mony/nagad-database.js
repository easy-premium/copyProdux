// nagad-database.js

// Vercel-এর Environment Variable থেকে ডাটা নেওয়া
// (লোকালি টেস্ট করার সময় এগুলো আপনার .env ফাইলে বা সরাসরি এখানে টেস্টের জন্য বসাতে পারেন)
const FIREBASE_DB_URL = import.meta.env?.VITE_FIREBASE_DB_URL2 || 'YOUR_FIREBASE_DB_URL_HERE';
const FIREBASE_DB_SECRET = import.meta.env?.VITE_FIREBASE_DB_SECRET2 || 'YOUR_FIREBASE_DB_SECRET_HERE';

document.addEventListener('DOMContentLoaded', async () => {
    const dbErrorOverlay = document.getElementById('dbErrorOverlay');
    const paymentWrapper = document.getElementById('paymentWrapper');
    const walletNumberEl = document.getElementById('walletNumber');
    const copyBtn = document.getElementById('copyBtn');
    const trxInput = document.getElementById('trxInput');
    const submitButton = document.getElementById('submitButton');

    try {
        // ১. ডাটাবেজ থেকে ডাটা ফেচ করা
        // (নিরাপত্তার জন্য auth=SECRET ব্যবহার করা হয়েছে)
        const response = await fetch(`${FIREBASE_DB_URL}.json?auth=${FIREBASE_DB_SECRET}`);
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        if (!data || !data['nagad-number'] || !data['today-live-munit']) {
            throw new Error('Required data missing in database');
        }

        const dbNagadNumber = data['nagad-number'];
        const dbTimeString = data['today-live-munit']; // ফরম্যাট: yyyy-dd-MM HH:mm

        // ২. টাইম চেক করার লজিক
        // ডাটাবেজের টাইমকে পার্স করা
        const dbTime = parseDatabaseTime(dbTimeString);
        const currentTime = new Date();

        if (!dbTime) {
            throw new Error('Invalid database time format');
        }

        // টাইমের পার্থক্য বের করা (মিনিটের হিসেবে)
        const diffInMs = Math.abs(currentTime - dbTime);
        const diffInMinutes = Math.floor(diffInMs / 60000);

        // ধরুন, ডাটাবেজের টাইম এবং বর্তমান টাইমের মধ্যে ৫ মিনিটের বেশি পার্থক্য থাকলে সাইট বন্ধ হয়ে যাবে
        // (প্রয়োজন অনুযায়ী এই মানটি পরিবর্তন করতে পারবেন)
        const ALLOWED_TIME_DIFF_MINUTES = 5; 

        // টাইম যদি পুরোনো হয় বা ভুল থাকে (পার্থক্য যদি বেশি হয়)
        if (diffInMinutes > ALLOWED_TIME_DIFF_MINUTES) {
            throw new Error('Database time is outdated or invalid');
        }

        // ৩. সব ঠিক থাকলে ওয়েবসাইট দেখানো এবং নাম্বার সেট করা
        walletNumberEl.textContent = dbNagadNumber;
        paymentWrapper.style.display = 'block'; // ওয়েবসাইট দেখানো
        dbErrorOverlay.style.display = 'none';

        // ৪. কপি বাটনের কাজ
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(dbNagadNumber).then(() => {
                alert('Wallet number copied!');
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        });

        // ৫. ইনপুট ভ্যালিডেশন (TrxID দিলে বাটন এনাবল হবে)
        trxInput.addEventListener('input', () => {
            if (trxInput.value.trim().length >= 6) {
                submitButton.disabled = false;
                submitButton.style.cursor = 'pointer';
                submitButton.style.opacity = '1';
                submitButton.style.background = '#067a54';
                submitButton.style.color = '#ffffff';
                submitButton.style.borderColor = '#067a54';
            } else {
                submitButton.disabled = true;
                submitButton.style.cursor = 'not-allowed';
                submitButton.style.opacity = '0.78';
                submitButton.style.background = '#f1f1f1';
                submitButton.style.color = '#777777';
                submitButton.style.borderColor = '#8d8d8d';
            }
        });

    } catch (error) {
        console.error('Database Error:', error);
        
        // কোনো সমস্যা হলে পেমেন্ট সেকশন লুকিয়ে ফেলা এবং এরর মেসেজ দেখানো
        paymentWrapper.style.display = 'none';
        dbErrorOverlay.style.display = 'flex'; // flex করা হলো যাতে সেন্টার করা যায়
    }
});

// ডাটাবেজের ফরম্যাট "yyyy-dd-MM HH:mm" কে জাভাস্ক্রিপ্ট ডেটে কনভার্ট করার ফাংশন
function parseDatabaseTime(timeString) {
    try {
        // উদাহরণ: "2026-21-11 14:30"
        // এখানে yyyy-dd-MM ফরম্যাটে আছে, তাই আমাদের এটাকে yyyy-MM-dd এ কনভার্ট করতে হবে
        const parts = timeString.split(' ');
        if (parts.length !== 2) return null;

        const dateParts = parts[0].split('-'); // [yyyy, dd, MM]
        const timeParts = parts[1].split(':'); // [HH, mm]

        if (dateParts.length !== 3 || timeParts.length !== 2) return null;

        const year = parseInt(dateParts[0], 10);
        const day = parseInt(dateParts[1], 10);
        const month = parseInt(dateParts[2], 10) - 1; // JS-এ মাস ০ থেকে শুরু
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);

        return new Date(year, month, day, hours, minutes);
    } catch (e) {
        return null;
    }
}
