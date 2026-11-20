export default async function handler(req, res) {
  // CORS হেডার
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, mobile, password, refCode } = req.body;
  const dbUrl = process.env.FIREBASE_DB_URL;
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  // ১. Environment Variable চেক
  if (!dbUrl || !dbSecret) {
    return res.status(500).json({ error: 'Database configuration missing. Check Vercel Env Vars.' });
  }

  // ২. স্পেস বা নিউলাইন চেক (গুরুত্বপূর্ণ)
  if (dbUrl.trim() !== dbUrl || dbSecret.trim() !== dbSecret) {
    return res.status(500).json({ error: 'Environment variables contain extra spaces or newlines. Please re-enter them in Vercel.' });
  }

  // ৩. ইনপুট ভ্যালিডেশন
  if (!mobile || !/^01\d{9}$/.test(mobile)) {
    return res.status(400).json({ error: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন' });
  }
  if (!action || (action !== 'login' && action !== 'register')) {
    return res.status(400).json({ error: 'Invalid action specified' });
  }

  const apiUrl = `${dbUrl}/user/${mobile}.json?auth=${dbSecret}`;

  try {
    if (action === 'login') {
      const response = await fetch(apiUrl);
      const user = await response.json();

      if (!user) {
        return res.status(404).json({ error: 'এই মোবাইল নম্বরে অ্যাকাউন্ট নেই' });
      }
      // পাসওয়ার্ড চেক (আপনার ডেটাবেসে পাসওয়ার্ড না থাকলে এখানে চেক বাদ দিন)
      return res.status(200).json({ success: true, user });
    } 
    
    else if (action === 'register') {
      const checkRes = await fetch(apiUrl);
      const existingUser = await checkRes.json();
      
      if (existingUser) {
        return res.status(400).json({ error: 'এই নম্বরে অ্যাকাউন্ট আছে' });
      }

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

      const saveRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        return res.status(500).json({ error: 'Firebase write failed', details: errText });
      }

      return res.status(200).json({ success: true, user: newUser });
    }
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: 'সার্ভার এরর', details: error.message });
  }
}
