export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, mobile, password, refCode } = req.body;
  const dbUrl = process.env.FIREBASE_DB_URL;
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!dbUrl || !dbSecret) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  const apiUrl = `${dbUrl}/user/${mobile}.json?auth=${dbSecret}`;

  try {
    if (action === 'login') {
      const response = await fetch(apiUrl);
      const user = await response.json();

      if (!user) {
        return res.status(404).json({ error: 'এই মোবাইল নম্বরে অ্যাকাউন্ট নেই' });
      }

      // পাসওয়ার্ড চেক (আপনার বর্তমান JSON এ পাসওয়ার্ড নেই, তাই ডেমো হিসেবে যেকোনো পাসওয়ার্ড নিচ্ছে)
      // প্রোডাকশনে ডেটাবেসে পাসওয়ার্ড হ্যাশ করে রাখতে হবে
      
      return res.status(200).json({ success: true, user });
    } 
    
    else if (action === 'register') {
      // চেক করুন ইউজার আগে থেকেই আছে কিনা
      const checkRes = await fetch(apiUrl);
      const existingUser = await checkRes.json();
      if (existingUser) {
        return res.status(400).json({ error: 'এই নম্বরে অ্যাকাউন্ট আছে' });
      }

      // নতুন ইউজার অবজেক্ট তৈরি (আপনার JSON ফরম্যাট অনুযায়ী)
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
        "uid": "UID_" + Date.now()
      };

      // ডেটাবেসে সেভ করুন
      await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      return res.status(200).json({ success: true, user: newUser });
    }
  } catch (error) {
    return res.status(500).json({ error: 'সার্ভার এরর', details: error.message });
  }
}
