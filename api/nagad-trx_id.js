// api/nagad-trx_id.js
export default async function handler(req, res) {
    // CORS সেটআপ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // শুধুমাত্র POST রিকোয়েস্ট গ্রহণ করা হবে
    if (req.method !== 'POST') {
        return res.status(405).json({ status: "error", message: "Method Not Allowed" });
    }

    const { trx_id } = req.body;

    if (!trx_id) {
        return res.status(400).json({ status: "error", message: "TrxID প্রদান করা হয়নি" });
    }

    const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL2;
    const FIREBASE_DB_SECRET = process.env.FIREBASE_DB_SECRET2;

    if (!FIREBASE_DB_URL || !FIREBASE_DB_SECRET) {
        return res.status(500).json({ status: "error", message: "ডাটাবেজ কনফিগারেশন পাওয়া যায়নি" });
    }

    try {
        // ফায়ারবেস থেকে সম্পূর্ণ ডাটা ফেচ করা
        const dbURL = `${FIREBASE_DB_URL.replace(/\/$/, '')}/.json?auth=${FIREBASE_DB_SECRET}`;
        const response = await fetch(dbURL);

        if (!response.ok) throw new Error("ফায়ারবেস থেকে ডাটা আনতে ব্যর্থ হয়েছে");

        const data = await response.json();

        // ডাটাবেজের ভেতরে 해당 TrxID আছে কিনা চেক করা
        // Firebase থেকে আসা ডাটার key গুলোই হলো TrxID (যেমন: DK17UGR8MT)
        const transaction = data[trx_id];

        if (!transaction) {
            return res.status(404).json({ 
                status: "error", 
                message: "এই TrxID ডাটাবেজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক TrxID দিন।" 
            });
        }

        // যদি ট্রানজেকশন পাওয়া যায়, তবে তার সব তথ্য রেসপন্স হিসেবে পাঠানো
        return res.status(200).json({
            status: "success",
            message: "ট্রানজেকশন সফলভাবে ম্যাচ হয়েছে!",
            data: transaction
        });

    } catch (error) {
        console.error("TrxID Check Error:", error);
        return res.status(500).json({ status: "error", message: "সার্ভারে সমস্যা হয়েছে" });
    }
}
