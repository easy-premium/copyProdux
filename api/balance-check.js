export default async function handler(req, res) {
  // CORS হেডার সেট করা
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

  if (!mobile) {
    return res.status(400).json({ error: 'Mobile number required' });
  }

  try {
    const response = await fetch(`${dbUrl}/user/${mobile}.json?auth=${dbSecret}`);
    const user = await response.json();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 🟢 এখানে শুধুমাত্র ব্যালেন্স এবং বেসিক ইনফরমেশন রিটার্ন করা হচ্ছে (products নেই)
    return res.status(200).json({ 
      success: true, 
      balance: Number(user["acount-balance"]) || 0,
      refBy: user.refBy || "none",
      uid: user.uid || "N/A"
    });
  } catch (error) { 
    return res.status(500).json({ error: 'সার্ভার এরর', details: error.message }); 
  }
}
