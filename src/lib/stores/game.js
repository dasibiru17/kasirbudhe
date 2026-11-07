import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/db-config.js';
import { session } from '$lib/stores/auth.js';
import { uid } from '$lib/stores/stores.js';

/**
 * ============================================================
 *  GAME MINI & INTERAKTIF — Store + Logika
 * ============================================================
 *  A. Cashier Speed Run (internal/kasir)
 *     Latihan menghitung kembalian. Hasil disimpan ke `game_scores`
 *     (skor, akurasi, combo, level, durasi).
 *
 *  B. Spin & Win Discounts (konsumen/loyalitas)
 *     Roda putar hadiah. Hasil spin langsung membuat kode voucher
 *     (`vouchers`) yang bisa diinput kasir saat checkout.
 *
 *  Keduanya berjalan di dua mode:
 *   - Cloud  : tabel Supabase (bila isSupabaseConfigured)
 *   - Lokal  : localStorage (mode default aplikasi, tanpa database)
 */

const PREFIX = 'pos-kasir';

/** @param {string} key @param {any} fallback */
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
				/* abaikan saat kuota penuh */
			}
		});
	}
	return store;
}

/** @typedef {{ id:string, username:string, name:string, score:number, bestStreak:number, correct:number, wrong:number, accuracy:number, level:string, avgResponseMs:number, createdAt:string }} GameScore */
/** @typedef {{ id:string, username:string, name:string, prizeId:string, label:string, type:'percent'|'nominal'|'points'|'zonk', value:number, code:string, status:'aktif'|'terpakai'|'kedaluwarsa', createdAt:string, expiresAt:string, usedAt:string|null, txId:string|null }} Voucher */

const DAY = 24 * 60 * 60 * 1000;

/**
 * Buang voucher "Coba Lagi" (zonk) — hanya hadiah nyata yang ditampilkan di UI.
 * @param {Voucher[]} list
 */
function validVoucherOnly(list) {
	return list.filter((v) => v.type !== 'zonk');
}

/** Riwayat skor game kasir (berbagai pemain). @type {import('svelte/store').Writable<GameScore[]>} */
export const gameScores = persisted('game-scores', []);

/** Riwayat voucher yang dimenangkan konsumen. @type {import('svelte/store').Writable<Voucher[]>} */
export const vouchers = persisted('vouchers', []);

/**
 * Tabel game belum/tidak bisa dipakai di Supabase (belum menjalankan
 * supabase-schema-game.sql, RLS menolak, atau jaringan putus).
 * Selama `true`, semua data game disimpan di localStorage agar permainan
 * tetap bisa dimainkan. Setiap sinkron berikutnya mencoba cloud lagi.
 */
export const gameOffline = writable(false);

/** Pesan error terakhir dari Supabase (untuk ditampilkan di halaman /game). */
export const gameCloudError = writable('');

/**
 * Jenis mode database yang sedang dipakai.
 * @returns {'cloud'|'lokal'}
 */
export function gameDbMode() {
	return supabase && !get(gameOffline) ? 'cloud' : 'lokal';
}

/**
 * Deteksi "tabel belum dibuat" dari respons PostgREST (kode 42P01 / PGRST205 / http 404).
 * @param {{ code?: string, status?: number, message?: string } | null | undefined} error
 */
function isMissingTableError(error) {
	if (!error) return false;
	const code = String(error.code ?? '');
	if (code === '42P01' || code === 'PGRST205' || error.status === 404) return true;
	return /does not exist|schema cache|could not find the table/i.test(String(error.message ?? ''));
}

/**
 * Sinkronkan skor game + voucher dari Supabase.
 * Dibungkus try/catch: bila tabel belum dibuat, aplikasi tetap jalan di lokal.
 */
