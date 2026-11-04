import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * ============================================================
 *  AUTH SEDERHANA — login lokal tanpa database / backend
 * ============================================================
 *  - Daftar user + sesi login disimpan di localStorage
 *    (konsisten dengan arsitektur app ini yang full offline).
 *  - Login bisa pakai username ATAU email ATAU no. HP.
 *  - Password TIDAK disimpan polos, melainkan dalam bentuk hash
 *    sederhana agar tidak terbaca langsung di DevTools.
 *  - CATATAN: ini pengaman level toko (bukan keamanan serius).
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

/**
 * Hash sinkron sederhana (cyrb53) — cukup untuk menyamarkan
 * password di localStorage. BUKAN pengganti bcrypt/scrypt.
 */
export function hashPassword(str) {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	const s = String(str ?? '');
	for (let i = 0; i < s.length; i++) {
		const ch = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Normalisasi identitas agar perbandingan adil. */
export function normUsername(v) {
	return String(v ?? '')
		.trim()
		.toLowerCase();
}
export function normEmail(v) {
	return String(v ?? '')
		.trim()
		.toLowerCase();
}
/** No. HP: hanya digit, awalan 62/0 diseragamkan ke 0. */
export function normPhone(v) {
	let d = String(v ?? '').replace(/\D/g, '');
	if (d.startsWith('62')) d = '0' + d.slice(2);
	return d;
}

/** Akun bawaan — dibuat otomatis saat pertama dibuka. */
/** @type {Array<{ username:string, name:string, role:'pemilik'|'kasir', email:string, phone:string, passwordHash:string, status?:'aktif'|'menunggu'|'ditolak', createdAt?:string }>} */
const DEFAULT_USERS = [
	{
		username: 'admin',
		name: 'Pemilik Toko',
		role: 'pemilik',
		email: 'admin@tokosejahtera.id',
		phone: '081234567890',
		passwordHash: hashPassword('admin123'),
		status: 'aktif'
	},
	{
		username: 'kasir',
		name: 'Kasir Toko',
		role: 'kasir',
		email: '',
		phone: '',
		passwordHash: hashPassword('kasir123'),
		status: 'aktif'
	}
];

/**
 * @type {import('svelte/store').Writable<Array<{ username:string, name:string, role:'pemilik'|'kasir', email:string, phone:string, passwordHash:string, status?:'aktif'|'menunggu'|'ditolak', createdAt?:string }>>}
 */
export const users = persisted('users', DEFAULT_USERS);

// Migrasi: pastikan akun bawaan ada + semua user punya field email/phone/status
if (browser) {
	users.update((list) => {
		const arr = Array.isArray(list) ? [...list] : [];
		for (const d of DEFAULT_USERS) {
			const i = arr.findIndex((u) => normUsername(u?.username) === d.username);
			if (i === -1) {
				arr.push({ ...d });
			} else {
				arr[i] = {
					email: '',
					phone: '',
					...arr[i],
					username: arr[i].username,
					role: arr[i].role === 'kasir' ? 'kasir' : 'pemilik',
					status: arr[i].status || 'aktif'
				};
			}
		}
		// Normalisasi semua entri lama yang mungkin belum punya email/phone/status
		return arr.map((u) => ({
			username: String(u.username ?? ''),
			name: String(u.name ?? u.username ?? ''),
			role: u.role === 'kasir' ? 'kasir' : 'pemilik',
			email: normEmail(u.email),
			phone: normPhone(u.phone),
			passwordHash: String(u.passwordHash ?? ''),
			status: u.status === 'menunggu' || u.status === 'ditolak' ? u.status : 'aktif',
			createdAt: u.createdAt || new Date().toISOString()
		}));
	});
}

/**
 * Sesi login aktif: { username, name, role, loginAt } atau null.
 * @type {import('svelte/store').Writable<null | { username:string, name:string, role:string, loginAt:string }>}
 */
export const session = persisted('session', null);

/** Cari user berdasarkan username / email / no. HP. */
export function findUser(identifier) {
	const raw = String(identifier ?? '').trim();
	if (!raw) return undefined;
	const asUser = normUsername(raw);
	const asMail = normEmail(raw);
	const asPhone = normPhone(raw);
	return get(users).find((u) => {
		if (normUsername(u.username) === asUser) return true;
		if (u.email && normEmail(u.email) === asMail) return true;
		if (u.phone && asPhone && normPhone(u.phone) === asPhone) return true;
		return false;
	});
}

/** Coba login pakai username / email / no. HP. @returns {{ ok:boolean, reason?:string }} */
export function login(identifier, password) {
	if (!String(identifier ?? '').trim() || !password) {
		return { ok: false, reason: 'Isi username / email / no. HP dan password dulu ya.' };
	}
	const found = findUser(identifier);
	if (!found || found.passwordHash !== hashPassword(password)) {
		return { ok: false, reason: 'Akun atau password salah. Coba lagi.' };
	}
	if (found.status === 'menunggu') {
		return {
			ok: false,
			reason: 'Akun Anda sedang dalam peninjauan pembuat aplikasi / pemilik toko. Harap tunggu persetujuan.'
		};
	}
	if (found.status === 'ditolak') {
		return {
			ok: false,
			reason: 'Pendaftaran akun Anda ditolak oleh pemilik toko.'
		};
	}
	session.set({
		username: found.username,
		name: found.name,
		role: found.role,
		loginAt: new Date().toISOString()
	});
	return { ok: true };
}

/** Keluar — hapus sesi, kembali ke halaman login. */
export function logout() {
	session.set(null);
}

/**
 * Tambah pengguna baru (khusus pemilik).
 * @param {{ username:string, name:string, role:string, email?:string, phone?:string, password:string }} data
 * @returns {{ ok:boolean, reason?:string }}
 */
export function addUser(data) {
	const username = normUsername(data.username);
	const name = String(data.name ?? '').trim();
	const role = data.role === 'kasir' ? 'kasir' : 'pemilik';
	const email = normEmail(data.email);
	const phone = normPhone(data.phone);
	const password = String(data.password ?? '');

	if (!username) return { ok: false, reason: 'Username wajib diisi.' };
	if (!/^[a-z0-9._-]{3,20}$/.test(username))
		return { ok: false, reason: 'Username 3–20 karakter (huruf/angka/titik/_/-).' };
	if (!name) return { ok: false, reason: 'Nama lengkap wajib diisi.' };
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return { ok: false, reason: 'Format email tidak valid.' };
	if (phone && (phone.length < 9 || phone.length > 15))
		return { ok: false, reason: 'No. HP tidak valid (9–15 digit).' };
	if (password.length < 6) return { ok: false, reason: 'Password minimal 6 karakter.' };

	const list = get(users);
	if (list.some((u) => normUsername(u.username) === username))
		return { ok: false, reason: `Username "${username}" sudah dipakai.` };
	if (email && list.some((u) => u.email && normEmail(u.email) === email))
		return { ok: false, reason: `Email "${email}" sudah terdaftar.` };
	if (phone && list.some((u) => u.phone && normPhone(u.phone) === phone))
		return { ok: false, reason: `No. HP "${phone}" sudah terdaftar.` };

	users.update((arr) => [
		...arr,
		{ username, name, role, email, phone, passwordHash: hashPassword(password) }
	]);
	return { ok: true };
}

/**
 * Ubah data pengguna (nama / role / email / phone). Username tidak bisa diubah.
 * @returns {{ ok:boolean, reason?:string }}
 */
export function updateUser(username, patch) {
	const key = normUsername(username);
	const name = String(patch.name ?? '').trim();
	const role = patch.role === 'kasir' ? 'kasir' : 'pemilik';
	const email = normEmail(patch.email);
	const phone = normPhone(patch.phone);

	if (!name) return { ok: false, reason: 'Nama lengkap wajib diisi.' };
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return { ok: false, reason: 'Format email tidak valid.' };
	if (phone && (phone.length < 9 || phone.length > 15))
		return { ok: false, reason: 'No. HP tidak valid (9–15 digit).' };

	const list = get(users);
	if (
		email &&
		list.some((u) => normUsername(u.username) !== key && u.email && normEmail(u.email) === email)
	)
		return { ok: false, reason: `Email "${email}" sudah dipakai akun lain.` };
	if (
		phone &&
		list.some((u) => normUsername(u.username) !== key && u.phone && normPhone(u.phone) === phone)
	)
		return { ok: false, reason: `No. HP "${phone}" sudah dipakai akun lain.` };

	users.update((arr) =>
		arr.map((u) => (normUsername(u.username) === key ? { ...u, name, role, email, phone } : u))
	);

	// Kalau yang diubah adalah akun yang sedang login, sinkronkan sesinya
	const s = get(session);
	if (s && normUsername(s.username) === key) {
		session.set({ ...s, name, role });
	}
	return { ok: true };
}

/** Reset password pengguna. @returns {{ ok:boolean, reason?:string }} */
export function resetPassword(username, newPassword) {
	if (String(newPassword ?? '').length < 6)
		return { ok: false, reason: 'Password baru minimal 6 karakter.' };
	const key = normUsername(username);
	let found = false;
	users.update((arr) =>
		arr.map((u) => {
			if (normUsername(u.username) === key) {
				found = true;
				return { ...u, passwordHash: hashPassword(newPassword) };
			}
			return u;
		})
	);
	return found ? { ok: true } : { ok: false, reason: 'Pengguna tidak ditemukan.' };
}

/** Hapus pengguna. Tidak bisa hapus diri sendiri / akun admin utama. @returns {{ ok:boolean, reason?:string }} */
export function removeUser(username) {
	const key = normUsername(username);
	if (key === 'admin') return { ok: false, reason: 'Akun admin utama tidak bisa dihapus.' };
	const s = get(session);
	if (s && normUsername(s.username) === key)
		return { ok: false, reason: 'Tidak bisa menghapus akun yang sedang dipakai login.' };
	let removed = false;
	users.update((arr) => {
		const next = arr.filter((u) => normUsername(u.username) !== key);
		removed = next.length !== arr.length;
		return next;
	});
	return removed ? { ok: true } : { ok: false, reason: 'Pengguna tidak ditemukan.' };
}

/**
 * Pendaftaran akun mandiri dari halaman login.
 * Status otomatis 'menunggu' agar ditinjau/diawasi oleh pemilik/pembuat aplikasi.
 * @param {{ username:string, name:string, role?:string, email?:string, phone?:string, password:string }} data
 * @returns {{ ok:boolean, reason?:string }}
 */
export function registerAccount(data) {
	const username = normUsername(data.username);
	const name = String(data.name ?? '').trim();
	const role = data.role === 'pemilik' ? 'pemilik' : 'kasir';
	const email = normEmail(data.email);
	const phone = normPhone(data.phone);
	const password = String(data.password ?? '');

	if (!username) return { ok: false, reason: 'Username wajib diisi.' };
	if (!/^[a-z0-9._-]{3,20}$/.test(username))
		return { ok: false, reason: 'Username 3–20 karakter (huruf/angka/titik/_/-).' };
	if (!name) return { ok: false, reason: 'Nama lengkap wajib diisi.' };
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return { ok: false, reason: 'Format email tidak valid.' };
	if (phone && (phone.length < 9 || phone.length > 15))
		return { ok: false, reason: 'No. HP tidak valid (9–15 digit).' };
	if (password.length < 6) return { ok: false, reason: 'Password minimal 6 karakter.' };

	const list = get(users);
	if (list.some((u) => normUsername(u.username) === username))
		return { ok: false, reason: `Username "${username}" sudah dipakai.` };
	if (email && list.some((u) => u.email && normEmail(u.email) === email))
		return { ok: false, reason: `Email "${email}" sudah terdaftar.` };
	if (phone && list.some((u) => u.phone && normPhone(u.phone) === phone))
		return { ok: false, reason: `No. HP "${phone}" sudah terdaftar.` };

	users.update((arr) => [
		...arr,
		{
			username,
			name,
			role,
			email,
			phone,
			passwordHash: hashPassword(password),
			status: 'menunggu',
			createdAt: new Date().toISOString()
		}
	]);
	return { ok: true };
}

/** Setujui / terima akun baru yang mendaftar */
export function approveUser(username) {
	const key = normUsername(username);
	let found = false;
	users.update((arr) =>
		arr.map((u) => {
			if (normUsername(u.username) === key) {
				found = true;
				return { ...u, status: 'aktif' };
			}
			return u;
		})
	);
	return found ? { ok: true } : { ok: false, reason: 'Pengguna tidak ditemukan.' };
}

/** Tolak akun baru yang mendaftar */
export function rejectUser(username) {
	const key = normUsername(username);
	let found = false;
	users.update((arr) =>
		arr.map((u) => {
			if (normUsername(u.username) === key) {
				found = true;
				return { ...u, status: 'ditolak' };
			}
			return u;
		})
	);
	return found ? { ok: true } : { ok: false, reason: 'Pengguna tidak ditemukan.' };
}
