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

        // ২. নতুন ব্যালেন্স এবং অর্ডার আইডি তৈরি করা
        const newBalance = currentBalance - price;
        const orderId = "ORD_" + Date.now();
        
        // ৩. নতুন ট্রানজেকশন আইডি তৈরি করা (SM + ৬ ডিজিটের র‍্যান্ডম সংখ্যা)
        const trx_id = "SM" + Math.floor(100000 + Math.random() * 900000);
        const currentTime = new Date().toISOString();

        // ৪. প্রোডাক্টের তথ্য তৈরি করা
        const newProduct = {
            "product-total-income": totalIncome,
            "order-end-time": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            "order-id": orderId,
            "order-start-time": currentTime,
            "product-daly-income": dailyIncome,
            "product-price": price,
            "product-name": productId
        };

        // ৫. ইউজারের ব্যালেন্স কাটা, প্রোডাক্ট অ্যাড করা এবং amount-history তে সম্পূর্ণ বিবরণ সেভ করা
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

        // 🟢 ৬. কমিশন ডিস্ট্রিবিউশন (আপলাইনদের বোনাস দেওয়া)
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

        // ৭. সফল রেসপন্স পাঠানো
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
