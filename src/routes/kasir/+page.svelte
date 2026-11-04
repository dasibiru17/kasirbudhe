<script>
	import {
		products,
		cart,
		formatRupiah,
		addToCart,
		removeCartItem,
		setCartQty,
		clearCart,
		checkout
	} from '$lib/stores/stores.js';
	import NotaModal from '$lib/components/ui/NotaModal.svelte';

	let search = $state('');
	let showCheckout = $state(false);
	let paid = $state(0);
	let lastTx = $state(null);
	let showNota = $state(false);
	let mobileTab = $state('katalog'); // 'katalog' | 'keranjang'

	const filtered = $derived(
		$products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
	);

	const cartTotal = $derived($cart.reduce((acc, i) => acc + i.price * i.qty, 0));
	const cartItems = $derived($cart.reduce((acc, i) => acc + i.qty, 0));
	const change = $derived(Math.max(0, paid - cartTotal));

	function qty(productId) {
		const item = $cart.find((i) => i.id === productId || i.productId === productId);
		return item ? item.qty : 0;
	}

	function finishCheckout() {
		if ($cart.length === 0) return;
		const res = checkout(paid);
		showCheckout = false;
		paid = 0;
		if (res.ok) {
			lastTx = res.tx;
			showNota = true;
		}
	}
</script>

<!-- Tab switcher untuk tampilan HP -->
<div
	class="mb-3 flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-1 lg:hidden"
