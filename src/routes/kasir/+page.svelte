<script>
	import { fly, fade, scale } from 'svelte/transition';
	import { quintOut, backOut, elasticOut } from 'svelte/easing';
	import {
		products,
		cart,
		formatRupiah,
		addToCart,
		removeCartItem,
		setCartQty,
		clearCart,
		checkout
	} from '$lib/stores/stores.js';
	import NotaModal from '$lib/components/ui/NotaModal.svelte';
	import AnimatedNumber from '$lib/components/ui/AnimatedNumber.svelte';

	let search = $state('');
	let showCheckout = $state(false);
	let paid = $state(0);
	/** @type {any} */
	let lastTx = $state(null);
	let showNota = $state(false);
	let mobileTab = $state('katalog');
	/** @type {string|null} */
	let flashId = $state(null);
	let kategoriAktif = $state('Semua');
	let konfirmasiKosong = $state(false);

	const filtered = $derived(
		$products.filter(
			(p) =>
				p.name.toLowerCase().includes(search.trim().toLowerCase()) &&
				(kategoriAktif === 'Semua' || (p.category || 'Lainnya') === kategoriAktif)
		)
	);

	const kategoriList = $derived([
		'Semua',
		...new Set($products.map((p) => p.category || 'Lainnya'))
	]);

	const cartTotal = $derived($cart.reduce((acc, i) => acc + i.price * i.qty, 0));
	const cartItems = $derived($cart.reduce((acc, i) => acc + i.qty, 0));
	const change = $derived(paid - cartTotal);

	// Warna inisial produk — deterministik dari nama agar konsisten
	const AVATAR_COLORS = [
		'from-brand-500 to-brand-700',
		'from-success-500 to-success-700',
		'from-warning-500 to-warning-700',
		'from-danger-500 to-danger-700',
		'from-indigo-500 to-indigo-700',
		'from-fuchsia-500 to-fuchsia-700',
		'from-teal-500 to-teal-700',
		'from-rose-500 to-rose-700'
	];

	/**
	 * Warna gradasi avatar produk, konsisten per nama.
	 * @param {string} nama
	 */
	function warnaProduk(nama) {
		let h = 0;
		for (const c of nama) h = (h * 31 + c.charCodeAt(0)) % 997;
		return AVATAR_COLORS[h % AVATAR_COLORS.length];
	}

	const uangCepat = $derived.by(() => {
		const base = Math.max(cartTotal, 0);
		const list = [
			base,
			Math.ceil(base / 5000) * 5000,
			Math.ceil(base / 10000) * 10000,
			50000,
			100000
		];
		return [...new Set(list.filter((v) => v > 0))].sort((a, b) => a - b).slice(0, 5);
	});

	/**
	 * @param {string} productId
	 */
	function qty(productId) {
		const item = $cart.find((i) => i.id === productId || i.productId === productId);
		return item ? item.qty : 0;
	}

	/**
	 * @param {{ id: string }} p
	 */
	function tambah(p) {
		addToCart(p);
		flashId = p.id;
		setTimeout(() => (flashId = null), 420);
	}

	/**
	 * @param {number} v
	 */
	function setPaid(v) {
		paid = v;
	}

	function finishCheckout() {
		if ($cart.length === 0 || paid < cartTotal) return;
		const res = checkout(paid);
		showCheckout = false;
		paid = 0;
		if (res.ok) {
			lastTx = res.tx;
			showNota = true;
		}
	}

	function kosongkan() {
		if ($cart.length === 0) return;
		konfirmasiKosong = false;
		clearCart();
	}
</script>

<svelte:head>
	<title>Kasir (POS) — Mini POS Toko Sejahtera</title>
</svelte:head>

<!-- Tab switcher untuk tampilan HP -->
<div
	class="mb-3 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-slate-900 p-1.5 shadow-lg lg:hidden"
