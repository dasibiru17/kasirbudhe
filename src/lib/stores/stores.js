import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * ============================================================
 *  STORE UTAMA — Sistem Pembukuan & Kasir Toko Retail
 * ============================================================
 *  Semua data dipersist ke localStorage agar tidak hilang
 *  saat halaman direload. Pola yang dipakai:
 *
 *  1. `persisted(name, initial)` → writable + auto-sync localStorage
 *  2. Setiap perubahan pada store akan langsung tersimpan
 *  3. Store `cart`, `products`, `transactions`, `expenses` saling
 *     berhubungan melalui store `derived` untuk hitung total dsb.
 */

/** Key prefix agar tidak bentrok dengan app lain di localStorage yang sama */
const PREFIX = 'pos-kasir';

function loadFromStorage(key, fallback) {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(`${PREFIX}:${key}`);
		return raw ? JSON.parse(raw) : fallback;
	} catch {
		return fallback;
	}
}

/**
 * Membuat writable store yang otomatis tersinkronisasi dengan localStorage:
 * data dimuat saat aplikasi start, dan disimpan ulang di setiap perubahan.
 * @template T
 * @param {string} key
 * @param {T} initialValue
 */
function persisted(key, initialValue) {
	const store = writable(loadFromStorage(key, initialValue));
	if (browser) {
		store.subscribe((value) => {
			try {
				localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
			} catch {
				/* kuota penuh / mode privat — abaikan */
			}
		});
	}
	return store;
}

/** Format angka menjadi Rupiah (contoh: Rp 15.000) */
export function formatRupiah(n) {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(n || 0);
}

/** Tanggal & waktu singkat id-ID (contoh: 03 Nov 2026, 18.30) */
export function formatTanggal(iso) {
	return new Intl.DateTimeFormat('id-ID', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(iso));
}

/** ID unik sederhana */
export function uid() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * ------------------------------------------------------------
 *  DATA MASTER PRODUK
 * ------------------------------------------------------------
 *  @type {import('svelte/store').Writable<Array<{
 *    id:string, name:string, category:string,
 *    buyPrice:number, sellPrice:number, stock:number
 *  }>>}
 */
export const products = persisted('products', [
	// Data contoh agar aplikasi tidak kosong saat pertama dibuka
	{
		id: uid(),
		name: 'Beras Premium 5kg',
		category: 'Sembako',
		buyPrice: 58000,
		sellPrice: 68000,
		stock: 25
	},
	{
		id: uid(),
		name: 'Minyak Goreng 1L',
		category: 'Sembako',
		buyPrice: 14000,
		sellPrice: 17500,
		stock: 40
	},
	{
		id: uid(),
		name: 'Gula Pasir 1kg',
		category: 'Sembako',
		buyPrice: 13000,
		sellPrice: 16000,
		stock: 30
	},
	{
		id: uid(),
		name: 'Kopi Sachet',
		category: 'Minuman',
		buyPrice: 1200,
		sellPrice: 2000,
		stock: 100
	},
	{
		id: uid(),
		name: 'Air Mineral 600ml',
		category: 'Minuman',
		buyPrice: 2500,
		sellPrice: 4000,
		stock: 60
	},
	{
		id: uid(),
		name: 'Mie Instan Goreng',
		category: 'Makanan',
		buyPrice: 2800,
		sellPrice: 3500,
		stock: 80
	},
	{
		id: uid(),
		name: 'Sabun Mandi Batang',
		category: 'Perawatan',
		buyPrice: 3800,
		sellPrice: 5000,
		stock: 20
	},
	{
		id: uid(),
		name: 'Deterjen 800g',
		category: 'Perawatan',
		buyPrice: 15500,
		sellPrice: 19000,
		stock: 15
	}
]);

/**
 * ------------------------------------------------------------
 *  KERANJANG BELANJA (POS)
 * ------------------------------------------------------------
 *  @type {import('svelte/store').Writable<Array<{ id:string, productId:string, name:string, price:number, qty:number }>>}
 */
export const cart = persisted('cart', []);

/** Tambah produk ke keranjang (atau tambah qty jika sudah ada) */
export function addToCart(product) {
	cart.update((items) => {
		const existing = items.find((i) => i.productId === product.id);
		if (existing) {
			// Batasi qty agar tidak melebihi stok yang ada
			const maxQty = Math.min(existing.qty + 1, product.stock);
			return items.map((i) => (i.productId === product.id ? { ...i, qty: maxQty } : i));
		}
		return [
			...items,
			{ id: uid(), productId: product.id, name: product.name, price: product.sellPrice, qty: 1 }
		];
	});
}

/** Ubah jumlah item di keranjang */
export function setCartQty(cartItemId, qty) {
	cart.update((items) =>
		items
			.map((i) => (i.id === cartItemId ? { ...i, qty: Math.max(1, Math.min(qty, 999)) } : i))
			.filter((i) => i.qty > 0)
	);
}

/** Hapus satu item dari keranjang */
export function removeCartItem(cartItemId) {
	cart.update((items) => items.filter((i) => i.id !== cartItemId));
}

