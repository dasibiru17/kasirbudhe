<script>
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import {
		products,
		stockOps,
		applyStockOpname,
		removeStockOp,
		formatRupiah,
		formatTanggal
	} from '$lib/stores/stores.js';
	import AnimatedNumber from '$lib/components/ui/AnimatedNumber.svelte';

	/** @type {{ productId: string, name: string, before: number, after: number, note: string } | null} */
	let target = $state(null);
	let physical = $state('');
	let note = $state('');
	let search = $state('');
	/** @type {{ type: 'ok'|'err', text: string } | null} */
	let msg = $state(null);

	const filtered = $derived(
		$products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
	);

	// Ringkasan riwayat
	const totalOpname = $derived($stockOps.length);
	const totalPenyesuaian = $derived($stockOps.length);
	const totalSelisihUnit = $derived($stockOps.reduce((a, o) => a + o.diff, 0));
	const totalKerugian = $derived(
		$stockOps.filter((o) => o.diff < 0).reduce((a, o) => a + Math.abs(o.value), 0)
	);
	const ternilaiSelisih = $derived($stockOps.reduce((a, o) => a + o.value, 0));

	const diffPreview = $derived.by(() => {
		if (!target || physical === '') return null;
		return Math.floor(Number(physical) || 0) - target.before;
	});

	/** Nilai rupiah dari selisih yang sedang dipreview (pakai harga beli). */
	const diffValuePreview = $derived.by(() => {
		if (!target || diffPreview === null) return 0;
		const p = $products.find((x) => x.id === target?.productId);
		return diffPreview * (p?.buyPrice ?? 0);
	});

	/**
	 * @param {{ id: string, name: string, stock: number }} p
	 */
	function openOpname(p) {
		target = { productId: p.id, name: p.name, before: p.stock, after: p.stock, note: '' };
		physical = String(p.stock);
		note = '';
		msg = null;
	}

	function close() {
		target = null;
		physical = '';
		note = '';
	}

	function simpan(e) {
		e.preventDefault();
		if (!target) return;
		const res = applyStockOpname(target.productId, Number(physical), note);
		if (res.ok) {
			const arah = (res.diff ?? 0) > 0 ? 'bertambah' : 'berkurang';
			msg = {
				type: 'ok',
				text: `Stok "${target.name}" ${arah} ${Math.abs(res.diff ?? 0)} unit dan tercatat di riwayat.`
			};
			close();
		} else {
			msg = { type: 'err', text: res.reason || 'Gagal menyimpan penyesuaian.' };
		}
	}

	function hapus(id) {
		if (confirm('Hapus catatan riwayat opname ini? (Stok produk tidak berubah)')) removeStockOp(id);
	}

	const stokMenipis = $derived($products.filter((p) => p.stock <= 5).length);
</script>