export async function syncGameFromCloud() {
	if (!browser || !supabase) return { ok: false, reason: 'Mode lokal' };
	try {
		const { data: authData } = await supabase.auth.getSession();
		if (!authData?.session) {
			// Tanpa sesi login, cloud tidak bisa dipakai — mainkan di lokal.
			gameOffline.set(true);
			gameCloudError.set('Belum login ke Supabase — data game disimpan di browser ini.');
			return { ok: false, reason: 'Belum login' };
		}

		const [scoreRes, voucherRes] = await Promise.all([
			supabase.from('game_scores').select('*').order('created_at', { ascending: false }).limit(200),
			supabase.from('vouchers').select('*').order('created_at', { ascending: false }).limit(200)
		]);

		if (!scoreRes.error && Array.isArray(scoreRes.data)) {
			gameScores.set(scoreRes.data.map(mapRowToScore));
		}
		if (!voucherRes.error && Array.isArray(voucherRes.data)) {
			vouchers.set(voucherRes.data.map(mapRowToVoucher));
		}
		const errMsg = scoreRes.error?.message || voucherRes.error?.message || '';
		if (errMsg) {
			// Tabel belum ada / RLS menolak → mainkan di lokal, jangan blokir user.
			if (isMissingTableError(scoreRes.error) || isMissingTableError(voucherRes.error)) {
				gameOffline.set(true);
				gameCloudError.set(
					'Tabel game_scores / vouchers belum ada di Supabase. Jalankan supabase-schema-game.sql di SQL Editor.'
				);
			} else {
				// Error lain (jaringan, RLS) juga berarti data game tak bisa dijamin tersimpan.
				// Jangan tampilkan "tersimpan di Supabase" bila cloud tidak benar-benar bisa dipakai.
				gameOffline.set(true);
				gameCloudError.set(errMsg);
			}
			return { ok: false, reason: errMsg };
		}

		gameOffline.set(false);
		gameCloudError.set('');
		return { ok: true };
	} catch (err) {
		gameOffline.set(true);
		const reason = err instanceof Error ? err.message : 'Gagal sinkron';
		gameCloudError.set(reason);
		return { ok: false, reason };
	}
}

// ============================================================
//  PEMETAAN BARIS SUPABASE <-> OBJEK APLIKASI
// ============================================================

/** @param {any} r */
function mapRowToScore(r) {
	const correct = Number(r.correct) || 0;
	const wrong = Number(r.wrong) || 0;
	return {
		id: String(r.id ?? ''),
		username: String(r.username ?? ''),
		name: String(r.name ?? r.username ?? ''),
		score: Number(r.score) || 0,
		bestStreak: Number(r.best_streak) || 0,
		correct,
		wrong,
		accuracy: Number(r.accuracy) || 0,
		level: String(r.level ?? 'Pemula'),
		avgResponseMs: Number(r.avg_response_ms) || 0,
		createdAt: r.created_at || new Date().toISOString()
	};
}

/** @param {any} r */
function mapRowToVoucher(r) {
	return {
		id: String(r.id ?? ''),
		username: String(r.username ?? ''),
		name: String(r.name ?? ''),
		prizeId: String(r.prize_id ?? ''),
		label: String(r.label ?? ''),
		type: /** @type {'percent'|'nominal'|'points'|'zonk'} */ (r.type ?? 'percent'),
		value: Number(r.value) || 0,
		code: String(r.code ?? ''),
		status: /** @type {'aktif'|'terpakai'|'kedaluwarsa'} */ (r.status ?? 'aktif'),
		createdAt: r.created_at || new Date().toISOString(),
		expiresAt: r.expires_at || new Date(Date.now() + 7 * DAY).toISOString(),
		usedAt: r.used_at || null,
		txId: r.tx_id || null
	};
}

/** @param {GameScore} s */
function scoreToRow(s) {
	return {
		id: s.id,
		username: s.username,
		name: s.name,
		score: s.score,
		best_streak: s.bestStreak,
		correct: s.correct,
		wrong: s.wrong,
		accuracy: s.accuracy,
		level: s.level,
		avg_response_ms: s.avgResponseMs,
		created_at: s.createdAt
	};
}

