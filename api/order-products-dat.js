// api/order-products-dat.js

export default async function handler(req, res) {
    // CORS সেটআপ (ফ্রন্টএন্ড থেকে কল করার জন্য)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // URL থেকে mobile এবং orderId নেওয়া
    const { mobile, orderId } = req.query;
    if (!mobile || !orderId) {
        return res.status(400).json({ error: 'Mobile and Order ID required' });
    }

    // Vercel Environment Variables থেকে URL এবং Secret নেওয়া
    const dbUrl = process.env.FIREBASE_DB_URL;
    const dbSecret = process.env.FIREBASE_DB_SECRET;

    if (!dbUrl || !dbSecret) {
        console.error("FIREBASE_DB_URL অথবা FIREBASE_DB_SECRET সেট করা নেই।");
        return res.status(500).json({ error: 'Database configuration missing' });
    }

    try {
        // আপনার JSON ফাইল অনুযায়ী সঠিক পাথ (user, products)
        // URL-এর শেষে ?auth=SECRET যুক্ত করা হয়েছে, যা লক করা ডেটাবেসে ঢোকার জন্য আবশ্যক
        const firebasePath = `${dbUrl}/user/${mobile}/products/${orderId}/autoadd-balance-dat.json?auth=${dbSecret}`;
        
        const response = await fetch(firebasePath);
        
        if (!response.ok) {
            if (response.status === 404) {
                return res.status(200).json({ success: true, history: [] });
            }
            throw new Error(`Firebase error: ${response.status}`);
        }

        const data = await response.json();

        // ডেটা না থাকলে খালি অ্যারে রিটার্ন করবে
        if (!data) {
            return res.status(200).json({ success: true, history: [] });
        }

        let historyArray = [];

        // আপনার ডেটা অবজেক্ট আকারে আছে, সেটাকে অ্যারেতে রূপান্তর করা হচ্ছে
        // উদাহরণ: { "2026-11-22": { "taka": 250 } } => { date: "2026-11-22", taka: 250 }
        if (typeof data === 'object' && !Array.isArray(data)) {
            historyArray = Object.keys(data).map(dateStr => {
                return {
                    date: dateStr,
                    taka: data[dateStr].taka
                };
            });
        }

        // তারিখ অনুযায়ী সিরিয়ালি সাজানো (পুরনো থেকে নতুন)
        historyArray.sort((a, b) => new Date(a.date) - new Date(b.date));

        // সফলভাবে ডেটা রিটার্ন করা
        return res.status(200).json({ 
            success: true, 
            orderId: orderId, 
            history: historyArray 
        });

    } catch (error) {
        console.error("Error fetching order data:", error);
        return res.status(500).json({ 
            success: false, 
            error: 'ডেটা লোড করতে সমস্যা হয়েছে' 
        });
    }
}
