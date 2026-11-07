<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { products, formatRupiah } from '$lib/stores/stores.js';
	import { voucherStats } from '$lib/stores/game.js';

	/**
	 * Pusat Promo — membuat pesan promosi siap kirim lewat WhatsApp.
	 * Tidak perlu server: pesan disusun dari data stok & harga, lalu
	 * dibuka di WhatsApp (app/desktop) atau disalin ke clipboard.
	 */

	/** Varian pesan yang tersedia. */
	const template = [
		{
			id: 'diskon',
			judul: 'Promo Diskon',
			icon: '🏷️',
			desc: 'Daftar produk pilihan dengan potongan harga.',
			tone: 'brand'
		},
		{
			id: 'restock',
			judul: 'Stok Baru',
			icon: '📦',
			desc: 'Umumkan barang yang baru datang.',
			tone: 'success'
		},
		{
			id: 'menipis',
			judul: 'Stok Menipis',
			icon: '⚠️',
			desc: 'Ingatkan pelanggan sebelum barang habis.',
			tone: 'warning'
		},
		{
			id: 'katalog',
			judul: 'Katalog Harga',
			icon: '📋',
			desc: 'Kirim daftar harga terbaru sekaligus.',
			tone: 'danger'
		}
	];

	let aktif = $state('diskon');
	let diskon = $state(10);
	let pesanKustom = $state('');
	let namaToko = $state('Toko Sejahtera');
	let terpilih = $state(/** @type {string[]} */ ([]));
	let salinStatus = $state('');
	let cari = $state('');

	/** Inisialisasi pilihan: default 4 produk pertama. */
	$effect(() => {
		if (terpilih.length === 0 && $products.length > 0) {
			terpilih = $products.slice(0, 4).map((p) => p.id);
		}
	});

	const filtered = $derived(
		$products.filter((p) => p.name.toLowerCase().includes(cari.trim().toLowerCase()))
	);

	const produkPilihan = $derived($products.filter((p) => terpilih.includes(p.id)));

	/**
	 * Harga setelah diskon, dibulatkan ke ratusan terdekat.
	 * @param {number} harga
	 */
	function hargaDiskon(harga) {
		if (diskon <= 0) return harga;
		return Math.round((harga * (1 - diskon / 100)) / 100) * 100;
	}

	/** @param {string} id */
	function toggle(id) {
		terpilih = terpilih.includes(id) ? terpilih.filter((x) => x !== id) : [...terpilih, id];
	}

	function pilihSemua() {
		terpilih = filtered.map((p) => p.id);
	}

	function kosongkan() {
		terpilih = [];
	}

	/** Susun teks pesan sesuai variant yang dipilih. */
	const pesan = $derived.by(() => {
		const daftar = produkPilihan;
		const header = `*${namaToko || 'Toko Kami'}*`;
		const penutup = '\nTerima kasih 🙏\n_Pesan otomatis dari Mini POS_';

		if (daftar.length === 0) {
			return `${header}\n\n( Belum ada produk dipilih — centang produk di bawah )${penutup}`;
		}

		const baris = daftar.map((p, i) => {
			const h = hargaDiskon(p.sellPrice);
			if (aktif === 'diskon' && diskon > 0) {
				return `${i + 1}. ${p.name}\n   ~${formatRupiah(p.sellPrice)}~ → *${formatRupiah(h)}* (-${diskon}%)`;
			}
			if (aktif === 'menipis') {
				return `${i + 1}. ${p.name} — sisa *${p.stock}* unit`;
			}
			return `${i + 1}. ${p.name} — *${formatRupiah(p.sellPrice)}*`;
		});

		const judul =
			aktif === 'diskon'
				? `🎉 *PROMO DISKON ${diskon}%*`
				: aktif === 'restock'
					? `📦 *STOK BARU DATANG!*`
					: aktif === 'menipis'
						? `⚠️ *STOK HAMPIR HABIS*`
						: `📋 *DAFTAR HARGA TERBARU*`;

		const ajakan =
			aktif === 'diskon'
				? '\n⏰ Promo terbatas — selama persediaan masih ada!'
				: aktif === 'restock'
					? '\n✅ Sudah tersedia di toko, silakan mampir!'
					: aktif === 'menipis'
						? '\n🛒 Amankan sekarang sebelum kehabisan!'
						: '\n📞 Hubungi kami untuk pemesanan.';

		const ekstra = pesanKustom.trim() ? `\n\n💬 ${pesanKustom.trim()}` : '';

		return `${header}\n\n${judul}\n\n${baris.join('\n')}${ajakan}${ekstra}${penutup}`;
	});

	async function salin() {
		try {
			await navigator.clipboard.writeText(pesan);
			salinStatus = 'Tersalin! ✅';
		} catch {
			salinStatus = 'Gagal menyalin — blok & copy manual.';
		}
		setTimeout(() => (salinStatus = ''), 2200);
	}

	function kirimWA() {
		const url = `https://wa.me/?text=${encodeURIComponent(pesan)}`;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	const totalHemat = $derived(
		produkPilihan.reduce((a, p) => a + (p.sellPrice - hargaDiskon(p.sellPrice)), 0)
	);

	const stokMenipis = $derived($products.filter((p) => p.stock <= 5));
</script>

<svelte:head>
	<title>Pusat Promo — Mini POS Toko Sejahtera</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-5">
	<!-- Header -->
	<div
		class="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 p-6 shadow-lg shadow-brand-900/15 sm:p-7"
		in:fly={{ y: -12, duration: 480, easing: quintOut }}
	>
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-16 right-0 h-52 w-52 rounded-full bg-white/10 blur-3xl"></div>
			<div
				class="absolute inset-0 opacity-[0.1]"
				style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 20px 20px;"
			></div>
		</div>
		<div class="relative">
			<p class="text-[11px] font-bold tracking-[0.18em] text-brand-200 uppercase">Pemasaran</p>
			<h1 class="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
				Pusat Promo & Broadcast
			</h1>
			<p class="mt-2 max-w-2xl text-sm leading-relaxed text-brand-100">
				Susun pesan promo dari data produk toko, lalu kirim ke pelanggan lewat WhatsApp dalam
				hitungan detik. Tanpa aplikasi tambahan, tanpa biaya iklan.
			</p>
			<div class="mt-4 flex flex-wrap gap-2">
				{#if stokMenipis.length > 0}
					<div
						class="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm"
					>
						⚠️ {stokMenipis.length} produk stoknya menipis — saatnya promo cepat
					</div>
				{/if}
				<a
					href="/game"
					class="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
				>
					🎡 Game Spin & Win · {$voucherStats.total} voucher dibagikan
				</a>
			</div>
		</div>
	</div>

	<!-- Pilih jenis pesan -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each template as t, i (t.id)}
			<button
				type="button"
				onclick={() => (aktif = t.id)}
				class="group rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md
					{aktif === t.id
					? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100 dark:bg-brand-900/30 dark:ring-brand-800'
					: 'border-[var(--color-line)] bg-[var(--color-surface-0)]'}"
				in:fly={{ y: 16, duration: 420, delay: i * 60, easing: quintOut }}
			>
				<div
					class="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-surface-2)] text-lg transition-transform duration-300 group-hover:scale-110"
				>
					{t.icon}
				</div>
				<p
					class="text-xs font-bold {aktif === t.id
						? 'text-brand-700 dark:text-brand-200'
						: 'text-[var(--color-ink-900)]'}"
				>
					{t.judul}
				</p>
				<p
					class="mt-0.5 text-[11px] leading-snug {aktif === t.id
						? 'text-brand-500 dark:text-brand-300'
						: 'text-[var(--color-ink-400)]'}"
				>
					{t.desc}
				</p>
			</button>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-5 lg:grid-cols-5">
		<!-- Pengaturan & produk -->
		<div class="space-y-4 lg:col-span-2">
			<!-- Pengaturan -->
			<div
				class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
				in:fly={{ y: 20, duration: 460, delay: 100, easing: quintOut }}
			>
				<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Pengaturan Pesan</h2>

				<label
					class="mt-3 block text-[10px] font-bold tracking-wide text-[var(--color-ink-500)] uppercase"
					for="toko"
				>
					Nama toko
				</label>
				<input
					id="toko"
					type="text"
					bind:value={namaToko}
					class="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-2 text-xs transition-colors outline-none focus:border-brand-400"
				/>

				{#if aktif === 'diskon'}
					<label
						class="mt-3 block text-[10px] font-bold tracking-wide text-[var(--color-ink-500)] uppercase"
						for="diskon"
					>
						Besar diskon: <span class="text-brand-600">{diskon}%</span>
					</label>
					<input
						id="diskon"
						type="range"
						min="5"
						max="70"
						step="5"
						bind:value={diskon}
						class="mt-2 w-full accent-[var(--color-brand-600)]"
					/>
					<div class="mt-1 flex justify-between text-[10px] text-[var(--color-ink-400)]">
						<span>5%</span><span>70%</span>
					</div>
				{/if}

				<label
					class="mt-3 block text-[10px] font-bold tracking-wide text-[var(--color-ink-500)] uppercase"
					for="kustom"
				>
					Pesan tambahan (opsional)
				</label>
				<textarea
					id="kustom"
					rows="2"
					bind:value={pesanKustom}
					placeholder="cth: Berlaku sampai Minggu, 20.00 WIB"
					class="mt-1 w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-2 text-xs transition-colors outline-none placeholder:text-[var(--color-ink-400)] focus:border-brand-400"
				></textarea>
			</div>

			<!-- Pilih produk -->
			<div
				class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
				in:fly={{ y: 20, duration: 460, delay: 160, easing: quintOut }}
			>
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-sm font-bold text-[var(--color-ink-900)]">
						Produk dalam Pesan
						<span
							class="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700"
						>
							{terpilih.length}
						</span>
					</h2>
					<div class="flex gap-1">
						<button
							type="button"
							class="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[10px] font-bold text-[var(--color-ink-600)] transition-colors hover:bg-[var(--color-surface-2)]"
							onclick={pilihSemua}
						>
							Semua
						</button>
						<button
							type="button"
							class="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[10px] font-bold text-[var(--color-ink-600)] transition-colors hover:bg-[var(--color-surface-2)]"
							onclick={kosongkan}
						>
							Kosongkan
						</button>
					</div>
				</div>

				<input
					type="search"
					placeholder="🔍 Cari produk…"
					bind:value={cari}
					class="mt-2 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-xs outline-none placeholder:text-[var(--color-ink-400)] focus:border-brand-400"
				/>

				<ul class="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
					{#each filtered as p (p.id)}
						<li>
							<label
								class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
							>
								<input
									type="checkbox"
									checked={terpilih.includes(p.id)}
									onchange={() => toggle(p.id)}
									class="h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
								/>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-xs font-semibold text-[var(--color-ink-800)]"
										>{p.name}</span
									>
									<span class="block text-[10px] text-[var(--color-ink-400)]"
										>{formatRupiah(p.sellPrice)} · stok {p.stock}</span
									>
								</span>
							</label>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<!-- Pratinjau -->
		<div class="lg:col-span-3" in:fly={{ y: 20, duration: 460, delay: 200, easing: quintOut }}>
			<div class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Pratinjau Pesan</h2>
					{#if aktif === 'diskon' && produkPilihan.length > 0}
						<span
							class="rounded-full bg-success-50 px-2.5 py-0.5 text-[10px] font-bold text-success-700"
						>
							Total hemat pelanggan {formatRupiah(totalHemat)}
						</span>
					{/if}
				</div>

				<!-- Gelembung chat ala WhatsApp -->
				<div class="mt-3 rounded-2xl bg-[#e5ddd5] p-3 dark:bg-[#0b141a]">
					<div
						class="ml-auto max-w-[95%] rounded-xl rounded-tr-sm bg-[#dcf8c6] p-3 shadow-sm dark:bg-[#005c4b]"
					>
						<pre
							class="font-sans text-[12px] leading-relaxed break-words whitespace-pre-wrap text-[#111b21] dark:text-[#e9edef]">{pesan}</pre>
						<p class="mt-1 text-right text-[10px] text-[#667781] dark:text-[#8696a0]">
							{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ✓✓
						</p>
					</div>
				</div>

				<div class="mt-4 flex flex-wrap gap-2">
					<button
						type="button"
						class="flex flex-1 btn-press items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white shadow-sm"
						onclick={kirimWA}
					>
						<span class="text-sm">📱</span> Kirim via WhatsApp
					</button>
					<button
						type="button"
						class="flex btn-press items-center justify-center gap-2 rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-xs font-bold text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-surface-2)]"
						onclick={salin}
					>
						📋 {salinStatus || 'Salin Pesan'}
					</button>
				</div>

				<p
					class="mt-3 rounded-lg bg-[var(--color-surface-2)] p-3 text-[11px] leading-relaxed text-[var(--color-ink-500)]"
				>
					💡 Tombol WhatsApp membuka aplikasi/WhatsApp Web dengan pesan sudah terisi — tinggal pilih
					kontak atau grup pelanggan lalu kirim.
				</p>
			</div>

			<!-- Tips -->
			<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each [{ icon: '⏰', judul: 'Kirim di jam ramai', isi: 'Berdasarkan data penjualan, jam paling efektif untuk broadcast adalah sore menjelang tutup toko.' }, { icon: '🎯', judul: 'Fokus 3–5 produk', isi: 'Pesan dengan terlalu banyak produk membuat pelanggan malas membaca. Pilih yang marginnya paling besar.' }, { icon: '🎡', judul: 'Game Spin & Win', isi: 'Ajak pelanggan memutar roda hadiah. Kode promo dari game bisa langsung ditukar di kasir, dan semua klaim tercatat otomatis.' }] as tip, i (tip.judul)}
					<div
						class="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-3.5 transition-shadow hover:shadow-sm"
						in:fly={{ y: 14, duration: 400, delay: 260 + i * 70, easing: quintOut }}
					>
						<p class="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink-900)]">
							<span>{tip.icon}</span>
							{tip.judul}
						</p>
						<p class="mt-1 text-[11px] leading-relaxed text-[var(--color-ink-400)]">{tip.isi}</p>
						{#if tip.icon === '🎡'}
							<a
								href="/game"
								class="mt-1.5 inline-block text-[11px] font-bold text-brand-600 hover:underline"
								>Buka game →</a
							>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>