/** @param {Voucher} v */
function voucherToRow(v) {
	return {
		id: v.id,
		username: v.username,
		name: v.name,
		prize_id: v.prizeId,
		label: v.label,
		type: v.type,
		value: v.value,
		code: v.code,
		status: v.status,
		created_at: v.createdAt,
		expires_at: v.expiresAt,
		used_at: v.usedAt,
		tx_id: v.txId
	};
}

// ============================================================
//  A. CASHIER SPEED RUN — Generator Soal
// ============================================================

/** Katalog item belanja mini-market (murah & serba pecahan seperti kasir asli). */
export const MENU_ITEMS = [
	{ name: 'Air Mineral 600ml', price: 4000, icon: '💧' },
	{ name: 'Mie Instan Goreng', price: 3500, icon: '🍜' },
	{ name: 'Kopi Sachet', price: 2000, icon: '☕' },
	{ name: 'Roti Manis', price: 4500, icon: '🍞' },
	{ name: 'Susu Kotak 250ml', price: 6500, icon: '🥛' },
	{ name: 'Sabun Mandi', price: 5000, icon: '🧼' },
	{ name: 'Permen Mint', price: 500, icon: '🍬' },
	{ name: 'Telur 1kg', price: 28000, icon: '🥚' },
	{ name: 'Gula Pasir 1kg', price: 16000, icon: '🍚' },
	{ name: 'Minyak Goreng 1L', price: 17500, icon: '🛢️' },
	{ name: 'Sampo Sachet', price: 1500, icon: '🧴' },
	{ name: 'Baterai AA', price: 12000, icon: '🔋' },
	{ name: 'Tisu Gulung', price: 7000, icon: '🧻' },
	{ name: 'Snack Keripik', price: 9000, icon: '🍟' },
	{ name: 'Detergen 250g', price: 8500, icon: '🧺' },
	{ name: 'Es Krim Cup', price: 6000, icon: '🍨' }
];

/** Level kesulitan: mengatur jumlah item, nominal ganjil, dan waktu. */
export const LEVELS = [
	{ id: 'pemula', label: 'Pemula', icon: '🟢', items: [2, 3], seconds: 12, odd: 500 },
	{ id: 'mahir', label: 'Mahir', icon: '🟡', items: [3, 4], seconds: 10, odd: 250 },
	{ id: 'kilat', label: 'Kilat', icon: '🔴', items: [4, 5], seconds: 8, odd: 100 }
];

/** @param {number} n @param {number} step */
const roundTo = (n, step) => Math.round(n / step) * step;

/**
 * Buat satu sesi soal kasir.
 * @param {number} index nomor soal (0-based) untuk menaikkan kesulitan bertahap
 * @returns {{
 *   id: string, levelId: string, levelLabel: string,
 *   items: Array<{ name:string, icon:string, price:number, qty:number }>,
 *   total: number, paid: number, change: number, seconds: number,
 *   options: number[]
 * }}
 */
export function createRound(index = 0) {
	const lvl = LEVELS[Math.min(LEVELS.length - 1, Math.floor(index / 4))];
	const count = randInt(lvl.items[0], lvl.items[1]);
	/** @type {Map<string, { name:string, icon:string, price:number, qty:number }>} */
	const picked = new Map();

	while (picked.size < count) {
		const item = MENU_ITEMS[randInt(0, MENU_ITEMS.length - 1)];
		if (picked.has(item.name)) continue;
		picked.set(item.name, { ...item, qty: randInt(1, 2) });
	}

	const items = [...picked.values()];
	const rawTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
	// Total dibulatkan ke pecahan sesuai level (500 → 250 → 100) agar latihan makin tajam
	const total = roundTo(rawTotal, lvl.odd);
	const change = changeOf(total);

	return {
		id: uid(),
		levelId: lvl.id,
		levelLabel: lvl.label,
		items,
		total,
		paid: total + change,
		change,
		seconds: lvl.seconds,
		/** Empat pilihan ganda kembalian — satu benar + tiga pengecoh masuk akal. */
		options: changeOptions(change)
	};
}

