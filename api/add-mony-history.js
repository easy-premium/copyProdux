/**
 * add-mony-history.js
 * Vercel Serverless API (/api/add-mony-history) এর মাধ্যমে ডেটাবেজ থেকে ইউজারের লেনদেনের হিস্টোরি লোড করে।
 */

(function() {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================
  // আপনার তৈরি করা API এর এন্ডপয়েন্ট
  const API_ENDPOINT = '/api/add-mony-history'; 

  // ============================================================
  // STATE
  // ============================================================
  let currentUser = null;
  let allTransactions = [];
  let currentFilter = 'all';

  // ============================================================
  // UTILS
  // ============================================================
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const pad2 = (n) => String(n).padStart(2, '0');

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    let h = d.getHours();
    const m = pad2(d.getMinutes());
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ampm;
  }

  function getDateGroupLabel(iso) {
    if (!iso) return 'অজানা তারিখ';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'অজানা তারিখ';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    if (target.getTime() === today.getTime()) return 'আজ';
    if (target.getTime() === yest.getTime()) return 'গতকাল';
    return formatDate(iso);
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('toast--show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.remove('toast--show'), 2500);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // FETCH USER DATA (VIA VERCEL SERVERLESS API)
  // ============================================================
  async function fetchUserData(mobile) {
    try {
      // API তে রিকোয়েস্ট পাঠানো
      const res = await fetch(`${API_ENDPOINT}?mobile=${mobile}`);
      const data = await res.json();

      if (data.success) {
        return {
          mobile: data.mobile,
          balance: data.balance || 0,
          amountHistory: data.amountHistory || {},
          uid: data.uid || null,
        };
      } else {
        console.warn('API Error:', data.error);
        return null;
      }
    } catch (e) {
      console.error('Fetch Error:', e);
      return null;
    }
  }

  // ============================================================
  // PARSE TRANSACTIONS
  // ============================================================
  function parseTransactions(history) {
    if (!history || typeof history !== 'object') return [];
    const list = [];

    Object.keys(history).forEach((key) => {
      const item = history[key];
      if (!item || typeof item !== 'object') return;
      if (key === 'time') return; // Invalid key skip

      const amount = Number(item.amount || 0);
      const type = (item.type || '').toLowerCase();
      const info = item.info || '';
      const time = item.time || null;

      let category = 'default';
      let title = info || 'লেনদেন';
      let isPlus = false;

      // ডেটার ধরন অনুযায়ী ক্যাটাগরি নির্ধারণ
      if (type === 'purchase' || /purchase/i.test(info)) {
        category = 'purchase';
        title = 'ইনভেস্ট';
        isPlus = false;
      } else if (/deposit/i.test(info) || item.provider) {
        category = 'deposit';
        title = 'ডিপোজিট' + (item.provider ? ' (' + item.provider + ')' : '');
        isPlus = true;
      } else if (/withdraw/i.test(info)) {
        category = 'withdraw';
        title = 'উইথড্র';
        isPlus = false;
      } else if (/bonus|commission|refer/i.test(info)) {
        category = 'bonus';
        title = info || 'বোনাস';
        isPlus = true;
      } else if (/signup/i.test(info)) {
        category = 'bonus';
        title = 'সাইনআপ বোনাস';
        isPlus = true;
      }

      list.push({
        id: key,
        amount: amount,
        category: category,
        title: title,
        time: time,
        isPlus: isPlus,
        trxId: item.trx_id || key,
      });
    });

    // নতুন লেনদেন আগে দেখানোর জন্য সর্ট
    list.sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return tb - ta;
    });

    return list;
  }

  // ============================================================
  // RENDER UI
  // ============================================================
  function renderBalance(user) {
    const balEl = document.getElementById('balanceAmount');
    const mobEl = document.getElementById('userMobileDisplay');
    const cntEl = document.getElementById('txnCountDisplay');
    
    if (balEl) balEl.innerHTML = '<span>৳</span> ' + fmt(user.balance);
    if (mobEl) mobEl.textContent = user.mobile;
    if (cntEl) cntEl.textContent = allTransactions.length + ' লেনদেন';
  }

  function getIconSvg(category) {
    switch (category) {
      case 'deposit':
        return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
      case 'withdraw':
        return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
      case 'purchase':
        return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
      case 'bonus':
        return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>';
      default:
        return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
  }

  function renderTransactionList() {
    const listEl = document.getElementById('transactionList');
    if (!listEl) return;

    let filtered = allTransactions;
    if (currentFilter !== 'all') {
      filtered = allTransactions.filter(t => t.category === currentFilter);
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3 7h18v13H3z"/><path d="M3 7l2-4h14l2 4"/><path d="M9 12h6"/>' +
        '</svg>' +
        '<div>কোনো লেনদেন পাওয়া যায়নি</div>' +
      '</div>';
      return;
    }

    // তারিখ অনুযায়ী গ্রুপ করা
    const groups = {};
    filtered.forEach(t => {
      const key = t.time ? new Date(t.time).toDateString() : 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    // গ্রুপ গুলো সর্ট করা
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });

    let html = '';
    sortedKeys.forEach(k => {
      const items = groups[k];
      const label = k === 'unknown' ? 'অজানা তারিখ' : getDateGroupLabel(items[0].time);
      
      html += '<div class="txn-date-group">';
      html += '<div class="txn-date-label">' + label + '</div>';
      
      items.forEach(t => {
        const iconCls = 'txn-icon--' + t.category;
        const amtCls = t.isPlus ? 'txn-amount--plus' : 'txn-amount--minus';
        const sign = t.isPlus ? '+' : '−';
        
        html += '' +
          '<div class="txn-item">' +
            '<div class="txn-icon ' + iconCls + '">' + getIconSvg(t.category) + '</div>' +
            '<div class="txn-info">' +
              '<div class="txn-title">' + escapeHtml(t.title) + '</div>' +
              '<div class="txn-sub">' + escapeHtml(t.trxId) + '</div>' +
            '</div>' +
            '<div>' +
              '<div class="txn-amount ' + amtCls + '">' + sign + ' ৳' + fmt(t.amount) + '</div>' +
              '<div class="txn-time">' + formatTime(t.time) + '</div>' +
            '</div>' +
          '</div>';
      });
      html += '</div>';
    });

    listEl.innerHTML = html;
  }

  // ============================================================
  // CONTROLS
  // ============================================================
  window.setFilter = function(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(el => {
      el.classList.toggle('filter-tab--active', el.getAttribute('data-filter') === filter);
    });
    renderTransactionList();
  };

  window.goBack = function() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  // ============================================================
  // INITIALIZE APP
  // ============================================================
  async function init() {
    const params = new URLSearchParams(window.location.search);
    const mobile = params.get('user');

    if (!mobile) {
      document.getElementById('transactionList').innerHTML =
        '<div class="empty-state"><div>ইউজার পাওয়া যায়নি। অনুগ্রহ করে লগইন করুন।</div></div>';
      showToast('ইউজার পাওয়া যায়নি');
      return;
    }

    if (!/^01\d{9}$/.test(mobile)) {
      document.getElementById('transactionList').innerHTML =
        '<div class="empty-state"><div>সঠিক মোবাইল নম্বর নয়</div></div>';
      return;
    }

    // প্রাথমিক ব্যালেন্স দেখানো
    currentUser = { mobile: mobile, balance: 0 };
    renderBalance(currentUser);

    // ডেটা লোড করা
    const userData = await fetchUserData(mobile);
    if (!userData) {
      document.getElementById('transactionList').innerHTML =
        '<div class="empty-state"><div>ডেটা লোড করতে সমস্যা হয়েছে</div></div>';
      showToast('ডেটা লোড ব্যর্থ');
      return;
    }

    // ডেটা প্রসেস করে রেন্ডার করা
    currentUser = userData;
    allTransactions = parseTransactions(userData.amountHistory);

    renderBalance(currentUser);
    renderTransactionList();
  }

  // DOM লোড হলে রান হবে
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
