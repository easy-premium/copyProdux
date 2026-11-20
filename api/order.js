export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mobile, productId, price, dailyIncome, totalIncome } = req.body;
  const dbUrl = process.env.FIREBASE_DB_URL;
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!mobile || !price) return res.status(400).json({ error: 'Missing fields' });

  try {
    // ১. কারেন্ট ব্যালেন্স চেক
    const userRes = await fetch(`${dbUrl}/user/${mobile}.json?auth=${dbSecret}`);
    const user = await userRes.json();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentBalance = user["acount-balance"] || 0;
    if (currentBalance < price) {
      return res.status(400).json({ error: 'পর্যাপ্ত ব্যালেন্স নেই' });
    }

    // ২. নতুন ব্যালেন্স এবং প্রোডাক্ট ডেটা তৈরি
    const newBalance = currentBalance - price;
    const productData = {
      "product-total-income": totalIncome,
      "order-end-time": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), 
      "order-id": "ORD_" + Date.now(),
      "order-start-time": new Date().toISOString(),
      "product-daly-income": dailyIncome,
      "product-price": price
    };

    // ৩. ডেটাবেসে আপডেট (PATCH)
    const patchUrl = `${dbUrl}/user/${mobile}.json?auth=${dbSecret}`;
    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "acount-balance": newBalance,
        "product": productData,
        "amount-history": {
          "time": new Date().toISOString(),
          "transactionuid": { "amount": price, "info": "Purchased Product " + productId }
        }
      })
    });

    return res.status(200).json({ success: true, newBalance, product: productData });
  } catch (error) {
    return res.status(500).json({ error: 'অর্ডার ব্যর্থ হয়েছে' });
  }
}
