<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { transactions, products, formatRupiah } from '$lib/stores/stores.js';
	import AnimatedNumber from '$lib/components/ui/AnimatedNumber.svelte';
	import Sparkline from '$lib/components/dashboard/Sparkline.svelte';

	/** Rentang hari yang dipilih (7 / 30 / 90). */
	const rentang = [7, 30, 90];
	let hari = $state(7);

	/** Batas waktu awal periode (jam 00:00 hari pertama). */
	const startDate = $derived.by(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - (hari - 1));
		return d;
	});

	const txPeriode = $derived($transactions.filter((t) => new Date(t.date) >= startDate));

	/** Deret harian untuk grafik batang. */
	const harian = $derived.by(() => {
		const out = [];
		for (let i = hari - 1; i >= 0; i--) {
			const d = new Date();
			d.setHours(0, 0, 0, 0);
			d.setDate(d.getDate() - i);
			const key = d.toDateString();
			const rows = $transactions.filter((t) => new Date(t.date).toDateString() === key);
			out.push({
				date: d,
				label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d),
				omzet: rows.reduce((a, t) => a + t.total, 0),
				laba: rows.reduce((a, t) => a + t.profit, 0),
				jumlah: rows.length
			});
		}
		return out;
	});

	const maxOmzet = $derived(Math.max(1, ...harian.map((h) => h.omzet)));

	const omzetPeriode = $derived(txPeriode.reduce((a, t) => a + t.total, 0));
	const labaPeriode = $derived(txPeriode.reduce((a, t) => a + t.profit, 0));
	const modalPeriode = $derived(txPeriode.reduce((a, t) => a + t.cost, 0));
	const rataTransaksi = $derived(txPeriode.length ? omzetPeriode / txPeriode.length : 0);
	const marginPersen = $derived(omzetPeriode ? (labaPeriode / omzetPeriode) * 100 : 0);

	/** Periode sebelumnya — untuk perbandingan pertumbuhan. */
	const prevPeriode = $derived.by(() => {
		const prevEnd = new Date(startDate);
		prevEnd.setMilliseconds(-1);
		const prevStart = new Date(startDate);
		prevStart.setDate(prevStart.getDate() - hari);
		return $transactions.filter((t) => {
			const d = new Date(t.date);
			return d >= prevStart && d < prevEnd;
		});
	});
	const omzetPrev = $derived(prevPeriode.reduce((a, t) => a + t.total, 0));
	const growth = $derived.by(() => {
		if (omzetPrev === 0) return omzetPeriode > 0 ? 100 : 0;
		return ((omzetPeriode - omzetPrev) / omzetPrev) * 100;
	});

	/** Omzet per jam (0-23) — menemukan jam sibuk. */
	const perJam = $derived.by(() => {
		const arr = Array.from({ length: 24 }, () => 0);
		for (const t of txPeriode) arr[new Date(t.date).getHours()] += t.total;
		return arr;
	});
	const maxJam = $derived(Math.max(1, ...perJam));
	const jamSibuk = $derived(perJam.indexOf(maxJam));

	/** Omzet per hari dalam seminggu (Senin..Minggu). */
	const perHari = $derived.by(() => {
		const nama = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
		const arr = nama.map((n) => ({ nama: n, omzet: 0, jumlah: 0 }));
		for (const t of txPeriode) {
			const d = new Date(t.date).getDay();
			arr[d].omzet += t.total;
			arr[d].jumlah += 1;
		}
		// Urutkan Senin dulu agar mudah dibaca
		return [...arr.slice(1), arr[0]];
	});
	const maxHariPekan = $derived(Math.max(1, ...perHari.map((h) => h.omzet)));

	/** Margin per produk — laba bersih per unit terjual. */
	const perProduk = $derived.by(() => {
		/** @type {Record<string, { nama:string, qty:number, omzet:number, laba:number }>} */
		const map = {};
		for (const t of txPeriode) {
			for (const it of t.items ?? []) {
				const nama = it.name ?? 'Produk';
				map[nama] ??= { nama, qty: 0, omzet: 0, laba: 0 };
				map[nama].qty += it.qty ?? 0;
				map[nama].omzet += (it.qty ?? 0) * (it.price ?? 0);
			}
		}
		// Laba per produk dihitung dari harga beli master saat ini
		for (const row of Object.values(map)) {
			const p = $products.find((x) => x.name === row.nama);
			const unitLaba = p ? p.sellPrice - p.buyPrice : 0;
			row.laba = unitLaba * row.qty;
		}
		return Object.values(map).sort((a, b) => b.laba - a.laba);
	});

	const terlarisQty = $derived([...perProduk].sort((a, b) => b.qty - a.qty).slice(0, 5));

	/** Margin % keseluruhan per produk (laba / omzet). */
	const marginProduk = $derived(
		[...perProduk]
			.filter((p) => p.omzet > 0)
			.map((p) => ({ ...p, margin: (p.laba / p.omzet) * 100 }))
			.sort((a, b) => b.margin - a.margin)
			.slice(0, 6)
	);

	/** Rata-rata item per transaksi. */
	const itemPerTransaksi = $derived.by(() => {
		if (!txPeriode.length) return 0;
		const total = txPeriode.reduce(
			(a, t) => a + (t.items ?? []).reduce((s, i) => s + (i.qty ?? 0), 0),
			0
		);
		return total / txPeriode.length;
	});
