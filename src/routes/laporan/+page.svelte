<script>
	import { fly } from 'svelte/transition';
	import {
		transactions,
		expenses,
		addExpense,
		removeExpense,
		clearTransactions
	} from '$lib/stores/stores.js';
	import { formatRupiah, formatTanggalJam } from '$lib/utils/format.js';
	import { exportPDF, exportExcel } from '$lib/utils/export-laporan.js';

	let note = $state('');
	let amount = $state('');

	/** Tombol kategori cepat — isi keterangan pengeluaran dengan sekali klik. */
	const kategoriCepat = [
		{ icon: '🛍️', label: 'Beli stok barang' },
		{ icon: '🧹', label: 'Kebersihan & plastik' },
		{ icon: '⚡', label: 'Listrik & air' },
		{ icon: '🛵', label: 'Ongkir / antar' },
		{ icon: '🧑‍💼', label: 'Gaji & bonus' },
		{ icon: '🔧', label: 'Perbaikan & lainnya' }
	];

	const omzet = $derived($transactions.reduce((acc, t) => acc + t.total, 0));
	const pengeluaran = $derived($expenses.reduce((acc, e) => acc + e.amount, 0));
	// Modal (HPP) = total harga beli barang yang terjual, dari field `cost` tiap transaksi
	const modalTerjual = $derived($transactions.reduce((acc, t) => acc + (t.cost || 0), 0));
	const labaRugi = $derived(omzet - modalTerjual); // negatif = rugi
	const saldoKas = $derived(omzet - pengeluaran);

	/**
	 * @param {SubmitEvent} e
	 */
	function tambahPengeluaran(e) {
		e.preventDefault();
		if (!note.trim() || Number(amount) <= 0) return;
		addExpense(note.trim(), Number(amount));
		note = '';
		amount = '';
	}

	function resetRiwayat() {
		if (confirm('Hapus SEMUA riwayat transaksi penjualan? Data tidak bisa dikembalikan.')) {
			clearTransactions();
		}
	}
</script>

