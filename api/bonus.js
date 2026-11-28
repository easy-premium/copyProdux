// api/bonus.js
export default async function handler(req, res) {
  // CORS সেটআপ
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dbUrl = process.env.FIREBASE_DB_URL.replace(/\/$/, '');
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  // ==========================================
  // ১. GET রিকোয়েস্ট: শুধু বোনাসের পরিমাণ চেক করা
  // ==========================================
  if (req.method === 'GET') {
    try {
      const bonusRes = await fetch(`${dbUrl}/daily-bonus.json?auth=${dbSecret}`);
      const bonusData = await bonusRes.json();
      
      let amount = 10; // ডিফল্ট
      if (typeof bonusData === 'object' && bonusData !== null) {
         amount = Number(bonusData.amount || bonusData.value || 10);
      } else if (bonusData) {
         amount = Number(bonusData);
      }

      return res.status(200).json({ success: true, amount: amount });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to fetch bonus amount' });
    }
  }

  // ==========================================
  // ২. POST রিকোয়েস্ট: ইউজারকে বোনাস দেওয়া
  // ==========================================
  if (req.method === 'POST') {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

    try {
      const [bonusRes, userRes] = await Promise.all([
        fetch(`${dbUrl}/daily-bonus.json?auth=${dbSecret}`),
        fetch(`${dbUrl}/user/${mobile}.json?auth=${dbSecret}`)
      ]);

      const bonusData = await bonusRes.json();
      const userData = await userRes.json();

      if (!userData) return res.status(404).json({ error: 'User not found' });
      
      let BONUS_AMOUNT = 10;
      if (typeof bonusData === 'object' && bonusData !== null) {
         BONUS_AMOUNT = Number(bonusData.amount || bonusData.value || 10);
      } else if (bonusData) {
         BONUS_AMOUNT = Number(bonusData);
      }

      const today = new Date().toISOString().split('T')[0];

      // চেক করা আজ বোনাস নেওয়া হয়েছে কিনা
      if (userData['last-bonus-date'] === today) {
        return res.status(400).json({ error: 'আপনি আজকের বোনাস ইতিমধ্যে গ্রহণ করেছেন। আগামীকাল আবার চেষ্টা করুন।' });
      }

      const currentBalance = Number(userData['acount-balance'] || 0);
      const newBalance = currentBalance + BONUS_AMOUNT;
      const timeNow = new Date().toISOString();
      const trxId = 'BONUS_' + Date.now();

      // ডাটাবেজে আপডেট
      const updates = {
        'acount-balance': newBalance,
        'last-bonus-date': today,
        [`amount-history/${trxId}`]: {
          amount: BONUS_AMOUNT,
          info: 'Daily Login Bonus',
          type: 'bonus',
          time: timeNow,
          trx_id: trxId
        }
      };

      const updateRes = await fetch(`${dbUrl}/user/${mobile}.json?auth=${dbSecret}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!updateRes.ok) throw new Error('Failed to update database');

      return res.status(200).json({
        success: true,
        message: 'সফলভাবে বোনাস গ্রহণ করা হয়েছে!',
        newBalance: newBalance,
        amount: BONUS_AMOUNT
      });

    } catch (error) {
      console.error('Bonus API Error:', error);
      return res.status(500).json({ error: 'সার্ভার সমস্যা, পরে আবার চেষ্টা করুন।' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
