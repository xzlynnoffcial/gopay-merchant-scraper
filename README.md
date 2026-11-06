# GoPay Merchant / GoBiz Scraper & Dynamic QRIS SDK

Modul mandiri (**Zero External Dependencies**) berbasis Node.js murni untuk integrasi pembayaran langsung **GoPay Merchant (GoBiz)**.
Mendukung pembuatan **QRIS Dinamis 0% Fee**, pemantauan mutasi transaksi real-time melalui API internal GoBiz Analytics, penanganan auto-refresh token, dan eksekusi pengembalian dana (refund) otomatis.

Kompatibel dengan Node.js v18+, VPS Linux, Termux Android, WhatsApp Bot, dan server REST API.

Credit: `by:Lynd - Lia-chan`

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Arsitektur & Cara Kerja](#-arsitektur--cara-kerja)
  - [1. Standar EMVCo TLV & Injeksi Tag 54](#1-standar-emvco-tlv--injeksi-tag-54)
  - [2. Alur Otentikasi & Refresh Token](#2-alur-otentikasi--refresh-token)
  - [3. Polling Mutasi Transaksi Real-time](#3-polling-mutasi-transaksi-real-time)
  - [4. Layanan Refund Dana](#4-layanan-refund-dana)
- [Struktur Repositori](#-struktur-repositori)
- [Panduan Penggunaan](#-panduan-penggunaan)
  - [Persiapan](#persiapan)
  - [Penggunaan Interaktif CLI](#penggunaan-interaktif-cli)
  - [Penggunaan dalam Kode (Programmatic)](#penggunaan-dalam-kode-programmatic)
- [⚠️ Analisis Risiko & Peringatan Keamanan](#️-analisis-risiko--peringatan-keamanan)
  - [1. Risiko Pembatasan & Penangguhan Akun](#1-risiko-pembatasan--penangguhan-akun)
  - [2. Wajib Gunakan Akun Kasir (Least Privilege)](#2-wajib-gunakan-akun-kasir-least-privilege)
  - [3. Pengamanan Sesi & Kredensial](#3-pengamanan-sesi--kredensial)
  - [4. Mitigasi Tabrakan Nominal Seragam](#4-mitigasi-tabrakan-nominal-seragam)
- [Disclaimer & Lisensi](#-disclaimer--lisensi)

---

## 🌟 Fitur Utama

- **0% Biaya Gateway (Tanpa Fee / Tanpa Potongan)**: Menggunakan QRIS Statis merchant milik sendiri yang dikonversi menjadi QRIS Dinamis. Uang 100% langsung masuk ke rekening bank merchant tanpa potongan pihak ketiga.
- **Zero External Dependencies**: Dibangun murni menggunakan modul bawaan Node.js (`fetch` & `node:crypto`). Tidak memerlukan instalasi paket tambahan (bebas dari overhead npm packages).
- **Auto 401 Interceptor**: Mendeteksi token kedaluwarsa secara otomatis dan menukarkan `refresh_token` di latar belakang tanpa mengganggu jalannya transaksi.
- **Dukungan Penuh Akun Kasir**: Aman dipasang di server backend menggunakan nomor sub-user (Kasir) tanpa mengekspos akun Owner utama.
- **CLI Siap Pakai**: Disertai antarmuka baris perintah (`cli.js`) untuk mempermudah login, request OTP SMS, pengujian QRIS, dan inspeksi riwayat transaksi.

---

## ⚙️ Arsitektur & Cara Kerja

### 1. Standar EMVCo TLV & Injeksi Tag 54

QRIS di Indonesia mengikuti spesifikasi **EMVCo MPM (Merchant-Presented Mode)** berbasis format **TLV (Tag-Length-Value)**.

Secara default, aplikasi GoPay Merchant menyediakan **QRIS Statis**:
- Tag `01` bernilai `11` (Static QR Code).
- Tidak memuat Tag `54` (Transaction Amount), sehingga pembeli harus mengetik nominal pembayaran secara manual.

Modul `src/qris.js` bekerja dengan membedah seluruh segmen TLV:
1. Memotong 4 karakter checksum lama di Tag `63`.
2. Mengubah nilai Tag `01` menjadi `12` (**Dynamic QR Code**).
3. Menyisipkan **Tag `54`** yang memuat nominal tagihan terformat (misal nominal Rp 25.000 menjadi `540525000`).
4. Menghitung ulang nilai **CRC16-CCITT (False)** dengan polinomial `0x1021` dan nilai awal `0xFFFF` pada string baru, kemudian menempelkannya kembali pada Tag `63`.

Hasilnya adalah string QRIS Dinamis yang mengunci nominal pembayaran secara otomatis di aplikasi perbankan atau e-wallet pelanggan.

### 2. Alur Otentikasi & Refresh Token

Handshake otentikasi GoBiz Web Dashboard (`src/auth.js`):
1. **Request OTP**: Mengirimkan request ke `https://api.gobiz.co.id/goid/login/request` menggunakan identifier nomor HP terdaftar. Server Gojek akan mengirimkan 4 digit kode OTP melalui SMS.
2. **Token Exchange**: Menukarkan OTP dan `otp_token` ke endpoint `https://api.gobiz.co.id/goid/token` dengan grant type `otp`. Server mengembalikan `access_token` (JWT berumur ~24 jam) dan `refresh_token`.
3. **Session Refresh**: Saat `access_token` kedaluwarsa (HTTP 401), gateway otomatis melakukan refresh token ke endpoint token dengan grant type `refresh_token`.

### 3. Polling Mutasi Transaksi Real-time

Untuk memverifikasi pembayaran (`src/analytics.js`):
- Melakukan kueri ke endpoint analitik transaksi internal:  
  `GET https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions`
- Parameter filter:
  - `statuses=SETTLEMENT,CAPTURE,REFUND,PARTIAL_REFUND`
  - `payment_types=QRIS,GOPAY`
  - Rentang waktu transaksi (`start_time` & `end_time`)
- Sistem membandingkan nominal (`gross_amount`) dan toleransi jendela waktu pembayaran terhadap waktu pembuatan invoice (buffer toleransi 60 detik).

### 4. Layanan Refund Dana

Jika terjadi pembatalan order atau stok kosong (`src/refund.js`):
- Mengirimkan instruksi ke:  
  `POST https://api.gojekapi.com/v1/merchants/{merchant_id}/transactions/{transaction_id}/refund`
- Saldo pembayaran akan langsung dikembalikan ke saldo GoPay / rekening asal milik pembeli.

---

## 📁 Struktur Repositori

```text
gopay-merchant-scraper/
├── src/
│   ├── qris.js       # Parser TLV EMVCo, Tag 54 Injector & CRC16-CCITT
│   ├── auth.js       # Handshake Login OTP SMS & Token Refresh GoBiz
│   ├── analytics.js  # Query Mutasi Transaksi & Poller Pembayaran Real-time
│   ├── refund.js     # Layanan Refund Transaksi
│   └── gateway.js    # Class High-Level GoPayMerchant
├── cli.js            # Tool CLI Interaktif (Terminal / Termux)
├── example.js        # Contoh Penggunaan Kode
├── test.js           # Unit Test Mandiri
├── config.example.json # Template Konfigurasi Sesi Kosong
├── LICENSE           # Lisensi MIT
└── package.json
```

---

## 🚀 Panduan Penggunaan

### Persiapan

Pastikan Anda telah memasang Node.js versi 18 atau lebih baru:
```bash
node -v
```

Jalankan pengujian logika mandiri untuk memastikan kompatibilitas environment:
```bash
node test.js
```

---

### Penggunaan Interaktif CLI

Gunakan CLI untuk melakukan proses login pertama kali dan generate QRIS tanpa perlu menulis kode:
```bash
node cli.js
```

**Alur Penggunaan CLI:**
1. Pilih menu `1` untuk meminta OTP SMS ke nomor kasir / merchant Anda.
2. Pilih menu `2`, masukkan `otp_token` dan 4 digit kode yang Anda terima via SMS.
3. Pilih menu `3`, masukkan string QRIS Statis dari aplikasi GoPay Merchant Anda.
4. Pilih menu `4`, masukkan nominal tagihan untuk mendapatkan string QRIS Dinamis.
5. Pilih menu `6` untuk memeriksa mutasi transaksi terbaru.
6. Pilih menu `7` untuk menjalankan listener/poller menunggu pembayaran masuk.

---

### Penggunaan dalam Kode (Programmatic)

```javascript
import { GoPayMerchant } from './index.js';

// 1. Inisialisasi Gateway
const merchant = new GoPayMerchant({
  sessionPath: './session.json', // File penyimpanan otomatis token dan sesi
  merchantId: 'G123456789',      // ID Merchant GoBiz Anda
  merchantName: 'Toko Saya',
  staticQris: '0002010102112661...' // String QRIS Statis GoPay Merchant Anda
});

async function run() {
  // 2. Generate QRIS Dinamis Nominal Rp 15.000
  const qris = merchant.createDynamicQris(15000);
  console.log('String QRIS Dinamis:', qris.qris_string);

  // 3. Menunggu Pembayaran (Timeout 5 Menit, Interval 3 Detik)
  console.log('Menunggu pembeli melakukan scan...');
  const result = await merchant.waitForPayment(15000, {
    timeoutSeconds: 300,
    intervalSeconds: 3,
    onPoll: ({ attempt, elapsed }) => {
      console.log(`[Poll #${attempt}] Waktu berjalan: ${elapsed}s`);
    }
  });

  if (result.found) {
    console.log('✅ Pembayaran Sukses Diterima!');
    console.log('ID Transaksi:', result.transaction_id);
    console.log('Waktu Bayar :', result.paid_at);
  } else {
    console.log('❌ Pembayaran Kedaluwarsa.');
  }

  // 4. Ambil 10 Transaksi Terakhir
  const recentTxs = await merchant.getRecentTransactions({ lookbackMinutes: 60 });
  console.log('Riwayat Transaksi:', recentTxs);
}

run().catch(console.error);
```

---

## ⚠️ Analisis Risiko & Peringatan Keamanan

Harap pahami seluruh batasan dan risiko keamanan sebelum mengimplementasikan modul ini pada infrastruktur produksi Anda:

### 1. Risiko Pembatasan & Penangguhan Akun
- Modul ini berinteraksi dengan API internal aplikasi web GoBiz (`api.gobiz.co.id` dan `api.gojekapi.com`) yang tidak dipublikasikan secara resmi untuk publik.
- **Rate Limiting**: Melakukan polling transaksi dengan frekuensi yang terlalu agresif (misal di bawah 2 detik) dapat memicu pemblokiran IP berupa HTTP `429 Too Many Requests` atau investigasi anomali oleh sistem keamanan GoTo Financial.
- **Saran**: Gunakan interval polling minimal **3 hingga 5 detik**.

### 2. Wajib Gunakan Akun Kasir (Least Privilege)
- **JANGAN PERNAH** menggunakan kredensial akun **Owner (Pemilik Utama)** pada server atau hosting aplikasi.
- **Gunakan Peran Kasir**:
  1. Buka aplikasi GoPay Merchant di perangkat fisik Owner.
  2. Masuk ke menu **Kelola Pegawai / Peran** dan tambahkan nomor baru dengan peran **Kasir**.
  3. Buka aplikasi GoPay Merchant sekali di perangkat nomor Kasir untuk verifikasi/aktivasi.
  4. Gunakan nomor Kasir tersebut untuk login di SDK ini.
- **Alasan**: Akun kasir hanya memiliki hak akses membaca riwayat transaksi (`scope: Transaction: 1`). Akun kasir **TIDAK BISA** melakukan penarikan saldo (*payout/withdrawal*) ke rekening bank, tidak bisa mengubah data toko, dan tidak akan mengganggu sesi aplikasi Owner di perangkat utama.

### 3. Pengamanan Sesi & Kredensial
- File `session.json` menyimpan `access_token` dan `refresh_token` yang dapat digunakan untuk berinteraksi dengan akun merchant.
- Pastikan file sesi memiliki izin baca yang ketat (misal `chmod 600 session.json`).
- **JANGAN PERNAH** melakukan commit atau membagikan file `session.json`, file `.env`, atau data pribadi ke repositori publik Git. File-file ini sudah tercantum di `.gitignore`.

### 4. Mitigasi Tabrakan Nominal Seragam
- Jika toko Anda melayani banyak transaksi bersamaan dengan nominal yang identik (misal Rp 10.000) dalam jendela waktu yang berdekatan, sistem pencocokan berbasis nominal murni berisiko mengalami salah asosiasi invoice.
- **Saran Solusi**:
  - Terapkan kode unik 3 digit acak di digit akhir (contoh: Rp 10.124, Rp 10.582).
  - Atau gunakan jendela pengecekan waktu yang sangat ketat (hanya mencocokkan transaksi yang terjadi setelah invoice dibuat).

### 5. Pitfall Kritis: Error 401 "Session is revoked" pada Akun Kasir Baru
- **Gejala Masalah**:
  Saat melakukan login akun Kasir via API / CLI (Request OTP ➔ Submit OTP), penukaran token berhasil dan mendapatkan `access_token`. Namun ketika memanggil endpoint mutasi transaksi atau profil merchant, server mengembalikan error:
  ```json
  HTTP 401: { "message": "Session is revoked" }
  ```
- **Penyebab**:
  Di sistem backend Gojek/GoBiz, akun pegawai / sub-user yang baru ditambahkan oleh Owner berstatus belum diinisialisasi (`have_password: true`, `expired: true`). Gateway otentikasi GoBiz secara ketat memblokir akses Web Dashboard API untuk sub-user yang belum pernah melakukan registrasi sesi awal melalui aplikasi mobile resmi.
- **Solusi & Langkah Aktivasi Wajib**:
  1. Pasang dan buka aplikasi resmi **GoPay Merchant** di perangkat Android/iOS (bisa di HP kasir atau via dual apps).
  2. Login satu kali menggunakan nomor HP Kasir tersebut.
  3. Masukkan kode OTP SMS dan selesaikan verifikasi profil/biometrik hingga **Dashboard Kasir berhasil terbuka di aplikasi mobile**.
  4. Begitu aplikasi mobile berhasil dibuka sekali, status kredensial kasir di database GoBiz resmi menjadi aktif (`approved: true`).
  5. Setelah aktivasi HP selesai, ulangi proses login / request OTP melalui CLI SDK ini (`node cli.js`). Token API tidak akan berstatus *revoked* lagi dan langsung bisa membaca mutasi secara normal.

---

## 📜 Disclaimer & Lisensi

Proyek ini dibuat untuk tujuan edukasi, penelitian arsitektur protokol EMVCo, dan otomasi pencatatan merchant mandiri. Penulis tidak bertanggung jawab atas penyalahgunaan, kerugian finansial, penangguhan akun, atau tuntutan hukum apa pun yang timbul akibat penggunaan modul ini. Seluruh merek dagang, logo, dan nama layanan (GoPay, GoBiz, Gojek, QRIS) adalah hak milik dari pemiliknya masing-masing.

Dilisensikan di bawah lisensi [MIT](LICENSE). Credit: `by:Lynd - Lia-chan`.
