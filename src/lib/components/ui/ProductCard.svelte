<script>
	/**
	 * ProductCard — kartu produk untuk halaman Kasir & Produk.
	 * Animasi masuk: slide-up + fade (fly transition Svelte).
	 * Efek tekan: btn-press (turun 2px saat ditekan, ala tombol kasir).
	 *
	 * @type {{
	 *   product: { id: string|number, name: string, price: number, stock: number },
	 *   onadd?: () => void,
	 *   delay?: number  // stagger masuk (ms)
	 * }}
	 */
	import { fly } from 'svelte/transition';

	let { product, onadd = () => {}, delay = 0 } = $props();

	import { formatIDR } from '$lib/utils/format';

	const lowStock = $derived(product.stock <= 5);
	const outOfStock = $derived(product.stock <= 0);
</script>

<div
	class="card btn-press group flex cursor-pointer flex-col gap-2 p-4
		{outOfStock ? 'opacity-60' : ''}"
	transition:fly={{ y: 24, duration: 300, delay }}
	onclick={() => !outOfStock && onadd()}
	role="button"
	tabindex="0"
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !outOfStock && onadd()}
>
	<div class="flex items-start justify-between gap-2">
		<p class="text-h3 line-clamp-2">{product.name}</p>
		<!-- Badge stok -->
		{#if outOfStock}
			<span
				class="bg-danger-100 text-danger-700 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
			>
				Stok habis
			</span>
		{:else if lowStock}
			<span
				class="bg-warning-100 text-warning-700 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
			>
				{product.stock} menipis
			</span>
		{:else}
			<span
				class="bg-success-100 text-success-700 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
			>
				{product.stock}
			</span>
		{/if}
	</div>

	<p class="text-stat-sm tabular-nums">{formatIDR(product.price)}</p>

	<!-- Tombol tambah (muncul halus saat hover) -->
	{#if !outOfStock}
		<button
			class="bg-brand-600 mt-1 w-full rounded-lg py-2 text-sm font-semibold text-white opacity-0
				transition-opacity duration-200 group-hover:opacity-100"
			onclick={(e) => {
				e.stopPropagation();
				onadd();
			}}
		>
			+ Tambah ke Keranjang
		</button>
	{/if}
</div>