</script>

<svelte:head>
	<title>Analitik Penjualan — Mini POS Toko Sejahtera</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-5">
	<!-- Header -->
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-extrabold tracking-tight text-[var(--color-ink-900)]">
				Analitik Penjualan
			</h1>
			<p class="mt-1 text-sm text-[var(--color-ink-500)]">
				Kapan toko paling ramai, produk mana paling menguntungkan, dan bagaimana trennya.
			</p>
		</div>

		<!-- Pilihan rentang -->
		<div class="flex rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1">
			{#each rentang as r (r)}
				<button
					type="button"
					class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-200
						{hari === r
						? 'bg-[var(--color-surface-0)] text-brand-700 shadow-xs'
						: 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]'}"
					onclick={() => (hari = r)}
				>
					{r} hari
				</button>
			{/each}
		</div>
	</div>

	<!-- KPI -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each [{ label: 'Omzet Periode', val: omzetPeriode, icon: '💵', rp: true }, { label: 'Laba Kotor', val: labaPeriode, icon: '📈', rp: true }, { label: 'Rata-rata Transaksi', val: rataTransaksi, icon: '🧾', rp: true }, { label: 'Margin', val: marginPersen, icon: '⚖️', rp: false, suffix: '%' }] as k, i (k.label)}
			<div
				class="group relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
				in:fly={{ y: 18, duration: 440, delay: i * 70, easing: quintOut }}
			>
				<div
					class="pointer-events-none absolute -top-10 -right-8 h-24 w-24 rounded-full bg-brand-500/5 blur-2xl transition-transform duration-500 group-hover:scale-125"
				></div>
				<div class="relative flex items-start justify-between gap-2">
					<p class="text-[10px] font-semibold tracking-wide text-[var(--color-ink-400)] uppercase">
						{k.label}
					</p>
					<span
						class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-base"
						>{k.icon}</span
					>
				</div>
				{#if k.rp}
					<p
						class="relative mt-2 text-base font-extrabold whitespace-nowrap text-[var(--color-ink-900)] tabular-nums"
					>
						{formatRupiah(k.val)}
					</p>
				{:else}
					<AnimatedNumber
						value={k.val}
						format={(n) => `${n.toFixed(1)}${k.suffix ?? ''}`}
						class="relative mt-2 block text-lg font-extrabold"
					/>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Pertumbuhan -->
	<div
		class="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] px-5 py-4"
		in:fly={{ y: 16, duration: 440, delay: 280, easing: quintOut }}
	>
		<span
			class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold
			{growth > 0
				? 'bg-success-50 text-success-700'
				: growth < 0
					? 'bg-danger-50 text-danger-700'
					: 'bg-[var(--color-surface-2)] text-[var(--color-ink-500)]'}"
		>
			{growth > 0 ? '▲' : growth < 0 ? '▼' : '–'}
			{Math.abs(growth).toFixed(1)}%
		</span>
		<p class="text-xs text-[var(--color-ink-500)]">
			Omzet {hari} hari terakhir dibanding {hari} hari sebelumnya (<span
				class="font-semibold text-[var(--color-ink-700)]">{formatRupiah(omzetPrev)}</span
			>)
		</p>
		<div class="ml-auto hidden h-9 w-32 sm:block">
			<Sparkline data={harian.map((h) => h.omzet)} tone={growth >= 0 ? 'success' : 'brand'} />
		</div>
	</div>

	<!-- Grafik harian -->
	<div
		class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
		in:fly={{ y: 20, duration: 460, delay: 120, easing: quintOut }}
	>
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Tren Omzet Harian</h2>
			{#if txPeriode.length > 0}
				<span class="text-[11px] text-[var(--color-ink-400)]">
					tertinggi {formatRupiah(maxOmzet)}
				</span>
			{/if}
		</div>

		{#if txPeriode.length === 0}
			<div
				class="mt-4 flex flex-col items-center gap-2 rounded-xl bg-[var(--color-surface-2)] py-12 text-center"
			>
				<span class="text-3xl">📉</span>
				<p class="text-xs font-semibold text-[var(--color-ink-700)]">
					Belum ada penjualan di periode ini
				</p>
				<p class="text-[11px] text-[var(--color-ink-400)]">
					Pilih rentang lebih panjang atau mulai transaksi di Kasir.
				</p>
			</div>
		{:else}
			<div
				class="mt-5 flex h-44 items-end gap-1 sm:gap-1.5"
				role="img"
				aria-label="Grafik omzet harian"
			>
				{#each harian as h, i (h.label + i)}
					<div class="group flex h-full flex-1 flex-col items-center justify-end gap-1">
						<div class="relative flex w-full flex-1 items-end">
							<div
								class="bar-rise w-full rounded-t-md bg-linear-to-t from-brand-500 to-brand-400 transition-all duration-300 group-hover:from-brand-600 group-hover:to-brand-500"
								style="height:{Math.max(
									h.omzet > 0 ? 4 : 2,
									(h.omzet / maxOmzet) * 100
								)}%; animation-delay:{i * 25}ms"
								title="{h.label}: {formatRupiah(h.omzet)} ({h.jumlah} transaksi)"
							></div>
						</div>
						{#if hari <= 30}
							<span
								class="truncate text-[9px] text-[var(--color-ink-400)] {hari > 14
									? 'hidden sm:block'
									: ''}">{h.label}</span
							>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
		<!-- Jam sibuk -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
			in:fly={{ y: 20, duration: 460, delay: 180, easing: quintOut }}
		>
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Jam Paling Ramai</h2>
				{#if txPeriode.length > 0}
					<span
						class="rounded-full bg-warning-50 px-2.5 py-0.5 text-[10px] font-bold text-warning-700"
					>
						Puncak {String(jamSibuk).padStart(2, '0')}.00
					</span>
				{/if}
			</div>
			<p class="mt-0.5 text-[11px] text-[var(--color-ink-400)]">
				Pakai untuk atur jadwal jaga shift.
			</p>

			<div class="mt-4 grid grid-cols-12 gap-1">
				{#each perJam as v, h (h)}
					<div class="flex flex-col items-center gap-1">
						<div class="flex h-24 w-full items-end">
							<div
								class="w-full rounded-sm transition-all duration-300 hover:opacity-80
								{v === maxJam && v > 0 ? 'bg-brand-600' : 'bg-brand-200 dark:bg-brand-800'}"
								style="height:{Math.max(v > 0 ? 6 : 3, (v / maxJam) * 100)}%"
								title="{String(h).padStart(2, '0')}.00 — {formatRupiah(v)}"
							></div>
						</div>
						{#if h % 3 === 0}
							<span class="text-[8px] text-[var(--color-ink-400)]">{h}</span>
						{:else}
							<span class="text-[8px]">&nbsp;</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Hari dalam seminggu -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
			in:fly={{ y: 20, duration: 460, delay: 220, easing: quintOut }}
		>
			<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Hari Paling Ramai</h2>
			<p class="mt-0.5 text-[11px] text-[var(--color-ink-400)]">
				Total omzet per hari dalam seminggu.
			</p>

			<ul class="mt-4 space-y-2.5">
				{#each perHari as d (d.nama)}
					<li>
						<div class="mb-1 flex items-center justify-between text-[11px]">
							<span class="font-semibold text-[var(--color-ink-700)]">{d.nama}</span>
							<span class="text-[var(--color-ink-500)] tabular-nums">{formatRupiah(d.omzet)}</span>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
							<div
								class="bar-rise-x h-full rounded-full bg-linear-to-r from-brand-400 to-brand-600"
								style="width:{(d.omzet / maxHariPekan) * 100}%"
							></div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
		<!-- Produk paling untung -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
			in:fly={{ y: 20, duration: 460, delay: 260, easing: quintOut }}
		>
			<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Produk Paling Menguntungkan</h2>
			<p class="mt-0.5 text-[11px] text-[var(--color-ink-400)]">
				Berdasarkan laba kotor dari master harga saat ini.
			</p>

			{#if perProduk.length === 0}
				<p class="mt-4 text-xs text-[var(--color-ink-400)]">Belum ada data penjualan.</p>
			{:else}
				<ol class="mt-3 space-y-2">
					{#each perProduk.slice(0, 5) as p, i (p.nama)}
						<li class="flex items-center gap-3 rounded-xl px-1 py-1.5">
							<span
								class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold
								{i === 0
									? 'bg-success-100 text-success-700'
									: 'bg-[var(--color-surface-2)] text-[var(--color-ink-500)]'}"
							>
								{i + 1}
							</span>
							<span
								class="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-ink-700)]"
								>{p.nama}</span
							>
							<span class="shrink-0 text-xs font-bold text-success-600 tabular-nums"
								>{formatRupiah(p.laba)}</span
							>
						</li>
					{/each}
				</ol>
			{/if}
		</div>

		<!-- Margin -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
			in:fly={{ y: 20, duration: 460, delay: 300, easing: quintOut }}
		>
			<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Margin Tertinggi</h2>
			<p class="mt-0.5 text-[11px] text-[var(--color-ink-400)]">
				Persentase laba terhadap harga jual.
			</p>

			{#if marginProduk.length === 0}
				<p class="mt-4 text-xs text-[var(--color-ink-400)]">Belum ada data.</p>
			{:else}
				<ul class="mt-4 space-y-3">
					{#each marginProduk as p (p.nama)}
						<li>
							<div class="mb-1 flex items-center justify-between text-[11px]">
								<span class="truncate font-semibold text-[var(--color-ink-700)]">{p.nama}</span>
								<span class="shrink-0 font-bold text-[var(--color-ink-900)] tabular-nums"
									>{p.margin.toFixed(0)}%</span
								>
							</div>
							<div class="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
								<div
									class="h-full rounded-full {p.margin >= 30
										? 'bg-success-500'
										: p.margin >= 15
											? 'bg-warning-500'
											: 'bg-danger-500'} bar-rise-x"
									style="width:{Math.min(100, Math.max(2, p.margin))}%"
								></div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<!-- Ringkasan bawah -->
	<div
		class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
		in:fly={{ y: 20, duration: 460, delay: 340, easing: quintOut }}
	>
		<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Ringkasan Periode</h2>
		<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each [{ label: 'Transaksi', val: String(txPeriode.length) }, { label: 'Item Terjual', val: String(perProduk.reduce((a, p) => a + p.qty, 0)) }, { label: 'Item/Transaksi', val: itemPerTransaksi.toFixed(1) }, { label: 'Modal Terjual', val: formatRupiah(modalPeriode) }] as s (s.label)}
				<div class="rounded-xl bg-[var(--color-surface-2)] p-3">
					<p class="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase">{s.label}</p>
					<p class="mt-0.5 text-sm font-bold text-[var(--color-ink-900)] tabular-nums">{s.val}</p>
				</div>
			{/each}
		</div>

		{#if terlarisQty.length > 0}
			<div class="mt-4 rounded-xl border border-[var(--color-line)] p-3">
				<p class="text-[10px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase">
					Terlaris (unit)
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each terlarisQty as p (p.nama)}
						<span
							class="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700"
						>
							{p.nama} · {p.qty}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</section>

<style>
	.bar-rise {
		animation: bar-rise 760ms cubic-bezier(0.22, 1, 0.36, 1) both;
		transform-origin: bottom;
	}
	@keyframes bar-rise {
		from {
			transform: scaleY(0);
		}
		to {
			transform: scaleY(1);
		}
	}
	.bar-rise-x {
		animation: bar-rise-x 760ms cubic-bezier(0.22, 1, 0.36, 1) both;
		transform-origin: left;
	}
	@keyframes bar-rise-x {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bar-rise,
		.bar-rise-x {
			animation: none;
		}
	}
</style>
