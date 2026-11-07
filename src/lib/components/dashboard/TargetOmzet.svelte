<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import AnimatedNumber from '$lib/components/ui/AnimatedNumber.svelte';

	/**
	 * TargetOmzet — kartu target omzet harian (goal tracking).
	 *
	 * Fungsi:
	 *  - Pemilik menetapkan target omzet per hari (tersimpan di localStorage,
	 *    kunci `pos-kasir:target-omzet`), aplikasi menghitung progres hari ini.
	 *  - Progress bar beranimasi + label sisa omzet yang harus dicapai.
	 *  - Target kosong/0 → tampil saran menetapkan target, bukan error.
	 *
	 * Komponen ini sengaja self-contained (store internal, bukan global):
	 * target omzet adalah preferensi tampilan dashboard, bukan data transaksi.
	 *
	 * @type {{
	 *   omzetHariIni: number,
	 *   jumlahTransaksi: number,
	 *   labaHariIni: number
	 * }}
	 */
	let { omzetHariIni = 0, jumlahTransaksi = 0, labaHariIni = 0 } = $props();

	const KEY = 'pos-kasir:target-omzet';
	const TARGET_AWAL = 500_000;

	/** @type {import('svelte/store').Writable<number>} */
	const target = writable(browser ? Number(localStorage.getItem(KEY)) || TARGET_AWAL : TARGET_AWAL);
	if (browser) {
		target.subscribe((v) => {
			try {
				localStorage.setItem(KEY, String(Math.max(0, Math.round(v))));
			} catch {
				/* kuota penuh — abaikan */
			}
		});
	}

	let editing = $state(false);
	let draft = $state('');

	const t = $derived(Math.max(0, $target));
	const pct = $derived(t === 0 ? 0 : Math.min(100, (omzetHariIni / t) * 100));
	const sisa = $derived(Math.max(0, t - omzetHariIni));
	const tercapai = $derived(t > 0 && omzetHariIni >= t);

	/** Format rupiah ringkas untuk label besar. */
	function rp(n) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(n);
	}

	function mulaiEdit() {
		draft = String(t);
		editing = true;
	}

	function simpan() {
		const n = Number(String(draft).replace(/\D/g, ''));
		target.set(Number.isFinite(n) ? n : 0);
		editing = false;
	}

	/** Nudge target ±50rb cepat lewat tombol. */
	/** @param {number} d */
	function geser(d) {
		target.set(Math.max(0, t + d));
	}
</script>

<div
	class="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
	in:fly={{ y: 16, duration: 420, easing: quintOut }}
>
	<!-- Header -->
	<div class="flex items-start justify-between gap-3">
		<div>
			<h2 class="flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink-900)]">
				🎯 Target Omzet Hari Ini
			</h2>
			<p class="mt-0.5 text-[11px] text-[var(--color-ink-400)]">
				{tercapai
					? 'Target tercapai — pertahankan! 🎉'
					: t === 0
						? 'Tetapkan target untuk memantau progres harian.'
						: `${jumlahTransaksi} transaksi · laba ${rp(labaHariIni)}`}
			</p>
		</div>

		{#if editing}
			<div class="flex shrink-0 items-center gap-1.5">
				<input
					bind:value={draft}
					inputmode="numeric"
					aria-label="Nilai target omzet"
					class="w-28 rounded-lg border-2 border-brand-400 bg-[var(--color-surface-0)] px-2 py-1 text-right text-xs font-black text-[var(--color-ink-900)] tabular-nums outline-none focus:ring-4 focus:ring-brand-100"
					onkeydown={(e) => {
						if (e.key === 'Enter') simpan();
						if (e.key === 'Escape') editing = false;
					}}
				/>
				<button
					type="button"
					class="btn-press rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-black text-white"
					onclick={simpan}>OK</button
				>
			</div>
		{:else}
			<button
				type="button"
				class="group shrink-0 rounded-xl border border-dashed border-[var(--color-line)] px-3 py-1.5 text-right transition-colors hover:border-brand-300 hover:bg-brand-50/50"
				onclick={mulaiEdit}
				title="Ubah target"
			>
				<span
					class="block text-[9px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase"
				>
					Target {#if t > 0}<span class="opacity-0 transition-opacity group-hover:opacity-100"
							>· ubah</span
						>{/if}
				</span>
				<span class="block text-sm font-black text-[var(--color-ink-900)] tabular-nums">
					{t > 0 ? rp(t) : '— tetapkan —'}
				</span>
			</button>
		{/if}
	</div>

	<!-- Progress -->
	{#if t > 0}
		<div class="mt-4">
			<div class="flex items-end justify-between gap-2">
				<div>
					<p class="text-[10px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase">
						Tercapai
					</p>
					<p
						class="text-xl leading-tight font-extrabold tabular-nums {tercapai
							? 'text-success-600'
							: 'text-[var(--color-ink-900)]'}"
					>
						<AnimatedNumber value={omzetHariIni} format={rp} duration={500} />
					</p>
				</div>
				<p
					class="text-2xl font-black tabular-nums {tercapai
						? 'text-success-600'
						: pct >= 50
							? 'text-brand-600'
							: 'text-[var(--color-ink-400)]'}"
				>
					{Math.floor(pct)}%
				</p>
			</div>

			<!-- Bar: gradasi naik sesuai progres -->
			<div class="mt-2 h-3 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
				<div
					class="flex h-full items-center justify-end rounded-full pr-1.5 transition-[width] duration-700 ease-out
						{tercapai
						? 'bg-linear-to-r from-success-500 to-emerald-400'
						: 'bg-linear-to-r from-brand-500 to-brand-400'}"
					style="width:{Math.max(pct, 2)}%"
					role="progressbar"
					aria-valuenow={Math.round(pct)}
					aria-valuemin="0"
					aria-valuemax="100"
				>
					{#if pct >= 12}
						<span class="text-[9px] font-black text-white/90">{tercapai ? '🎉' : ''}</span>
					{/if}
				</div>
			</div>

			<!-- Sisa target + tombol cepat -->
			<div class="mt-2.5 flex flex-wrap items-center justify-between gap-2">
				<p
					class="text-[11px] font-semibold {tercapai
						? 'text-success-600'
						: 'text-[var(--color-ink-500)]'}"
				>
					{tercapai ? `Melebihi target ${rp(omzetHariIni - t)}` : `Sisa ${rp(sisa)} lagi`}
				</p>
				<div class="flex items-center gap-1">
					{#each [{ d: -100_000, label: '−100rb' }, { d: 100_000, label: '+100rb' }] as b (b.label)}
						<button
							type="button"
							class="btn-press rounded-lg border border-[var(--color-line)] px-2 py-1 text-[10px] font-bold text-[var(--color-ink-500)] hover:border-brand-300 hover:text-brand-600"
							onclick={() => geser(b.d)}
						>
							{b.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<!-- Empty state -->
		<button
			type="button"
			class="mt-4 w-full rounded-xl border border-dashed border-[var(--color-line)] px-4 py-5 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40"
			onclick={() => {
				target.set(TARGET_AWAL);
			}}
		>
			<span class="block text-2xl">🎯</span>
			<span class="mt-1 block text-xs font-bold text-[var(--color-ink-700)]">
				Mulai dengan target {rp(TARGET_AWAL)}
			</span>
			<span class="mt-0.5 block text-[10px] text-[var(--color-ink-400)]">
				Klik untuk pakai target awal — bisa diubah kapan saja
			</span>
		</button>
	{/if}
</div>
