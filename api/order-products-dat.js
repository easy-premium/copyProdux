// api/order-products-dat.js

export default async function handler(req, res) {
    // CORS হেডার (যাতে ফ্রন্টএন্ড থেকে কল করা যায়)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // URL থেকে mobile এবং orderId বের করা
    const { mobile, orderId } = req.query;

    if (!mobile || !orderId) {
        return res.status(400).json({ error: 'Mobile and Order ID are required' });
    }

    // Vercel Environment Variables থেকে URL এবং Secret নেওয়া
    const dbUrl = process.env.FIREBASE_DB_URL;
    const dbSecret = process.env.FIREBASE_DB_SECRET;

    if (!dbUrl || !dbSecret) {
        console.error("FIREBASE_DB_URL অথবা FIREBASE_DB_SECRET সেট করা নেই।");
        return res.status(500).json({ error: 'Database configuration missing' });
    }

    try {
        // আপনার Firebase ডেটাবেসের সঠিক পাথটি এখানে দিন
        // উদাহরণ: /users/01325475745/products/ORD_1795354391434/autoadd-balance-dat.json?auth=SECRET
        const firebasePath = `${dbUrl}/users/${mobile}/products/${orderId}/autoadd-balance-dat.json?auth=${dbSecret}`;
        
        const response = await fetch(firebasePath);
        
        if (!response.ok) {
            // যদি ডেটা না পাওয়া যায় (404), তবে খালি অ্যারে রিটার্ন করবে
            if (response.status === 404) {
                return res.status(200).json({ success: true, history: [] });
            }
            throw new Error(`Firebase Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // যদি ডেটাবেসে কোনো ডেটা না থাকে
        if (!data) {
            return res.status(200).json({ success: true, history: [] });
        }

        // Firebase থেকে ডেটা সাধারণত Object আকারে আসে (Key-Value পেয়ার)
        // আমরা সেটাকে Array-তে রূপান্তর করব
        let historyArray = [];

        if (typeof data === 'object' && !Array.isArray(data)) {
            historyArray = Object.keys(data).map(key => {
                return {
                    id: key,
                    ...data[key]
                };
            });
        } else if (Array.isArray(data)) {
            historyArray = data;
        }

        // ডেটাগুলোকে তারিখ অনুযায়ী সিরিয়ালি সাজানো (পুরনো থেকে নতুন)
        historyArray.sort((a, b) => {
            // আপনার ডেটাবেসের ডেট ফিল্ডের নাম অনুযায়ী 'date', 'time' বা 'createdAt' ব্যবহার করুন
            const dateA = new Date(a.date || a.time || a.createdAt || 0);
            const dateB = new Date(b.date || b.time || b.createdAt || 0);
            return dateA - dateB;
        });

        // ফ্রন্টএন্ডে ডেটা পাঠানো
        return res.status(200).json({
            success: true,
            orderId: orderId,
            history: historyArray
        });

    } catch (error) {
        console.error("Error fetching order data from Firebase:", error);
        return res.status(500).json({ 
            success: false, 
            error: 'ডেটা লোড করতে সমস্যা হয়েছে' 
        });
    }
}
