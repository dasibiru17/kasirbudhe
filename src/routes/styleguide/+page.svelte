<script>
	import { products, transactions, expenses, formatRupiah, checkout } from '$lib/stores/stores.js';

	// ===================== Demo interaktif: simulasi transaksi =====================
	let demoQty = $state(0);
	const demoHarga = 5000;
	const demoTotal = $derived(demoQty * demoHarga);
	const demoPaid = $state(20000);
	const demoChange = $derived(Math.max(0, demoPaid - demoTotal));

	const fiturList = [
		{
			icon: '📊',
			judul: 'Beranda & Panduan',
			deskripsi:
				'Satu menu gabungan: ringkasan stok, nilai modal, omzet & laba hari ini, kesehatan stok, distribusi kategori, produk terlaris, peringatan stok menipis, transaksi terakhir — plus tab Panduan berisi cara pakai, tips, dan simulasi pembayaran.',
			link: '/',
			linkLabel: 'Buka Beranda & Panduan'
		},
		{
			icon: '🛒',
			judul: 'Kasir (POS)',
			deskripsi:
				'Pilih produk, kelola keranjang, konfirmasi pembayaran dengan hitung kembalian, dan nota yang bisa langsung dicetak.',
			link: '/kasir',
			linkLabel: 'Buka Kasir'
		},
		{
			icon: '📦',
			judul: 'Produk & Stok',
			deskripsi:
				'CRUD produk lengkap (nama, kategori, harga beli, harga jual, stok) dengan pencarian cepat dan indikator stok kritis.',
			link: '/produk',
			linkLabel: 'Kelola Produk'
		},
		{
			icon: '📒',
			judul: 'Laporan / Buku Kas',
			deskripsi:
				'Riwayat penjualan dengan omzet, modal (HPP), laba/rugi per transaksi. Export ke PDF & Excel, plus catat pengeluaran operasional.',
			link: '/laporan',
			linkLabel: 'Lihat Laporan'
		}
	];

	const langkahMulai = [
		{
			n: 1,
			teks: 'Isi daftar produk di halaman Produk & Stok (nama, harga beli, harga jual, stok).'
		},
		{ n: 2, teks: 'Mulai transaksi di Kasir: klik produk, atur qty, lalu Bayar Sekarang.' },
		{ n: 3, teks: 'Konfirmasi pembayaran → nota muncul dan bisa dicetak langsung.' },
		{ n: 4, teks: 'Pantau omzet, modal & laba di Laporan — export ke PDF/Excel bila perlu.' }
	];

	const tips = [
		{
			icon: '💾',
			judul: 'Data tersimpan otomatis',
			teks: 'Semua data (produk, transaksi, pengeluaran) disimpan di localStorage browser — tidak hilang saat halaman direload.'
		},
		{
			icon: '🖨',
			judul: 'Cetak nota & laporan',
			teks: 'Nota transaksi bisa dicetak setelah pembayaran. Laporan bisa di-export ke PDF (via print) atau Excel (.xls).'
		},
		{
			icon: '⚠️',
			judul: 'Perhatikan stok menipis',
			teks: 'Produk dengan stok ≤ 5 otomatis ditandai merah di Dashboard & halaman Produk. Segera restock!'
		},
		{
			icon: '🌙',
			judul: 'Mode gelap',
			teks: 'Klik 🌙 Mode Gelap di sidebar — preferensi tersimpan otomatis dan berlaku di semua halaman.'
		}
	];
</script>

<svelte:head>
	<title>Panduan Aplikasi — Mini POS & Bookkeeping</title>
</svelte:head>