/**
 * Pilihan ganda untuk satu soal: kembalian yang benar + 3 pengecoh.
 * Pengecoh dibuat "menipu" ala kasir nyata:
 *  - salah hitung pecahan terdekat (±500/±1.000)
 *  - tertukar nominal uang pembayaran (kembalian jika dibayar pecahan lain)
 *  - lupa qty / salah membaca total
 * Semua opsi unik, ≥ 0, lalu diacak agar posisi jawaban benar tidak menetap.
 * @param {number} change
 * @returns {number[]}
 */
function changeOptions(change) {
	/** @type {Set<number>} */
	const set = new Set([change]);
	/** @type {number[]} */
	const near = [500, 1000, 2000, 5000];
	let guard = 0;
	while (set.size < 4 && guard < 40) {
		guard++;
		const mode = randInt(0, 2);
		/** @type {number} */
		let candidate;
		if (mode === 0) {
			// geser pecahan terdekat
			const step = near[randInt(0, Math.min(2, near.length - 1))];
			candidate = change + (Math.random() < 0.5 ? -step : step);
		} else if (mode === 1) {
			// pembulatan kasar yang keliru
			const step = near[randInt(0, near.length - 1)];
			candidate = roundTo(change, step) + (Math.random() < 0.5 ? -step : step);
		} else {
			// jauh sekali (tertukar dengan total / terbalik)
			candidate =
				Math.random() < 0.5
					? change * 2 + randInt(1, 5) * 500
					: Math.max(0, change - randInt(1, 4) * 1000);
		}
		// Pengecoh minimal Rp 500 agar "Rp 0" tidak jadi pilihan gampang dicoret
		if (candidate >= 500 && candidate !== change) set.add(candidate);
	}
	// Fallback keamanan: isi dengan variasi sederhana bila generator macet
	let extra = 500;
	while (set.size < 4) {
		if (change + extra >= 500) set.add(change + extra);
		if (change - extra >= 500 && change - extra !== change) set.add(change - extra);
		extra += 500;
	}
	return [...set].sort(() => Math.random() - 0.5);
}

/**
 * Kembalian "manusiawi": pelanggan membayar uang bulat (50rb/100rb),
 * jadi kembaliannya kelipatan 500–5.000 yang tidak terlalu besar.
 * `total` dipakai untuk menaikkan nominal kembalian pada belanja besar
 * (uang tunai 100rb ke atas lebih wajar dikembalikan 5rb/10rb).
 * @param {number} total
 */
function changeOf(total) {
	const options = total > 90000 ? [5000, 10000] : [0, 500, 1000, 1500, 2000, 5000];
	return options[randInt(0, options.length - 1)];
}

/**
 * @param {number} min
 * @param {number} max
 */
function randInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
//  A. SKOR, AKURASI, LEVEL
// ============================================================

/** Skor satu soal: makin cepat & makin tinggi combonya, makin besar poinnya.
 * @param {boolean} correct
 * @param {number} timeLeftMs sisa waktu saat menjawab (ms)
 * @param {number} maxMs durasi total soal (ms)
 * @param {number} combo jumlah jawaban benar beruntun
 */
export function scoreFor(correct, timeLeftMs, maxMs, combo) {
	if (!correct) return 0;
	const timeBonus = Math.max(0, Math.min(1, timeLeftMs / maxMs));
	const comboBonus = Math.min(combo, 10) * 10;
	return Math.round(50 + timeBonus * 100 + comboBonus);
}