<svelte:head>
	<title>Stok Opname — Mini POS Toko Sejahtera</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-5">
	<!-- Header -->
	<div
		class="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 p-6 shadow-lg shadow-brand-900/15 sm:p-7"
		in:fly={{ y: -12, duration: 480, easing: quintOut }}
	>
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-20 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl"></div>
			<div
				class="absolute inset-0 opacity-[0.1]"
				style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 20px 20px;"
			></div>
		</div>
		<div class="relative">
			<p class="text-[11px] font-bold tracking-[0.18em] text-brand-200 uppercase">Audit Stok</p>
			<h1 class="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
				Stok Opname
			</h1>
			<p class="mt-2 max-w-2xl text-sm leading-relaxed text-brand-100">
				Cocokkan stok sistem dengan hitungan fisik barang di rak. Selisih otomatis tercatat — jadi
				tahu ke mana barang hilang, rusak, atau salah input.
			</p>
			<div class="mt-4 flex flex-wrap gap-2">
				<span
					class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm"
				>
					📦 {$products.length} produk
				</span>
				<span
					class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm"
				>
					⚠️ {stokMenipis} stok menipis
				</span>
				<span
					class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm"
				>
					🧾 {totalOpname} penyesuaian tercatat
				</span>
			</div>
		</div>
	</div>

	<!-- Ringkasan -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each [{ label: 'Total Penyesuaian', val: totalPenyesuaian, icon: '🔄', fmt: null }, { label: 'Selisih Unit', val: totalSelisihUnit, icon: '📊', fmt: 'unit' }, { label: 'Estimasi Kerugian', val: totalKerugian, icon: '📉', fmt: 'rp', danger: true }, { label: 'Nilai Selisih Bersih', val: ternilaiSelisih, icon: '⚖️', fmt: 'rp' }] as s, i (s.label)}
			<div
				class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
				in:fly={{ y: 16, duration: 420, delay: i * 70, easing: quintOut }}
			>
				<div
					class="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-surface-2)] text-lg"
				>
					{s.icon}
				</div>
				<p class="text-[10px] font-semibold tracking-wide text-[var(--color-ink-400)] uppercase">
					{s.label}
				</p>
				{#if s.fmt === 'rp'}
					<p
						class="mt-0.5 text-base font-extrabold tabular-nums {s.danger && s.val > 0
							? 'text-danger-600'
							: 'text-[var(--color-ink-900)]'}"
					>
						{formatRupiah(s.val)}
					</p>
				{:else if s.fmt === 'unit'}
					<p
						class="mt-0.5 text-lg font-extrabold tabular-nums {s.val < 0
							? 'text-danger-600'
							: s.val > 0
								? 'text-success-600'
								: 'text-[var(--color-ink-900)]'}"
					>
						{s.val > 0 ? '+' : ''}{s.val}
					</p>
				{:else}
					<AnimatedNumber value={s.val} class="mt-0.5 block text-lg font-extrabold" />
				{/if}
			</div>
		{/each}
	</div>

	{#if msg}
		<div
			class="rounded-xl border px-4 py-3 text-xs font-semibold {msg.type === 'ok'
				? 'border-success-200 text-success-800 bg-success-50'
				: 'border-danger-200 bg-danger-50 text-danger-700'}"
			in:fly={{ y: -8, duration: 250 }}
		>
			{msg.type === 'ok' ? '✅' : '⚠️'}
			{msg.text}
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-5 lg:grid-cols-5">
		<!-- Daftar produk -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4 lg:col-span-3"
			in:fly={{ y: 20, duration: 480, delay: 120, easing: quintOut }}
		>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Pilih Produk untuk Dihitung</h2>
				<input
					type="search"
					placeholder="🔍 Cari produk…"
					bind:value={search}
					class="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-xs transition-colors outline-none placeholder:text-[var(--color-ink-400)] focus:border-brand-400 sm:w-56"
				/>
			</div>

			{#if filtered.length === 0}
				<p class="mt-6 py-6 text-center text-xs text-[var(--color-ink-400)]">
					Tidak ada produk yang cocok.
				</p>
			{:else}
				<ul class="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
					{#each filtered as p (p.id)}
						<li>
							<button
								type="button"
								onclick={() => openOpname(p)}
								class="group flex w-full items-center gap-3 rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md
									{target?.productId === p.id ? 'border-brand-400 bg-brand-50/60' : ''}"
							>
								<span
									class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-base transition-transform duration-200 group-hover:scale-110"
								>
									📦
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-xs font-bold text-[var(--color-ink-900)]"
										>{p.name}</span
									>
									<span class="block truncate text-[11px] text-[var(--color-ink-400)]">
										{p.category} · modal {formatRupiah(p.buyPrice)}
									</span>
								</span>
								<span
									class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold
									{p.stock <= 5
										? 'bg-danger-50 text-danger-600'
										: p.stock <= 15
											? 'bg-warning-50 text-warning-600'
											: 'bg-success-50 text-success-600'}"
								>
									{p.stock} unit
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Form penyesuaian -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4 lg:col-span-2"
			in:fly={{ y: 20, duration: 480, delay: 180, easing: quintOut }}
		>
			<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Penyesuaian Stok</h2>

			{#if !target}
				<div class="mt-8 flex flex-col items-center gap-2 py-10 text-center">
					<span
						class="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-2)] text-2xl"
						>👈</span
					>
					<p class="text-xs font-semibold text-[var(--color-ink-700)]">Pilih produk dulu</p>
					<p class="max-w-[15rem] text-[11px] leading-relaxed text-[var(--color-ink-400)]">
						Klik salah satu produk di daftar sebelah untuk mulai mencocokkan stok fisiknya.
					</p>
				</div>
			{:else}
				<form class="mt-3 space-y-3" onsubmit={simpan} transition:fade={{ duration: 200 }}>
					<div class="rounded-xl bg-[var(--color-surface-2)] p-3">
						<p
							class="text-[10px] font-semibold tracking-wide text-[var(--color-ink-400)] uppercase"
						>
							Produk
						</p>
						<p class="mt-0.5 truncate text-sm font-bold text-[var(--color-ink-900)]">
							{target.name}
						</p>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div class="rounded-xl border border-[var(--color-line)] p-3 text-center">
							<p class="text-[10px] font-semibold text-[var(--color-ink-400)] uppercase">
								Stok sistem
							</p>
							<p class="mt-0.5 text-xl font-extrabold text-[var(--color-ink-900)] tabular-nums">
								{target.before}
							</p>
						</div>
						<div class="rounded-xl border border-brand-200 bg-brand-50 p-3 text-center">
							<p class="text-[10px] font-semibold text-brand-600 uppercase">Stok fisik</p>
							<p class="mt-0.5 text-xl font-extrabold text-brand-700 tabular-nums">
								{physical === '' ? '–' : Math.max(0, Math.floor(Number(physical) || 0))}
							</p>
						</div>
					</div>

					<div>
						<label
							class="text-[10px] font-bold tracking-wide text-[var(--color-ink-500)] uppercase"
							for="fisik"
						>
							Hasil hitung fisik (unit)
						</label>
						<input
							id="fisik"
							type="number"
							min="0"
							step="1"
							required
							bind:value={physical}
							class="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-2.5 text-sm transition-colors outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
						/>
					</div>

					{#if diffPreview !== null}
						<div
							class="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold
							{diffPreview === 0
								? 'bg-[var(--color-surface-2)] text-[var(--color-ink-500)]'
								: diffPreview > 0
									? 'bg-success-50 text-success-700'
									: 'bg-danger-50 text-danger-700'}"
						>
							<span>Selisih</span>
							<span class="tabular-nums">
								{diffPreview > 0 ? '+' : ''}{diffPreview} unit
								{#if diffPreview !== 0}
									· {formatRupiah(diffValuePreview)}
								{/if}
							</span>
						</div>
					{/if}

					<div>
						<label
							class="text-[10px] font-bold tracking-wide text-[var(--color-ink-500)] uppercase"
							for="catatan"
						>
							Catatan (opsional)
						</label>
						<input
							id="catatan"
							type="text"
							placeholder="cth: rusak, kadaluarsa, salah input"
							bind:value={note}
							class="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-2.5 text-xs transition-colors outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
						/>
					</div>

					<div class="flex gap-2 pt-1">
						<button
							type="button"
							class="flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-xs font-bold text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-surface-2)]"
							onclick={close}
						>
							Batal
						</button>
						<button
							type="submit"
							class="flex-1 btn-press rounded-lg bg-brand-600 px-3 py-2.5 text-xs font-bold text-white"
						>
							Simpan Penyesuaian
						</button>
					</div>
				</form>
			{/if}

			<p
				class="mt-4 rounded-lg bg-[var(--color-surface-2)] p-3 text-[11px] leading-relaxed text-[var(--color-ink-500)]"
			>
				💡 Nilai selisih dihitung memakai <b>harga beli (modal)</b>, jadi kerugian yang tercatat
				adalah nilai modal barang yang hilang — bukan potensi penjualannya.
			</p>
		</div>
	</div>

	<!-- Riwayat opname -->
	<div
		class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
		in:fly={{ y: 20, duration: 480, delay: 240, easing: quintOut }}
	>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Riwayat Penyesuaian</h2>
			<span class="text-[11px] text-[var(--color-ink-400)]">{totalOpname} catatan</span>
		</div>

		{#if $stockOps.length === 0}
			<div
				class="mt-4 flex flex-col items-center gap-2 rounded-xl bg-[var(--color-surface-2)] py-10 text-center"
			>
				<span class="text-3xl">🗂️</span>
				<p class="text-xs font-semibold text-[var(--color-ink-700)]">Belum ada penyesuaian stok</p>
				<p class="max-w-sm text-[11px] text-[var(--color-ink-400)]">
					Riwayat akan muncul di sini setiap kali Anda mencocokkan stok fisik dengan sistem.
				</p>
			</div>
		{:else}
			<ul class="mt-3 divide-y divide-[var(--color-line)]">
				{#each $stockOps as o, i (o.id)}
					<li class="flex items-center gap-3 py-3" in:fly={{ x: -8, duration: 300, delay: i * 40 }}>
						<span
							class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold
							{o.diff < 0 ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600'}"
						>
							{o.diff < 0 ? '▼' : '▲'}
						</span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-bold text-[var(--color-ink-900)]">{o.name}</p>
							<p class="truncate text-[11px] text-[var(--color-ink-400)]">
								{formatTanggal(o.date)} · {o.before} → {o.after} unit
								{#if o.note}· {o.note}{/if}
							</p>
						</div>
						<div class="shrink-0 text-right">
							<p
								class="text-xs font-bold tabular-nums {o.diff < 0
									? 'text-danger-600'
									: 'text-success-600'}"
							>
								{o.diff > 0 ? '+' : ''}{o.diff} unit
							</p>
							<p class="text-[10px] text-[var(--color-ink-400)] tabular-nums">
								{formatRupiah(o.value)}
							</p>
						</div>
						<button
							type="button"
							onclick={() => hapus(o.id)}
							class="shrink-0 rounded-lg px-2 py-1 text-xs text-[var(--color-ink-400)] transition-colors hover:bg-danger-50 hover:text-danger-600"
							aria-label="Hapus catatan"
							title="Hapus catatan riwayat"
						>
							✕
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
