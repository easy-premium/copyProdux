export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, mobile, password, refCode } = req.body;
  const dbUrl = process.env.FIREBASE_DB_URL;
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!dbUrl || !dbSecret) {
    return res.status(500).json({ error: 'Database config missing' });
  }

  const apiUrl = `${dbUrl}/user/${mobile}.json?auth=${dbSecret}`;

  try {
    if (action === 'login') {
      const response = await fetch(apiUrl);
      const user = await response.json();

      if (!user) {
        return res.status(404).json({ error: 'এই মোবাইল নম্বরে অ্যাকাউন্ট নেই' });
      }
      return res.status(200).json({ success: true, user });
    } 
    
    else if (action === 'register') {
      // ১. ডেটাবেসে ইউজার আগে থেকেই আছে কিনা চেক
      const checkRes = await fetch(apiUrl);
      const existingUser = await checkRes.json();
      
      if (existingUser) {
        // ইউজার থাকলে ৪০০ এরর পাঠাবে
        return res.status(400).json({ error: 'এই নম্বরে অ্যাকাউন্ট আছে' });
      }

      // ২. নতুন ইউজার তৈরি
      const newUser = {
        "acount-balance": 0,
        "amount-history": {
          "time": new Date().toISOString(),
          "transactionuid": { "amount": 0, "info": "Account Created" }
        },
        "product": {
          "product-total-income": 0,
          "order-end-time": "",
          "order-id": "",
          "order-start-time": "",
          "product-daly-income": 0,
          "product-price": 0
        },
        "uid": "UID_" + Date.now(),
        "refBy": refCode || "none"
      };

      // ৩. ডেটাবেসে সেভ করা
      const saveRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save to Firebase');
      }

      return res.status(200).json({ success: true, user: newUser });
    }
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: 'সার্ভার এরর', details: error.message });
  }
}