/** @param {number} correct @param {number} wrong */
export function accuracyOf(correct, wrong) {
	const total = correct + wrong;
	return total === 0 ? 0 : Math.round((correct / total) * 100);
}

/** Gelar berdasarkan akurasi + jumlah benar.
 * @param {number} accuracy 0-100
 * @param {number} correct jumlah jawaban benar
 */
export function rankOf(accuracy, correct) {
	if (accuracy >= 95 && correct >= 20)
		return { label: 'Kasir Legendaris', icon: '👑', tone: 'warning' };
	if (accuracy >= 90) return { label: 'Kasir Kilat', icon: '⚡', tone: 'brand' };
	if (accuracy >= 75) return { label: 'Kasir Mahir', icon: '⭐', tone: 'success' };
	if (accuracy >= 50) return { label: 'Kasir Magang', icon: '🌱', tone: 'ink' };
	return { label: 'Kasir Pemula', icon: '🐣', tone: 'danger' };
}

/**
 * Simpan satu sesi permainan selesai ke `game_scores`.
 * @param {{ correct:number, wrong:number, bestStreak:number, score:number, level:string, avgResponseMs:number }} result
 */
export async function saveGameScore(result) {
	const s = get(session);
	const record = {
		id: uid(),
		username: String(s?.username ?? 'tamu'),
		name: String(s?.name ?? 'Tamu'),
		score: Math.round(result.score) || 0,
		bestStreak: result.bestStreak || 0,
		correct: result.correct || 0,
		wrong: result.wrong || 0,
		accuracy: accuracyOf(result.correct || 0, result.wrong || 0),
		level: result.level || 'Pemula',
		avgResponseMs: Math.round(result.avgResponseMs) || 0,
		createdAt: new Date().toISOString()
	};

	gameScores.update((list) => [record, ...list].slice(0, 200));

	const db = supabase;
	if (browser && db) {
		const { error } = await db.from('game_scores').insert(scoreToRow(record));
		if (error) {
			gameCloudError.set(error.message);
			return { ok: false, reason: error.message, record, dbMode: 'lokal' };
		}
		return { ok: true, record, dbMode: 'cloud', reason: '' };
	}
	return { ok: true, record, dbMode: 'lokal', reason: '' };
}

/** Papan peringkat: skor tertinggi per pemain. */
export const leaderboard = derived(gameScores, ($scores) => {
	/** @type {Map<string, GameScore>} */
	const best = new Map();
	for (const s of $scores) {
		const key = s.username || s.name;
		const prev = best.get(key);
		if (!prev || s.score > prev.score) best.set(key, s);
	}
	return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
});

/** Statistik pemain yang sedang login (untuk kartu ringkasan). */
export const myStats = derived([gameScores, session], ([$scores, $session]) => {
	const key = String($session?.username ?? 'tamu');
	const mine = $scores.filter((s) => s.username === key);
	const best = mine.reduce((m, s) => (s.score > m ? s.score : m), 0);
	const totalCorrect = mine.reduce((a, s) => a + s.correct, 0);
	const totalWrong = mine.reduce((a, s) => a + s.wrong, 0);
	const avgAccuracy =
		mine.length === 0 ? 0 : Math.round(mine.reduce((a, s) => a + s.accuracy, 0) / mine.length);
	return {
		plays: mine.length,
		best,
		lastPlayedAt: mine.length ? mine[0].createdAt : '',
		accuracy: avgAccuracy,
		totalCorrect,
		totalWrong,
		bestStreak: mine.reduce((m, s) => Math.max(m, s.bestStreak), 0)
	};
});

/** Hapus riwayat skor (khusus pemilik, untuk bersih-bersih data latihan). */
export async function clearGameScores() {
	gameScores.set([]);
	const db = supabase;
	if (browser && db) {
		await db.from('game_scores').delete().neq('id', '');
	}
}

// ============================================================
//  B. SPIN & WIN — Hadiah, Roda, Voucher
// ============================================================

