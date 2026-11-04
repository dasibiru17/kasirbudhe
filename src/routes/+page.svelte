<script>
	import { products, transactions } from '$lib/stores/stores.js';
	import StatCard from '$lib/components/dashboard/StatCard.svelte';
	import { formatRupiah, formatTanggal } from '$lib/utils/format.js';

	const totalStok = $derived($products.reduce((acc, p) => acc + p.stock, 0));
	const totalNilai = $derived($products.reduce((acc, p) => acc + p.stock * p.buyPrice, 0));
	const stokMenipis = $derived($products.filter((p) => p.stock <= 5));

	const penjualanHariIni = $derived.by(() => {
		const today = new Date().toDateString();
		return $transactions.filter((t) => new Date(t.date).toDateString() === today);
	});
	const omzetHariIni = $derived(penjualanHariIni.reduce((acc, t) => acc + t.total, 0));
	const labaHariIni = $derived(penjualanHariIni.reduce((acc, t) => acc + t.profit, 0));
</script>

<section>
	<h1 class="text-2xl font-bold text-ink-800">Dashboard</h1>
	<p class="mt-1 text-sm text-ink-500">
		Ringkasan kondisi toko — data tersimpan otomatis.
	</p>

	<!-- Kondisi Stok -->
	<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard title="Total Produk" value={$products.length} icon="📦" tone="brand" />
		<StatCard title="Total Unit Stok" value={totalStok} icon="🏬" tone="success" />
		<StatCard title="Nilai Modal Stok" value={formatRupiah(totalNilai)} icon="💰" tone="warning" />
		<StatCard title="Stok Menipis" value={stokMenipis.length} icon="⚠️" tone="danger" />
	</div>

	<!-- Performa Hari Ini -->
	<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard title="Transaksi Hari Ini" value={penjualanHariIni.length} icon="🧾" tone="brand" />
		<StatCard title="Omzet Hari Ini" value={formatRupiah(omzetHariIni)} icon="💵" tone="success" />
		<StatCard
			title="Laba Kotor Hari Ini"
			value={formatRupiah(labaHariIni)}
			icon="📈"
			tone="success"
		/>
		<StatCard
			title="Omzet Total Semua"
			value={formatRupiah($transactions.reduce((acc, t) => acc + t.total, 0))}
			icon="🏦"
			tone="warning"
		/>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Produk Stok Menipis -->
		<div class="rounded-xl border border-line bg-surface p-5">
			<h2 class="text-sm font-bold text-ink-700">Peringatan Stok Menipis</h2>
			{#if stokMenipis.length === 0}
				<p class="mt-3 text-sm text-ink-400">Semua stok aman — tidak ada peringatan.</p>
			{:else}
				<ul class="mt-3 divide-y divide-line">
					{#each stokMenipis as p (p.id)}
						<li class="flex items-center justify-between py-2.5 text-sm">
							<span class="font-medium text-ink-700">{p.name}</span>
							<span class="rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-bold text-danger-600">
								{p.stock} unit
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Transaksi Terakhir -->
		<div class="rounded-xl border border-line bg-surface p-5">
			<h2 class="text-sm font-bold text-ink-700">Transaksi Terakhir</h2>
			{#if $transactions.length === 0}
				<p class="mt-3 text-sm text-ink-400">
					Belum ada transaksi — buka <a class="text-brand-600" href="/kasir">Kasir (POS)</a> untuk mencatat
					penjualan.
				</p>
			{:else}
				<ul class="mt-3 divide-y divide-line">
					{#each $transactions.slice(0, 5) as t (t.id)}
						<li class="flex items-center justify-between py-2.5 text-sm">
							<div>
								<p class="font-medium text-ink-700">
									{t.items.reduce((a, i) => a + i.qty, 0)} item
								</p>
								<p class="text-xs text-ink-400">{formatTanggal(t.date)}</p>
							</div>
							<span class="font-bold text-success-600">{formatRupiah(t.total)}</span>
						</li>
					{/each}
				</ul>
				<a class="mt-3 inline-block text-xs font-medium text-brand-600" href="/laporan">
					Lihat semua di Buku Kas →
				</a>
			{/if}
		</div>
	</div>
</section>


