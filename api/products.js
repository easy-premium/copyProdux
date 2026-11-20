export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { mobile } = req.query;
  const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!mobile) return res.status(400).json({ error: 'Mobile required' });

  try {
    const response = await fetch(`${dbUrl}/user/${mobile}.json?auth=${dbSecret}`);
    const user = await response.json();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // ব্যালেন্স এবং প্রোডাক্ট লিস্ট সঠিকভাবে রিটার্ন করা
    return res.status(200).json({
      success: true,
      balance: Number(user["acount-balance"]) || 0,
      products: user.products || {},
      refBy: user.refBy || "none",
      uid: user.uid || "N/A"
    });
  } catch (error) {
    return res.status(500).json({ error: 'সার্ভার এরর', details: error.message });
  }
}