/**
 * Segmen roda putar. `weight` = peluang relatif (bukan persen).
 * Roda digambar dari daftar ini, jadi urutan = urutan segmen.
 */
export const PRIZES = [
	{
		id: 'diskon5',
		label: 'Diskon 5%',
		type: 'percent',
		value: 5,
		weight: 26,
		color: '#4f46e5',
		icon: '🏷️'
	},
	{
		id: 'poin50',
		label: 'Poin 50',
		type: 'points',
		value: 50,
		weight: 22,
		color: '#0891b2',
		icon: '⭐'
	},
	{
		id: 'diskon10',
		label: 'Diskon 10%',
		type: 'percent',
		value: 10,
		weight: 14,
		color: '#7c3aed',
		icon: '🎯'
	},
	{
		id: 'zonk',
		label: 'Coba Lagi',
		type: 'zonk',
		value: 0,
		weight: 16,
		color: '#64748b',
		icon: '🙈'
	},
	{
		id: 'potongan2k',
		label: 'Potongan 2rb',
		type: 'nominal',
		value: 2000,
		weight: 10,
		color: '#059669',
		icon: '💵'
	},
	{
		id: 'diskon15',
		label: 'Diskon 15%',
		type: 'percent',
		value: 15,
		weight: 7,
		color: '#db2777',
		icon: '🔥'
	},
	{
		id: 'potongan5k',
		label: 'Potongan 5rb',
		type: 'nominal',
		value: 5000,
		weight: 4,
		color: '#ea580c',
		icon: '💰'
	},
	{
		id: 'diskon20',
		label: 'Diskon 20%',
		type: 'percent',
		value: 20,
		weight: 1,
		color: '#b91c1c',
		icon: '👑'
	}
];

/** Hadiah minimum yang wajib didapat setelah N kali "zonk" beruntun (anti frustrasi). */
const ZONK_MERCY = 2;

/** Kode voucher: SPN-XXXXXX (tanpa huruf/angka yang mudah tertukar: 0/O, 1/I). */
export function generateVoucherCode() {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let out = '';
	for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
	return `SPN-${out}`;
}

/**
 * Tentukan pemenang berdasarkan bobot. `zonekStreak` menaikkan peluang menang
 * agar konsumen tidak kapok setelah berkali-kali "Coba Lagi".
 * @param {number} zonkStreak
 */
export function pickPrize(zonkStreak = 0) {
	const boost = zonkStreak >= ZONK_MERCY ? 4 : 1;
	const pool = PRIZES.map((p) => ({ ...p, w: p.id === 'zonk' ? p.weight / boost : p.weight }));
	const total = pool.reduce((a, p) => a + p.w, 0);
	let r = Math.random() * total;
	for (const p of pool) {
		r -= p.w;
		if (r <= 0) return p;
	}
	return pool[0];
}

/**
 * Index segmen roda untuk hadiah terpilih.
 * @param {string} prizeId
 */
export function prizeIndex(prizeId) {
	return Math.max(
		0,
		PRIZES.findIndex((p) => p.id === prizeId)
	);
}

/** Batas spin per orang per hari. */
export const SPIN_DAILY_LIMIT = 3;

/**
 * Berapa kali user ini sudah spin hari ini (dihitung dari voucher tersimpan).
 * @param {string} username
 */
export function spinsToday(/** @type {string} */ username) {
	const today = new Date().toDateString();
	return get(vouchers).filter(
		(v) => v.username === username && new Date(v.createdAt).toDateString() === today
	).length;
}

/**
 * Buat voucher dari hadiah roda.
 * @param {{ id:string, label:string, type:string, value:number }} prize
 * @param {string} [namaKonsumen]
 */
