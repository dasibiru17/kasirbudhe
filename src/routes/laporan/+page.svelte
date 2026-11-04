<script>
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

	const omzet = $derived($transactions.reduce((acc, t) => acc + t.total, 0));
	const pengeluaran = $derived($expenses.reduce((acc, e) => acc + e.amount, 0));
	// Modal (HPP) = total harga beli barang yang terjual, dari field `cost` tiap transaksi
	const modalTerjual = $derived($transactions.reduce((acc, t) => acc + (t.cost || 0), 0));
	const labaRugi = $derived(omzet - modalTerjual); // negatif = rugi
	const saldoKas = $derived(omzet - pengeluaran);

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
	<p class="text-ink-500 mt-1 text-sm">
		Riwayat transaksi penjualan (kas masuk) dan pengeluaran operasional (kas keluar).
	</p>

	<!-- Ringkasan Keuangan -->
	<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<div class="border-success-200 bg-success-50 rounded-xl border p-5">
			<p class="text-success-700 text-xs font-medium">Total Omzet (Kas Masuk)</p>
			<p class="text-success-800 mt-1 text-lg font-bold">{formatRupiah(omzet)}</p>
		</div>
		<div class="border-line bg-surface rounded-xl border p-5">
			<p class="text-ink-500 text-xs font-medium">Total Modal (HPP)</p>
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
		<div class="border-warning-200 bg-warning-50 rounded-xl border p-5">
			<p class="text-warning-700 text-xs font-medium">Pengeluaran Operasional</p>
			<p class="text-warning-800 mt-1 text-lg font-bold">{formatRupiah(pengeluaran)}</p>
		</div>
		<div class="border-line bg-surface rounded-xl border p-5">
			<p class="text-ink-500 text-xs font-medium">Saldo Kas Bersih</p>
			<p class="text-ink-800 mt-1 text-lg font-bold">{formatRupiah(saldoKas)}</p>
		</div>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Form Pengeluaran -->
		<form class="border-line bg-surface rounded-xl border p-5" onsubmit={tambahPengeluaran}>
			<h2 class="text-ink-700 text-sm font-bold">Catat Pengeluaran</h2>
			<input
				class="border-ink-300 focus:border-brand-400 mt-3 w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
				placeholder="cth: Beli kantong plastik"
				bind:value={note}
			/>
			<input
				type="number"
				min="0"
				class="border-ink-300 focus:border-brand-400 mt-2 w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
				placeholder="Nominal (Rp)"
				bind:value={amount}
			/>
			<button
				type="submit"
				class="bg-brand-600 hover:bg-brand-700 mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white"
			>
				+ Catat Pengeluaran
			</button>

			<!-- Daftar pengeluaran -->
			{#if $expenses.length > 0}
				<ul class="divide-line border-line mt-5 divide-y border-t pt-3">
					{#each $expenses as e (e.id)}
						<li class="flex items-center justify-between py-2 text-sm">
							<div>
								<p class="text-ink-700 font-medium">{e.note}</p>
								<p class="text-ink-400 text-xs">{formatTanggalJam(e.date)}</p>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-danger-600 font-bold">-{formatRupiah(e.amount)}</span>
								<button
									class="text-ink-400 hover:text-danger-600 text-xs"
									onclick={() => removeExpense(e.id)}
									aria-label="Hapus">✕</button
								>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</form>

		<!-- Riwayat Transaksi -->
		<div class="border-line bg-surface rounded-xl border lg:col-span-2">
			<div class="border-line flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
				<h2 class="text-ink-700 text-sm font-bold">Riwayat Transaksi Penjualan</h2>
				{#if $transactions.length > 0}
					<div class="flex items-center gap-2">
						<button
							class="border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg border px-3 py-1.5 text-xs font-semibold"
							onclick={() => exportPDF($transactions)}
							title="Cetak / simpan sebagai PDF"
						>
							🖨 Export PDF
						</button>
						<button
							class="border-success-200 bg-success-50 text-success-700 hover:bg-success-100 rounded-lg border px-3 py-1.5 text-xs font-semibold"
							onclick={() => exportExcel($transactions)}
							title="Unduh sebagai file Excel"
						>
							📊 Export Excel
						</button>
						<button
							class="border-danger-200 text-danger-600 hover:bg-danger-50 rounded-lg border px-3 py-1.5 text-xs font-semibold"
							onclick={resetRiwayat}
						>
							🗑 Reset
						</button>
					</div>
				{/if}
			</div>
			{#if $transactions.length === 0}
				<p class="text-ink-400 px-5 py-8 text-center text-sm">Belum ada transaksi.</p>
			{:else}
				<div class="max-h-[32rem] overflow-y-auto">
					<table class="w-full text-left text-sm">
						<thead class="border-line bg-surface-alt text-ink-500 border-b text-xs uppercase">
							<tr>
								<th class="px-5 py-3 font-bold">Waktu</th>
								<th class="px-5 py-3 font-bold">Item</th>
								<th class="px-5 py-3 text-right font-bold">Omzet</th>
								<th class="px-5 py-3 text-right font-bold">Modal</th>
								<th class="px-5 py-3 text-right font-bold">Laba/Rugi</th>
							</tr>
						</thead>
						<tbody class="divide-line divide-y">
							{#each $transactions as t (t.id)}
								{@const labaT = t.total - (t.cost || 0)}
								<tr class="hover:bg-surface-alt">
									<td class="text-ink-500 px-5 py-3 text-xs">{formatTanggalJam(t.date)}</td>
									<td class="text-ink-600 px-5 py-3 text-xs">
										{t.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}
									</td>
									<td class="text-ink-700 px-5 py-3 text-right text-xs">{formatRupiah(t.total)}</td>
									<td class="text-ink-500 px-5 py-3 text-right text-xs"
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
						<tfoot class="border-line bg-surface-alt border-t-2">
							<tr>
								<td class="text-ink-700 px-5 py-3 text-xs font-bold" colspan="2">TOTAL</td>
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
