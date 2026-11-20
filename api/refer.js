export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mobile } = req.query;
  
  if (!mobile) return res.status(400).json({ error: 'Mobile required' });

  // এখানে আপনার ডোমেইন সেট করুন
  const domain = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://yourdomain.com';
  const refLink = `${domain}/?ref=${mobile}`;

  return res.status(200).json({ success: true, refLink });
}
