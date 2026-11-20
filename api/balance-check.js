export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mobile } = req.query;
  const dbUrl = process.env.FIREBASE_DB_URL;
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

  try {
    const response = await fetch(`${dbUrl}/user/${mobile}.json?auth=${dbSecret}`);
    const user = await response.json();

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ 
      success: true, 
      balance: user["acount-balance"] || 0,
      product: user.product || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'সার্ভার এরর' });
  }
}
