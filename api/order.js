// api/order.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { mobile, productId, price, dailyIncome, totalIncome } = req.body;

    const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
    const dbSecret = process.env.FIREBASE_DB_SECRET;

    if (!dbUrl || !dbSecret) return res.status(500).json({ error: 'Database config missing' });

    const userUrl = `${dbUrl}/user/${mobile}.json?auth=${dbSecret}`;

    try {
        // ১. ইউজারের তথ্য চেক করা
        const userRes = await fetch(userUrl);
        const user = await userRes.json();

        if (!user) return res.status(404).json({ error: 'User not found' });

        const currentBalance = Number(user["acount-balance"]) || 0;
        if (currentBalance < price) return res.status(400).json({ error: 'পর্যাপ্ত ব্যালেন্স নেই' });

        // ২. গিটহাব থেকে produx.json ফাইলটি রিড করা (মেয়াদ এবং অন্যান্য তথ্যের জন্য)
        // এখানে আপনার গিটহাবের র' লিংকটি ব্যবহার করতে হবে
        const githubRawUrl = 'https://raw.githubusercontent.com/easy-premium/copyProdux/main/produx.json';
        const productRes = await fetch(githubRawUrl);
        const productData = await productRes.json();

        const productInfo = productData.products[productId];
        if (!productInfo) return res.status(404).json({ error: 'Product info not found' });

        // ডাটাবেজ থেকে মেয়াদ (expiry-date) নেওয়া হচ্ছে, না থাকলে ডিফল্ট ৯০ দিন
        const expiryDays = productInfo['expiry-date'] || 90;

        // ৩. নতুন ব্যালেন্স এবং অর্ডার আইডি তৈরি করা
        const newBalance = currentBalance - price;
        const orderId = "ORD_" + Date.now();
        
        // ৪. নতুন ট্রানজেকশন আইডি তৈরি করা
        const trx_id = "SM" + Math.floor(100000 + Math.random() * 900000);
        const currentTime = new Date().toISOString();

        // ৫. অটো ব্যালেন্স অ্যাড করার ডেট (Daily Income) ক্যালকুলেশন
        const autoAddBalanceData = {};
        let currentDate = new Date(); // আজকের তারিখ থেকে শুরু

        // ব্যাকএন্ডে বাংলাদেশ টাইম (UTC+6) ব্যবহার করার জন্য
        const bdOffset = 6 * 60 * 60 * 1000;
        
        for (let i = 0; i < expiryDays; i++) {
            // বর্তমান তারিখের সাথে দিন যোগ করা
            const targetDate = new Date(currentDate.getTime() + i * 24 * 60 * 60 * 1000 + bdOffset);
            
            // ফরম্যাট তৈরি: yyyy-dd-MM (আপনার ডাটাবেজের স্ক্রিনশট অনুযায়ী)
            const year = targetDate.getUTCFullYear();
            const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getUTCDate()).padStart(2, '0');
            
            const dateKey = `${year}-${day}-${month}`; // 2026-22-11
            
            // ঐ দিনের জন্য কত টাকা পাবে
            autoAddBalanceData[dateKey] = {
                taka: dailyIncome
            };
        }

        // ৬. প্রোডাক্টের সম্পূর্ণ তথ্য তৈরি করা (autoadd-balance-dat সহ)
        const newProduct = {
            "product-total-income": totalIncome,
            "order-end-time": new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
            "order-id": orderId,
            "order-start-time": currentTime,
            "product-daly-income": dailyIncome,
            "product-price": price,
            "product-name": productId,
            "autoadd-balance-dat": autoAddBalanceData // এখানে দিন অনুযায়ী টাকার তালিকা সেভ হচ্ছে
        };

        // ৭. ইউজারের ব্যালেন্স কাটা, প্রোডাক্ট অ্যাড করা এবং amount-history তে সম্পূর্ণ বিবরণ সেভ করা
        const updateData = {
            "acount-balance": newBalance,
            [`products/${orderId}`]: newProduct,
            [`amount-history/${trx_id}`]: {
                amount: price,
                time: currentTime,
                trx_id: trx_id,
                type: "purchase",
                product_name: productId,
                'acount-total-balance': newBalance,
                'acount-total-old-balance': currentBalance,
                info: `Purchased ${productId} (Order: ${orderId})`
            }
        };

        await fetch(userUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        // 🟢 ৮. কমিশন ডিস্ট্রিবিউশন (আপলাইনদের বোনাস দেওয়া)
        if (user.refBy && user.refBy !== "none") {
            // গ্লোবাল কমিশন রেট চেক করা
            const configRes = await fetch(`${dbUrl}/.json?auth=${dbSecret}&shallow=true`);
            const config = await configRes.json();
            
            const l1Rate = parseFloat(config["lavel-1-bonus"] || "0") / 100;
            const l2Rate = parseFloat(config["lavel-2-bonus"] || "0") / 100;
            const l3Rate = parseFloat(config["lavel-3-bonus"] || "0") / 100;

            // লেভেল ১ কমিশন
            const l1UserUrl = `${dbUrl}/user/${user.refBy}.json?auth=${dbSecret}`;
            const l1Res = await fetch(l1UserUrl);
            const l1User = await l1Res.json();

            if (l1User) {
                const l1Bonus = Math.round(price * l1Rate);
                const l1OldBalance = Number(l1User["acount-balance"]) || 0;
                const l1NewBalance = l1OldBalance + l1Bonus;
                const l1TrxId = "SM" + Math.floor(100000 + Math.random() * 900000);

                const l1UpdateData = {
                    "acount-balance": l1NewBalance,
                    [`amount-history/${l1TrxId}`]: {
                        amount: l1Bonus,
                        time: new Date().toISOString(),
                        trx_id: l1TrxId,
                        type: "commission",
                        from_user: mobile,
                        'acount-total-balance': l1NewBalance,
                        'acount-total-old-balance': l1OldBalance,
                        info: "Level 1 Commission"
                    }
                };

                await fetch(l1UserUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(l1UpdateData)
                });

                // লেভেল ২ কমিশন
                if (l1User.refBy && l1User.refBy !== "none" && l2Rate > 0) {
                    const l2UserUrl = `${dbUrl}/user/${l1User.refBy}.json?auth=${dbSecret}`;
                    const l2Res = await fetch(l2UserUrl);
                    const l2User = await l2Res.json();
                    
                    if (l2User) {
                        const l2Bonus = Math.round(price * l2Rate);
                        const l2OldBalance = Number(l2User["acount-balance"]) || 0;
                        const l2NewBalance = l2OldBalance + l2Bonus;
                        const l2TrxId = "SM" + Math.floor(100000 + Math.random() * 900000);

                        const l2UpdateData = {
                            "acount-balance": l2NewBalance,
                            [`amount-history/${l2TrxId}`]: {
                                amount: l2Bonus,
                                time: new Date().toISOString(),
                                trx_id: l2TrxId,
                                type: "commission",
                                from_user: mobile,
                                'acount-total-balance': l2NewBalance,
                                'acount-total-old-balance': l2OldBalance,
                                info: "Level 2 Commission"
                            }
                        };

                        await fetch(l2UserUrl, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(l2UpdateData)
                        });

                        // লেভেল ৩ কমিশন
                        if (l2User.refBy && l2User.refBy !== "none" && l3Rate > 0) {
                            const l3UserUrl = `${dbUrl}/user/${l2User.refBy}.json?auth=${dbSecret}`;
                            const l3Res = await fetch(l3UserUrl);
                            const l3User = await l3Res.json();
                            
                            if (l3User) {
                                const l3Bonus = Math.round(price * l3Rate);
                                const l3OldBalance = Number(l3User["acount-balance"]) || 0;
                                const l3NewBalance = l3OldBalance + l3Bonus;
                                const l3TrxId = "SM" + Math.floor(100000 + Math.random() * 900000);

                                const l3UpdateData = {
                                    "acount-balance": l3NewBalance,
                                    [`amount-history/${l3TrxId}`]: {
                                        amount: l3Bonus,
                                        time: new Date().toISOString(),
                                        trx_id: l3TrxId,
                                        type: "commission",
                                        from_user: mobile,
                                        'acount-total-balance': l3NewBalance,
                                        'acount-total-old-balance': l3OldBalance,
                                        info: "Level 3 Commission"
                                    }
                                };

                                await fetch(l3UserUrl, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(l3UpdateData)
                                });
                            }
                        }
                    }
                }
            }
        }

        // ৯. সফল রেসপন্স পাঠানো
        return res.status(200).json({ 
            success: true, 
            newBalance, 
            orderId, 
            product: newProduct, 
            trx_id 
        });

    } catch (error) {
        return res.status(500).json({ error: 'অর্ডার ব্যর্থ হয়েছে', details: error.message });
    }
}
