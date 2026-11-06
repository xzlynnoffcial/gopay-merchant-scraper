// by:Lynd - Rena-chan
// [Auth] GoBiz / GoPay Merchant Authentication & Token Management
import crypto from 'node:crypto';

/**
 * Normalisasi format nomor telepon ke format lokal tanpa 0/62/+62
 * Contoh: 08123456789 -> 8123456789
 * @param {string} phone
 * @returns {string}
 */
export function cleanPhoneNumber(phone) {
  let p = String(phone || '').replace(/[^0-9]/g, '');
  if (p.startsWith('62')) p = p.slice(2);
  else if (p.startsWith('0')) p = p.slice(1);
  return p;
}

/**
 * Header standar untuk request otentikasi GoBiz Web Dashboard
 * @param {string} uniqueId - UUID unik perangkat
 */
export function getAuthHeaders(uniqueId = null) {
  const uid = uniqueId || crypto.randomUUID();
  return {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id',
    'Authentication-Type': 'go-id',
    'Content-Type': 'application/json',
    'Gojek-Country-Code': 'ID',
    'Gojek-Timezone': 'Asia/Jakarta',
    'Origin': 'https://portal.gofoodmerchant.co.id',
    'Referer': 'https://portal.gofoodmerchant.co.id/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'X-AppVersion': 'platform-v3.107.0-94ce5d57',
    'X-PhoneMake': 'Windows 10 64-bit',
    'X-PhoneModel': 'Chrome 149.0.0.0 on Windows 10 64-bit',
    'X-Platform': 'Web',
    'X-User-Locale': 'en-US',
    'X-User-Type': 'merchant',
    'x-DeviceOS': 'Web',
    'x-appId': 'go-biz-web-dashboard',
    'x-uniqueid': uid
  };
}

/**
 * Mengirimkan permintaan OTP SMS ke nomor HP merchant / kasir
 * @param {string} phone - Nomor telepon
 * @param {string} [uniqueId] - Opsional UUID perangkat
 * @returns {Promise<{ success: boolean, otp_token: string, otp_expires_in: number, phone: string, unique_id: string }>}
 */
export async function requestOtp(phone, uniqueId = null) {
  const cleanPhone = cleanPhoneNumber(phone);
  const uid = uniqueId || crypto.randomUUID();

  const payload = {
    client_id: 'go-biz-web-new',
    phone_number: cleanPhone,
    country_code: '62',
    login_type: 'otp'
  };

  const res = await fetch('https://api.gobiz.co.id/goid/login/request', {
    method: 'POST',
    headers: getAuthHeaders(uid),
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    const errMsg = data.errors?.[0]?.message || data.message || JSON.stringify(data);
    throw new Error(`[Request OTP Gagal] HTTP ${res.status}: ${errMsg}`);
  }

  const otpData = data.data || {};
  return {
    success: true,
    phone: cleanPhone,
    unique_id: uid,
    otp_token: otpData.otp_token || data.otp_token || '',
    otp_expires_in: otpData.otp_expires_in || 720,
    timer_seconds: otpData.next_state?.timer_in_seconds || 120
  };
}

/**
 * Menukarkan 4 digit kode OTP dengan Access Token dan Refresh Token GoBiz
 * @param {string} otp - 4 digit kode OTP yang diterima lewat SMS
 * @param {string} otpToken - Token yang didapat dari requestOtp
 * @param {string} uniqueId - UUID perangkat saat requestOtp
 * @returns {Promise<{ success: boolean, access_token: string, refresh_token: string, expires_in: number }>}
 */
export async function verifyOtp(otp, otpToken, uniqueId) {
  if (!otp || !otpToken) {
    throw new Error('Kode OTP dan otp_token wajib diisi.');
  }

  const payload = {
    client_id: 'go-biz-web-new',
    grant_type: 'otp',
    data: {
      otp: String(otp).trim(),
      otp_token: otpToken
    }
  };

  const res = await fetch('https://api.gobiz.co.id/goid/token', {
    method: 'POST',
    headers: getAuthHeaders(uniqueId),
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    const errMsg = data.errors?.[0]?.message || data.message || JSON.stringify(data);
    throw new Error(`[Verifikasi OTP Gagal] HTTP ${res.status}: ${errMsg}`);
  }

  return {
    success: true,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 86400
  };
}

/**
 * Memperbarui access_token yang kedaluwarsa menggunakan refresh_token
 * @param {string} refreshToken - Refresh token tersimpan
 * @param {string} [uniqueId] - UUID perangkat
 * @returns {Promise<{ success: boolean, access_token: string, refresh_token: string }>}
 */
export async function refreshToken(refreshToken, uniqueId = null) {
  if (!refreshToken) {
    throw new Error('refresh_token tidak boleh kosong.');
  }

  const payload = {
    client_id: 'go-biz-web-new',
    grant_type: 'refresh_token',
    data: {
      refresh_token: refreshToken
    }
  };

  const res = await fetch('https://api.gobiz.co.id/goid/token', {
    method: 'POST',
    headers: getAuthHeaders(uniqueId),
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    const errMsg = data.errors?.[0]?.message || data.message || JSON.stringify(data);
    throw new Error(`[Refresh Token Gagal] HTTP ${res.status}: ${errMsg}`);
  }

  return {
    success: true,
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken
  };
}
