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

<div class="flex h-[calc(100vh-0px)] overflow-hidden">
	<!-- Panel kiri: daftar produk -->
	<div class="flex w-full flex-col border-r border-line bg-surface-alt lg:w-[62%]">
		<div class="border-b border-line bg-surface px-5 py-4">
			<h1 class="text-xl font-bold text-ink-800">Kasir (POS)</h1>
			<input
				type="search"
				placeholder="Cari produk..."
				class="mt-3 w-full rounded-lg border border-ink-300 px-4 py-2.5 text-sm outline-none focus:border-brand-400"
				bind:value={search}
			/>
		</div>

		<div class="flex-1 overflow-y-auto p-5">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each filtered as p (p.id)}
					<button
						class="flex items-center justify-between rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
						disabled={p.stock <= 0}
						onclick={() => addToCart(p)}
					>
						<div>
							<p class="text-sm font-bold text-ink-800">{p.name}</p>
							<p class="mt-0.5 text-xs text-ink-400">
								{formatRupiah(p.sellPrice)} · stok {p.stock}
							</p>
						</div>
						<div class="flex items-center gap-2">
							{#if qty(p.id) > 0}
								<span
									class="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white"
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
	</div>

	<!-- Panel kanan: keranjang -->
	<div class="flex w-full flex-col bg-surface lg:w-[38%]">
		<div class="flex items-center justify-between border-b border-line px-5 py-4">
			<h2 class="text-sm font-bold text-ink-700">Keranjang</h2>
			<button
				class="text-xs font-medium text-danger-600 hover:underline"
				onclick={clearCart}
				disabled={$cart.length === 0}
			>
				Kosongkan
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-5">
			{#if $cart.length === 0}
				<p class="text-center text-sm text-ink-400">
					Keranjang kosong — klik produk di sebelah kiri.
				</p>
			{:else}
				<ul class="divide-y divide-line">
					{#each $cart as i (i.id)}
						<li class="flex items-center justify-between py-3">
							<div>
								<p class="text-sm font-medium text-ink-700">{i.name}</p>
								<p class="text-xs text-ink-400">{formatRupiah(i.price)} × {i.qty}</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									class="grid h-7 w-7 place-items-center rounded-md border border-line text-sm hover:bg-surface-2"
									disabled={i.qty <= 1}
									onclick={() => setCartQty(i.productId, i.qty - 1)}
								>
									−
								</button>
								<span class="w-5 text-center text-sm font-bold">{i.qty}</span>
								<button
									class="grid h-7 w-7 place-items-center rounded-md border border-line text-sm hover:bg-surface-2"
									onclick={() => setCartQty(i.productId, i.qty + 1)}
								>
									+
								</button>
								<span class="w-20 text-right text-sm font-bold text-success-600">
									{formatRupiah(i.price * i.qty)}
								</span>
								<button
									class="text-xs text-danger-600 hover:underline"
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
		<div class="border-t border-line px-5 py-4">
			<div class="flex items-center justify-between text-sm">
				<span class="text-ink-500">Total {cartItems} item</span>
				<span class="text-lg font-bold text-ink-800">{formatRupiah(cartTotal)}</span>
			</div>
			<button
				class="mt-3 w-full rounded-lg bg-success-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-40"
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
		class="fixed inset-0 z-50 bg-ink-900/40"
		onclick={() => (showCheckout = false)}
		aria-label="Tutup"
	></button>
	<div
		class="fixed inset-x-0 top-1/2 z-50 mx-auto w-[92%] max-w-sm -translate-y-1/2 rounded-xl bg-surface p-6 shadow-2xl"
	>
		<h2 class="text-lg font-bold text-ink-800">Konfirmasi Pembayaran</h2>

		<div class="mt-5 flex flex-col gap-4">
			<div class="flex items-center justify-between rounded-lg bg-surface-alt px-4 py-3 text-sm">
				<span class="text-ink-500">Total Tagihan</span>
				<span class="font-bold text-ink-800">{formatRupiah(cartTotal)}</span>
			</div>

			<div>
				<label class="text-xs font-bold text-ink-500" for="dibayar">Uang Dibayar</label>
				<input
					id="dibayar"
					type="number"
					min="0"
					class="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
					bind:value={paid}
				/>
			</div>

			<div class="flex items-center justify-between rounded-lg bg-success-50 px-4 py-3 text-sm">
				<span class="text-ink-500">Kembalian</span>
				<span class="font-bold text-success-700">{formatRupiah(change)}</span>
			</div>

			<div class="flex justify-end gap-2">
				<button
					class="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-surface-alt"
					onclick={() => (showCheckout = false)}
				>
					Batal
				</button>
				<button
					class="rounded-lg bg-success-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-40"
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