>
	<button
		type="button"
		class="flex-1 rounded-lg py-2 text-xs font-bold transition-colors
			{mobileTab === 'katalog'
			? 'bg-brand-600 text-white shadow-xs'
			: 'text-[var(--color-ink-700)] hover:bg-[var(--color-surface-2)]'}"
		onclick={() => (mobileTab = 'katalog')}
	>
		📦 Katalog Produk
	</button>
	<button
		type="button"
		class="relative flex-1 rounded-lg py-2 text-xs font-bold transition-colors
			{mobileTab === 'keranjang'
			? 'bg-brand-600 text-white shadow-xs'
			: 'text-[var(--color-ink-700)] hover:bg-[var(--color-surface-2)]'}"
		onclick={() => (mobileTab = 'keranjang')}
	>
		🛒 Keranjang
		{#if cartItems > 0}
			<span
				class="bg-danger-600 ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold text-white"
			>
				{cartItems}
			</span>
		{/if}
	</button>
</div>

<div
	class="flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] lg:h-[calc(100vh-8rem)] lg:flex-row"
>
	<!-- Panel kiri: daftar produk -->
	<div
		class="border-line bg-surface-alt flex w-full flex-col lg:w-[62%] lg:border-r {mobileTab ===
		'katalog'
			? 'flex'
			: 'hidden lg:flex'}"
	>
		<div class="border-line bg-surface border-b px-5 py-4">
			<h1 class="text-ink-800 text-xl font-bold">Kasir (POS)</h1>
			<input
				type="search"
				placeholder="Cari produk..."
				class="border-ink-300 focus:border-brand-400 mt-3 w-full rounded-lg border px-4 py-2.5 text-sm outline-none"
				bind:value={search}
			/>
		</div>

		<div class="max-h-[60vh] flex-1 overflow-y-auto p-4 sm:p-5 lg:max-h-none">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each filtered as p (p.id)}
					<button
						class="border-line bg-surface hover:border-brand-300 hover:bg-brand-50 flex items-center justify-between rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40"
						disabled={p.stock <= 0}
						onclick={() => addToCart(p)}
					>
						<div>
							<p class="text-ink-800 text-sm font-bold">{p.name}</p>
							<p class="text-ink-400 mt-0.5 text-xs">
								{formatRupiah(p.sellPrice)} · stok {p.stock}
							</p>
						</div>
						<div class="flex items-center gap-2">
							{#if qty(p.id) > 0}
								<span
									class="bg-brand-600 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white"
								>
									{qty(p.id)}
								</span>
							{/if}
							<span class="text-lg">+</span>
						</div>
					</button>
				{:else}
					<p class="col-span-full text-center text-sm text-ink-400">
						{$products.length === 0
							? 'Belum ada produk — tambahkan di halaman Produk & Stok.'
							: 'Tidak ada produk yang cocok dengan pencarian.'}
					</p>
				{/each}
			</div>
		</div>

		<!-- Tombol cepat buka keranjang di mobile -->
		{#if cartItems > 0}
			<div class="border-t border-[var(--color-line)] bg-[var(--color-surface-0)] p-3 lg:hidden">
				<button
					type="button"
					class="bg-brand-600 flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-bold text-white shadow-sm"
					onclick={() => (mobileTab = 'keranjang')}
				>
					<span>🛒 Lihat Keranjang ({cartItems})</span>
					<span>{formatRupiah(cartTotal)} →</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Panel kanan: keranjang -->
	<div
		class="bg-surface flex w-full flex-col lg:w-[38%] {mobileTab === 'keranjang'
			? 'flex'
			: 'hidden lg:flex'}"
	>
		<div class="border-line flex items-center justify-between border-b px-5 py-4">
			<h2 class="text-ink-700 text-sm font-bold">Keranjang</h2>
			<button
				class="text-danger-600 text-xs font-medium hover:underline"
				onclick={clearCart}
				disabled={$cart.length === 0}
			>
				Kosongkan
			</button>
		</div>

		<div class="max-h-[50vh] flex-1 overflow-y-auto p-4 sm:p-5 lg:max-h-none">
			{#if $cart.length === 0}
				<p class="text-ink-400 text-center text-sm">
					Keranjang kosong — klik produk di sebelah kiri.
				</p>
			{:else}
				<ul class="divide-line divide-y">
					{#each $cart as i (i.id)}
						<li class="flex items-center justify-between py-3">
							<div>
								<p class="text-ink-700 text-sm font-medium">{i.name}</p>
								<p class="text-ink-400 text-xs">{formatRupiah(i.price)} × {i.qty}</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									class="border-line hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-md border text-sm"
									disabled={i.qty <= 1}
									onclick={() => setCartQty(i.productId, i.qty - 1)}
								>
									−
								</button>
								<span class="w-5 text-center text-sm font-bold">{i.qty}</span>
								<button
									class="border-line hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-md border text-sm"
									onclick={() => setCartQty(i.productId, i.qty + 1)}
								>
									+
								</button>
								<span class="text-success-600 w-20 text-right text-sm font-bold">
									{formatRupiah(i.price * i.qty)}
								</span>
								<button
									class="text-danger-600 text-xs hover:underline"
									onclick={() => removeCartItem(i.id)}
									aria-label="Hapus item"
								>
									✕
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Ringkasan & tombol bayar -->
		<div class="border-line border-t px-5 py-4">
			<div class="flex items-center justify-between text-sm">
				<span class="text-ink-500">Total {cartItems} item</span>
				<span class="text-ink-800 text-lg font-bold">{formatRupiah(cartTotal)}</span>
			</div>
			<button
				class="bg-success-600 hover:bg-success-700 mt-3 w-full rounded-lg px-4 py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				disabled={$cart.length === 0}
				onclick={() => (showCheckout = true)}
			>
				Bayar Sekarang
			</button>
		</div>
	</div>
</div>

{#if showCheckout}
	<!-- Modal konfirmasi pembayaran -->
	<button
		class="bg-ink-900/40 fixed inset-0 z-50"
		onclick={() => (showCheckout = false)}
		aria-label="Tutup"
	></button>
	<div
		class="bg-surface fixed inset-x-0 top-1/2 z-50 mx-auto w-[92%] max-w-sm -translate-y-1/2 rounded-xl p-6 shadow-2xl"
	>
		<h2 class="text-ink-800 text-lg font-bold">Konfirmasi Pembayaran</h2>

		<div class="mt-5 flex flex-col gap-4">
			<div class="bg-surface-alt flex items-center justify-between rounded-lg px-4 py-3 text-sm">
				<span class="text-ink-500">Total Tagihan</span>
				<span class="text-ink-800 font-bold">{formatRupiah(cartTotal)}</span>
			</div>

			<div>
				<label class="text-ink-500 text-xs font-bold" for="dibayar">Uang Dibayar</label>
				<input
					id="dibayar"
					type="number"
					min="0"
					class="border-ink-300 focus:border-brand-400 mt-1 w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
					bind:value={paid}
				/>
			</div>

			<div class="bg-success-50 flex items-center justify-between rounded-lg px-4 py-3 text-sm">
				<span class="text-ink-500">Kembalian</span>
				<span class="text-success-700 font-bold">{formatRupiah(change)}</span>
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="border-line text-ink-600 hover:bg-surface-alt rounded-lg border px-4 py-2.5 text-sm font-medium"
					onclick={() => (showCheckout = false)}
				>
					Batal
				</button>
				<button
					class="bg-success-600 hover:bg-success-700 rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
					disabled={$cart.length === 0 || paid < cartTotal}
					onclick={finishCheckout}
				>
					Selesaikan Transaksi
				</button>
			</div>
		</div>
	</div>
{/if}

<NotaModal open={showNota} tx={lastTx} onclose={() => (showNota = false)} />
