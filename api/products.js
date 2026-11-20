export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { mobile } = req.query;
  const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!dbUrl || !dbSecret) {
    return res.status(500).json({ error: 'Database config missing' });
  }

  try {
    // 🟢 ১. মেইন প্রোডাক্ট লিস্ট (VIP1 - VIP6) সেটআপ
    const allProducts = {
      vip1: { name:'VIP1', price:1000,  dailyIncome:250,   totalIncome:25000,   image:'https://easy-premium.github.io/copyProdux/produx/image1.txt' },
      vip2: { name:'VIP2', price:3000,  dailyIncome:789,   totalIncome:78900,   image:'https://easy-premium.github.io/copyProdux/produx/image2.txt' },
      vip3: { name:'VIP3', price:6000,  dailyIncome:1666,  totalIncome:166600,  image:'https://easy-premium.github.io/copyProdux/produx/image3.txt' },
      vip4: { name:'VIP4', price:12000, dailyIncome:3530,  totalIncome:353000,  image:'https://easy-premium.github.io/copyProdux/produx/image4.txt' },
      vip5: { name:'VIP5', price:25000, dailyIncome:8333,  totalIncome:833300,  image:'https://easy-premium.github.io/copyProdux/produx/image5.txt' },
      vip6: { name:'VIP6', price:50000, dailyIncome:17857, totalIncome:1785700, image:'https://easy-premium.github.io/copyProdux/produx/image6.txt' }
    };

    let userProducts = {};
    let balance = 0;
    let refBy = "none";
    let uid = "N/A";

    // 🟢 ২. ইউজারের ডেটা থাকলে তার কেনা প্রোডাক্ট এবং ব্যালেন্স বের করা
    if (mobile) {
      const response = await fetch(`${dbUrl}/user/${mobile}.json?auth=${dbSecret}`);
      const user = await response.json();

      if (user) {
        userProducts = user.products || {};
        balance = Number(user["acount-balance"]) || 0;
        refBy = user.refBy || "none";
        uid = user.uid || "N/A";
      }
    }

    // 🟢 ৩. সব ডেটা একসাথে রেসপন্স করা
    return res.status(200).json({
      success: true,
      allProducts: allProducts,     // ওয়েবসাইটে শো করার জন্য সব প্রোডাক্ট
      purchasedProducts: userProducts, // ইউজার যা কিনেছে
      balance: balance,
      refBy: refBy,
      uid: uid
    });

  } catch (error) {
    return res.status(500).json({ error: 'সার্ভার এরর', details: error.message });
  }
}
