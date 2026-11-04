<script>
	/**
	 * CartItem — baris produk di keranjang kasir.
	 * Animasi: slide masuk dari kanan (fly), keluar dengan slide-out
	 * (animator provided out: transisi Svelte fly reversed).
	 *
	 * @type {{
	 *   item: { id: string|number, name: string, price: number, qty: number },
	 *   onqty?: (qty: number) => void,
	 *   onremove?: (id?: string|number) => void
	 * }}
	 */
	import { fly } from 'svelte/transition';

	let { item, onqty = () => {}, onremove = () => {} } = $props();

	import { formatIDR } from '$lib/utils/format';
</script>

<div
	class="card flex items-center justify-between gap-3 p-3"
	transition:fly={{ x: 320, duration: 250 }}
>
	<!-- Nama & harga satuan -->
	<div class="min-w-0 flex-1">
		<p class="truncate text-sm font-semibold text-[var(--color-ink-900)]">{item.name}</p>
		<p class="text-caption tabular-nums">{formatIDR(item.price)} × {item.qty}</p>
	</div>

	<!-- Pengatur qty -->
	<div class="flex shrink-0 items-center gap-1">
		<button
			class="btn-press grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-surface-2)] text-lg font-bold text-[var(--color-ink-900)]"
			onclick={() => onqty(item.qty - 1)}
			aria-label="Kurangi qty"
		>
			−
		</button>
		<span class="w-8 text-center text-sm font-bold tabular-nums">{item.qty}</span>
		<button
			class="btn-press bg-brand-600 grid h-8 w-8 place-items-center rounded-lg text-lg font-bold text-white"
			onclick={() => onqty(item.qty + 1)}
			aria-label="Tambah qty"
		>
			+
		</button>
	</div>

	<!-- Subtotal -->
	<p class="w-24 shrink-0 text-right text-sm font-bold tabular-nums">
		{formatIDR(item.price * item.qty)}
	</p>

	<!-- Hapus -->
	<button
		class="btn-press bg-danger-100 text-danger-600 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm"
		onclick={() => onremove()}
		aria-label="Hapus item"
	>
		🗑
	</button>
</div>
