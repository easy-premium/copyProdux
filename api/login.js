export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, mobile, password, refCode } = req.body;
  const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!dbUrl || !dbSecret) return res.status(500).json({ error: 'Database config missing' });

  const userUrl = `${dbUrl}/user/${mobile}.json?auth=${dbSecret}`;

  try {
    if (action === 'login') {
      const response = await fetch(userUrl);
      const user = await response.json();
      if (!user) return res.status(404).json({ error: 'এই মোবাইল নম্বরে অ্যাকাউন্ট নেই' });
      return res.status(200).json({ success: true, user });
    } 
    
    else if (action === 'register') {
      const checkRes = await fetch(userUrl);
      const existingUser = await checkRes.json();
      if (existingUser !== null) return res.status(400).json({ error: 'এই নম্বরে অ্যাকাউন্ট আছে' });

      const configRes = await fetch(`${dbUrl}/.json?auth=${dbSecret}`);
      const config = await configRes.json();
      
      // 🟢 Number() দিয়ে সঠিকভাবে সংখ্যায় কনভার্ট করা হচ্ছে
      const referBonus = Number(config["refer-bonus"] || 0);

      let finalRefCode = refCode && refCode.trim() !== "" ? refCode.trim() : "none";

      const newUser = {
        "acount-balance": referBonus, // 🟢 এখন সঠিক সংখ্যা সেভ হবে
        "amount-history": {
          "time": new Date().toISOString(),
          "transactionuid": { 
            "amount": referBonus, 
            "info": "Signup Bonus" 
          }
        },
        "products": {}, 
        "refBy": finalRefCode,
        "uid": "UID_" + Date.now()
      };

      await fetch(userUrl, {
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