export async function createVoucher(prize, namaKonsumen = '') {
	const s = get(session);
	const now = Date.now();
	const record = {
		id: uid(),
		username: String(s?.username ?? 'tamu'),
		name: String(namaKonsumen || s?.name || 'Konsumen'),
		prizeId: prize.id,
		label: prize.label,
		type: /** @type {'percent'|'nominal'|'points'|'zonk'} */ (prize.type),
		value: prize.value,
		code: generateVoucherCode(),
		status: /** @type {'aktif'} */ ('aktif'),
		createdAt: new Date(now).toISOString(),
		expiresAt: new Date(now + 7 * DAY).toISOString(),
		usedAt: null,
		txId: null
	};

	vouchers.update((list) => [record, ...list]);

	const db = supabase;
	if (browser && db) {
		const { error } = await db.from('vouchers').insert(voucherToRow(record));
		if (error) {
			// Voucher tetap valid di lokal: kasir memvalidasi dari store yang sama.
			gameCloudError.set(error.message);
			return {
				ok: true,
				record,
				dbMode: 'lokal',
				reason: error.message // info tambahan: hadiah tetap valid, hanya tidak tersinkron
			};
		}
		return { ok: true, record, dbMode: 'cloud', reason: '' };
	}
	return { ok: true, record, dbMode: 'lokal', reason: '' };
}

/**
 * Cari voucher berdasarkan kode (tidak peka huruf besar/kecil).
 * @param {string} code
 * @param {Voucher[]} [list]
 */
export function findVoucher(code, list = get(vouchers)) {
	const key = String(code ?? '')
		.trim()
		.toUpperCase();
	if (!key) return null;
	return list.find((v) => v.code.toUpperCase() === key) ?? null;
}

/**
 * Validasi voucher sebelum dipakai di kasir.
 * @param {string} code
 * @param {number} subtotal
 */
export function validateVoucher(/** @type {string} */ code, /** @type {number} */ subtotal) {
	const v = findVoucher(code);
	if (!v) return { ok: false, reason: 'Kode promo tidak ditemukan.' };
	if (v.status === 'terpakai') return { ok: false, reason: 'Kode ini sudah dipakai.' };
	if (v.type === 'zonk') return { ok: false, reason: 'Kode ini bukan hadiah (Coba Lagi).' };
	if (new Date(v.expiresAt).getTime() < Date.now())
		return { ok: false, reason: 'Kode sudah kedaluwarsa.' };
	if (subtotal <= 0) return { ok: false, reason: 'Keranjang masih kosong.' };

	const discount = voucherDiscount(v, subtotal);
	return { ok: true, voucher: v, discount };
}

/**
 * Hitung nilai potongan voucher.
 * - percent : maks 50% dari subtotal (pengaman), dibulatkan ke ratusan
 * - nominal : tidak melebihi subtotal
 * - points  : tidak memotong tagihan (dicatat sebagai reward)
 * @param {Voucher} v
 * @param {number} subtotal
 */
export function voucherDiscount(v, subtotal) {
	if (!v || v.type === 'zonk' || v.type === 'points') return 0;
	if (v.type === 'percent') {
		const pct = Math.min(v.value, 50);
		return Math.min(subtotal, Math.round((subtotal * pct) / 100 / 100) * 100);
	}
	return Math.min(subtotal, v.value);
}

/** Label potongan untuk UI (mis. "Diskon 10%" / "Potongan Rp 2.000").
 * @param {Voucher | null} v
 */
export function voucherLabel(v) {
	if (!v) return '';
	if (v.type === 'percent') return `Diskon ${v.value}%`;
	if (v.type === 'nominal')
		return `Potongan ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v.value)}`;
	if (v.type === 'points') return `Poin reward ${v.value}`;
	return 'Coba Lagi';
}

/**
 * Tandai voucher sebagai terpakai setelah transaksi selesai.
 * @param {string} code
 * @param {string} [txId]
 */
