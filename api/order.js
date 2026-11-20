export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mobile, productId, price, dailyIncome, totalIncome } = req.body;
  const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!dbUrl || !dbSecret) return res.status(500).json({ error: 'Database config missing' });

  const userUrl = `${dbUrl}/user/${mobile}.json?auth=${dbSecret}`;

  try {
    const userRes = await fetch(userUrl);
    const user = await userRes.json();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentBalance = user["acount-balance"] || 0;
    if (currentBalance < price) return res.status(400).json({ error: 'পর্যাপ্ত ব্যালেন্স নেই' });

    const newBalance = currentBalance - price;
    const orderId = "ORD_" + Date.now();

    // নতুন প্রোডাক্ট অবজেক্ট
    const newProduct = {
      "product-total-income": totalIncome,
      "order-end-time": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      "order-id": orderId,
      "order-start-time": new Date().toISOString(),
      "product-daly-income": dailyIncome,
      "product-price": price,
      "product-name": productId
    };

    // ডেটাবেসে আপডেট (ব্যালেন্স মাইনাস এবং নতুন প্রোডাক্ট যোগ)
    await fetch(userUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "acount-balance": newBalance,
        [`products/${orderId}`]: newProduct, // products অবজেক্টের ভেতর নতুন অর্ডার
        "amount-history": {
          "time": new Date().toISOString(),
          "transactionuid": { "amount": price, "info": "Purchased " + productId }
        }
      })
    });

    return res.status(200).json({ success: true, newBalance, orderId, product: newProduct });
  } catch (error) {
    return res.status(500).json({ error: 'অর্ডার ব্যর্থ হয়েছে' });
  }
}
