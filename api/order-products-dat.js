// api/order-products-dat.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { user_id, product_id } = req.query;

    if (!user_id || !product_id) {
        return res.status(400).json({ status: "error", message: "User ID অথবা Product ID দেওয়া হয়নি।" });
    }

    const FIREBASE_DB_URL1 = process.env.FIREBASE_DB_URL;
    const FIREBASE_DB_SECRET1 = process.env.FIREBASE_DB_SECRET;

    try {
        const userURL = `${FIREBASE_DB_URL1.replace(/\/$/, '')}/user/${user_id}/products/${product_id}.json?auth=${FIREBASE_DB_SECRET1}`;
        const userResponse = await fetch(userURL);
        const productData = await userResponse.json();

        if (!productData) {
            return res.status(404).json({ status: "error", message: "প্রোডাক্ট খুঁজে পাওয়া যায়নি।" });
        }

        return res.status(200).json({
            status: "success",
            product_name: productData['product-name'],
            auto_data: productData['autoadd-balance-dat'] || {}
        });

    } catch (error) {
        return res.status(500).json({ status: "error", message: "সার্ভারে সমস্যা হয়েছে।" });
    }
}
