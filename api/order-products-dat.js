/* =========================================================
   ORDER PRODUCTS AUTO ADD BALANCE DATA
   ========================================================= */

// API থেকে ডেটা লোড করার ফাংশন
async function fetchOrderHistory(mobile, orderId) {
    try {
        const res = await fetch(`/api/user/${mobile}/products/${orderId}/autoadd-balance-dat`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        return data;
    } catch (error) {
        console.error("Error fetching order history:", error);
        return { success: false, history: [] };
    }
}

// UI-তে ডেটা রেন্ডার করার ফাংশন
function renderOrderHistory(historyList) {
    if (!historyList || historyList.length === 0) {
        return `<div style="text-align:center;padding:20px;color:#666;">কোনো ডেটা পাওয়া যায়নি।</div>`;
    }

    return historyList.map(item => {
        // status 'paid' হলে (অতিবৃদ্ধ) সবুজ ব্যাকগ্রাউন্ড, আর 'upcoming' হলে (ভবিষ্যৎ) হলুদ ব্যাকগ্রাউন্ড
        const bgColor = item.status === 'paid' ? '#E8F5E9' : '#FFF3E0';
        const textColor = item.status === 'paid' ? '#2E7D32' : '#EF6C00';
        const statusText = item.status === 'paid' ? 'প্রাপ্ত' : 'বাকি';

        return `
            <div style="
                display: flex; 
                justify-content: space-between; 
                align-items: center;
                padding: 12px 16px; 
                margin-bottom: 10px; 
                background: ${bgColor}; 
                border-left: 4px solid ${textColor};
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                font-family: 'Hind Siliguri', sans-serif;
            ">
                <div>
                    <div style="font-size: 14px; font-weight: 700; color: #333;">${item.date}</div>
                    <div style="font-size: 12px; color: #666;">${item.time}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 15px; font-weight: 800; color: ${textColor};">৳ ${item.amount}</div>
                    <div style="font-size: 10px; color: ${textColor}; font-weight: 600;">${statusText}</div>
                </div>
            </div>
        `;
    }).join('');
}

// মূল ফাংশন যা অর্ডারে ক্লিক করলে কল হবে
async function openOrderDetails(mobile, orderId) {
    // ডায়ালগ বা নতুন পেজ দেখানোর জন্য
    showDialog('অটো অ্যাড ব্যালেন্স ডেটails', '<div style="text-align:center;padding:20px;">লোড হচ্ছে...</div>', 'ঠিক আছে', () => {});

    const data = await fetchOrderHistory(mobile, orderId);
    let historyList = [];

    if (data.success && data.history) {
        historyList = data.history;
    }

    // ডেটা সিরিয়ালি সাজানো (তারিখ অনুযায়ী)
    historyList.sort((a, b) => new Date(a.date) - new Date(b.date));

    const htmlContent = renderOrderHistory(historyList);

    // ডায়ালগ আপডেট করা
    document.getElementById('dlgTitle').textContent = 'অটো অ্যাড ব্যালেন্স ডেটails';
    document.getElementById('dlgBody').innerHTML = htmlContent;
    document.getElementById('dlgBtn').textContent = 'ঠিক আছে';
    document.getElementById('dlgBody').style.maxHeight = '60vh';
    document.getElementById('dlgBody').style.overflowY = 'auto';
}
