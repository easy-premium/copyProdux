// api/nagad-trx_id.js
export default async function handler(req, res) {
    // CORS সেটআপ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ status: "error", message: "Method Not Allowed" });
    }

    const { trx_id, user_id, link_amount } = req.body;

    if (!trx_id || !user_id || !link_amount) {
        return res.status(400).json({ status: "error", message: "প্রয়োজনীয় তথ্য (TrxID, ইউজার আইডি বা টাকার পরিমাণ) প্রদান করা হয়নি।" });
    }

    // ডাটাবেজ ২ (ট্রানজেকশন) এর Environment Variables
    const FIREBASE_DB_URL2 = process.env.FIREBASE_DB_URL2;
    const FIREBASE_DB_SECRET2 = process.env.FIREBASE_DB_SECRET2;

    // ডাটাবেজ ১ (ইউজার) এর Environment Variables
    const FIREBASE_DB_URL1 = process.env.FIREBASE_DB_URL;
    const FIREBASE_DB_SECRET1 = process.env.FIREBASE_DB_SECRET;

    if (!FIREBASE_DB_URL2 || !FIREBASE_DB_SECRET2 || !FIREBASE_DB_URL1 || !FIREBASE_DB_SECRET1) {
        return res.status(500).json({ status: "error", message: "ডাটাবেজ কনফিগারেশন সঠিক নেই।" });
    }

    try {
        // ==========================================
        // ধাপ ১: ট্রানজেকশন ডাটাবেজ (DB 2) থেকে TrxID চেক করা
        // ==========================================
        const db2URL = `${FIREBASE_DB_URL2.replace(/\/$/, '')}/.json?auth=${FIREBASE_DB_SECRET2}`;
        const trxResponse = await fetch(db2URL);
        const trxData = await trxResponse.json();

        const transaction = trxData[trx_id];

        // যদি ট্রানজেকশন খুঁজে না পাওয়া যায়
        if (!transaction) {
            return res.status(404).json({ 
                status: "error", 
                message: "এই TrxID ডাটাবেজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক TrxID দিন।" 
            });
        }

        // চেক করা হচ্ছে ট্রানজেকশনটি আগে ব্যবহার করা হয়েছে কিনা
        if (transaction.status === "used" || transaction.used_by) {
            return res.status(400).json({ 
                status: "error", 
                message: `এই TrxID টি আগেই ব্যবহার করা হয়েছে (ব্যবহারকারী: ${transaction.used_by || 'অজানা'})।` 
            });
        }

        // ট্রানজেকশন পাওয়া গেলে টাকার পরিমাণ বের করা
        const trxAmount = Number(transaction.amount_bdt);
        const expectedAmount = Number(link_amount);

        if (isNaN(trxAmount) || isNaN(expectedAmount)) {
            return res.status(400).json({ 
                status: "error", 
                message: "ট্রানজেকশনে সঠিক টাকার পরিমাণ নেই।" 
            });
        }

        // ==========================================
        // ধাপ ২: লিংকের টাকার সাথে ট্রানজেকশনের টাকার মিল চেক করা
        // ==========================================
        if (trxAmount !== expectedAmount) {
            return res.status(400).json({ 
                status: "error", 
                message: `টাকার পরিমাণ মেলেনি! আপনি ${expectedAmount} টাকা পাঠিয়েছেন, কিন্তু TrxID-তে ${trxAmount} টাকা আছে।` 
            });
        }

        // ==========================================
        // ধাপ ৩: ইউজার ডাটাবেজ (DB 1) থেকে ইউজারের বর্তমান ব্যালেন্স চেক করা
        // ==========================================
        const userURL = `${FIREBASE_DB_URL1.replace(/\/$/, '')}/user/${user_id}.json?auth=${FIREBASE_DB_SECRET1}`;
        const userResponse = await fetch(userURL);
        const userData = await userResponse.json();

        // যদি ইউজার (ফোন নাম্বার) ডাটাবেজে না থাকে
        if (!userData) {
            return res.status(404).json({ 
                status: "error", 
                message: "ডাটাবেজে এই ইউজার (ফোন নাম্বার) খুঁজে পাওয়া যায়নি।" 
            });
        }

        // ==========================================
        // ধাপ ৪: ইউজারের ব্যালেন্স আপডেট করা
        // ==========================================
        const currentBalance = Number(userData['acount-balance']) || 0;
        const newBalance = currentBalance + trxAmount;

        const updateUserRes = await fetch(userURL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'acount-balance': newBalance })
        });

        if (!updateUserRes.ok) {
            throw new Error("ইউজারের ব্যালেন্স আপডেট করা সম্ভব হয়নি।");
        }

        // ==========================================
        // ধাপ ৫: ট্রানজেকশনটিকে "used" হিসেবে মার্ক করা (DB 2)
        // ==========================================
        const trxMarkURL = `${FIREBASE_DB_URL2.replace(/\/$/, '')}/${trx_id}.json?auth=${FIREBASE_DB_SECRET2}`;
        const currentTime = new Date().toISOString(); // বর্তমান সময়

        const markTrxRes = await fetch(trxMarkURL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: "used",
                used_by: user_id,
                used_at: currentTime
            })
        });

        if (!markTrxRes.ok) {
            console.error("ট্রানজেকশন স্ট্যাটাস আপডেট করতে ব্যর্থ হয়েছে, তবে ইউজারের ব্যালেন্স যোগ হয়েছে।");
        }

        // ==========================================
        // ধাপ ৬: সব ঠিক থাকলে সফল রেসপন্স পাঠানো
        // ==========================================
        return res.status(200).json({
            status: "success",
            message: "ট্রানজেকশন সফলভাবে ম্যাচ হয়েছে এবং ব্যালেন্স যোগ হয়েছে!",
            transaction_data: {
                ...transaction,
                status: "used",
                used_by: user_id,
                used_at: currentTime
            },
            new_balance: newBalance
        });

    } catch (error) {
        console.error("Payment Error:", error);
        return res.status(500).json({ status: "error", message: "সার্ভারে সমস্যা হয়েছে: " + error.message });
    }
}