<section>
	<h1 class="text-ink-800 text-2xl font-bold">Laporan / Buku Kas</h1>
	<p class="mt-1 text-sm text-ink-500">
		Riwayat transaksi penjualan (kas masuk) dan pengeluaran operasional (kas keluar).
	</p>

	<!-- Ringkasan Keuangan -->
	<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<div class="border-success-200 rounded-xl border bg-success-50 p-5">
			<p class="text-xs font-medium text-success-700">Total Omzet (Kas Masuk)</p>
			<p class="text-success-800 mt-1 text-lg font-bold">{formatRupiah(omzet)}</p>
		</div>
		<div class="bg-surface rounded-xl border border-line p-5">
			<p class="text-xs font-medium text-ink-500">Total Modal (HPP)</p>
			<p class="text-ink-800 mt-1 text-lg font-bold">{formatRupiah(modalTerjual)}</p>
		</div>
		<div
			class="rounded-xl border p-5 {labaRugi >= 0
				? 'border-brand-200 bg-brand-50'
				: 'border-danger-200 bg-danger-50'}"
		>
			<p class="text-xs font-medium {labaRugi >= 0 ? 'text-brand-700' : 'text-danger-700'}">
				{labaRugi >= 0 ? 'Laba Bersih Penjualan' : 'Rugi Penjualan'}
			</p>
			<p class="mt-1 text-lg font-bold {labaRugi >= 0 ? 'text-brand-800' : 'text-danger-800'}">
				{formatRupiah(Math.abs(labaRugi))}
			</p>
		</div>
		<div class="border-warning-200 rounded-xl border bg-warning-50 p-5">
			<p class="text-xs font-medium text-warning-700">Pengeluaran Operasional</p>
			<p class="text-warning-800 mt-1 text-lg font-bold">{formatRupiah(pengeluaran)}</p>
		</div>
		<div class="bg-surface rounded-xl border border-line p-5">
			<p class="text-xs font-medium text-ink-500">Saldo Kas Bersih</p>
			<p class="text-ink-800 mt-1 text-lg font-bold">{formatRupiah(saldoKas)}</p>
		</div>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Form Pengeluaran -->
		<form
			class="bg-surface relative overflow-hidden rounded-2xl border border-line p-5 shadow-sm"
			onsubmit={tambahPengeluaran}
		>
			<!-- Aksen gradasi di tepi atas kartu -->
			<div
				class="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-danger-600 via-danger-500 to-warning-500"
				aria-hidden="true"
			></div>

			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div class="grid h-10 w-10 place-items-center rounded-xl bg-danger-50 text-lg">📤</div>
					<div>
						<h2 class="text-ink-800 text-sm font-bold">Catat Pengeluaran</h2>
						<p class="text-[11px] text-ink-400">Kas keluar operasional harian</p>
					</div>
				</div>
				<span
					class="rounded-full bg-danger-50 px-2.5 py-1 text-[10px] font-extrabold text-danger-600 tabular-nums"
				>
					{$expenses.length} catatan
				</span>
			</div>

			<!-- Kategori cepat -->
			<div class="mt-4">
				<p class="mb-1.5 text-[10px] font-bold tracking-wide text-ink-500 uppercase">
					Kategori cepat
				</p>
				<div class="flex flex-wrap gap-1.5">
					{#each kategoriCepat as k (k.label)}
						<button
							type="button"
							class="rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all duration-150
								{note === k.label
								? 'border-danger-300 bg-danger-50 text-danger-700'
								: 'bg-surface text-ink-600 hover:border-danger-300 border-line hover:text-danger-600'}"
							onclick={() => (note = k.label)}
						>
							{k.icon}
							{k.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="relative mt-3">
				<span
					class="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-sm text-ink-400"
					>✏️</span
				>
				<input
					class="border-ink-300 bg-surface mt-0 w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm transition-all duration-200 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
					placeholder="cth: Beli kantong plastik"
					bind:value={note}
				/>
			</div>

			<div class="relative mt-2">
				<span
					class="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-sm font-bold text-ink-400"
					>Rp</span
				>
				<input
					type="number"
					min="0"
					class="border-ink-300 bg-surface w-full rounded-xl border py-2.5 pr-4 pl-11 text-sm font-bold tabular-nums transition-all duration-200 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
					placeholder="0"
					bind:value={amount}
				/>
				{#if Number(amount) > 0}
					<p class="mt-1.5 text-right text-[11px] font-bold text-danger-500 tabular-nums">
						= {formatRupiah(Number(amount))}
					</p>
				{/if}
			</div>

			<button
				type="submit"
				class="mt-3 w-full btn-press rounded-xl bg-linear-to-r from-danger-600 to-danger-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-danger-600/20 transition-all hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
				disabled={!note.trim() || Number(amount) <= 0}
			>
				➖ Catat Pengeluaran
			</button>

			<!-- Daftar pengeluaran -->
			{#if $expenses.length > 0}
				{@const totalExp = $expenses.reduce((a, e) => a + e.amount, 0)}
				<div class="mt-5 flex items-center justify-between border-t border-line pt-3">
					<p class="text-[10px] font-bold tracking-wide text-ink-500 uppercase">
						Riwayat kas keluar
					</p>
					<p class="text-xs font-extrabold text-danger-600 tabular-nums">
						{formatRupiah(totalExp)}
					</p>
				</div>
				<ul class="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
					{#each $expenses as e, i (e.id)}
						<li
							class="group hover:bg-surface-alt flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 transition-all duration-150 hover:border-line"
							in:fly={{ x: -14, duration: 300, delay: Math.min(i * 40, 200) }}
						>
							<span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-danger-50 text-xs"
								>📤</span
							>
							<div class="min-w-0 flex-1">
								<p class="truncate text-xs font-bold text-ink-700">{e.note}</p>
								<p class="text-[10px] text-ink-400">{formatTanggalJam(e.date)}</p>
							</div>
							<div class="flex shrink-0 items-center gap-1.5">
								<span class="text-xs font-extrabold text-danger-600 tabular-nums"
									>-{formatRupiah(e.amount)}</span
								>
								<button
									class="grid h-6 w-6 place-items-center rounded-md text-xs text-ink-400 opacity-0 transition-all duration-150 hover:bg-danger-50 hover:text-danger-600 hover:group-hover:opacity-100 focus:opacity-100"
									onclick={() => removeExpense(e.id)}
									aria-label="Hapus pengeluaran">✕</button
								>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p
					class="bg-surface-alt mt-4 rounded-xl border-dashed border-line p-4 text-center text-[11px] text-ink-400"
				>
					Belum ada pengeluaran tercatat hari ini 🎉
				</p>
			{/if}
		</form>

		<!-- Riwayat Transaksi -->
		<div class="bg-surface rounded-xl border border-line lg:col-span-2">
			<div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
				<h2 class="text-sm font-bold text-ink-700">Riwayat Transaksi Penjualan</h2>
				{#if $transactions.length > 0}
					<div class="flex items-center gap-2">
						<button
							class="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
							onclick={() => exportPDF($transactions)}
							title="Cetak / simpan sebagai PDF"
						>
							🖨 Export PDF
						</button>
						<button
							class="border-success-200 rounded-lg border bg-success-50 px-3 py-1.5 text-xs font-semibold text-success-700 hover:bg-success-100"
							onclick={() => exportExcel($transactions)}
							title="Unduh sebagai file Excel"
						>
							📊 Export Excel
						</button>
						<button
							class="border-danger-200 rounded-lg border px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-50"
							onclick={resetRiwayat}
						>
							🗑 Reset
						</button>
					</div>
				{/if}
			</div>
			{#if $transactions.length === 0}
				<p class="px-5 py-8 text-center text-sm text-ink-400">Belum ada transaksi.</p>
			{:else}
				<div class="max-h-[32rem] overflow-x-auto overflow-y-auto">
					<table class="w-full min-w-[560px] text-left text-sm">
						<thead class="bg-surface-alt border-b border-line text-xs text-ink-500 uppercase">
							<tr>
								<th class="px-5 py-3 font-bold">Waktu</th>
								<th class="px-5 py-3 font-bold">Item</th>
								<th class="px-5 py-3 text-right font-bold">Omzet</th>
								<th class="px-5 py-3 text-right font-bold">Modal</th>
								<th class="px-5 py-3 text-right font-bold">Laba/Rugi</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-line">
							{#each $transactions as t (t.id)}
								{@const labaT = t.total - (t.cost || 0)}
								<tr class="hover:bg-surface-alt">
									<td class="px-5 py-3 text-xs text-ink-500">{formatTanggalJam(t.date)}</td>
									<td class="text-ink-600 px-5 py-3 text-xs">
										{t.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}
									</td>
									<td class="px-5 py-3 text-right text-xs text-ink-700">{formatRupiah(t.total)}</td>
									<td class="px-5 py-3 text-right text-xs text-ink-500"
										>{formatRupiah(t.cost || 0)}</td
									>
									<td
										class="px-5 py-3 text-right text-xs font-bold {labaT >= 0
											? 'text-success-600'
											: 'text-danger-600'}"
									>
										{formatRupiah(labaT)}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot class="bg-surface-alt border-t-2 border-line">
							<tr>
								<td class="px-5 py-3 text-xs font-bold text-ink-700" colspan="2">TOTAL</td>
								<td class="text-ink-800 px-5 py-3 text-right text-xs font-bold"
									>{formatRupiah(omzet)}</td
								>
								<td class="text-ink-800 px-5 py-3 text-right text-xs font-bold"
									>{formatRupiah(modalTerjual)}</td
								>
								<td
									class="px-5 py-3 text-right text-xs font-extrabold {labaRugi >= 0
										? 'text-success-600'
										: 'text-danger-600'}"
								>
									{formatRupiah(labaRugi)}
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</div>
	</div>
</section>
