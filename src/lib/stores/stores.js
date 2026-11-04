import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/db-config.js';

/**
 * ============================================================
 *  STORE UTAMA â€” Sistem Pembukuan & Kasir Toko Retail
 *  (Tersinkronisasi ke Cloud Supabase + Offline Cache)
 * ============================================================
 */

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
				/* abaikan */
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

const DEFAULT_PRODUCTS = [
	{
		id: 'p-1',
		name: 'Beras Premium 5kg',
		category: 'Sembako',
		buyPrice: 58000,
		sellPrice: 68000,
		stock: 25
	},
	{
		id: 'p-2',
		name: 'Minyak Goreng 1L',
		category: 'Sembako',
		buyPrice: 14000,
		sellPrice: 17500,
		stock: 40
	},
	{
		id: 'p-3',
		name: 'Gula Pasir 1kg',
		category: 'Sembako',
		buyPrice: 13000,
		sellPrice: 16000,
		stock: 30
	},
	{
		id: 'p-4',
		name: 'Kopi Sachet',
		category: 'Minuman',
		buyPrice: 1200,
		sellPrice: 2000,
		stock: 100
	},
	{
		id: 'p-5',
		name: 'Air Mineral 600ml',
		category: 'Minuman',
		buyPrice: 2500,
		sellPrice: 4000,
		stock: 60
	},
	{
		id: 'p-6',
		name: 'Mie Instan Goreng',
		category: 'Makanan',
		buyPrice: 2800,
		sellPrice: 3500,
		stock: 80
	},
	{
		id: 'p-7',
		name: 'Sabun Mandi Batang',
		category: 'Perawatan',
		buyPrice: 3800,
		sellPrice: 5000,
		stock: 20
	},
	{
		id: 'p-8',
		name: 'Deterjen 800g',
		category: 'Perawatan',
		buyPrice: 15500,
		sellPrice: 19000,
		stock: 15
	}
];

/**
 * ------------------------------------------------------------
 *  DATA MASTER PRODUK
 * ------------------------------------------------------------
 *  @type {import('svelte/store').Writable<Array<{
 *    id:string, name:string, category:string,
 *    buyPrice:number, sellPrice:number, stock:number
 *  }>>}
 */
export const products = persisted('products', DEFAULT_PRODUCTS);

/**
 * ------------------------------------------------------------
 *  KERANJANG BELANJA (POS)
 * ------------------------------------------------------------
 *  @type {import('svelte/store').Writable<Array<{ id:string, productId:string, name:string, price:number, qty:number }>>}
 */
export const cart = persisted('cart', []);

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

/** Sinkronisasi Produk, Transaksi, dan Pengeluaran dari Supabase Cloud */
export async function syncDataFromCloud() {
	if (!browser || !supabase) return;

	// Jangan menyentuh cloud sebelum ada sesi login: request anonim dijamin gagal (401)
	// dan menimpa data dengan seed palsu.
	const { data: authData, error: authError } = await supabase.auth.getSession();
	if (authError || !authData?.session) return;

	try {
		const [prodRes, txRes, expRes] = await Promise.all([
			supabase.from('products').select('*').order('created_at', { ascending: true }),
			supabase.from('transactions').select('*').order('date', { ascending: false }),
			supabase.from('expenses').select('*').order('date', { ascending: false })
		]);

		if (!prodRes.error && Array.isArray(prodRes.data)) {
			if (prodRes.data.length > 0) {
				products.set(
					prodRes.data.map((r) => ({
						id: String(r.id),
						name: String(r.name),
						category: String(r.category || 'Lainnya'),
						buyPrice: Number(r.buy_price) || 0,
						sellPrice: Number(r.sell_price) || 0,
						stock: Number(r.stock) || 0
					}))
				);
			}
		}

		if (!txRes.error && Array.isArray(txRes.data)) {
			transactions.set(
				txRes.data.map((r) => ({
					id: String(r.id),
					date: r.date || new Date().toISOString(),
					items: Array.isArray(r.items) ? r.items : [],
					total: Number(r.total) || 0,
					cost: Number(r.cost) || 0,
					profit: Number(r.profit) || 0,
					paid: Number(r.paid) || 0,
					change: Number(r.change) || 0
				}))
			);
		}

		if (!expRes.error && Array.isArray(expRes.data)) {
			expenses.set(
				expRes.data.map((r) => ({
					id: String(r.id),
					date: r.date || new Date().toISOString(),
					note: String(r.note),
					amount: Number(r.amount) || 0
				}))
			);
		}
	} catch {
		/* abaikan saat offline */
	}
}

