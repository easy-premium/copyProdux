export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!dbUrl || !dbSecret) {
    return res.status(500).json({ error: 'Database config missing' });
  }

  try {
    // ফায়ারবেস থেকে গ্লোবাল কনফিগারেশন (বোনাস এবং কমিশন) রিড করা
    const response = await fetch(`${dbUrl}/.json?auth=${dbSecret}&shallow=true`);
    const config = await response.json();

    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    // ডেটাবেস থেকে ডেটা রিটার্ন করা
    return res.status(200).json({
      success: true,
      referBonus: Number(config["refer-bonus"] || 0),
      level1: config["lavel-1-bonus"] || "0%",
      level2: config["lavel-2-bonus"] || "0%",
      level3: config["lavel-3-bonus"] || "0%"
    });
  } catch (error) {
    return res.status(500).json({ error: 'সার্ভার এরর', details: error.message });
  }
}
