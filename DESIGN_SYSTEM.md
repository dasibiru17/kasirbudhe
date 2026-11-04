# 🎨 Design System — Mini POS & Bookkeeping

Dokumentasi desain untuk aplikasi Retail POS & Pembukuan (SvelteKit + Tailwind CSS v4).
**Versi hidup**: buka `http://localhost:5174/styleguide` — semua contoh di bawah dirender
dari token nyata di `src/app.css`.

---

## 1. Palet Warna

Prinsip: **putih bersih + satu aksen brand** untuk CTA; warna status hanya untuk makna
(hijau = untung, merah = keluar, kuning = peringatan) — tidak untuk dekorasi. Kontras teks
semua kombinasi di bawah ≥ WCAG AA.

### Brand / CTA (Indigo)

| Token       | Hex visual | Penggunaan                        |
| ----------- | ---------- | --------------------------------- |
| `brand-50`  | #eef2ff    | hover baris, background badge CTA |
| `brand-100` | #e0e7ff    | background badge                  |
| `brand-300` | #a5b4fc    | aksen sekunder                    |
| `brand-500` | #6366f1    | hover tombol CTA                  |
| `brand-600` | #4f46e5    | **CTA utama, logo, link aktif**   |
| `brand-900` | #312e81    | gradient hero                     |

### Status

| Token            | Warna       | Makna di aplikasi          | Contoh kombinasi                  |
| ---------------- | ----------- | -------------------------- | --------------------------------- |
| `success-50/100` | hijau muda  | bg badge "Kas Masuk"       | `bg-success-100 text-success-700` |
| `success-600`    | emerald-600 | **teks untung, kembalian** | `text-success-600`                |
| `danger-50/100`  | merah muda  | bg badge "Kas Keluar"      | `bg-danger-100 text-danger-700`   |
| `danger-600`     | red-600     | **teks pengeluaran**       | `text-danger-600`                 |
| `warning-50/100` | kuning muda | bg badge stok              | `bg-warning-100 text-warning-700` |
| `warning-600`    | amber-600   | **teks stok menipis**      | `text-warning-600`                |

### Surface & Teks (Light / Dark otomatis via variabel CSS)

| Token                 | Light              | Dark                | Penggunaan                   |
| --------------------- | ------------------ | ------------------- | ---------------------------- |
| `--color-surface-1`   | slate-50 `#f8fafc` | slate-900 `#0f172a` | **background halaman**       |
| `--color-surface-0`   | putih              | slate-800 `#1e293b` | **background kartu**         |
| `--color-surface-2`   | slate-100          | #273449             | kartu sekunder, tombol qty − |
| `--color-line`        | slate-200          | slate-700           | semua border                 |
| `--color-ink-900`     | slate-900          | slate-100           | judul (H1–H3)                |
| `--color-ink-700`     | slate-700          | slate-300           | teks isi                     |
| `--color-ink-500/400` | slate-500/400      | slate-400/500       | caption, placeholder         |

> Dark mode: tambahkan class `dark` pada `<html>`. Variabel di `@layer base .dark` di
> `app.css` otomatis menukar surface & ink — komponen tidak perlu `dark:` per-kelas.

---

## 2. Tipografi

**Font**: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) —
geometris modern, dibuat di Indonesia, angka jelas & simetris. Ideal untuk dashboard
keuangan retail. Import di `src/app.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
	href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
	rel="stylesheet"
/>
```

Semua angka keuangan memakai `tabular-nums` (sudah global via `html { font-variant-numeric }`)
agar kolom Rupiah sejajar sempurna.

### Typography Scale (utility Tailwind kustom di `app.css`)

