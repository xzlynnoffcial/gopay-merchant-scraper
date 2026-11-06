// by:Lynd - Rena-chan
// [Example] Contoh Penggunaan GoPay Merchant / GoBiz SDK

import { GoPayMerchant } from './index.js';

// 1. Inisialisasi dengan konfigurasi atau file session JSON
const merchant = new GoPayMerchant({
  sessionPath: './session.json',
  staticQris: '00020101021126610014COM.GO-JEK.WWW01189360091400000000000210G0000000000303UMI51440014ID.CO.QRIS.WWW0215ID10000000000000303UMI5204549953033605802ID5916Toko Contoh Demo6007JAKARTA61051234562070703A016304ABCD',
  merchantId: 'G000000000',
  merchantName: 'Toko Contoh Demo'
});

async function main() {
  console.log('=== 1. GENERATE QRIS DINAMIS (0% FEE) ===');
  const nominal = 25000;
  const qris = merchant.createDynamicQris(nominal);
  console.log('Nominal   :', qris.amount);
  console.log('QRIS String:', qris.qris_string);

  console.log('\n=== 2. PARSING TAG QRIS ===');
  const parsed = merchant.parseQris(qris.qris_string);
  console.log('Merchant Name:', parsed.merchantName);
  console.log('Currency     :', parsed.currency);
  console.log('Amount       :', parsed.amount);

  /*
  // === 3. CONTOH LOGIN OTP (Hanya perlu sekali) ===
  console.log('\n=== 3. REQUEST OTP LOGIN ===');
  const otpRes = await merchant.requestOtp('081234567890');
  console.log('OTP terkirim via SMS. Token:', otpRes.otp_token);

  // Masukkan 4 digit OTP dari SMS
  const verifyRes = await merchant.verifyOtp('1234', otpRes.otp_token);
  console.log('Login Berhasil! Token tersimpan di session.json');

  // === 4. CEK MUTASI TRANSAKSI TERAKHIR ===
  console.log('\n=== 4. CEK MUTASI TRANSAKSI ===');
  const txList = await merchant.getRecentTransactions({ lookbackMinutes: 60 });
  console.log(`Ditemukan ${txList.length} transaksi:`);
  for (const tx of txList) {
    console.log(`- ID: ${tx.id} | Rp ${tx.gross_amount / 100} | Status: ${tx.status} | Waktu: ${tx.transaction_time}`);
  }

  // === 5. POLLING MENUNGGU PEMBAYARAN MASUK ===
  console.log('\n=== 5. MENUNGGU PEMBAYARAN MASUK ===');
  const result = await merchant.waitForPayment(25000, {
    timeoutSeconds: 300, // 5 menit
    intervalSeconds: 3,
    onPoll: ({ attempt, elapsed }) => {
      console.log(`[Poll #${attempt}] Menunggu pembayaran Rp 25.000 (${elapsed}s)...`);
    }
  });

  if (result.found) {
    console.log('✅ Pembayaran Berhasil Diterima!', result.transaction);
  } else {
    console.log('❌ Pembayaran Kedaluwarsa!');
  }
  */
}

main().catch(console.error);
