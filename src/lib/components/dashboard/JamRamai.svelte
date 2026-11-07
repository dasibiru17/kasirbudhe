<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatRupiah } from '$lib/stores/stores.js';

	/**
	 * JamRamai — heatmap omzet per jam (7 hari terakhir).
	 *
	 * Fungsi:
	 *  - Menjawab pertanyaan "jam berapa toko paling ramai?" dari data transaksi
	 *    nyata 7 hari terakhir — tanpa perlu membuka halaman Analitik.
	 *  - Grid 24 kolom (jam 6..21, jam toko wajar) × 7 baris (hari), sel diberi
	 *    intensitas warna sesuai omzet jam tersebut.
	 *  - Hover/fokus menampilkan detail omzet via <title>; sel ter-ramai diberi
	 *    bingkai sorot.
	 *
	 * Sengaja digambar dengan grid DOM (bukan canvas) agar accessibility &
	 * responsif tanpa library eksternal.
	 *
	 * @type {{ transactions: Array<{ date: string, total: number, items?: any[] }> }}
	 */
	let { transactions = [] } = $props();

	/** Jam operasional yang ditampilkan (inklusif). */
	const JAM_AWAL = 6;
	const JAM_AKHIR = 21;
	const JAM = Array.from({ length: JAM_AKHIR - JAM_AWAL + 1 }, (_, i) => JAM_AWAL + i);
	const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

	/**
	 * Bangun matriks omzet[jam][hari].
	 * @returns {Array<{ jam:number, hari:number, total:number, ada:boolean }>}
	 */
	const matrix = $derived.by(() => {
		const batas = new Date();
		batas.setHours(0, 0, 0, 0);
		const mulai = batas.getTime() - 6 * 86_400_000;

		/** @type {Record<string, number>} */
		const map = {};
		for (const t of transactions) {
			const d = new Date(t.date);
			if (d.getTime() < mulai) continue;
			const key = `${d.getHours()}:${d.toDateString()}`;
			map[key] = (map[key] ?? 0) + (t.total ?? 0);
		}

		/** @type {Array<{ jam:number, hari:number, total:number, ada:boolean }>} */
		const out = [];
		/** @type {Array<{ hari:number, total:number }>} */
		const hari = [];
		for (let back = 6; back >= 0; back--) {
			const d = new Date();
			d.setDate(d.getDate() - back);
			const key = d.toDateString();
			hari.push({ hari: d.getDay(), total: 0 });
			for (const j of JAM) {
				const total = map[`${j}:${key}`] ?? 0;
				hari[6 - back].total += total;
				out.push({ jam: j, hari: d.getDay(), total, ada: total > 0 });
			}
		}
		void hari;
		return out;
	});

	/** Total per jam untuk menentukan jam paling ramai secara keseluruhan. */
	const perJam = $derived.by(() =>
		JAM.map((j) => ({
			jam: j,
			total: matrix.filter((m) => m.jam === j).reduce((a, m) => a + m.total, 0)
		}))
	);
	const jamRamai = $derived([...perJam].sort((a, b) => b.total - a.total)[0]);

	/** Total per hari (baris) untuk menandai hari terpadat. */
	const perHari = $derived.by(() => {
		/** @type {Array<{ hari:number, total:number }>} */
		const rows = [];
		for (let i = 0; i < 7; i++) {
			const tanggal = new Date();
			tanggal.setDate(tanggal.getDate() - (6 - i));
			rows.push({
				hari: tanggal.getDay(),
				total: matrix.filter((m) => m.hari === tanggal.getDay()).reduce((a, m) => a + m.total, 0)
			});
		}
		return rows;
	});
	const maxHari = $derived(Math.max(...perHari.map((p) => p.total), 1));

	/** Intensitas warna sel 0..1 terhadap sel terpadat. */
	const maxSel = $derived(Math.max(...matrix.map((m) => m.total), 1));

	/**
	 * Warna sel: skala brand-100 → brand-700 sesuai intensitas.
	 * @param {number} total
	 */
	function cellColor(total) {
		if (total <= 0) return 'var(--color-surface-2)';
		const f = Math.min(1, total / maxSel);
		// interpolasi manual dari oklch terang ke pekat
		if (f < 0.2) return 'var(--color-brand-100)';
		if (f < 0.4) return 'var(--color-brand-200)';
		if (f < 0.6) return 'var(--color-brand-300)';
		if (f < 0.8) return 'var(--color-brand-400)';
		return 'var(--color-brand-600)';
	}

	/**
	 * Teks sel (harga) hanya tampil bila cukup lega.
	 * @param {number} total
	 */
	function cellLabel(total) {
		if (total <= 0) return '';
		if (total / maxSel < 0.35) return '';
		const ribu = Math.round(total / 1000);
		return `${ribu}rb`;
	}

	/** Label jam yang ringkas: 6..12 → pagi, dst. */
	/** @param {number} j */
	function jamLabel(j) {
		return `${j}`.padStart(2, '0');
	}
