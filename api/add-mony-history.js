// api/add-mony-history.js
export default async function handler(req, res) {
  // ব্রাউজার থেকে রিকোয়েস্ট অ্যাকসেপ্ট করার জন্য CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const { mobile } = req.query;

  if (!mobile) {
    return res.status(400).json({ success: false, error: 'Mobile number is required' });
  }

  try {
    const dbUrl = process.env.FIREBASE_DB_URL;
    const dbSecret = process.env.FIREBASE_DB_SECRET;

    if (!dbUrl || !dbSecret) {
      return res.status(500).json({ success: false, error: 'Database configuration missing' });
    }

    const cleanUrl = dbUrl.replace(/\/$/, '');
    const firebaseUrl = `${cleanUrl}/user/${mobile}.json?auth=${dbSecret}`;
    
    const response = await fetch(firebaseUrl);
    
    if (!response.ok) {
      throw new Error(`Firebase responded with ${response.status}`);
    }

    const data = await response.json();

    if (!data) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      mobile: mobile,
      balance: data['acount-balance'] || 0,
      amountHistory: data['amount-history'] || {},
      uid: data.uid || null
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