/** Kosongkan keranjang */
export function clearCart() {
	cart.set([]);
}

/**
 * ------------------------------------------------------------
 *  RIWAYAT TRANSAKSI PENJUALAN (kas masuk)
 * ------------------------------------------------------------
 *  @type {import('svelte/store').Writable<Array<{
 *    id:string, date:string,
 *    items:Array<{ productId:string, name:string, price:number, qty:number }>,
 *    total:number, cost:number, profit:number, paid:number, change:number
 *  }>>}
 */
export const transactions = persisted('transactions', []);

/**
 * ------------------------------------------------------------
 *  CATATAN PENGELUARAN OPERASIONAL (kas keluar)
 * ------------------------------------------------------------
 *  @type {import('svelte/store').Writable<Array<{ id:string, date:string, note:string, amount:number }>>}
 */
export const expenses = persisted('expenses', []);

/**
 * ============================================================
 *  STORE TURUNAN (derived) — dihitung ulang otomatis
 *  setiap kali data sumber berubah. Inilah reaktivitas
 *  khas Svelte: UI ikut update tanpa kode tambahan.
 * ============================================================
 */

/** Total belanja keranjang saat ini */
export const cartTotal = derived(cart, ($cart) =>
	$cart.reduce((sum, i) => sum + i.price * i.qty, 0)
);

/** Jumlah jenis item di keranjang */
export const cartCount = derived(cart, ($cart) => $cart.reduce((sum, i) => sum + i.qty, 0));

/** Statistik ringkas untuk halaman Dashboard */
export const stats = derived([transactions, products, expenses], ([$txs, $products, $expenses]) => {
	const omzet = $txs.reduce((s, t) => s + t.total, 0);
	const modalTerjual = $txs.reduce((s, t) => s + t.cost, 0);
	const laba = omzet - modalTerjual;
	const pengeluaran = $expenses.reduce((s, e) => s + e.amount, 0);
	const saldoKas = omzet - pengeluaran;
	const nilaiStok = $products.reduce((s, p) => s + p.buyPrice * p.stock, 0);
	const stokKritis = $products.filter((p) => p.stock <= 5);
	const hariIni = new Date().toDateString();
	const penjualanHariIni = $txs
		.filter((t) => new Date(t.date).toDateString() === hariIni)
		.reduce((s, t) => s + t.total, 0);

	return {
		omzet,
		laba,
		pengeluaran,
		saldoKas,
		nilaiStok,
		stokKritis,
		penjualanHariIni,
		totalProduk: $products.length,
		jumlahTransaksi: $txs.length
	};
});

/**
 * ============================================================
 *  LOGIKA INTI: MENYELESAIKAN TRANSAKSI KASIR
 * ============================================================
 *  1. Kurangi stok produk di data master secara otomatis
 *  2. Catat transaksi ke riwayat (kas masuk)
 *  3. Kosongkan keranjang
 *  @param {number} paid - uang yang dibayarkan pelanggan
 */
export function checkout(paid) {
	const items = get(cart);
	const total = items.reduce((s, i) => s + i.price * i.qty, 0);
	if (items.length === 0) return { ok: false, reason: 'Keranjang kosong' };
	if (paid < total) return { ok: false, reason: 'Pembayaran kurang dari total' };

	// Hitung harga modal (HPP) dari data master
	const allProducts = get(products);
	const cost = items.reduce((s, i) => {
		const p = allProducts.find((x) => x.id === i.productId);
		return s + (p ? p.buyPrice * i.qty : 0);
	}, 0);

	// 1) Potong stok di data master
	products.update((list) =>
		list.map((p) => {
			const item = items.find((i) => i.productId === p.id);
			return item ? { ...p, stock: Math.max(0, p.stock - item.qty) } : p;
		})
	);

	// 2) Catat transaksi
	const tx = {
		id: uid(),
		date: new Date().toISOString(),
		items,
		total,
		cost,
		profit: total - cost,
		paid,
		change: paid - total
	};
	transactions.update((list) => [tx, ...list]);

	// 3) Bersihkan keranjang
	cart.set([]);
	return { ok: true, tx };
}

/** Tambah catatan pengeluaran operasional */
export function addExpense(note, amount) {
	if (!note || amount <= 0) return;
	expenses.update((list) => [{ id: uid(), date: new Date().toISOString(), note, amount }, ...list]);
}

/** Hapus catatan pengeluaran */
export function removeExpense(id) {
	expenses.update((list) => list.filter((e) => e.id !== id));
}

/** Hapus semua riwayat transaksi penjualan (riwayat kembali kosong) */
export function clearTransactions() {
	transactions.set([]);
}

/** CRUD Produk */
export function saveProduct(data) {
	if (data.id) {
		updateProduct(data.id, data);
	} else {
		products.update((list) => [...list, { ...data, id: uid() }]);
	}
}
export function updateProduct(id, data) {
	products.update((list) => list.map((p) => (p.id === id ? { ...p, ...data, id } : p)));
}
export function deleteProduct(id) {
	products.update((list) => list.filter((p) => p.id !== id));
	cart.update((items) => items.filter((i) => i.productId !== id));
}
