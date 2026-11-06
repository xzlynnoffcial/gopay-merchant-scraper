// by:Lynd - Rena-chan
// [Refund] GoPay Merchant / GoBiz Transaction Refund Service
import { getDataHeaders } from './analytics.js';

/**
 * Melakukan refund dana transaksi GoPay / QRIS ke pembeli
 * Catatan: Membutuhkan role yang memiliki hak akses refund (Owner / Manajer / Kasir dengan izin)
 * @param {string} accessToken
 * @param {string} merchantId
 * @param {string} transactionId - ID transaksi yang akan di-refund
 * @param {object} [options]
 * @param {number} [options.amount] - Nominal refund (opsional, jika tidak diisi maka full refund)
 * @param {string} [options.reason='Permintaan Pembatalan / Out of Stock'] - Alasan refund
 * @returns {Promise<object>}
 */
export async function refundTransaction(accessToken, merchantId, transactionId, options = {}) {
  const {
    amount = null,
    reason = 'Permintaan Pembatalan / Out of Stock'
  } = options;

  if (!accessToken || !merchantId || !transactionId) {
    throw new Error('accessToken, merchantId, dan transactionId wajib diisi.');
  }

  const url = `https://api.gojekapi.com/v1/merchants/${merchantId}/transactions/${transactionId}/refund`;
  const payload = {
    reason: String(reason).slice(0, 100)
  };

  if (amount && Number(amount) > 0) {
    payload.amount = Math.floor(Number(amount));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: getDataHeaders(accessToken),
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.message || data.error || JSON.stringify(data);
    throw new Error(`[Refund Gagal] HTTP ${res.status}: ${errMsg}`);
  }

  return {
    success: true,
    transaction_id: transactionId,
    refund_details: data
  };
}