>
	<button
		type="button"
		class="relative flex-1 rounded-xl py-2.5 text-xs font-bold transition-all duration-300
			{mobileTab === 'katalog' ? 'text-white' : 'text-white/50 hover:text-white/80'}"
		onclick={() => (mobileTab = 'katalog')}
	>
		{#if mobileTab === 'katalog'}
			<span
				class="absolute inset-0 rounded-xl bg-linear-to-r from-brand-500 to-brand-600 shadow-md"
				aria-hidden="true"
			></span>
		{/if}
		<span class="relative">📦 Katalog</span>
	</button>
	<button
		type="button"
		class="relative flex-1 rounded-xl py-2.5 text-xs font-bold transition-all duration-300
			{mobileTab === 'keranjang' ? 'text-white' : 'text-white/50 hover:text-white/80'}"
		onclick={() => (mobileTab = 'keranjang')}
	>
		{#if mobileTab === 'keranjang'}
			<span
				class="absolute inset-0 rounded-xl bg-linear-to-r from-brand-500 to-brand-600 shadow-md"
				aria-hidden="true"
			></span>
		{/if}
		<span class="relative">🛒 Keranjang</span>
		{#if cartItems > 0}
			<span
				class="badge-pop relative ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1.5 text-[10px] font-extrabold text-white ring-2 ring-slate-900"
			>
				{cartItems}
			</span>
		{/if}
	</button>
</div>

<!-- ================== LAYOUT POS ================== -->
<div
	class="relative flex flex-col overflow-hidden rounded-3xl shadow-2xl ring-1 shadow-slate-900/20 ring-black/5 lg:h-[calc(100vh-7.5rem)] lg:flex-row"
>
	<!-- ============ PANEL KIRI: KATALOG ============ -->
	<div
		class="flex w-full flex-col bg-[var(--color-surface-1)] {mobileTab === 'katalog'
			? 'flex'
			: 'hidden lg:flex'} lg:w-[62%]"
	>
		<!-- Header katalog -->
		<div class="bg-[var(--color-surface-0)] px-5 pt-4 pb-3.5">
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<div
						class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-lg text-white shadow-md shadow-brand-500/30"
					>
						🛒
					</div>
					<div>
						<h1 class="text-lg font-extrabold tracking-tight text-[var(--color-ink-900)]">
							Toko Sejahtera
						</h1>
						<p class="text-[11px] font-medium text-[var(--color-ink-400)]">
							{filtered.length} dari {$products.length} produk
							{#if kategoriAktif !== 'Semua'}· {kategoriAktif}{/if}
						</p>
					</div>
				</div>
				<button
					type="button"
					class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] text-base transition-all duration-200 hover:scale-105 hover:border-brand-300 dark:hover:bg-white/10"
					onclick={() => {
						search = '';
						kategoriAktif = 'Semua';
					}}
					title="Reset filter & pencarian"
					aria-label="Reset filter"
				>
					↺
				</button>
			</div>

			<!-- Pencarian -->
			<div class="relative mt-3">
				<span
					class="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-sm text-[var(--color-ink-400)]"
				>
					🔍
				</span>
				<input
					type="search"
					placeholder="Cari produk…"
					class="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] py-3 pr-11 pl-11 text-sm font-medium shadow-inner transition-all duration-200 outline-none placeholder:text-[var(--color-ink-400)] focus:border-brand-400 focus:bg-[var(--color-surface-0)] focus:shadow-lg focus:ring-2 focus:shadow-brand-500/5 focus:ring-brand-100 dark:focus:ring-brand-900/50"
					bind:value={search}
				/>
				{#if search}
					<button
						type="button"
						class="absolute inset-y-0 right-2 grid h-8 w-8 place-items-center rounded-full bg-[var(--color-surface-1)] text-xs text-[var(--color-ink-400)] transition-all hover:scale-110 hover:text-danger-600"
						onclick={() => (search = '')}
						aria-label="Bersihkan pencarian"
					>
						✕
					</button>
				{/if}
			</div>

			<!-- Chip kategori -->
			<div class="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
				{#each kategoriList as k (k)}
					{@const aktif = kategoriAktif === k}
					<button
						type="button"
						class="relative shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all duration-200
							{aktif
							? 'text-white shadow-md shadow-brand-600/30'
							: 'border border-[var(--color-line)] bg-[var(--color-surface-0)] text-[var(--color-ink-500)] hover:scale-105 hover:border-brand-300 hover:text-brand-600'}"
						class:bg-linear-to-r={aktif}
						class:from-brand-500={aktif}
						class:to-brand-700={aktif}
						onclick={() => (kategoriAktif = k)}
					>
						{k}
					</button>
				{/each}
			</div>
		</div>

		<!-- Grid produk -->
		<div class="max-h-[62vh] flex-1 overflow-y-auto p-4 sm:p-5 lg:max-h-none">
			{#if filtered.length === 0}
				<div class="flex flex-col items-center gap-3 py-20 text-center" in:fade={{ duration: 250 }}>
					<span
						class="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--color-surface-2)] text-3xl"
					>
						{$products.length === 0 ? '📦' : '🔍'}
					</span>
					<p class="text-sm font-bold text-[var(--color-ink-800)]">
						{$products.length === 0 ? 'Belum ada produk' : 'Tidak ada yang cocok'}
					</p>
					<p class="max-w-xs text-xs leading-relaxed text-[var(--color-ink-400)]">
						{$products.length === 0
							? 'Tambahkan produk pertama di halaman Produk & Stok.'
							: 'Coba kata kunci lain atau ketuk ↺ untuk reset.'}
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
					{#each filtered as p, i (p.id)}
						{@const q = qty(p.id)}
						{@const habis = p.stock <= 0}
						{@const kritis = p.stock > 0 && p.stock <= 5}
						<button
							type="button"
							class="group relative flex flex-col overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200
								{habis
								? 'cursor-not-allowed border-[var(--color-line)] bg-[var(--color-surface-2)] opacity-50'
								: q > 0
									? 'border-brand-400 bg-[var(--color-surface-0)] shadow-md ring-2 shadow-brand-500/10 ring-brand-500/20'
									: 'border-[var(--color-line)] bg-[var(--color-surface-0)] hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/10'}
								{flashId === p.id ? 'card-pop' : ''}"
							disabled={habis}
							onclick={() => tambah(p)}
							in:fly={{ y: 18, duration: 340, delay: Math.min(i * 35, 350), easing: quintOut }}
						>
							<!-- Avatar produk -->
							<div class="relative mb-2.5 flex items-start justify-between">
								<div
									class="grid h-11 w-11 place-items-center rounded-xl bg-linear-to-br text-lg font-black text-white shadow-md transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3 {warnaProduk(
										p.name
									)}"
								>
									{p.name.trim().charAt(0).toUpperCase()}
								</div>

								{#if q > 0}
									<span
										class="badge-pop grid h-6 min-w-6 place-items-center rounded-full bg-danger-500 px-1.5 text-[11px] font-black text-white shadow-md ring-2 ring-white dark:ring-slate-800"
									>
										{q}
									</span>
								{/if}
							</div>

							<p
								class="line-clamp-2 min-h-[2.1rem] text-[13px] leading-tight font-bold text-[var(--color-ink-900)]"
							>
								{p.name}
							</p>
							<p class="mt-1 text-sm font-black text-brand-600 tabular-nums">
								{formatRupiah(p.sellPrice)}
							</p>

							<!-- Bar stok -->
							<div class="mt-2">
								{#if habis}
									<span
										class="dark:bg-danger-900/30 inline-flex items-center gap-1 rounded-md bg-danger-50 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-danger-600 uppercase"
									>
										❌ Habis
									</span>
								{:else if kritis}
									<span
										class="dark:bg-warning-900/30 inline-flex items-center gap-1 rounded-md bg-warning-50 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-warning-700 uppercase"
									>
										⚠️ Sisa {p.stock}
									</span>
								{:else}
									<span class="text-[10px] font-semibold text-[var(--color-ink-400)] tabular-nums">
										stok {p.stock}
									</span>
								{/if}
							</div>

							<!-- Overlay + muncul di hover -->
							{#if !habis}
								<div
									class="absolute inset-0 grid place-items-center rounded-2xl bg-brand-600/0 text-2xl font-black text-white opacity-0 transition-all duration-200 group-hover:bg-brand-600/85 group-hover:opacity-100"
									aria-hidden="true"
								>
									{q > 0 ? `+1 (${q})` : '+'}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- ============ PANEL KANAN: KERANJANG (GELAP) ============ -->
	<div
		class="relative flex w-full flex-col overflow-hidden bg-slate-900 {mobileTab === 'keranjang'
			? 'flex'
			: 'hidden lg:flex'} lg:w-[38%]"
	>
		<!-- Cahaya dekoratif -->
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div
				class="blob-a absolute -top-24 -right-16 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
			></div>
			<div
				class="blob-b absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl"
			></div>
			<div
				class="absolute inset-0 opacity-[0.07]"
				style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 24px 24px;"
			></div>
		</div>

		<!-- Header keranjang -->
		<div class="relative flex items-center justify-between px-5 pt-4 pb-3">
			<div class="flex items-center gap-2.5">
				<span class="text-lg">🧾</span>
				<div>
					<p class="text-sm font-extrabold tracking-tight text-white">Pesanan</p>
					<p class="text-[10px] font-medium text-white/50">
						{cartItems} item · {$cart.length} jenis
					</p>
				</div>
			</div>
			{#if $cart.length > 0}
				{#if konfirmasiKosong}
					<div class="flex items-center gap-1.5" in:fade={{ duration: 150 }}>
						<span class="text-[10px] font-bold text-white/60">Yakin?</span>
						<button
							type="button"
							class="rounded-lg bg-danger-500 px-2.5 py-1 text-[10px] font-black text-white transition-transform hover:scale-105"
							onclick={kosongkan}
						>
							Hapus
						</button>
						<button
							type="button"
							class="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80 transition-colors hover:bg-white/20"
							onclick={() => (konfirmasiKosong = false)}
						>
							Batal
						</button>
					</div>
				{:else}
					<button
						type="button"
						class="hover:text-danger-400 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white/50 transition-colors hover:bg-white/10"
						onclick={() => (konfirmasiKosong = true)}
					>
						Kosongkan
					</button>
				{/if}
			{/if}
		</div>

		<!-- Daftar item keranjang -->
		<div class="relative max-h-[46vh] flex-1 overflow-y-auto px-5 pb-4 lg:max-h-none">
			{#if $cart.length === 0}
				<div class="flex flex-col items-center gap-3 py-16 text-center" in:fade={{ duration: 250 }}>
					<div class="relative">
						<span
							class="grid h-20 w-20 place-items-center rounded-3xl border border-white/10 bg-white/5 text-4xl backdrop-blur-sm"
						>
							🛒
						</span>
						<span
							class="absolute -right-1.5 -bottom-1.5 grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-xs text-white shadow-lg"
						>
							+
						</span>
					</div>
					<p class="text-sm font-bold text-white/90">Belum ada pesanan</p>
					<p class="max-w-[13rem] text-xs leading-relaxed text-white/40">
						Tidak ada item yang ditambahkan. Klik produk untuk memulai.
					</p>
				</div>
			{:else}
				<ul class="space-y-2.5">
					{#each $cart as i, idx (i.id)}
						<li
							class="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10"
							in:fly={{ x: 30, duration: 360, delay: Math.min(idx * 45, 270), easing: quintOut }}
							out:fly={{ x: 40, duration: 200 }}
						>
							<!-- Avatar -->
							<div
								class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-br text-sm font-black text-white shadow-md {warnaProduk(
									i.name
								)}"
							>
								{i.name.trim().charAt(0).toUpperCase()}
							</div>

							<!-- Info + stepper -->
							<div class="min-w-0 flex-1">
								<p class="truncate text-xs font-bold text-white">{i.name}</p>
								<div class="mt-1.5 flex items-center gap-2">
									<div
										class="flex items-center overflow-hidden rounded-lg border border-white/15 bg-white/5"
									>
										<button
											type="button"
											class="grid h-6 w-6 place-items-center text-xs font-bold text-white/70 transition-all hover:bg-white/15 hover:text-white disabled:opacity-25"
											disabled={i.qty <= 1}
											onclick={() => setCartQty(i.productId, i.qty - 1)}
											aria-label="Kurangi jumlah {i.name}"
										>
											−
										</button>
										<span class="w-7 text-center text-xs font-black text-white tabular-nums">
											{i.qty}
										</span>
										<button
											type="button"
											class="grid h-6 w-6 place-items-center text-xs font-bold text-white/70 transition-all hover:bg-white/15 hover:text-white"
											onclick={() => setCartQty(i.productId, i.qty + 1)}
											aria-label="Tambah jumlah {i.name}"
										>
											+
										</button>
									</div>
									<span class="text-[10px] font-medium text-white/40 tabular-nums">
										@ {formatRupiah(i.price)}
									</span>
								</div>
							</div>

							<!-- Subtotal + hapus -->
							<div class="flex shrink-0 flex-col items-end gap-1">
								<span class="text-xs font-black text-emerald-400 tabular-nums">
									{formatRupiah(i.price * i.qty)}
								</span>
								<button
									type="button"
									class="hover:text-danger-400 text-[10px] font-semibold text-white/30 transition-all hover:scale-110"
									onclick={() => removeCartItem(i.id)}
									aria-label="Hapus {i.name}"
								>
									Hapus
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Ringkasan & bayar -->
		<div class="relative border-t border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md">
			<div class="mb-3 flex items-end justify-between">
				<div>
					<p class="text-[10px] font-bold tracking-[0.15em] text-white/50 uppercase">Total</p>
					<p class="text-2xl font-black tracking-tight text-white tabular-nums">
						<AnimatedNumber value={cartTotal} format={formatRupiah} duration={280} />
					</p>
				</div>
				<span class="text-[10px] font-bold text-white/40">{cartItems} item</span>
			</div>

			<button
				type="button"
				class="group relative flex w-full btn-press items-center justify-center gap-2 overflow-hidden rounded-2xl bg-linear-to-r from-emerald-500 to-emerald-600 py-4 text-base font-black text-white shadow-xl shadow-emerald-600/30 transition-all hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
				disabled={$cart.length === 0}
				onclick={() => {
					setPaid(cartTotal);
					showCheckout = true;
				}}
			>
				<!-- Shine sweep saat hover -->
				<span
					class="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
					aria-hidden="true"
				></span>
				<span class="relative flex items-center gap-2">
					💵 Bayar Sekarang
					<span class="transition-transform duration-200 group-hover:translate-x-1">→</span>
				</span>
			</button>
		</div>
	</div>
</div>

<!-- Bilah bayar melayang di mobile (katalog) -->
{#if cartItems > 0 && mobileTab === 'katalog'}
	<div class="fixed inset-x-3 bottom-20 z-40 lg:hidden" in:fly={{ y: 40, duration: 350 }}>
		<button
			type="button"
			class="flex w-full btn-press items-center justify-between rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white shadow-2xl shadow-slate-900/40"
			onclick={() => (mobileTab = 'keranjang')}
		>
			<span class="flex items-center gap-2">
				<span class="relative">
					🛒
					<span
						class="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger-500 px-1 text-[9px] font-black text-white ring-2 ring-slate-900"
					>
						{cartItems}
					</span>
				</span>
				<span class="text-white/90">Lihat Pesanan</span>
			</span>
			<span class="tabular-nums">{formatRupiah(cartTotal)} →</span>
		</button>
	</div>
{/if}

{#if showCheckout}
	<!-- ================= MODAL PEMBAYARAN ================= -->
	<div class="fixed inset-0 z-50 grid place-items-center p-4">
		<button
			class="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
			onclick={() => (showCheckout = false)}
			aria-label="Tutup"
			in:fade={{ duration: 200 }}
		></button>

		<div
			class="relative w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10"
			in:scale={{ start: 0.88, duration: 360, easing: backOut }}
		>
			<!-- Cahaya -->
			<div
				class="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-brand-500/25 blur-3xl"
				aria-hidden="true"
			></div>

			<div class="relative p-6">
				<!-- Header -->
				<div class="flex items-start justify-between">
					<div>
						<p class="text-[10px] font-black tracking-[0.2em] text-white/50 uppercase">
							Konfirmasi Pembayaran
						</p>
						<p class="mt-1.5 text-3xl font-black tracking-tight text-white tabular-nums">
							{formatRupiah(cartTotal)}
						</p>
						<p class="mt-0.5 text-[11px] font-medium text-white/50">
							{cartItems} item · {$cart.length} jenis produk
						</p>
					</div>
					<button
						type="button"
						class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 transition-all hover:scale-110 hover:bg-white/15 hover:text-white"
						onclick={() => (showCheckout = false)}
						aria-label="Tutup"
					>
						✕
					</button>
				</div>

				<!-- Uang dibayar -->
				<div class="mt-6">
					<label class="text-[10px] font-black tracking-wide text-white/50 uppercase" for="dibayar">
						Uang dibayar
					</label>
					<div class="relative mt-1.5">
						<span
							class="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-sm font-black text-white/40"
						>
							Rp
						</span>
						<input
							id="dibayar"
							type="number"
							min="0"
							bind:value={paid}
							class="w-full rounded-2xl border border-white/15 bg-white/5 py-3.5 pr-4 pl-12 text-2xl font-black text-white tabular-nums transition-all outline-none placeholder:text-white/20 focus:border-brand-400 focus:bg-white/10 focus:ring-2 focus:ring-brand-500/40"
						/>
					</div>
				</div>

				<!-- Nominal cepat -->
				<div class="mt-3 grid grid-cols-3 gap-1.5">
					{#each uangCepat as u (u)}
						<button
							type="button"
							class="rounded-xl border py-2.5 text-xs font-black tabular-nums transition-all duration-150
								{paid === u
								? 'border-brand-400 bg-brand-500/20 text-white shadow-sm ring-2 ring-brand-500/40'
								: 'border-white/10 bg-white/5 text-white/70 hover:border-brand-400/50 hover:bg-white/10 hover:text-white'}"
							onclick={() => setPaid(u)}
						>
							{formatRupiah(u)}
						</button>
					{/each}
				</div>

				<!-- Kembalian / kekurangan -->
				<div
					class="mt-5 flex items-center justify-between rounded-2xl border px-4 py-4 transition-all duration-200
						{paid < cartTotal
						? 'border-danger-500/30 bg-danger-500/10'
						: 'border-emerald-500/30 bg-emerald-500/10'}"
				>
					<div>
						<p
							class="text-[10px] font-black tracking-wide uppercase {paid < cartTotal
								? 'text-danger-400'
								: 'text-emerald-400'}"
						>
							{paid < cartTotal ? 'Uang kurang' : 'Kembalian'}
						</p>
						<p
							class="mt-0.5 text-2xl font-black tabular-nums {paid < cartTotal
								? 'text-danger-300'
								: 'text-emerald-300'}"
						>
							<AnimatedNumber value={Math.abs(change)} format={formatRupiah} duration={220} />
						</p>
					</div>
					<span
						class="grid h-11 w-11 place-items-center rounded-2xl text-xl {paid < cartTotal
							? 'bg-danger-500/20'
							: 'bg-emerald-500/20'}"
					>
						{paid < cartTotal ? '⚠️' : '✅'}
					</span>
				</div>

				<!-- Aksi -->
				<div class="mt-6 flex gap-2">
					<button
						type="button"
						class="flex-1 rounded-2xl border border-white/15 py-3.5 text-xs font-bold text-white/70 transition-all hover:bg-white/10 hover:text-white"
						onclick={() => (showCheckout = false)}
					>
						Batal
					</button>
					<button
						type="button"
						class="flex-[2] btn-press rounded-2xl bg-linear-to-r from-emerald-500 to-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/30 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
						disabled={$cart.length === 0 || paid < cartTotal}
						onclick={finishCheckout}
					>
						✅ Selesaikan Transaksi
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<NotaModal open={showNota} tx={lastTx} onclose={() => (showNota = false)} />

<style>
	/* Pop halus saat kartu produk diklik */
	.card-pop {
		animation: card-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes card-pop {
		0% {
			transform: scale(1);
		}
		40% {
			transform: scale(0.96);
			box-shadow: 0 0 0 6px rgb(79 70 229 / 0.18);
		}
		100% {
			transform: scale(1);
		}
	}

	/* Badge jumlah muncul dengan pantulan kecil */
	.badge-pop {
		animation: badge-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes badge-pop {
		0% {
			transform: scale(0.4);
			opacity: 0;
		}
		70% {
			transform: scale(1.2);
			opacity: 1;
		}
		100% {
			transform: scale(1);
		}
	}

	/* Blob cahaya di panel gelap */
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
			transform: translate(-20px, 14px) scale(1.15);
		}
	}
	@keyframes blob-b {
		0%,
		100% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(18px, -12px) scale(1.1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card-pop,
		.badge-pop,
		.blob-a,
		.blob-b {
			animation: none;
		}
	}
</style>
