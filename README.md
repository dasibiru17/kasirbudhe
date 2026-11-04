# Mini POS & Bookkeeping — Sistem Pembukuan dan Kasir Toko Retail

Aplikasi web untuk pemilik toko retail kecil: kelola stok produk, lakukan transaksi kasir,
dan pantau laporan pembukuan sederhana secara real-time. Dibangun dengan **SvelteKit
(Svelte 5 + runes)** dan **Tailwind CSS v4**.

## Fitur

| Halaman                             | Fitur                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Dashboard** (`/`)                 | Statistik stok, nilai modal, omzet & laba hari ini, peringatan stok menipis, transaksi terakhir         |
| **Kasir / POS** (`/kasir`)          | Daftar produk + pencarian cepat, keranjang interaktif reaktif, modal pembayaran dengan hitung kembalian |
| **Produk & Stok** (`/produk`)       | CRUD lengkap (nama, kategori, harga beli, harga jual, stok), pencarian, indikator stok kritis           |
| **Laporan / Buku Kas** (`/laporan`) | Omzet, laba kotor, pengeluaran operasional, saldo kas, riwayat transaksi lengkap                        |

**Logika inti otomatis** — saat tombol _Selesaikan Transaksi_ ditekan:

1. Stok produk di data master berkurang otomatis.
2. Transaksi tercatat di riwayat (lengkap dengan harga modal, profit, bayar, kembalian).
3. Keranjang dikosongkan.

**Persistensi data** — semua store (`products`, `cart`, `transactions`, `expenses`)
disinkronkan dengan `localStorage` melalui helper `persisted()` di
`src/lib/stores/stores.js`, jadi data tidak hilang saat halaman direload.

## Cara Menjalankan

```bash
cd pos-kasir

# 1. Install dependencies (pilih salah satu)
bun install        # jika pakai bun
npm install        # atau npm / pnpm

# 2. Jalankan server development
bun run dev        # atau: npm run dev
# buka http://localhost:5174
```

Build untuk produksi:

```bash
bun run build      # atau: npm run build
bun run preview    # pratinjau hasil build
```

Verifikasi kualitas kode:

```bash
bun run check      # svelte-check (type checking)
bun run format     # prettier
```

## Struktur Kode

```
pos-kasir/
├── src/
│   ├── app.css                          # import Tailwind CSS v4
│   ├── app.html
│   ├── lib/
│   │   ├── stores/stores.js             # ← jantung aplikasi: semua store & logika bisnis
│   │   ├── utils/format.js              # formatRupiah, formatTanggalJam
│   │   └── components/
│   │       ├── layout/Sidebar.svelte    # navigasi dashboard
│   │       ├── dashboard/StatCard.svelte
│   │       └── produk/ProductModal.svelte
│   └── routes/
│       ├── +layout.svelte               # kerangka dashboard (sidebar + konten)
│       ├── +page.svelte                 # halaman Dashboard
│       ├── kasir/+page.svelte           # halaman Kasir / POS
│       ├── produk/+page.svelte          # halaman Manajemen Produk
│       └── laporan/+page.svelte         # halaman Laporan / Buku Kas
├── qa.mjs                               # skrip QA end-to-end (opsional)
└── static/favicon.png
```

### Ringkasan API store (`src/lib/stores/stores.js`)

```js
// Store (pakai $products, $cart, dst. di komponen)
(products, cart, transactions, expenses, cartTotal, cartCount, stats);

// Keranjang
addToCart(product); // kirim objek produk
setCartQty(cartItemId, qty);
removeCartItem(cartItemId);
clearCart();

// Transaksi
checkout(paid); // → { ok, tx } — potong stok + catat riwayat
addExpense(note, amount); // pengeluaran operasional
removeExpense(id);

// Produk (CRUD)
saveProduct(data); // tambah atau edit (otomatis deteksi id)
updateProduct(id, data);
deleteProduct(id);

// Util
(formatRupiah(n), formatTanggal(iso), uid());
```

## Data Awal

Saat pertama dibuka, aplikasi mengisi 8 produk contoh (sembako, minuman, makanan,
perawatan) agar langsung bisa dicoba. Untuk mengosongkan, hapus key
`pos-kasir:products` di DevTools → Application → Local Storage.

## Menjalankan QA (opsional)

```bash
# pastikan dev server berjalan di port 5174, lalu:
node <path-browser-automation>/browser.mjs http://localhost:5174 --script ./qa.mjs
```

Skrip ini menguji alur lengkap: pilih produk → bayar → cek riwayat laporan →
verifikasi stok berkurang → cek key localStorage.
