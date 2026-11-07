<script>
	import { fly, fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import {
		products,
		transactions,
		expenses,
		formatRupiah,
		formatTanggal
	} from '$lib/stores/stores.js';
	import { session } from '$lib/stores/auth.js';
	import { panduanTab } from '$lib/stores/ui.js';
	import HeroStat from '$lib/components/dashboard/HeroStat.svelte';
	import HealthRing from '$lib/components/dashboard/HealthRing.svelte';
	import LiveClock from '$lib/components/dashboard/LiveClock.svelte';
	import TargetOmzet from '$lib/components/dashboard/TargetOmzet.svelte';
	import JamRamai from '$lib/components/dashboard/JamRamai.svelte';
	import Reveal from '$lib/components/ui/Reveal.svelte';
	import AnimatedNumber from '$lib/components/ui/AnimatedNumber.svelte';

	// ============================================================
	//  TAB: Beranda (dashboard) & Panduan — satu halaman
	// ============================================================
	/** @type {Array<{ id: 'beranda'|'panduan', label: string, icon: string, desc: string }>} */
	const tabs = [
		{ id: 'beranda', label: 'Beranda', icon: '📊', desc: 'Ringkasan toko' },
		{ id: 'panduan', label: 'Panduan', icon: '📚', desc: 'Cara pakai & fitur' }
	];

	// ============================================================
	//  STATISTIK TURUNAN
	// ============================================================
	const totalStok = $derived($products.reduce((a, p) => a + p.stock, 0));
	const totalNilai = $derived($products.reduce((a, p) => a + p.stock * p.buyPrice, 0));
	const stokMenipis = $derived($products.filter((p) => p.stock <= 5));

	const hariIni = () => new Date().toDateString();
	const penjualanHariIni = $derived(
		$transactions.filter((t) => new Date(t.date).toDateString() === hariIni())
	);
	const omzetHariIni = $derived(penjualanHariIni.reduce((a, t) => a + t.total, 0));
	const labaHariIni = $derived(penjualanHariIni.reduce((a, t) => a + t.profit, 0));
	const omzetTotal = $derived($transactions.reduce((a, t) => a + t.total, 0));

	/** Omzet kemarin — untuk menghitung delta tren kartu hero. */
	const omzetKemarin = $derived.by(() => {
		const d = new Date();
		d.setDate(d.getDate() - 1);
		const target = d.toDateString();
		return $transactions
			.filter((t) => new Date(t.date).toDateString() === target)
			.reduce((a, t) => a + t.total, 0);
	});

	const deltaOmzet = $derived.by(() => {
		if (omzetKemarin === 0) return omzetHariIni > 0 ? 100 : 0;
		return ((omzetHariIni - omzetKemarin) / omzetKemarin) * 100;
	});

	/** Deret omzet 7 hari terakhir (termasuk hari ini) untuk sparkline. */
	const sparkOmzet = $derived.by(() => {
		const out = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const key = d.toDateString();
			out.push(
				$transactions
					.filter((t) => new Date(t.date).toDateString() === key)
					.reduce((a, t) => a + t.total, 0)
			);
		}
		return out;
	});

	const sparkLaba = $derived.by(() => {
		const out = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const key = d.toDateString();
			out.push(
				$transactions
					.filter((t) => new Date(t.date).toDateString() === key)
					.reduce((a, t) => a + t.profit, 0)
			);
		}
		return out;
	});

	const sparkTransaksi = $derived.by(() => {
		const out = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const key = d.toDateString();
			out.push($transactions.filter((t) => new Date(t.date).toDateString() === key).length);
		}
		return out;
	});

	const sparkStok = $derived.by(() => {
		// Tren nilai modal stok: akumulasi per kategori (stabil, tanpa history palsu)
		const cats = [...new Set($products.map((p) => p.category))];
		return cats.length
			? cats.map((c) =>
					$products.filter((p) => p.category === c).reduce((a, p) => a + p.stock * p.buyPrice, 0)
				)
			: [0];
	});

	/** Skor kesehatan stok: % produk yang stoknya di atas ambang kritis. */
	const skorStok = $derived(
		$products.length === 0
			? 100
			: (($products.length - stokMenipis.length) / $products.length) * 100
	);

	/** Distribusi nilai modal per kategori (maks 4 teratas). */
	const kategori = $derived.by(() => {
		/** @type {Record<string, {nilai:number, unit:number}>} */
		const map = {};
		for (const p of $products) {
			const k = p.category || 'Lainnya';
			map[k] ??= { nilai: 0, unit: 0 };
			map[k].nilai += p.stock * p.buyPrice;
			map[k].unit += p.stock;
		}
		const rows = Object.entries(map)
			.map(([nama, v]) => ({ nama, ...v }))
			.sort((a, b) => b.nilai - a.nilai);
		const max = rows[0]?.nilai || 1;
		return rows.map((r) => ({ ...r, persen: Math.round((r.nilai / max) * 100) }));
	});

	const produkTerlaris = $derived.by(() => {
		/** @type {Record<string, {nama:string, qty:number, omzet:number}>} */
		const map = {};
		for (const t of $transactions) {
			for (const it of t.items ?? []) {
				const nama = it.name ?? 'Produk';
				map[nama] ??= { nama, qty: 0, omzet: 0 };
				map[nama].qty += it.qty ?? 0;
				map[nama].omzet += (it.qty ?? 0) * (it.price ?? 0);
			}
		}
		return Object.values(map)
			.sort((a, b) => b.qty - a.qty)
			.slice(0, 5);
	});

	const transaksiTerakhir = $derived($transactions.slice(0, 6));

	const namaUser = $derived(($session?.name || '').split(' ')[0] || '');
	const isKasir = $derived($session?.role === 'kasir');

	// ============================================================
	//  KONTEN PANDUAN
	// ============================================================
	const fiturList = $derived([
		{
			icon: '📊',
			judul: 'Ringkasan Toko',
			deskripsi:
				'Statistik stok, nilai modal, omzet & laba hari ini, kesehatan stok, dan distribusi kategori — semuanya real-time di tab Beranda.',
			link: '/',
			linkLabel: 'Tab Beranda',
			tone: 'brand'
		},
		{
			icon: '🛒',
			judul: 'Kasir (POS)',
			deskripsi:
				'Pilih produk, kelola keranjang, konfirmasi pembayaran dengan hitung kembalian, dan nota yang bisa langsung dicetak.',
			link: '/kasir',
			linkLabel: 'Buka Kasir',
			tone: 'success'
		},
		{
			icon: '📦',
			judul: 'Produk & Stok',
			deskripsi:
				'CRUD produk lengkap (nama, kategori, harga beli, harga jual, stok) dengan pencarian cepat dan indikator stok kritis.',
			link: '/produk',
			linkLabel: 'Kelola Produk',
			tone: 'warning'
		},
		{
			icon: '📒',
			judul: 'Laporan / Buku Kas',
			deskripsi:
				'Riwayat penjualan dengan omzet, modal (HPP), laba/rugi per transaksi. Export PDF & Excel, plus catat pengeluaran operasional.',
			link: '/laporan',
			linkLabel: 'Lihat Laporan',
			tone: 'danger'
		},
		{
			icon: '📈',
			judul: 'Analitik Penjualan',
			deskripsi:
				'Grafik tren omzet harian, jam & hari paling ramai, produk paling menguntungkan, dan margin tiap produk.',
			link: '/analitik',
			linkLabel: 'Buka Analitik',
			tone: 'brand'
		},
		{
			icon: '🔄',
			judul: 'Stok Opname',
			deskripsi:
				'Cocokkan stok sistem dengan hitungan fisik. Selisih tercatat lengkap beserta estimasi nilai kerugiannya.',
			link: '/stok-opname',
			linkLabel: 'Buka Stok Opname',
			tone: 'warning'
		},
		{
			icon: '📣',
			judul: 'Pusat Promo',
			deskripsi:
				'Susun pesan promo, stok baru, atau katalog harga dari data produk lalu kirim langsung lewat WhatsApp.',
			link: '/promo',
			linkLabel: 'Buka Pusat Promo',
			tone: 'success'
		}
	]);

	const langkahMulai = [
		{
			n: 1,
			teks: 'Isi daftar produk di halaman Produk & Stok (nama, harga beli, harga jual, stok).',
			icon: '📦'
		},
		{
			n: 2,
			teks: 'Mulai transaksi di Kasir: klik produk, atur qty, lalu Bayar Sekarang.',
			icon: '🛒'
		},
		{ n: 3, teks: 'Konfirmasi pembayaran → nota muncul dan bisa dicetak langsung.', icon: '🧾' },
		{
			n: 4,
			teks: 'Pantau omzet, modal & laba di Laporan — export ke PDF/Excel bila perlu.',
			icon: '📈'
		}
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
			teks: 'Produk dengan stok ≤ 5 otomatis ditandai merah di Beranda & halaman Produk. Segera restock!'
		},
		{
			icon: '🌙',
			judul: 'Mode gelap',
			teks: 'Klik 🌙 Mode Gelap di sidebar — preferensi tersimpan otomatis dan berlaku di semua halaman.'
		}
	];

	const pintasan = $derived([
		{
			href: '/kasir',
			judul: 'Mulai Jualan',
			icon: '🛒',
			desc: 'Buka kasir & catat transaksi',
			tone: 'brand'
		},
		{
			href: '/produk',
			judul: 'Tambah Produk',
			icon: '📦',
			desc: 'Kelola stok & harga',
			tone: 'success'
		},
		...(isKasir
			? []
			: [
					{
						href: '/laporan',
						judul: 'Lihat Laporan',
						icon: '📒',
						desc: 'Omzet, laba & export',
						tone: 'warning'
					},
					{
						href: '/analitik',
						judul: 'Analitik',
						icon: '📈',
						desc: 'Jam ramai & margin',
						tone: 'brand'
					}
				]),
		{
			href: '/promo',
			judul: 'Buat Promo',
			icon: '📣',
			desc: 'Broadcast WhatsApp',
			tone: 'success'
		},
		{
			href: '/stok-opname',
			judul: 'Stok Opname',
			icon: '🔄',
			desc: 'Cocokkan stok fisik',
			tone: 'warning'
		}
	]);

	// Demo simulasi pembayaran (tab Panduan)
	let demoQty = $state(0);
	const demoHarga = 5000;
	const demoTotal = $derived(demoQty * demoHarga);
	const demoPaid = $state(20000);
	const demoChange = $derived(Math.max(0, demoPaid - demoTotal));

	/** @param {'beranda'|'panduan'} id */
	function pilihTab(id) {
		panduanTab.set(id);
		if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>Beranda & Panduan — Mini POS Toko Sejahtera</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-6">
	<!-- ============================ HERO ============================ -->
	<div
		class="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 p-6 shadow-xl shadow-brand-900/20 sm:p-8"
	>
		<!-- Dekorasi: blob blur + pola titik + garis cahaya -->
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div
				class="blob-a absolute -top-20 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
			></div>
			<div
				class="blob-b absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl"
			></div>
			<div
				class="absolute inset-0 opacity-[0.12]"
				style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 22px 22px;"
			></div>
			<div
				class="shimmer-line absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/60 to-transparent"
			></div>
		</div>

		<div class="relative">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div in:fly={{ y: -14, duration: 500, easing: quintOut }}>
					<LiveClock name={namaUser} />
					<h1 class="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
						{namaUser ? 'Halo ' + namaUser + ', toko kamu siap' : 'Toko kamu siap'}
						<span class="animate-pulse-slow inline-block">✨</span>
					</h1>
					<p class="mt-1.5 max-w-xl text-sm leading-relaxed text-brand-100">
						Semua ringkasan penting dan cara pakai aplikasi ada di satu tempat. Pindah tab kapan
						saja — data selalu tersimpan otomatis.
					</p>
				</div>

				<!-- Kartu omzet hari ini di dalam hero -->
				<div
					class="ml-auto rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-md"
					in:fly={{ y: -14, duration: 600, delay: 100, easing: quintOut }}
				>
					<p class="text-[10px] font-bold tracking-[0.18em] text-white/70 uppercase">
						Omzet hari ini
					</p>
					<p class="mt-1 text-xl font-extrabold text-white tabular-nums sm:text-2xl">
						{formatRupiah(omzetHariIni)}
					</p>
					<p class="mt-0.5 text-[11px] text-white/70">
						{penjualanHariIni.length} transaksi · laba {formatRupiah(labaHariIni)}
					</p>
				</div>
			</div>

			<!-- Tab switcher -->
			<div
				class="relative mt-6 inline-flex rounded-2xl border border-white/20 bg-white/10 p-1 backdrop-blur-md"
				role="tablist"
				aria-label="Pilih tampilan"
			>
				{#each tabs as tab (tab.id)}
					<button
						type="button"
						role="tab"
						aria-selected={$panduanTab === tab.id}
						class="relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors duration-300 sm:px-5 sm:text-sm
							{$panduanTab === tab.id ? 'text-brand-700' : 'text-white/80 hover:text-white'}"
						onclick={() => pilihTab(tab.id)}
					>
						{#if $panduanTab === tab.id}
							<span
								class="absolute inset-0 rounded-xl bg-white shadow-sm"
								in:scale={{ start: 0.9, duration: 220, easing: quintOut }}
								aria-hidden="true"
							></span>
						{/if}
						<span class="relative">{tab.icon}</span>
						<span class="relative">{tab.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- ============================ KONTEN TAB ============================ -->
	{#if $panduanTab === 'beranda'}
		<div in:fade={{ duration: 260 }}>
			<!-- Kartu statistik hero -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<HeroStat
					title="Omzet Hari Ini"
					value={omzetHariIni}
					format={formatRupiah}
					icon="💵"
					tone="success"
					spark={sparkOmzet}
					delta={deltaOmzet}
					delay={0}
				/>
				<HeroStat
					title="Laba Kotor Hari Ini"
					value={labaHariIni}
					format={formatRupiah}
					icon="📈"
					tone="brand"
					spark={sparkLaba}
					delay={60}
				/>
				<HeroStat
					title="Transaksi Hari Ini"
					value={penjualanHariIni.length}
					icon="🧾"
					tone="warning"
					spark={sparkTransaksi}
					delay={120}
				/>
				<HeroStat
					title="Nilai Modal Stok"
					value={totalNilai}
					format={formatRupiah}
					icon="💰"
					tone="brand"
					spark={sparkStok}
					delay={180}
				/>
			</div>

			<!-- Peringatan stok + kesehatan + pintasan -->
			<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<!-- Kesehatan stok -->
				<Reveal
					class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
				>
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Kesehatan Stok</h2>
						<span
							class="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-ink-500)]"
						>
							{$products.length} produk
						</span>
					</div>
					<div class="mt-3 flex flex-col items-center">
						<HealthRing percent={skorStok} label="stok aman" size={130} />
					</div>
					<div class="mt-3 grid grid-cols-2 gap-2 text-center">
						<div class="rounded-xl bg-[var(--color-surface-2)] py-2">
							<p class="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase">
								Total unit
							</p>
							<p class="text-sm font-bold text-[var(--color-ink-900)] tabular-nums">
								<AnimatedNumber value={totalStok} />
							</p>
						</div>
						<div class="rounded-xl bg-danger-50 py-2">
							<p class="text-[10px] font-semibold text-danger-600 uppercase">Menipis</p>
							<p class="text-sm font-bold text-danger-700 tabular-nums">
								<AnimatedNumber value={stokMenipis.length} />
							</p>
						</div>
					</div>
				</Reveal>

				<!-- Peringatan stok menipis -->
				<Reveal
					delay={80}
					class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
				>
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Peringatan Stok Menipis</h2>
						<a href="/produk" class="text-[11px] font-bold text-brand-600 hover:underline"
							>Kelola →</a
						>
					</div>
					{#if stokMenipis.length === 0}
						<div class="mt-6 flex flex-col items-center gap-2 py-6 text-center" in:fade>
							<span class="grid h-12 w-12 place-items-center rounded-full bg-success-50 text-2xl"
								>✅</span
							>
							<p class="text-sm font-semibold text-success-700">Semua stok aman</p>
							<p class="text-xs text-[var(--color-ink-400)]">
								Tidak ada produk di bawah ambang kritis.
							</p>
						</div>
					{:else}
						<ul class="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
							{#each stokMenipis as p, i (p.id)}
								<li
									class="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-surface-2)] px-3 py-2 transition-colors hover:bg-danger-50"
									in:fly={{ x: -10, duration: 320, delay: i * 60 }}
								>
									<span
										class="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-ink-700)]"
										>{p.name}</span
									>
									<span
										class="shrink-0 rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-bold text-danger-600"
									>
										{p.stock} unit
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</Reveal>

				<!-- Pintasan cepat -->
				<Reveal
					delay={140}
					class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
				>
					<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Pintasan Cepat</h2>
					<div class="mt-3 space-y-2">
						{#each pintasan as a, i (a.href)}
							<a
								href={a.href}
								class="group flex items-center gap-3 rounded-xl border border-[var(--color-line)] px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
								in:fly={{ x: 12, duration: 320, delay: i * 70 }}
							>
								<span
									class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-lg transition-transform duration-200 group-hover:scale-110"
								>
									{a.icon}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block text-xs font-bold text-[var(--color-ink-900)]">{a.judul}</span>
									<span class="block truncate text-[11px] text-[var(--color-ink-400)]"
										>{a.desc}</span
									>
								</span>
								<span
									class="text-brand-500 transition-transform duration-200 group-hover:translate-x-1"
									>→</span
								>
							</a>
						{/each}
					</div>
					<button
						type="button"
						class="mt-3 w-full rounded-xl border border-dashed border-[var(--color-line)] px-3 py-2 text-[11px] font-bold text-[var(--color-ink-500)] transition-colors hover:border-brand-300 hover:text-brand-600"
						onclick={() => pilihTab('panduan')}
					>
						📚 Lihat panduan lengkap
					</button>
				</Reveal>
			</div>

			<!-- Target omzet + jam ramai (insight bisnis harian) -->
			<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<TargetOmzet {omzetHariIni} jumlahTransaksi={penjualanHariIni.length} {labaHariIni} />
				<JamRamai transactions={$transactions} />
			</div>

			<!-- Distribusi kategori + produk terlaris -->
			<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Reveal
					class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
				>
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Nilai Modal per Kategori</h2>
						<span class="text-[11px] text-[var(--color-ink-400)]"
							>total {formatRupiah(totalNilai)}</span
						>
					</div>
					{#if kategori.length === 0}
						<p class="mt-4 text-xs text-[var(--color-ink-400)]">Belum ada produk.</p>
					{:else}
						<ul class="mt-4 space-y-3.5">
							{#each kategori as k, i (k.nama)}
								<li>
									<div class="mb-1.5 flex items-center justify-between text-xs">
										<span class="font-semibold text-[var(--color-ink-700)]">{k.nama}</span>
										<span class="font-bold text-[var(--color-ink-900)] tabular-nums"
											>{formatRupiah(k.nilai)}</span
										>
									</div>
									<div class="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
										<div
											class="bar-grow h-full rounded-full bg-linear-to-r from-brand-400 to-brand-600"
											style="width:{k.persen}%; animation-delay:{i * 110}ms"
										></div>
									</div>
									<p class="mt-1 text-[10px] text-[var(--color-ink-400)]">{k.unit} unit</p>
								</li>
							{/each}
						</ul>
					{/if}
				</Reveal>

				<Reveal
					delay={80}
					class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
				>
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Produk Terlaris</h2>
						<span class="text-[11px] text-[var(--color-ink-400)]">5 teratas</span>
					</div>
					{#if produkTerlaris.length === 0}
						<div class="mt-4 rounded-xl bg-[var(--color-surface-2)] p-4 text-center">
							<p class="text-xs text-[var(--color-ink-500)]">
								Belum ada penjualan — buka <a href="/kasir" class="font-bold text-brand-600"
									>Kasir</a
								> untuk mulai mencatat.
							</p>
						</div>
					{:else}
						<ol class="mt-3 space-y-2">
							{#each produkTerlaris as p, i (p.nama)}
								<li class="flex items-center gap-3 rounded-xl px-1 py-1.5">
									<span
										class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold
										{i === 0
											? 'bg-warning-100 text-warning-700'
											: i === 1
												? 'bg-[var(--color-surface-2)] text-[var(--color-ink-500)]'
												: 'bg-brand-50 text-brand-600'}"
									>
										{i + 1}
									</span>
									<span
										class="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-ink-700)]"
										>{p.nama}</span
									>
									<span
										class="shrink-0 text-[11px] font-bold text-[var(--color-ink-900)] tabular-nums"
										>{p.qty} terjual</span
									>
								</li>
							{/each}
						</ol>
					{/if}
				</Reveal>
			</div>

			<!-- Transaksi terakhir -->
			<Reveal
				class="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
			>
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Transaksi Terakhir</h2>
					{#if !isKasir}
						<a href="/laporan" class="text-[11px] font-bold text-brand-600 hover:underline"
							>Lihat semua →</a
						>
					{/if}
				</div>
				{#if transaksiTerakhir.length === 0}
					<p class="mt-3 text-xs text-[var(--color-ink-400)]">
						Belum ada transaksi — buka <a href="/kasir" class="font-bold text-brand-600"
							>Kasir (POS)</a
						> untuk mencatat penjualan.
					</p>
				{:else}
					<ul class="mt-2 divide-y divide-[var(--color-line)]">
						{#each transaksiTerakhir as t, i (t.id)}
							<li
								class="flex items-center justify-between gap-3 py-2.5"
								in:fly={{ x: -8, duration: 300, delay: i * 50 }}
							>
								<div class="flex min-w-0 items-center gap-3">
									<span
										class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success-50 text-base"
										>🧾</span
									>
									<div class="min-w-0">
										<p class="truncate text-xs font-bold text-[var(--color-ink-900)]">
											{(t.items ?? []).reduce((a, it) => a + (it.qty ?? 0), 0)} item
										</p>
										<p class="text-[11px] text-[var(--color-ink-400)]">{formatTanggal(t.date)}</p>
									</div>
								</div>
								<span class="shrink-0 text-xs font-bold text-success-600 tabular-nums"
									>{formatRupiah(t.total)}</span
								>
							</li>
						{/each}
					</ul>
				{/if}
			</Reveal>
		</div>

		<!-- ===================== TAB PANDUAN ===================== -->
	{:else}
		<div in:fade={{ duration: 260 }} class="space-y-6">
			<!-- Statistik ringkas panduan -->
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{#each [{ icon: '📦', label: 'Produk Terdaftar', val: $products.length, tone: 'brand' }, { icon: '🧾', label: 'Total Transaksi', val: $transactions.length, tone: 'success' }, { icon: '📤', label: 'Catatan Pengeluaran', val: $expenses.length, tone: 'warning' }, { icon: '🏦', label: 'Omzet Total', val: omzetTotal, tone: 'danger' }] as s, i (s.label)}
					<Reveal
						delay={i * 70}
						class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
					>
						<div
							class="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-surface-2)] text-lg"
						>
							{s.icon}
						</div>
						<p
							class="text-[10px] font-semibold tracking-wide text-[var(--color-ink-400)] uppercase"
						>
							{s.label}
						</p>
						{#if s.tone === 'danger'}
							<p class="mt-0.5 text-sm font-extrabold text-[var(--color-ink-900)] tabular-nums">
								{formatRupiah(s.val)}
							</p>
						{:else}
							<AnimatedNumber value={s.val} class="mt-0.5 block text-lg font-extrabold" />
						{/if}
					</Reveal>
				{/each}
			</div>

			<!-- Fitur -->
			<Reveal>
				<h2 class="text-lg font-bold text-[var(--color-ink-900)]">Fitur Aplikasi</h2>
				<p class="text-xs text-[var(--color-ink-500)]">
					Empat halaman utama yang saling terhubung.
				</p>
			</Reveal>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each fiturList as f, i (f.judul)}
					<Reveal delay={i * 70}>
						<a
							href={f.link}
							class="group flex h-full flex-col rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg"
						>
							<div class="mb-3 flex items-center gap-3">
								<div
									class="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-surface-2)] text-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
								>
									{f.icon}
								</div>
								<p class="text-base font-bold text-[var(--color-ink-900)]">{f.judul}</p>
							</div>
							<p class="flex-1 text-xs leading-relaxed text-[var(--color-ink-500)]">
								{f.deskripsi}
							</p>
							<span class="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-600">
								{f.linkLabel}
								<span class="transition-transform duration-200 group-hover:translate-x-1">→</span>
							</span>
						</a>
					</Reveal>
				{/each}
			</div>

			<!-- Mulai cepat: timeline -->
			<Reveal class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-6">
				<h2 class="text-lg font-bold text-[var(--color-ink-900)]">Mulai Cepat</h2>
				<p class="text-xs text-[var(--color-ink-500)]">
					Empat langkah dari kosong sampai laporan pertama.
				</p>
				<ol class="relative mt-5 space-y-5 border-l border-dashed border-[var(--color-line)] pl-8">
					{#each langkahMulai as l, i (l.n)}
						<li class="relative" in:fly={{ x: -12, duration: 360, delay: i * 90 }}>
							<span
								class="step-pulse absolute top-0 -left-[43px] grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-[11px] font-extrabold text-white shadow-md"
							>
								{l.n}
							</span>
							<p class="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-ink-700)]">
								<span class="text-base leading-none">{l.icon}</span>
								<span>{l.teks}</span>
							</p>
						</li>
					{/each}
				</ol>
			</Reveal>

			<!-- Tips -->
			<Reveal>
				<h2 class="text-lg font-bold text-[var(--color-ink-900)]">Tips & Info Penting</h2>
				<p class="text-xs text-[var(--color-ink-500)]">Hal-hal yang membantu sehari-hari.</p>
			</Reveal>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each tips as t, i (t.judul)}
					<Reveal delay={i * 60}>
						<div
							class="flex items-start gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5 transition-all duration-300 hover:shadow-md"
						>
							<div
								class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-lg"
							>
								{t.icon}
							</div>
							<div>
								<p class="text-sm font-bold text-[var(--color-ink-900)]">{t.judul}</p>
								<p class="mt-1 text-xs leading-relaxed text-[var(--color-ink-500)]">{t.teks}</p>
							</div>
						</div>
					</Reveal>
				{/each}
			</div>

			<!-- Simulasi -->
			<Reveal class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-6">
				<h2 class="text-lg font-bold text-[var(--color-ink-900)]">Coba Simulasi Pembayaran</h2>
				<p class="text-xs text-[var(--color-ink-500)]">
					Rasakan cara kerja kembalian sebelum benar-benar jualan — angka di bawah hanya demo, tidak
					mengubah data sungguhan.
				</p>
				<div class="mt-5 grid gap-5 sm:grid-cols-2">
					<div>
						<p class="mb-3 text-sm font-semibold text-[var(--color-ink-900)]">
							Barang demo — {formatRupiah(demoHarga)}/pcs
						</p>
						<div class="flex items-center gap-3">
							<button
								class="grid h-10 w-10 btn-press place-items-center rounded-lg bg-[var(--color-surface-2)] text-lg font-bold disabled:opacity-40"
								disabled={demoQty <= 0}
								onclick={() => (demoQty = Math.max(0, demoQty - 1))}
								aria-label="Kurangi jumlah">−</button
							>
							<span
								class="w-12 text-center text-2xl font-extrabold text-[var(--color-ink-900)] tabular-nums"
							>
								<AnimatedNumber value={demoQty} duration={220} />
							</span>
							<button
								class="grid h-10 w-10 btn-press place-items-center rounded-lg bg-brand-600 text-lg font-bold text-white"
								onclick={() => (demoQty += 1)}
								aria-label="Tambah jumlah">+</button
							>
						</div>
						<p class="mt-4 text-xs text-[var(--color-ink-500)]">
							Total: <b class="text-[var(--color-ink-900)] tabular-nums"
								>{formatRupiah(demoTotal)}</b
							>
						</p>
					</div>
					<div class="rounded-xl bg-[var(--color-surface-2)] p-4">
						<p class="mb-2 text-xs text-[var(--color-ink-500)]">
							Uang dibayar: {formatRupiah(demoPaid)}
						</p>
						<div class="flex items-baseline justify-between">
							<span class="text-xs font-medium text-[var(--color-ink-700)]">Kembalian</span>
							<span class="text-xl font-extrabold text-success-600 tabular-nums">
								<AnimatedNumber value={demoChange} format={formatRupiah} duration={260} />
							</span>
						</div>
						{#if demoPaid < demoTotal}
							<p class="mt-2 text-xs font-medium text-danger-600">
								Uang masih kurang — tambah qty atau bayar lebih.
							</p>
						{/if}
					</div>
				</div>
			</Reveal>

			<!-- Tentang -->
			<Reveal class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-6">
				<h2 class="text-lg font-bold text-[var(--color-ink-900)]">Tentang Aplikasi</h2>
				<div class="mt-4 grid gap-6 sm:grid-cols-2">
					<div>
						<p class="mb-2 text-sm font-semibold text-[var(--color-ink-900)]">Spesifikasi</p>
						<ul class="space-y-1.5 text-xs text-[var(--color-ink-500)]">
							<li>• SvelteKit (Svelte 5 + runes) & Tailwind CSS v4</li>
							<li>• Font: Plus Jakarta Sans · angka tabular</li>
							<li>• Penyimpanan: localStorage browser</li>
							<li>• Tanpa backend — jalan sepenuhnya offline</li>
						</ul>
					</div>
					<div>
						<p class="mb-2 text-sm font-semibold text-[var(--color-ink-900)]">Kredit</p>
						<p class="text-xs text-[var(--color-ink-500)]">
							Design by <b class="text-[var(--color-ink-900)]">Dasi.biru17</b> — v1.1
						</p>
						<p class="mt-2 text-[11px] text-[var(--color-ink-400)]">
							Dibuat untuk pemilik toko retail kecil: kasir cepat, pembukuan jelas, tanpa ribet.
						</p>
					</div>
				</div>
			</Reveal>
		</div>
	{/if}
</section>

<style>
	/* Blob bergerak pelan — memberi kesan hero "hidup" */
	.blob-a {
		animation: blob-a 14s ease-in-out infinite;
	}
	.blob-b {
		animation: blob-b 18s ease-in-out infinite;
	}
	@keyframes blob-a {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(28px, 18px) scale(1.12);
		}
	}
	@keyframes blob-b {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(-24px, -16px) scale(1.08);
		}
	}

	/* Garis cahaya menyapu di tepi atas hero */
	.shimmer-line {
		animation: shimmer-line 6s ease-in-out infinite;
	}
	@keyframes shimmer-line {
		0%,
		100% {
			opacity: 0.25;
			transform: translateX(-30%);
		}
		50% {
			opacity: 0.85;
			transform: translateX(30%);
		}
	}

	/* Bar kategori tumbuh dari kiri */
	.bar-grow {
		animation: bar-grow 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
		transform-origin: left;
	}
	@keyframes bar-grow {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	/* Denyut halus pada nomor langkah */
	.step-pulse {
		animation: step-pulse 2.6s ease-in-out infinite;
	}
	@keyframes step-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgb(79 70 229 / 0.35);
		}
		50% {
			box-shadow: 0 0 0 7px rgb(79 70 229 / 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.blob-a,
		.blob-b,
		.shimmer-line,
		.bar-grow,
		.step-pulse {
			animation: none;
		}
		.bar-grow {
			transform: none;
		}
	}
</style>