if (browser && supabase) {
	syncDataFromCloud();

	supabase
		.channel('public:pos-data')
		.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, syncDataFromCloud)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'transactions' },
			syncDataFromCloud
		)
		.on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, syncDataFromCloud)
		.subscribe();
}

/** Tambah produk ke keranjang (atau tambah qty jika sudah ada) */
export function addToCart(product) {
	cart.update((items) => {
		const existing = items.find((i) => i.productId === product.id);
		if (existing) {
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
			.map((i) =>
				i.id === cartItemId || i.productId === cartItemId
					? { ...i, qty: Math.max(1, Math.min(qty, 999)) }
					: i
			)
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
 *  @param {number} paid - uang yang dibayarkan pelanggan
 */
export function checkout(paid) {
	const items = get(cart);
	const total = items.reduce((s, i) => s + i.price * i.qty, 0);
	if (items.length === 0) return { ok: false, reason: 'Keranjang kosong' };
	if (paid < total) return { ok: false, reason: 'Pembayaran kurang dari total' };

	const allProducts = get(products);
	const cost = items.reduce((s, i) => {
		const p = allProducts.find((x) => x.id === i.productId);
		return s + (p ? p.buyPrice * i.qty : 0);
	}, 0);

	/** @type {Array<{id: string, stock: number}>} */
	const stockUpdates = [];

	// 1) Potong stok di data master
	products.update((list) =>
		list.map((p) => {
			const item = items.find((i) => i.productId === p.id);
			if (item) {
				const newStock = Math.max(0, p.stock - item.qty);
				stockUpdates.push({ id: p.id, stock: newStock });
				return { ...p, stock: newStock };
			}
			return p;
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

	// Sinkronkan ke Supabase Cloud
	if (browser && supabase) {
		supabase
			.from('transactions')
			.insert({
				id: tx.id,
				date: tx.date,
				items: tx.items,
				total: tx.total,
				cost: tx.cost,
				profit: tx.profit,
				paid: tx.paid,
				change: tx.change
			})
			.then(() => {});

		for (const u of stockUpdates) {
			supabase
				.from('products')
				.update({ stock: u.stock })
				.eq('id', u.id)
				.then(() => {});
		}
	}

	// 3) Bersihkan keranjang
	cart.set([]);
	return { ok: true, tx };
}

/** Tambah catatan pengeluaran operasional */
export function addExpense(note, amount) {
	if (!note || amount <= 0) return;
	const newExp = { id: uid(), date: new Date().toISOString(), note, amount };
	expenses.update((list) => [newExp, ...list]);

	if (browser && supabase) {
		supabase
			.from('expenses')
			.insert({
				id: newExp.id,
				date: newExp.date,
				note: newExp.note,
				amount: newExp.amount
			})
			.then(() => {});
	}
}

/** Hapus catatan pengeluaran */
export function removeExpense(id) {
	expenses.update((list) => list.filter((e) => e.id !== id));
	if (browser && supabase) {
		supabase
			.from('expenses')
			.delete()
			.eq('id', id)
			.then(() => {});
	}
}

/** Hapus semua riwayat transaksi penjualan (riwayat kembali kosong) */
export function clearTransactions() {
	transactions.set([]);
	if (browser && supabase) {
		supabase
			.from('transactions')
			.delete()
			.neq('id', '')
			.then(() => {});
	}
}

/** CRUD Produk */
export function saveProduct(data) {
	if (data.id) {
		updateProduct(data.id, data);
	} else {
		const newProd = { ...data, id: uid() };
		products.update((list) => [...list, newProd]);
		if (browser && supabase) {
			supabase
				.from('products')
				.insert({
					id: newProd.id,
					name: newProd.name,
					category: newProd.category,
					buy_price: newProd.buyPrice,
					sell_price: newProd.sellPrice,
					stock: newProd.stock
				})
				.then(() => {});
		}
	}
}
export function updateProduct(id, data) {
	products.update((list) => list.map((p) => (p.id === id ? { ...p, ...data, id } : p)));
	if (browser && supabase) {
		supabase
			.from('products')
			.update({
				name: data.name,
				category: data.category,
				buy_price: data.buyPrice,
				sell_price: data.sellPrice,
				stock: data.stock
			})
			.eq('id', id)
			.then(() => {});
	}
}
export function deleteProduct(id) {
	products.update((list) => list.filter((p) => p.id !== id));
	cart.update((items) => items.filter((i) => i.productId !== id));
	if (browser && supabase) {
		supabase
			.from('products')
			.delete()
			.eq('id', id)
			.then(() => {});
	}
}
