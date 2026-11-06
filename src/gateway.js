// by:Lynd - Rena-chan
// [Gateway] High-level GoPay Merchant Gateway with Auto Session & Auto Refresh
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildDynamicQRIS, parseQRIS } from './qris.js';
import { requestOtp, verifyOtp, refreshToken } from './auth.js';
import { getRecentTransactions, pollIncomingPayment, searchMerchants } from './analytics.js';
import { refundTransaction } from './refund.js';

export class GoPayMerchant {
  /**
   * @param {object} [config]
   * @param {string} [config.sessionPath] - Path file JSON untuk menyimpan sesi token
   * @param {string} [config.staticQris] - String QRIS Statis GoPay Merchant
   * @param {string} [config.merchantId] - ID Merchant (contoh: G123456789)
   * @param {string} [config.merchantName] - Nama Toko / Merchant
   * @param {string} [config.phone] - Nomor HP login GoBiz
   */
  constructor(config = {}) {
    this.sessionPath = config.sessionPath || null;
    this.staticQris = config.staticQris || '';
    this.merchantId = config.merchantId || '';
    this.merchantName = config.merchantName || 'Merchant GoPay';
    this.phone = config.phone || '';
    this.accessToken = config.accessToken || '';
    this.refreshToken = config.refreshToken || '';
    this.uniqueId = config.uniqueId || crypto.randomUUID();

    if (this.sessionPath) {
      this.loadSession();
    }
  }

  loadSession() {
    try {
      if (this.sessionPath && fs.existsSync(this.sessionPath)) {
        const raw = fs.readFileSync(this.sessionPath, 'utf-8');
        const data = JSON.parse(raw);
        this.staticQris = data.static_qris || data.qris_string || this.staticQris;
        this.merchantId = data.merchant_id || this.merchantId;
        this.merchantName = data.merchant_name || this.merchantName;
        this.phone = data.phone || this.phone;
        this.accessToken = data.access_token || this.accessToken;
        this.refreshToken = data.refresh_token || this.refreshToken;
        this.uniqueId = data.unique_id || this.uniqueId;
      }
    } catch (e) {
      console.error('[GoPayMerchant] Gagal membaca session file:', e.message);
    }
  }

  saveSession() {
    try {
      if (this.sessionPath) {
        const dir = path.dirname(this.sessionPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const data = {
          merchant_id: this.merchantId,
          merchant_name: this.merchantName,
          static_qris: this.staticQris,
          phone: this.phone,
          access_token: this.accessToken,
          refresh_token: this.refreshToken,
          unique_id: this.uniqueId,
          updated_at: new Date().toISOString()
        };
        fs.writeFileSync(this.sessionPath, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error('[GoPayMerchant] Gagal menyimpan session file:', e.message);
    }
  }

  // --- Auth Flow ---
  async requestOtp(phone = null) {
    const targetPhone = phone || this.phone;
    if (!targetPhone) throw new Error('Nomor telepon wajib diisi untuk request OTP.');
    this.phone = targetPhone;
    const res = await requestOtp(targetPhone, this.uniqueId);
    return res;
  }

  async verifyOtp(otp, otpToken) {
    const res = await verifyOtp(otp, otpToken, this.uniqueId);
    this.accessToken = res.access_token;
    this.refreshToken = res.refresh_token;
    this.saveSession();

    // Auto discover merchant ID jika belum ada
    try {
      const merchants = await this.getMerchants();
      if (merchants.length > 0) {
        this.merchantId = merchants[0].id || merchants[0].merchant_id || this.merchantId;
        this.merchantName = merchants[0].name || merchants[0].merchant_name || this.merchantName;
        this.saveSession();
      }
    } catch {}

    return res;
  }

  async refresh() {
    if (!this.refreshToken) throw new Error('refresh_token tidak tersedia.');
    const res = await refreshToken(this.refreshToken, this.uniqueId);
    this.accessToken = res.access_token;
    if (res.refresh_token) this.refreshToken = res.refresh_token;
    this.saveSession();
    return this.accessToken;
  }

  // Wrapper with auto 401 token refresh
  async callWithAuth(fn) {
    try {
      return await fn(this.accessToken);
    } catch (err) {
      if (err.message && (err.message.includes('401') || err.message.includes('revoked'))) {
        console.warn('[GoPayMerchant] Token expired / 401, merefresh token otomatis...');
        await this.refresh();
        return await fn(this.accessToken);
      }
      throw err;
    }
  }

  // --- Merchant & Transactions ---
  async getMerchants() {
    return await this.callWithAuth((token) => searchMerchants(token));
  }

  async getRecentTransactions(options = {}) {
    if (!this.merchantId) throw new Error('merchantId belum diatur.');
    return await this.callWithAuth((token) => getRecentTransactions(token, this.merchantId, options));
  }

  // --- Dynamic QRIS ---
  createDynamicQris(amount, staticQrisOverride = null) {
    const qrisSource = staticQrisOverride || this.staticQris;
    if (!qrisSource) {
      throw new Error('QRIS statis belum diatur. Masukkan static_qris di config atau panggil dengan staticQrisOverride.');
    }
    const numAmount = Math.max(1, Math.floor(Number(amount)));
    const dynamicQris = buildDynamicQRIS(qrisSource, numAmount);
    return {
      success: true,
      amount: numAmount,
      qris_string: dynamicQris,
      merchant_name: this.merchantName,
      created_at: new Date().toISOString()
    };
  }

  parseQris(qrisString = null) {
    return parseQRIS(qrisString || this.staticQris);
  }

  // --- Payment Poller ---
  async waitForPayment(amount, options = {}) {
    if (!this.merchantId) throw new Error('merchantId belum diatur.');
    return await this.callWithAuth((token) =>
      pollIncomingPayment(token, this.merchantId, amount, options)
    );
  }

  // --- Refund ---
  async refund(transactionId, options = {}) {
    if (!this.merchantId) throw new Error('merchantId belum diatur.');
    return await this.callWithAuth((token) =>
      refundTransaction(token, this.merchantId, transactionId, options)
    );
  }
}
