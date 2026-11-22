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
        return res.status(400).json({ status: "error", message: "আপনার কোথাও একটা ভুল হচ্ছে, সঠিকভাবে ফরম পূরণ করুন।" });
    }

    const FIREBASE_DB_URL2 = process.env.FIREBASE_DB_URL2;
    const FIREBASE_DB_SECRET2 = process.env.FIREBASE_DB_SECRET2;
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

        if (!transaction) {
            return res.status(404).json({ status: "error", message: "সঠিকভাবে টাকা পাঠিয়ে সঠিক ট্রানজেকশন বসিয়ে দিন।" });
        }

        if (transaction.status === "used" || transaction.used_by) {
            return res.status(400).json({ status: "error", message: "এই TrxID টি আগেই ব্যবহার করা হয়েছে।" });
        }

        const trxAmount = Number(transaction.amount_bdt);
        const expectedAmount = Number(link_amount);

        if (isNaN(trxAmount) || isNaN(expectedAmount)) {
            return res.status(400).json({ status: "error", message: "আপনার কোথাও একটা ভুল হচ্ছে, সঠিকভাবে ফরম পূরণ করুন।" });
        }

        // ==========================================
        // ধাপ ২: লিংকের টাকার সাথে ট্রানজেকশনের টাকার মিল চেক করা
        // ==========================================
        if (trxAmount !== expectedAmount) {
            return res.status(400).json({ status: "error", message: "লেনদেন টাকার পরিমাণ সঠিকভাবে লিখুন।" });
        }

        // ==========================================
        // ধাপ ৩: ইউজার ডাটাবেজ (DB 1) থেকে ইউজারের বর্তমান ব্যালেন্স চেক করা
        // ==========================================
        const userURL = `${FIREBASE_DB_URL1.replace(/\/$/, '')}/user/${user_id}.json?auth=${FIREBASE_DB_SECRET1}`;
        const userResponse = await fetch(userURL);
        const userData = await userResponse.json();

        if (!userData) {
            return res.status(404).json({ status: "error", message: "আপনার কোথাও একটা ভুল হচ্ছে, সঠিকভাবে ফরম পূরণ করুন।" });
        }

        // ==========================================
        // ধাপ ৪: ট্রানজেকশনটিকে প্রথমে "used" হিসেবে মার্ক করা (DB 2)
        // ==========================================
        const trxMarkURL = `${FIREBASE_DB_URL2.replace(/\/$/, '')}/${trx_id}.json?auth=${FIREBASE_DB_SECRET2}`;
        const currentTime = new Date().toISOString();

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
            throw new Error("ট্রানজেকশন স্ট্যাটাস আপডেট করা সম্ভব হয়নি।");
        }

        // ==========================================
        // ধাপ ৫: ইউজারের ব্যালেন্স আপডেট করা এবং amount-history সেভ করা
        // ==========================================
        const currentBalance = Number(userData['acount-balance']) || 0;
        const newBalance = currentBalance + trxAmount;

        // ইউজারের হিস্ট্রি আপডেট (এখানে acount-total-balance যুক্ত করা হয়েছে)
        const updateData = {
            'acount-balance': newBalance,
            [`amount-history/${trx_id}`]: {
                amount: trxAmount,
                time: currentTime,
                trx_id: trx_id,
                from: transaction.from || "Unknown",
                provider: transaction.provider || "Unknown",
                'acount-total-balance': newBalance,
                info: `Deposit via ${transaction.provider || 'Nagad'} (TrxID: ${trx_id})`
            }
        };

        const updateUserRes = await fetch(userURL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        // যদি ইউজারের ব্যালেন্স আপডেট ব্যর্থ হয়, তবে ট্রানজেকশনটি আবার আগের অবস্থায় ফিরিয়ে নেওয়া হবে (Rollback)
        if (!updateUserRes.ok) {
            await fetch(trxMarkURL, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: transaction.status || "successful", used_by: null, used_at: null })
            });
            throw new Error("ইউজারের ব্যালেন্স আপডেট করা সম্ভব হয়নি।");
        }

        // ==========================================
        // ধাপ ৬: সব ঠিক থাকলে সফল রেসপন্স পাঠানো
        // ==========================================
        return res.status(200).json({
            status: "success",
            message: "ট্রানজেকশন সফলভাবে ম্যাচ হয়েছে এবং ব্যালেন্স যোগ হয়েছে!",
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
        return res.status(500).json({ status: "error", message: "সার্ভারে সমস্যা হয়েছে, টাকা কাটা হয়নি।" });
    }
}
