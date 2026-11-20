export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mobile } = req.query;
  const dbUrl = process.env.FIREBASE_DB_URL;
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!mobile) return res.status(400).json({ error: 'Mobile required' });

  try {
    // সব ইউজার ডেটা নিয়ে আসা
    const response = await fetch(`${dbUrl}/user.json?auth=${dbSecret}`);
    const allUsers = await response.json();

    if (!allUsers) return res.status(200).json({ success: true, team: [] });

    // যে সব ইউজারের refBy === mobile
    const team = Object.keys(allUsers)
      .filter(key => allUsers[key].refBy === mobile)
      .map(key => ({
        mobile: key,
        joinDate: allUsers[key]["amount-history"]?.time || 'Unknown',
        totalIncome: allUsers[key]["product"]?.["product-total-income"] || 0
      }));

    return res.status(200).json({ success: true, team });
  } catch (error) {
    return res.status(500).json({ error: 'সার্ভার এরর' });
  }
}