export async function redeemVoucher(/** @type {string} */ code, txId = '') {
	const key = String(code ?? '')
		.trim()
		.toUpperCase();
	let updated = null;
	vouchers.update((list) =>
		list.map((v) => {
			if (v.code.toUpperCase() !== key || v.status !== 'aktif') return v;
			updated = {
				...v,
				status: /** @type {'terpakai'} */ ('terpakai'),
				usedAt: new Date().toISOString(),
				txId
			};
			return updated;
		})
	);
	if (!updated) return { ok: false, reason: 'Voucher tidak valid.' };

	const db = supabase;
	if (browser && db) {
		const v = /** @type {Voucher} */ (updated);
		await db
			.from('vouchers')
			.update({ status: 'terpakai', used_at: v.usedAt, tx_id: v.txId })
			.eq('code', key);
	}
	return { ok: true, voucher: updated };
}

/** Batalkan pemakaian voucher (mis. kasir salah input lalu transaksi batal).
 * @param {string} code
 */
export async function unredeemVoucher(/** @type {string} */ code) {
	const key = String(code ?? '')
		.trim()
		.toUpperCase();
	vouchers.update((list) =>
		list.map((v) =>
			v.code.toUpperCase() === key
				? { ...v, status: /** @type {'aktif'} */ ('aktif'), usedAt: null, txId: null }
				: v
		)
	);
	const db = supabase;
	if (browser && db) {
		await db
			.from('vouchers')
			.update({ status: 'aktif', used_at: null, tx_id: null })
			.eq('code', key);
	}
}

/**
 * Tandai voucher kedaluwarsa (dipanggil sekali saat halaman game dibuka).
 * @returns {number} jumlah voucher yang berubah status
 */
export function markExpiredVouchers() {
	const now = Date.now();
	let changed = 0;
	vouchers.update((list) =>
		list.map((v) => {
			if (v.status === 'aktif' && new Date(v.expiresAt).getTime() < now) {
				changed++;
				return { ...v, status: /** @type {'kedaluwarsa'} */ ('kedaluwarsa') };
			}
			return v;
		})
	);
	return changed;
}

/** Voucher aktif saja, terbaru dulu. */
export const activeVouchers = derived(vouchers, ($v) =>
	$v.filter((v) => v.status === 'aktif' && v.type !== 'zonk')
);

/** Voucher aktif milik user yang sedang login. */
export const myVouchers = derived([vouchers, session], ([$v, $session]) => {
	const key = String($session?.username ?? 'tamu');
	return $v.filter((v) => v.username === key);
});

/**
 * Ringkasan untuk menu game (tile Cashier Speed Run & Spin & Win).
 * Dipakai halaman /game agar jumlah spin hari ini, voucher aktif, dan poin
 * selalu mengikuti data yang sama dengan papan permainan.
 */
export const gameSummary = derived(
	[myStats, myVouchers, vouchers, session],
	([$stats, $mine, $all, $session]) => {
		const today = new Date().toDateString();
		const valid = validVoucherOnly($mine);
		return {
			...$stats,
			spinsToday: spinsToday(String($session?.username ?? 'tamu')),
			vouchers: valid.length,
			voucherAktif: valid.filter((v) => v.status === 'aktif').length,
			voucherHariIni: valid.filter((v) => new Date(v.createdAt).toDateString() === today).length,
			totalVoucherHariIni: validVoucherOnly($all).filter(
				(v) => new Date(v.createdAt).toDateString() === today
			).length
		};
	}
);

/** Ringkasan statistik voucher untuk owner. */
export const voucherStats = derived(vouchers, ($v) => {
	const valid = $v.filter((x) => x.type !== 'zonk');
	const dipakai = valid.filter((x) => x.status === 'terpakai');
	return {
		total: valid.length,
		aktif: valid.filter((x) => x.status === 'aktif').length,
		dipakai: dipakai.length,
		conversion: valid.length === 0 ? 0 : Math.round((dipakai.length / valid.length) * 100)
	};
});
