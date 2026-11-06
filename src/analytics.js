// by:Lynd - Rena-chan
// [Analytics] GoBiz / GoPay Merchant Transactions & Settlement Poller

export function getDataHeaders(accessToken) {
  if (!accessToken) throw new Error('accessToken wajib diisi.');
  return {
    'Accept': 'application/json, text/plain, */*',
    'Authentication-Type': 'go-id',
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Origin': 'https://portal.gofoodmerchant.co.id',
    'Referer': 'https://portal.gofoodmerchant.co.id/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
  };
}

/**
 * Mencari profil merchant dan outlet yang terhubung dengan akun
 * @param {string} accessToken
 * @returns {Promise<Array<object>>}
 */
export async function searchMerchants(accessToken) {
  const url = 'https://api.gobiz.co.id/v1/merchants/search';
  const body = JSON.stringify({ from: 0, size: 20 });

  const res = await fetch(url, {
    method: 'POST',
    headers: getDataHeaders(accessToken),
    body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Search Merchants Gagal] HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  return data.merchants || data || [];
}

/**
 * Mengambil profil detail user login saat ini
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
export async function getUserProfile(accessToken) {
  const url = 'https://api.gobiz.co.id/v1/users/me';
  const res = await fetch(url, {
    method: 'GET',
    headers: getDataHeaders(accessToken)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[User Profile Gagal] HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }

  return await res.json();
}

/**
 * Mengambil riwayat mutasi transaksi real-time dari GoBiz Analytics
 * @param {string} accessToken
 * @param {string} merchantId - Contoh: G123456789
 * @param {object} [options]
 * @param {number} [options.lookbackMinutes=30] - Rentang waktu mundur (menit)
 * @param {string} [options.statuses='SETTLEMENT,CAPTURE,REFUND,PARTIAL_REFUND']
 * @param {string} [options.paymentTypes='QRIS,GOPAY']
 * @param {number} [options.size=20]
 * @returns {Promise<Array<object>>}
 */
export async function getRecentTransactions(accessToken, merchantId, options = {}) {
  const {
    lookbackMinutes = 30,
    statuses = 'SETTLEMENT,CAPTURE,REFUND,PARTIAL_REFUND',
    paymentTypes = 'QRIS,GOPAY',
    from = 0,
    size = 20
  } = options;

  const now = new Date();
  const startTime = new Date(now.getTime() - lookbackMinutes * 60 * 1000).toISOString();
  const endTime = now.toISOString();

  const params = new URLSearchParams({
    from: String(from),
    size: String(size),
    statuses,
    payment_types: paymentTypes,
    start_time: startTime,
    end_time: endTime,
    merchant_ids: merchantId
  });

  const url = `https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getDataHeaders(accessToken)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Get Transactions Gagal] HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  return data.transactions || [];
}

/**
 * Helper untuk menunggu pembayaran masuk dengan nominal spesifik (Polling)
 * @param {string} accessToken
 * @param {string} merchantId
 * @param {number} targetAmount - Nominal rupiah yang dicari
 * @param {object} [options]
 * @param {number} [options.timeoutSeconds=900] - Default 15 menit
 * @param {number} [options.intervalSeconds=3] - Interval polling (detik)
 * @param {number} [options.createdTimestamp] - Timestamp pesan dibuat
 * @param {function} [options.onPoll] - Callback tiap tick polling
 * @returns {Promise<{ found: boolean, transaction?: object, message?: string }>}
 */
export async function pollIncomingPayment(accessToken, merchantId, targetAmount, options = {}) {
  const {
    timeoutSeconds = 900,
    intervalSeconds = 3,
    createdTimestamp = Date.now(),
    onPoll = null
  } = options;

  const startTime = Date.now();
  const endTime = startTime + (timeoutSeconds * 1000);
  let attempt = 0;

  while (Date.now() < endTime) {
    attempt++;
    if (onPoll) onPoll({ attempt, elapsed: Math.floor((Date.now() - startTime) / 1000) });

    try {
      const txList = await getRecentTransactions(accessToken, merchantId, { lookbackMinutes: 30 });
      for (const tx of txList) {
        const txAmount = typeof tx.gross_amount === 'number' ? tx.gross_amount / 100 : 0;
        const txTimeMs = new Date(tx.transaction_time || tx.settlement_time || 0).getTime();

        // Cek kecocokan nominal dan buffer waktu (tidak lebih lama dari 60 detik sebelum invoice dibuat)
        if (Math.floor(txAmount) === Math.floor(targetAmount) && txTimeMs >= (createdTimestamp - 60000)) {
          return {
            found: true,
            status: 'SUCCESS',
            amount: txAmount,
            transaction_id: tx.id || tx.order_id,
            paid_at: tx.transaction_time || tx.settlement_time,
            transaction: tx
          };
        }
      }
    } catch (err) {
      // Ignore network hiccup during poll
      if (err.message && err.message.includes('401')) {
        throw err; // Lempar jika token expired
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }

  return {
    found: false,
    status: 'EXPIRED',
    message: `Waktu pembayaran telah habis (${timeoutSeconds}s)`
  };
}
