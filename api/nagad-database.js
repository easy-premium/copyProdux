// api/nagad-database.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ডাটাবেজ ২ (ট্রানজেকশন ডাটাবেজ থেকেই ওয়ালেট নাম্বার এবং টাইম আসছে)
    const FIREBASE_DB_URL2 = process.env.FIREBASE_DB_URL2;
    const FIREBASE_DB_SECRET2 = process.env.FIREBASE_DB_SECRET2;

    if (!FIREBASE_DB_URL2 || !FIREBASE_DB_SECRET2) {
        return res.status(500).json({ status: "error", message: "ডাটাবেজ কনফিগারেশন পাওয়া যায়নি" });
    }

    try {
        const dbURL = `${FIREBASE_DB_URL2.replace(/\/$/, '')}/.json?auth=${FIREBASE_DB_SECRET2}`;
        const response = await fetch(dbURL);
        const data = await response.json();

        if (!data || !data['nagad-number'] || !data['today-live-munit']) {
            return res.status(500).json({ status: "error", message: "ডাটাবেজে প্রয়োজনীয় তথ্য নেই" });
        }

        const dbNagadNumber = data['nagad-number'];
        const dbTimeString = data['today-live-munit']; // ফরম্যাট: yyyy-dd-MM HH:mm

        // টাইম চেক
        const dbTime = parseDatabaseTime(dbTimeString);
        const currentTime = new Date();

        if (!dbTime) return res.status(500).json({ status: "error", message: "ডাটাবেজের টাইম ফরম্যাট ভুল" });

        const diffInMs = Math.abs(currentTime - dbTime);
        const diffInMinutes = Math.floor(diffInMs / 60000);
        
        // ১ মিনিটের বেশি পার্থক্য থাকলে বন্ধ হবে
        if (diffInMinutes > 1) {
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
        
        // বাংলাদেশ টাইমজোন (UTC+6)
        return new Date(Date.UTC(year, month, day, hours - 6, minutes));
    } catch (e) {
        return null;
    }
}
