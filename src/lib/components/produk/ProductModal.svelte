<script>
	import { formatRupiah } from '$lib/utils/format.js';

	/**
	 * Modal form Tambah / Edit Produk.
	 * @type {{ product?: {id:string,name:string,category:string,buyPrice:number,sellPrice:number,stock:number} | null, onclose: () => void, onsave: (data:any) => void }}
	 */
	let { product = null, onclose, onsave } = $props();

	// Nilai awal form. Modal diremount saat dibuka, jadi hanya nilai awal yang relevan.
	// svelte-ignore state_referenced_locally
	let name = $state(product?.name ?? '');
	// svelte-ignore state_referenced_locally
	let category = $state(product?.category ?? '');
	// svelte-ignore state_referenced_locally
	let buyPrice = $state(product?.buyPrice ?? 0);
	// svelte-ignore state_referenced_locally
	let sellPrice = $state(product?.sellPrice ?? 0);
	// svelte-ignore state_referenced_locally
	let stock = $state(product?.stock ?? 0);

	const margin = $derived(sellPrice - buyPrice);
	const valid = $derived(name.trim() !== '' && sellPrice >= 0 && stock >= 0);

	/** @param {SubmitEvent} e */
	function submit(e) {
		e.preventDefault();
		if (!valid) return;
		onsave({
			id: product?.id,
			name: name.trim(),
			category: category.trim() || 'Lainnya',
			buyPrice: Number(buyPrice) || 0,
			sellPrice: Number(sellPrice) || 0,
			stock: Number(stock) || 0
		});
	}
</script>

<!-- Overlay -->
<button class="fixed inset-0 z-50 bg-ink-900/40" onclick={onclose} aria-label="Tutup modal"
></button>

<!-- Panel -->
<div
	class="fixed inset-x-0 top-1/2 z-50 mx-auto w-[92%] max-w-md -translate-y-1/2 rounded-xl bg-surface p-6 shadow-2xl"
>
	<h2 class="text-lg font-bold text-ink-800">{product ? 'Edit Produk' : 'Produk Baru'}</h2>

	<form class="mt-5 flex flex-col gap-4" onsubmit={submit}>
		<div>
			<label class="text-xs font-bold text-ink-500" for="nama">Nama Produk</label>
			<input
				id="nama"
				class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
				bind:value={name}
				required
			/>
		</div>

		<div>
			<label class="text-xs font-bold text-ink-500" for="kategori">Kategori</label>
			<input
				id="kategori"
				placeholder="cth: Sembako, Minuman"
				class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
				bind:value={category}
			/>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="text-xs font-bold text-ink-500" for="hargabeli">Harga Beli</label>
				<input
					id="hargabeli"
					type="number"
					min="0"
					class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
					bind:value={buyPrice}
				/>
			</div>
			<div>
				<label class="text-xs font-bold text-ink-500" for="hargajual">Harga Jual</label>
				<input
					id="hargajual"
					type="number"
					min="0"
					class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
					bind:value={sellPrice}
				/>
			</div>
		</div>

		<div>
			<label class="text-xs font-bold text-ink-500" for="stok">Stok</label>
			<input
				id="stok"
				type="number"
				min="0"
				class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
				bind:value={stock}
			/>
		</div>

		<!-- Pratinjau margin (reaktif) -->
		<p class="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-500">
			Margin per unit:
			<span class="font-bold {margin < 0 ? 'text-danger-600' : 'text-success-600'}">
				{margin < 0 ? `-${formatRupiah(-margin)}` : formatRupiah(margin)}
			</span>
		</p>

		<div class="mt-1 flex justify-end gap-2">
			<button
				type="button"
				class="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-surface-2"
				onclick={onclose}
			>
				Batal
			</button>
			<button
				type="submit"
				disabled={!valid}
				class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Simpan
			</button>
		</div>
	</form>
</div>


