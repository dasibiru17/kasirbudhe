<script>
	import { products, saveProduct, deleteProduct } from '$lib/stores/stores.js';
	import ProductModal from '$lib/components/produk/ProductModal.svelte';
	import { formatRupiah } from '$lib/utils/format.js';

	let showAddModal = $state(false);
	let editingProduct = $state(null);
	let search = $state('');

	const filtered = $derived(
		$products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
	);
</script>

<section>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-ink-800">Produk & Stok</h1>
			<p class="mt-1 text-sm text-ink-500">
				Kelola daftar produk, harga beli, harga jual, dan jumlah stok.
			</p>
		</div>
		<button
			class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
			onclick={() => (showAddModal = true)}
		>
			+ Produk Baru
		</button>
	</div>

	<input
		type="search"
		placeholder="Cari produk..."
		class="mt-6 w-full max-w-sm rounded-lg border border-ink-300 px-4 py-2.5 text-sm outline-none focus:border-brand-400"
		bind:value={search}
	/>

	<div class="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-line bg-surface-alt text-xs text-ink-500 uppercase">
				<tr>
					<th class="px-5 py-3 font-bold">Nama</th>
					<th class="px-5 py-3 font-bold">Harga Beli</th>
					<th class="px-5 py-3 font-bold">Harga Jual</th>
					<th class="px-5 py-3 font-bold">Stok</th>
					<th class="px-5 py-3 font-bold">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-line">
				{#each filtered as p (p.id)}
					<tr class="hover:bg-surface-alt">
						<td class="px-5 py-3 font-medium text-ink-700">{p.name}</td>
						<td class="px-5 py-3 text-ink-600">{formatRupiah(p.buyPrice)}</td>
						<td class="px-5 py-3 text-ink-600">{formatRupiah(p.sellPrice)}</td>
						<td class="px-5 py-3">
							<span
								class="rounded-full px-2.5 py-0.5 text-xs font-bold {p.stock <= 5
									? 'bg-danger-50 text-danger-600'
									: 'bg-success-50 text-success-600'}"
							>
								{p.stock} unit
							</span>
						</td>
						<td class="px-5 py-3">
							<div class="flex gap-2">
								<button
									class="rounded-md border border-line px-3 py-1 text-xs font-medium text-ink-600 hover:bg-surface-2"
									onclick={() => (editingProduct = p)}
								>
									✏️ Edit
								</button>
								<button
									class="rounded-md border border-danger-200 px-3 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
									onclick={() => deleteProduct(p.id)}
								>
									🗑️ Hapus
								</button>
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="px-5 py-8 text-center text-ink-400" colspan="5">
							Belum ada produk — klik "+ Produk Baru" untuk menambahkan.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

{#if showAddModal || editingProduct}
	<ProductModal
		product={editingProduct}
		onclose={() => {
			showAddModal = false;
			editingProduct = null;
		}}
		onsave={(data) => {
			saveProduct(data);
			showAddModal = false;
			editingProduct = null;
		}}
	/>
{/if}


