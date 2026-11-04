# Tutorial Menjalankan Aplikasi Mini POS Toko Sejahtera

Panduan lengkap dari nol: menyiapkan database Supabase → menjalankan aplikasi → login → publish ke internet.

---

## Bagian 0 — Yang kamu butuhkan

| Kebutuhan              | Status di laptopmu                            |
| ---------------------- | --------------------------------------------- |
| Node.js v20.19+        | ✅ terpasang (v22.13.0)                       |
| npm                    | ✅ terpasang (10.9.2)                         |
| Dependensi `pos-kasir` | ✅ sudah terpasang                            |
| Akun Supabase          | punya akses ke project `uumbhhqglqiyetenpukd` |

Semua perintah di tutorial ini memakai **PowerShell** (terminal Windows).

---

## Bagian 1 — Menyiapkan Database Supabase (WAJIB, sekali saja)

> Database project-mu saat ini **masih kosong** — semua tabel belum ada.

1. Buka [https://supabase.com/dashboard](https://supabase.com/dashboard) lalu pilih project
   **uumbhhqglqiyetenpukd**.
2. Di menu kiri pilih **SQL Editor** → klik **New query**.
3. Buka file `pos-kasir/supabase-schema-secure.sql` di editor, **copy semua isinya**.
4. Paste ke SQL Editor Supabase → tekan **Run** (atau Ctrl+Enter).
5. Tunggu sampai muncul **"Success. No rows returned"** di bagian bawah.
6. Cek: menu **Table Editor** → sekarang ada tabel `users`, `products`, `transactions`,
   `expenses`, `app_config`.

### 1b. Matikan verifikasi email (opsional tapi disarankan)

Supaya akun baru langsung bisa dipakai tanpa klik tautan di email:

1. Menu **Authentication** → **Sign In / Providers** → pilih **Email**.
2. Matikan **Confirm email** → **Save**.

> Kalau fitur ini tetap **aktif**, setelah mendaftar kamu harus membuka email dan klik
> tautan konfirmasi sebelum bisa login.

### 1c. Tentang kunci API

Kunci sudah tertanam di `src/lib/supabase.js`:

- URL: `https://uumbhhqglqiyetenpukd.supabase.co`
- Key: `sb_publishable_ddDeITyp-jBV6c9rv9ZdwA_vpWcV690`

Kunci _publishable_ aman ada di frontend. **Jangan pernah** menaruh key `sb_secret_...`
atau `service_role` di kode aplikasi.

Kalau suatu saat ingin memakai `.env`:

```powershell
cd "d:\WEBSITE MAS WAHYU\TripGenZku\pos-kasir"
Copy-Item .env.example .env
notepad .env
```

Isi `.env`:

```
VITE_SUPABASE_URL=https://uumbhhqglqiyetenpukd.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ddDeITyp-jBV6c9rv9ZdwA_vpWcV690
```

---

## Bagian 2 — Menjalankan Aplikasi di Laptop

1. Buka PowerShell, masuk ke folder aplikasi:

   ```powershell
   cd "d:\WEBSITE MAS WAHYU\TripGenZku\pos-kasir"
   ```

2. (Hanya pertama kali / setelah `git pull`) install dependensi:

   ```powershell
   npm install
   ```

3. Jalankan server development:

   ```powershell
   npm run dev
   ```

4. Terminal akan menampilkan seperti ini:

   ```
   VITE v7.x  ready in 800 ms
   ➜  Local:   http://localhost:5174/
   ➜  Network: http://192.168.x.x:5174/
   ```

5. Buka browser ke **http://localhost:5174**.
6. Hentikan server kapan saja dengan **Ctrl + C** di terminal.

---

## Bagian 3 — Membuat Akun Pemilik (pertama kali)

Saat pertama membuka app, kamu akan diarahkan ke halaman **/login**.

1. Klik tab **➕ Buat Akun Baru**.
2. Isi:
   - **Username**: mis. `pemilik`
   - **Nama Lengkap**: nama kamu
   - **Email**: email asli kamu (wajib, ini yang dipakai untuk login)
   - **No. HP**: opsional
   - **Peran Akun**: pilih **👑 Pemilik Toko**
   - **Password**: minimal 6 karakter
3. Klik **Ajukan Pendaftaran Akun →**.
4. **Akun pertama otomatis menjadi pemilik dan langsung aktif.**
   Pendaftar berikutnya otomatis menjadi `kasir` dengan status _menunggu_ — harus disetujui
   dulu di menu **Kelola Pengguna**.
5. Kembali ke tab **🔑 Masuk Akun**, isi **email + password** → **Masuk →**.

> Catatan: kotak "akun demo" (admin@… / kasir@…) hanya berfungsi jika kamu membuat akun
> dengan email tersebut. Untuk pemakaian nyata, gunakan email kamu sendiri.

---

## Bagian 4 — Menggunakan Aplikasi

| Halaman         | Alamat      | Fungsi                                                                                 |
| --------------- | ----------- | -------------------------------------------------------------------------------------- |
| Dashboard       | `/`         | Ringkasan omzet, laba, stok menipis                                                    |
| Kasir (POS)     | `/kasir`    | Klik produk → keranjang → **Bayar Sekarang** → uang dibayar → **Selesaikan Transaksi** |
| Produk & Stok   | `/produk`   | Tambah / edit / hapus produk                                                           |
| Laporan         | `/laporan`  | Riwayat transaksi, pengeluaran, export PDF/Excel                                       |
| Kelola Pengguna | `/pengguna` | Setujui akun kasir baru, atur peran                                                    |

Alur transaksi cepat: **Kasir → klik produk → Bayar Sekarang → isi uang → Selesaikan Transaksi**.

---

## Bagian 5 — Sinkronisasi HP ↔ Laptop

Agar HP bisa membuka aplikasi yang sama, jalankan server dengan akses jaringan:

```powershell
npm run dev -- --host
```

Terminal akan menampilkan alamat **Network**, mis. `http://192.168.1.10:5174/`.
Buka alamat itu dari HP yang tersambung ke Wi-Fi yang sama.

Supaya koneksi antar-perangkat diizinkan Windows, jalankan sekali (PowerShell **as Administrator**):

```powershell
New-NetFirewallRule -DisplayName "Vite POS 5174" -Direction Inbound -Protocol TCP -LocalPort 5174 -Action Allow
```

Data produk, transaksi, dan pengguna akan tersinkron otomatis lewat Supabase (real-time +
polling tiap 8 detik). Tanpa internet, aplikasi tetap jalan memakai cache `localStorage`.

---

## Bagian 6 — Build & Publish ke Internet

### 6a. Uji hasil build di laptop

```powershell
npm run build
npm run preview
```

Buka http://localhost:5174 untuk memastikan versi produksi berjalan.

### 6b. Publish ke Vercel (gratis)

1. Push folder ini ke GitHub.
2. Buka [vercel.com](https://vercel.com) → **Add New → Project** → import repo.
3. Set **Root Directory** = `pos-kasir`.
4. Framework otomatis terdeteksi **SvelteKit**.
5. Tambahkan Environment Variables (opsional, karena sudah ada default di kode):
   - `VITE_SUPABASE_URL` = `https://uumbhhqglqiyetenpukd.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_ddDeITyp-jBV6c9rv9ZdwA_vpWcV690`
6. **Deploy** → aplikasi online dan bisa dibuka dari HP mana pun.

---

## Bagian 7 — Cek Cepat Apakah Database Sudah Terhubung

Jalankan di PowerShell:

```powershell
$k = 'sb_publishable_ddDeITyp-jBV6c9rv9ZdwA_vpWcV690'
Invoke-RestMethod "https://uumbhhqglqiyetenpukd.supabase.co/rest/v1/products?select=id,name,stock&limit=3" -Headers @{ apikey = $k; Authorization = "Bearer $k" }
```

- **Muncul data produk** → database siap ✅
- **Error 404 `Could not find the table`** → skrip SQL di Bagian 1 belum dijalankan ❌
- **Muncul array kosong `[]`** → tabel ada, tapi kamu belum login di app (RLS menolak akses anonim). Normal.

---

## Masalah Umum & Solusinya

| Gejala                                    | Penyebab                        | Solusi                                                                 |
| ----------------------------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| "Email atau password salah" padahal benar | Email belum dikonfirmasi        | Cek email, atau matikan _Confirm email_ (Bagian 1b), lalu daftar ulang |
| "Akun Anda sedang dalam peninjauan…"      | Status `menunggu`               | Login sebagai pemilik → menu **Kelola Pengguna** → **Setujui**         |
| "Profil akun belum tersedia di server"    | Skrip SQL belum dijalankan      | Ulangi Bagian 1                                                        |
| "Masuk ke database online memakai email"  | Mengisi username, bukan email   | Isi alamat email                                                       |
| Data tidak sinkron ke HP                  | Firewall / beda Wi-Fi           | Bagian 5                                                               |
| Port 5174 dipakai proses lain             | Server lain masih jalan         | Tutup terminal lama atau `npm run dev -- --port 5175`                  |
| Lupa password                             | Password dikelola Supabase Auth | Dashboard → **Authentication → Users** → **Reset password**            |

---

## Ringkasan Perintah Harian

```powershell
cd "d:\WEBSITE MAS WAHYU\TripGenZku\pos-kasir"
npm run dev            # jalankan aplikasi
npm run dev -- --host  # jalankan + akses dari HP
npm run check          # cek error kode
npm run build          # build produksi
```

**Akun pertama wajib didaftarkan lewat tab "Buat Akun Baru" di halaman login.**
