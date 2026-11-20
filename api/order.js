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

    const newProduct = {
      "product-total-income": totalIncome,
      "order-end-time": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      "order-id": orderId,
      "order-start-time": new Date().toISOString(),
      "product-daly-income": dailyIncome,
      "product-price": price,
      "product-name": productId
    };

    // ১. ইউজারের ব্যালেন্স কাটা এবং প্রোডাক্ট অ্যাড করা
    await fetch(userUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "acount-balance": newBalance,
        [`products/${orderId}`]: newProduct,
        "amount-history": {
          "time": new Date().toISOString(),
          "transactionuid": { "amount": price, "info": "Purchased " + productId }
        }
      })
    });

    // 🟢 ২. কমিশন ডিস্ট্রিবিউশন (আপলাইনদের বোনাস দেওয়া)
    if (user.refBy && user.refBy !== "none") {
      // গ্লোবাল কমিশন রেট চেক করা
      const configRes = await fetch(`${dbUrl}/.json?auth=${dbSecret}&shallow=true`);
      const config = await configRes.json();
      
      const l1Rate = parseFloat(config["lavel-1-bonus"] || "0") / 100;
      const l2Rate = parseFloat(config["lavel-2-bonus"] || "0") / 100;
      const l3Rate = parseFloat(config["lavel-3-bonus"] || "0") / 100;

      // লেভেল ১ কমিশন
      const l1UserUrl = `${dbUrl}/user/${user.refBy}.json?auth=${dbSecret}`;
      const l1Res = await fetch(l1UserUrl);
      const l1User = await l1Res.json();

      if (l1User) {
        const l1Bonus = Math.round(price * l1Rate);
        await fetch(l1UserUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "acount-balance": (l1User["acount-balance"] || 0) + l1Bonus,
            "amount-history": { "time": new Date().toISOString(), "transactionuid": { "amount": l1Bonus, "info": "Level 1 Commission" } }
          })
        });

        // লেভেল ২ কমিশন
        if (l1User.refBy && l1User.refBy !== "none" && l2Rate > 0) {
          const l2UserUrl = `${dbUrl}/user/${l1User.refBy}.json?auth=${dbSecret}`;
          const l2Res = await fetch(l2UserUrl);
          const l2User = await l2Res.json();
          if (l2User) {
            const l2Bonus = Math.round(price * l2Rate);
            await fetch(l2UserUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                "acount-balance": (l2User["acount-balance"] || 0) + l2Bonus,
                "amount-history": { "time": new Date().toISOString(), "transactionuid": { "amount": l2Bonus, "info": "Level 2 Commission" } }
              })
            });

            // লেভেল ৩ কমিশন
            if (l2User.refBy && l2User.refBy !== "none" && l3Rate > 0) {
              const l3UserUrl = `${dbUrl}/user/${l2User.refBy}.json?auth=${dbSecret}`;
              const l3Res = await fetch(l3UserUrl);
              const l3User = await l3Res.json();
              if (l3User) {
                const l3Bonus = Math.round(price * l3Rate);
                await fetch(l3UserUrl, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    "acount-balance": (l3User["acount-balance"] || 0) + l3Bonus,
                    "amount-history": { "time": new Date().toISOString(), "transactionuid": { "amount": l3Bonus, "info": "Level 3 Commission" } }
                  })
                });
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ success: true, newBalance, orderId, product: newProduct });
  } catch (error) {
    return res.status(500).json({ error: 'অর্ডার ব্যর্থ হয়েছে', details: error.message });
  }
}