</script>

<div
	class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5"
	in:fly={{ y: 16, duration: 420, delay: 80, easing: quintOut }}
>
	<div class="flex flex-wrap items-start justify-between gap-2">
		<div>
			<h2 class="flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink-900)]">
				🕐 Jam Ramai Toko
			</h2>
			<p class="mt-0.5 text-[11px] text-[var(--color-ink-400)]">Omzet per jam · 7 hari terakhir</p>
		</div>

		{#if jamRamai && jamRamai.total > 0}
			<div
				class="rounded-xl bg-brand-50 px-3 py-1.5 text-right dark:bg-brand-900/30"
				title="Jam dengan omzet tertinggi 7 hari terakhir"
			>
				<p class="text-[9px] font-black tracking-wide text-brand-500 uppercase">Jam terpadat</p>
				<p class="text-sm leading-tight font-black text-brand-700 tabular-nums dark:text-brand-200">
					{jamLabel(jamRamai.jam)}:00
				</p>
			</div>
		{/if}
	</div>

	{#if transactions.length === 0}
		<p
			class="mt-4 rounded-xl bg-[var(--color-surface-2)] p-4 text-center text-[11px] text-[var(--color-ink-400)]"
		>
			Belum ada transaksi. Heatmap akan terisi otomatis begitu kamu mulai menjual di Kasir.
		</p>
	{:else}
		<!-- Grid heatmap: kolom = jam, baris = hari -->
		<div class="mt-4 overflow-x-auto pb-1">
			<table class="w-full min-w-[640px] border-separate" style="border-spacing: 3px;">
				<caption class="sr-only">Omzet per jam dalam 7 hari terakhir</caption>
				<thead>
					<tr>
						<th class="w-9"></th>
						{#each JAM as j (j)}
							<th
								class="text-[8px] font-bold text-[var(--color-ink-400)] {j === jamRamai?.jam
									? 'text-brand-600 dark:text-brand-300'
									: ''}"
								scope="col"
							>
								{jamLabel(j)}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each perHari as h, row (h.hari + '-' + row)}
						<tr>
							<th
								class="pr-1 text-right text-[10px] font-bold {h.total === maxHari
									? 'text-brand-600 dark:text-brand-300'
									: 'text-[var(--color-ink-400)]'}"
								scope="row"
							>
								{NAMA_HARI[h.hari]}
							</th>
							{#each JAM as j (j + '-' + row)}
								{@const cell = matrix.find((m) => m.jam === j && m.hari === h.hari)}
								{@const isHot = j === jamRamai?.jam && cell?.total === maxSel}
								<td class="p-0">
									<div
										class="grid h-6 place-items-center rounded-[5px] text-[7px] font-black transition-transform duration-150 hover:scale-125 {isHot
											? 'ring-2 ring-brand-500 ring-offset-1'
											: ''}"
										style="background:{cellColor(cell?.total ?? 0)}; color:{(cell?.total ?? 0) /
											maxSel >
										0.55
											? 'white'
											: 'var(--color-ink-700)'}"
										title="{NAMA_HARI[h.hari]} {jamLabel(j)}:00 — {formatRupiah(cell?.total ?? 0)}"
									>
										{cellLabel(cell?.total ?? 0)}
									</div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Legenda + insight -->
		<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-1.5">
				<span class="text-[9px] font-bold text-[var(--color-ink-400)] uppercase">Sepi</span>
				{#each [0.15, 0.4, 0.65, 0.9] as f (f)}
					<span class="h-3.5 w-5 rounded-[4px]" style="background:{cellColor(f * maxSel)}"></span>
				{/each}
				<span class="text-[9px] font-bold text-[var(--color-ink-400)] uppercase">Ramai</span>
			</div>
			<p class="text-[10px] leading-relaxed text-[var(--color-ink-400)]">
				💡 Atur jadwal kasir & stok mengikuti jam terpadat.
			</p>
		</div>
	{/if}
</div>
