// api/nagad-database.js
export default async function handler(req, res) {
    // CORS সেটআপ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Vercel Environment Variables থেকে ডাটা নেওয়া
    // (আপনার Vercel Settings এ FIREBASE_DB_URL2 এবং FIREBASE_DB_SECRET2 থাকতে হবে)
    const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL2;
    const FIREBASE_DB_SECRET = process.env.FIREBASE_DB_SECRET2;

    if (!FIREBASE_DB_URL || !FIREBASE_DB_SECRET) {
        return res.status(500).json({ status: "error", message: "ডাটাবেজ কনফিগারেশন পাওয়া যায়নি" });
    }

    try {
        // ফায়ারবেস থেকে ডাটা ফেচ করা
        const dbURL = `${FIREBASE_DB_URL.replace(/\/$/, '')}/.json?auth=${FIREBASE_DB_SECRET}`;
        const response = await fetch(dbURL);

        if (!response.ok) throw new Error("ফায়ারবেস থেকে ডাটা আনতে ব্যর্থ হয়েছে");

        const data = await response.json();

        if (!data || !data['nagad-number'] || !data['today-live-munit']) {
            return res.status(500).json({ status: "error", message: "ডাটাবেজে প্রয়োজনীয় তথ্য নেই" });
        }

        const dbNagadNumber = data['nagad-number'];
        const dbTimeString = data['today-live-munit']; // ফরম্যাট: yyyy-dd-MM HH:mm

        // টাইম চেক
        const dbTime = parseDatabaseTime(dbTimeString);
        const currentTime = new Date();

        if (!dbTime) {
            return res.status(500).json({ status: "error", message: "ডাটাবেজের টাইম ফরম্যাট ভুল" });
        }

        const diffInMs = Math.abs(currentTime - dbTime);
        const diffInMinutes = Math.floor(diffInMs / 60000);
        const ALLOWED_TIME_DIFF_MINUTES = 5; // ৫ মিনিটের বেশি পার্থক্য থাকলে বন্ধ হবে

        if (diffInMinutes > ALLOWED_TIME_DIFF_MINUTES) {
            return res.status(400).json({ status: "error", message: "ডাটাবেজের সমস্যা হয়েছে (টাইম পুরোনো)" });
        }

        return res.status(200).json({
            status: "success",
            nagad_number: dbNagadNumber,
            db_time: dbTimeString
        });

    } catch (error) {
        return res.status(500).json({ status: "error", message: "সার্ভারে সমস্যা হয়েছে" });
    }
}

function parseDatabaseTime(timeString) {
    try {
        const parts = timeString.split(' ');
        if (parts.length !== 2) return null;
        const dateParts = parts[0].split('-'); // [yyyy, dd, MM]
        const timeParts = parts[1].split(':'); // [HH, mm]
        if (dateParts.length !== 3 || timeParts.length !== 2) return null;
        
        const year = parseInt(dateParts[0], 10);
        const day = parseInt(dateParts[1], 10);
        const month = parseInt(dateParts[2], 10) - 1;
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        
        // বাংলাদেশ টাইমজোন (UTC+6) নিশ্চিত করা
        return new Date(Date.UTC(year, month, day, hours - 6, minutes));
    } catch (e) {
        return null;
    }
}