<section>
	<!-- ============================ HERO ============================ -->
	<div
		class="from-brand-600 via-brand-700 to-brand-900 mb-8 rounded-xl bg-linear-to-br p-8 text-white sm:p-10"
	>
		<p class="text-brand-200 text-xs font-bold tracking-[0.2em] uppercase">
			Mini POS & Bookkeeping — v1.2
		</p>
		<h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
			Style Guide & Design System
		</h1>
		<p class="text-brand-100 mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
			Referensi token warna, tipografi, komponen, dan panduan penggunaan aplikasi Toko Sejahtera.
			Panduan harian kini menyatu di menu <b class="text-white">Beranda & Panduan</b>.
		</p>
		<div class="mt-5 flex flex-wrap gap-3">
			<a
				href="/kasir"
				class="text-brand-700 hover:bg-brand-50 rounded-lg bg-white px-5 py-2.5 text-sm font-bold transition-colors"
			>
				🛒 Mulai Jualan
			</a>
			<a
				href="/laporan"
				class="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
			>
				📒 Lihat Laporan
			</a>
		</div>
	</div>

	<!-- ===================== STATISTIK LIVE APLIKASI ===================== -->
	<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="border-line bg-surface flex items-center gap-4 rounded-xl border p-5">
			<div class="bg-brand-50 grid h-12 w-12 place-items-center rounded-xl text-2xl">📦</div>
			<div>
				<p class="text-caption text-ink-400 font-medium">Produk Terdaftar</p>
				<p class="text-stat-sm">{$products.length}</p>
			</div>
		</div>
		<div class="border-line bg-surface flex items-center gap-4 rounded-xl border p-5">
			<div class="bg-success-50 grid h-12 w-12 place-items-center rounded-xl text-2xl">🧾</div>
			<div>
				<p class="text-caption text-ink-400 font-medium">Total Transaksi</p>
				<p class="text-stat-sm">{$transactions.length}</p>
			</div>
		</div>
		<div class="border-line bg-surface flex items-center gap-4 rounded-xl border p-5">
			<div class="bg-warning-50 grid h-12 w-12 place-items-center rounded-xl text-2xl">📤</div>
			<div>
				<p class="text-caption text-ink-400 font-medium">Catatan Pengeluaran</p>
				<p class="text-stat-sm">{$expenses.length}</p>
			</div>
		</div>
		<div class="border-line bg-surface flex items-center gap-4 rounded-xl border p-5">
			<div class="bg-danger-50 grid h-12 w-12 place-items-center rounded-xl text-2xl">🏦</div>
			<div>
				<p class="text-caption text-ink-400 font-medium">Omzet Total</p>
				<p class="text-stat-sm">
					{formatRupiah($transactions.reduce((acc, t) => acc + t.total, 0))}
				</p>
			</div>
		</div>
	</div>

	<!-- ===================== FITUR APLIKASI ===================== -->
	<h2 class="text-h1 mb-1">Fitur Aplikasi</h2>
	<p class="text-body mb-5">Empat halaman utama yang saling terhubung.</p>
	<div class="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each fiturList as f (f.judul)}
			<div class="card flex flex-col p-5">
				<div class="mb-3 flex items-center gap-3">
					<div class="bg-surface-2 grid h-11 w-11 place-items-center rounded-xl text-xl">
						{f.icon}
					</div>
					<p class="text-h3">{f.judul}</p>
				</div>
				<p class="text-body flex-1">{f.deskripsi}</p>
				<a
					href={f.link}
					class="text-brand-600 mt-4 inline-flex items-center gap-1 text-xs font-bold hover:underline"
				>
					{f.linkLabel} →
				</a>
			</div>
		{/each}
	</div>

	<!-- ===================== MULAI CEPAT ===================== -->
	<h2 class="text-h1 mb-1">Mulai Cepat</h2>
	<p class="text-body mb-5">Empat langkah dari kosong sampai laporan pertama.</p>
	<div class="card mb-10 p-6">
		<ol class="space-y-4">
			{#each langkahMulai as l (l.n)}
				<li class="flex items-start gap-4">
					<span
						class="bg-brand-600 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
						>{l.n}</span
					>
					<p class="text-body pt-1">{l.teks}</p>
				</li>
			{/each}
		</ol>
	</div>

	<!-- ===================== TIPS & INFO ===================== -->
	<h2 class="text-h1 mb-1">Tips & Info Penting</h2>
	<p class="text-body mb-5">Hal-hal yang membantu sehari-hari.</p>
	<div class="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each tips as t (t.judul)}
			<div class="card flex items-start gap-4 p-5">
				<div class="bg-surface-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg">
					{t.icon}
				</div>
				<div>
					<p class="text-h3">{t.judul}</p>
					<p class="text-body mt-1">{t.teks}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- ===================== DEMO SIMULASI TRANSAKSI ===================== -->
	<h2 class="text-h1 mb-1">Coba Simulasi Pembayaran</h2>
	<p class="text-body mb-5">
		Rasakan cara kerja kembalian sebelum benar-benar jualan — angka di bawah hanya demo, tidak
		mengubah data sungguhan.
	</p>
	<div class="card mb-10 grid gap-6 p-6 sm:grid-cols-2">
		<div>
			<p class="text-h3 mb-3">Barang demo — {formatRupiah(demoHarga)}/pcs</p>
			<div class="flex items-center gap-3">
				<button
					class="btn-press bg-surface-2 grid h-10 w-10 place-items-center rounded-lg text-lg font-bold"
					disabled={demoQty <= 0}
					onclick={() => (demoQty = Math.max(0, demoQty - 1))}>−</button
				>
				<span class="text-stat w-12 text-center">{demoQty}</span>
				<button
					class="btn-press bg-brand-600 grid h-10 w-10 place-items-center rounded-lg text-lg font-bold text-white"
					onclick={() => (demoQty += 1)}>+</button
				>
			</div>
			<p class="text-caption mt-4">
				Total: <b class="text-ink-800 tabular-nums">{formatRupiah(demoTotal)}</b>
			</p>
		</div>
		<div class="bg-surface-2 rounded-lg p-4">
			<p class="text-caption mb-2">Uang dibayar: {formatRupiah(demoPaid)}</p>
			<div class="flex items-baseline justify-between">
				<span class="text-body">Kembalian</span>
				<span class="text-stat text-success-600 tabular-nums">{formatRupiah(demoChange)}</span>
			</div>
			{#if demoPaid < demoTotal}
				<p class="text-caption text-danger-600 mt-2">
					Uang masih kurang — tambah qty atau bayar lebih.
				</p>
			{/if}
		</div>
	</div>

	<!-- ===================== TENTANG APLIKASI ===================== -->
	<h2 class="text-h1 mb-1">Tentang Aplikasi</h2>
	<div class="card p-6">
		<div class="grid gap-6 sm:grid-cols-2">
			<div>
				<p class="text-h3 mb-2">Spesifikasi</p>
				<ul class="text-body space-y-1.5">
					<li>• SvelteKit (Svelte 5 + runes) & Tailwind CSS v4</li>
					<li>• Font: Plus Jakarta Sans · angka tabular</li>
					<li>• Penyimpanan: localStorage browser (+ Supabase opsional)</li>
					<li>• Tanpa backend — jalan sepenuhnya offline</li>
					<li>• Tema terang & gelap, responsif dari 360px</li>
					<li>• Animasi menghormati <i>prefers-reduced-motion</i></li>
				</ul>
			</div>
			<div>
				<p class="text-h3 mb-2">Kredit</p>
				<p class="text-body">Design by <b>Dasi.biru17</b> — v1.2</p>
				<p class="text-caption mt-2">
					Dibuat untuk pemilik toko retail kecil: kasir cepat, pembukuan jelas, tanpa ribet.
				</p>
				<p class="text-h3 mt-4 mb-2">Data Seed Awal</p>
				<p class="text-caption">
					Saat pertama dibuka, aplikasi mengisi 8 produk contoh (sembako, minuman, makanan,
					perawatan). Untuk mengosongkan, hapus key <code class="bg-surface-2 rounded px-1 py-0.5"
						>pos-kasir:products</code
					> di DevTools → Application → Local Storage.
				</p>
			</div>
		</div>
	</div>
</section>
