// by:Lynd - Rena-chan
// [EMVCo] QRIS Utility - Dynamic QRIS Generator & Parser

/**
 * Menghitung checksum CRC16-CCITT (False) standar EMVCo
 * Polynomial: 0x1021, Initial: 0xFFFF
 * @param {string} str - Payload QRIS tanpa 4 digit checksum akhir
 * @returns {string} 4 karakter Hex Uppercase
 */
export function computeCRC16CCITT(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Parsing array field TLV (Tag-Length-Value) EMVCo
 * @param {string} qrisString
 * @returns {Array<{ tag: string, len: number, val: string }>}
 */
export function parseTLV(qrisString) {
  const tags = [];
  let i = 0;
  const raw = String(qrisString || '').trim();

  while (i < raw.length) {
    const tag = raw.substring(i, i + 2);
    const len = parseInt(raw.substring(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > raw.length) break;
    const val = raw.substring(i + 4, i + 4 + len);
    tags.push({ tag, len, val });
    i += 4 + len;
  }
  return tags;
}

/**
 * Mengubah QRIS Statis GoPay Merchant menjadi QRIS Dinamis (0% Fee)
 * Berdasarkan standar spesifikasi EMVCo TLV:
 * - Mengubah Tag 01 dari '11' (Static) menjadi '12' (Dynamic)
 * - Menyuntikkan Tag 54 (Transaction Amount)
 * - Menghitung ulang Tag 63 (CRC16-CCITT)
 * @param {string} staticQris - String QRIS Statis (biasanya diawali 000201...)
 * @param {number|string} amount - Nominal pembayaran (contoh: 15000)
 * @returns {string} String QRIS Dinamis siap scan
 */
export function buildDynamicQRIS(staticQris, amount) {
  if (!staticQris || typeof staticQris !== 'string') {
    throw new Error('QRIS statis wajib berupa string EMVCo yang valid.');
  }

  const tags = parseTLV(staticQris);
  if (!tags.length) {
    throw new Error('Format QRIS tidak valid atau gagal diparsing.');
  }

  const amountStr = String(Math.floor(Number(amount)));
  if (!amountStr || Number(amountStr) <= 0) {
    throw new Error('Nominal transaksi harus lebih besar dari 0.');
  }

  // Buang tag CRC16 (63) jika sudah ada di input
  const filtered = tags.filter((t) => t.tag !== '63');

  // Tag 01: Point of Initiation Method -> 12 (Dynamic)
  const tag01 = filtered.find((t) => t.tag === '01');
  if (tag01) tag01.val = '12';

  // Tag 54: Transaction Amount
  const tag54 = filtered.find((t) => t.tag === '54');
  if (tag54) {
    tag54.val = amountStr;
  } else {
    // Sisipkan setelah Tag 53 (Currency) atau sebelum Tag 58 (Country Code)
    const idx53 = filtered.findIndex((t) => t.tag === '53');
    const idx58 = filtered.findIndex((t) => t.tag === '58');
    const insertIdx = idx53 !== -1 ? idx53 + 1 : (idx58 !== -1 ? idx58 : filtered.length);
    filtered.splice(insertIdx, 0, { tag: '54', val: amountStr });
  }

  // Rekonstruksi TLV string
  let payload = '';
  for (const item of filtered) {
    const v = String(item.val);
    payload += item.tag + String(v.length).padStart(2, '0') + v;
  }

  // Tambahkan Tag 63 Length 04
  payload += '6304';
  const checksum = computeCRC16CCITT(payload);
  return payload + checksum;
}

/**
 * Parsing ringkasan data merchant dari string QRIS
 * @param {string} qrisString
 * @returns {object} Object berisi informasi merchant dan transaksi
 */
export function parseQRIS(qrisString) {
  const tags = parseTLV(qrisString);
  const map = {};
  for (const t of tags) {
    map[t.tag] = t.val;
  }

  return {
    version: map['00'],
    pointOfInitiation: map['01'] === '12' ? 'DYNAMIC' : 'STATIC',
    merchantCategory: map['52'],
    currency: map['53'] === '360' ? 'IDR' : map['53'],
    amount: map['54'] || null,
    countryCode: map['58'],
    merchantName: map['59'] || null,
    merchantCity: map['60'] || null,
    postalCode: map['61'] || null,
    rawTags: map
  };
}
