// api/bonus.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mobile } = req.body;

  if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

  try {
    const dbUrl = process.env.FIREBASE_DB_URL.replace(/\/$/, '');
    const dbSecret = process.env.FIREBASE_DB_SECRET;
    
    // ১. ডাটাবেজ থেকে বোনাসের পরিমাণ এবং ইউজারের ডেটা চেক করা
    const [bonusRes, userRes] = await Promise.all([
      fetch(`${dbUrl}/daily-bonus.json?auth=${dbSecret}`),
      fetch(`${dbUrl}/user/${mobile}.json?auth=${dbSecret}`)
    ]);

    const dailyBonusAmount = await bonusRes.json();
    const userData = await userRes.json();

    if (!userData) return res.status(404).json({ error: 'User not found' });
    
    // যদি ডাটাবেজে daily-bonus সেট না থাকে, তবে ডিফল্ট ১০ ধরা হবে
    const BONUS_AMOUNT = Number(dailyBonusAmount) || 10; 

    // ২. আজকের তারিখ বের করা
    const today = new Date().toISOString().split('T')[0];

    // ৩. চেক করা আজ কি বোনাস নেওয়া হয়েছে?
    const lastBonusDate = userData['last-bonus-date'];
    if (lastBonusDate === today) {
      return res.status(400).json({ error: 'আপনি আজকের বোনাস ইতিমধ্যে গ্রহণ করেছেন। আগামীকাল আবার চেষ্টা করুন।' });
    }

    // ৪. নতুন ব্যালেন্স ও হিস্টোরি তৈরি করা
    const currentBalance = Number(userData['acount-balance'] || 0);
    const newBalance = currentBalance + BONUS_AMOUNT;
    const timeNow = new Date().toISOString();
    const trxId = 'BONUS_' + Date.now();

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

    // ৫. ডাটাবেজে আপডেট পাঠানো
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