| Utility        | Ukuran/Bobot         | Pakai untuk               | Contoh kelas           |
| -------------- | -------------------- | ------------------------- | ---------------------- |
| `text-h1`      | 30px / 800           | Judul halaman             | `class="text-h1"`      |
| `text-h2`      | 20px / 700           | Judul modal/kartu besar   | `class="text-h2"`      |
| `text-h3`      | 16px / 600           | Judul kartu, nama produk  | `class="text-h3"`      |
| `text-body`    | 14px / 400           | Paragraf, isi tabel       | `class="text-body"`    |
| `text-caption` | 12px / 500           | Label sekunder, timestamp | `class="text-caption"` |
| `text-stat`    | 24px / 800 + tabular | **Angka statistik utama** | `class="text-stat"`    |
| `text-stat-sm` | 18px / 700 + tabular | Angka kartu kecil, harga  | `class="text-stat-sm"` |

---

## 3. Animasi Micro-Interactions

Semua animasi memakai API bawaan Svelte — tanpa library eksternal.

| #   | Interaksi                                                                                    | Implementasi                                          | File                    |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------- |
| 1   | Tambah barang → **slide masuk dari kanan**; hapus → slide keluar                             | `transition:fly={{ x: 320, duration: 250 }}`          | `CartItem.svelte`       |
| 2   | Kartu produk muncul **stagger slide-up**                                                     | `transition:fly={{ y: 24, delay: i*60 }}`             | `ProductCard.svelte`    |
| 3   | **Efek tekan kasir** (hover ring + active turun 2px)                                         | utility `btn-press` (transform + cubic-bezier bouncy) | `app.css`               |
| 4   | **Angka statistik bertumbuh** + kedip hijau/merah                                            | `Spring` dari `svelte/motion`, stiffness 0.12         | `AnimatedNumber.svelte` |
| 5   | **Modal sukses**: backdrop fade + panel pop (scale bouncy) + ikon centang muncul telat 200ms | `fade`, `scale` + `quintOut`, `in:fade delay:200`     | `SuccessModal.svelte`   |

### Contoh potongan

```svelte
<script>
	import { fly, fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { Spring } from 'svelte/motion';
</script>

<!-- 1. Item keranjang: slide masuk/keluar otomatis -->
{#each cart as item (item.id)}
	<div transition:fly={{ x: 320, duration: 250 }}>…</div>
{/each}

<!-- 2. Tombol kasir: tekan turun 2px -->
<button class="btn-press bg-brand-600 rounded-lg …">Bayar Sekarang</button>

<!-- 3. Angka counter -->
<AnimatedNumber value={cartTotal} format={formatRupiah} />

<!-- 4. Modal sukses -->
{#if open}
	<div transition:fade={{ duration: 200 }}></div>
	<!-- backdrop -->
	<div transition:scale={{ start: 0.85, duration: 350, easing: quintOut }}>
		<div in:fade={{ duration: 300, delay: 200 }}>✓</div>
		<!-- ikon telat masuk -->
	</div>
{/if}
```

---

## 4. Struktur Token di `app.css`

```
@theme        → --color-brand-*, success-*, danger-*, warning-*, surface-*, ink-*, --font-sans
@custom-variant dark → aktifkan dark mode class strategy
@layer base   → variabel .dark + html { font-variant-numeric: tabular-nums }
@utility card → bg kartu + border + rounded + shadow
@utility btn-press → efek tekan kasir
@utility text-h1/h2/h3/body/caption/stat/stat-sm → typography scale
```

## 5. Komponen UI (`src/lib/components/ui/`)

| Komponen                | Fungsi                                                         |
| ----------------------- | -------------------------------------------------------------- |
| `AnimatedNumber.svelte` | Counter spring untuk omzet/total, kedip sesuai arah            |
| `ProductCard.svelte`    | Kartu produk + badge stok (normal/menipis/habis) + stagger fly |
| `CartItem.svelte`       | Baris keranjang + qty stepper + slide in/out                   |
| `SuccessModal.svelte`   | Popup transaksi berhasil (fade + pop + ikon delay)             |

Lihat semuanya hidup di **`/styleguide`**.
