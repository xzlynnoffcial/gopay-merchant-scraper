// by:Lynd - Rena-chan
// [CLI] Interactive CLI Tools for GoPay Merchant / GoBiz Scraper
import readline from 'node:readline';
import { GoPayMerchant } from './index.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (q) => new Promise((res) => rl.question(q, res));

const merchant = new GoPayMerchant({
  sessionPath: './session.json'
});

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║        GOPAY MERCHANT / GOBIZ CLI GATEWAY         ║');
  console.log('║      0% Fee • Dynamic QRIS • Real-time Poller     ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  while (true) {
    console.log('\n--- MENU PILIHAN ---');
    console.log('1. Login / Request OTP (Akun Kasir/Owner)');
    console.log('2. Verifikasi Kode OTP SMS');
    console.log('3. Set / Ubah QRIS Statis');
    console.log('4. Generate QRIS Dinamis');
    console.log('5. Cek Profil & Merchant ID');
    console.log('6. Cek Mutasi Transaksi Terbaru');
    console.log('7. Monitor / Tunggu Pembayaran (Poller)');
    console.log('0. Keluar');

    const choice = (await ask('\nPilih menu (0-7): ')).trim();

    try {
      if (choice === '1') {
        const phone = await ask('Masukkan Nomor HP (contoh: 08123456789): ');
        console.log('Mengirimkan OTP...');
        const res = await merchant.requestOtp(phone);
        console.log(`✅ OTP berhasil dikirim via SMS!`);
        console.log(`Token OTP : ${res.otp_token}`);
        console.log(`Masa Aktif: ${res.otp_expires_in} detik`);
        console.log('Silakan pilih menu 2 untuk verifikasi OTP.');
      } else if (choice === '2') {
        const otpToken = await ask('Masukkan otp_token: ');
        const otp = await ask('Masukkan 4 digit kode OTP dari SMS: ');
        console.log('Memverifikasi OTP...');
        const res = await merchant.verifyOtp(otp, otpToken);
        console.log('✅ Login Berhasil! Sesi disimpan ke session.json.');
        console.log('Merchant ID Terdeteksi:', merchant.merchantId || '-');
      } else if (choice === '3') {
        const qris = await ask('Masukkan string QRIS Statis: ');
        merchant.staticQris = qris.trim();
        merchant.saveSession();
        console.log('✅ QRIS Statis berhasil disimpan ke session.json!');
      } else if (choice === '4') {
        const amount = await ask('Masukkan nominal pembayaran (Rp): ');
        const res = merchant.createDynamicQris(amount);
        console.log('\n=== HASIL QRIS DINAMIS ===');
        console.log('Nominal   : Rp', Number(res.amount).toLocaleString('id-ID'));
        console.log('QR String :', res.qris_string);
        console.log('\n(Bisa disalin dan dijadikan QR code gambar via qrcode generator/bot)');
      } else if (choice === '5') {
        console.log('Mengambil profil merchant...');
        const list = await merchant.getMerchants();
        console.log('Daftar Merchant:', JSON.stringify(list, null, 2));
      } else if (choice === '6') {
        const minutes = (await ask('Rentang waktu mundur (menit, default 30): ')) || '30';
        console.log(`Mengambil mutasi ${minutes} menit terakhir...`);
        const txs = await merchant.getRecentTransactions({ lookbackMinutes: Number(minutes) });
        console.log(`\n=== Ditemukan ${txs.length} transaksi ===`);
        for (const tx of txs) {
          const nominal = typeof tx.gross_amount === 'number' ? tx.gross_amount / 100 : 0;
          console.log(`[${tx.status}] Rp ${nominal.toLocaleString('id-ID')} | ID: ${tx.id || tx.order_id} | Waktu: ${tx.transaction_time}`);
        }
      } else if (choice === '7') {
        const amount = await ask('Nominal yang ditunggu (Rp): ');
        const timeout = (await ask('Timeout (detik, default 300): ')) || '300';
        console.log(`\nMemulai pemantauan pembayaran Rp ${Number(amount).toLocaleString('id-ID')}...`);
        const res = await merchant.waitForPayment(amount, {
          timeoutSeconds: Number(timeout),
          intervalSeconds: 3,
          onPoll: ({ attempt, elapsed }) => {
            process.stdout.write(`\r[Poll #${attempt}] Berjalan selama ${elapsed}s... `);
          }
        });
        console.log('');
        if (res.found) {
          console.log('🎉 PEMBAYARAN BERHASIL DITERIMA!');
          console.log('Detail Transaksi:', JSON.stringify(res.transaction, null, 2));
        } else {
          console.log('❌ PEMBAYARAN KEDALUWARSA / TIDAK DITEMUKAN.');
        }
      } else if (choice === '0') {
        console.log('Selesai.');
        break;
      } else {
        console.log('Pilihan tidak valid.');
      }
    } catch (err) {
      console.error('\n❌ Terjadi Kesalahan:', err.message);
    }
  }

  rl.close();
}

main().catch(console.error);
