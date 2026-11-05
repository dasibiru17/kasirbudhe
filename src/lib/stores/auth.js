import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/db-config.js';

/**
 * ============================================================
 *  AUTH & PENGAWASAN PENGGUNA â€” Sinkronisasi Cloud (Supabase) + Lokal
 * ============================================================
 *  - Terhubung langsung ke Supabase Cloud agar akun di HP & Laptop
 *    terintegrasi menjadi satu dan real-time.
 *  - Tetap menyimpan cache ke localStorage sebagai cadangan offline.
 */

const PREFIX = 'pos-kasir';

/** Status koneksi ke tabel cloud Supabase */
export const cloudConnected = writable(false);
export const cloudError = writable('');

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
 * Hash sinkron sederhana (cyrb53).
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

/** Akun bawaan â€” dibuat otomatis saat pertama dibuka. */
/** @type {Array<{ id?:string, username:string, name:string, role:'pemilik'|'kasir', email:string, phone:string, passwordHash:string, status?:'aktif'|'menunggu'|'ditolak', createdAt?:string }>} */
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
		email: 'kasir@tokosejahtera.id',
		phone: '081298765432',
		passwordHash: hashPassword('kasir123'),
		status: 'aktif'
	}
];

/**
 * @type {import('svelte/store').Writable<Array<{ id?:string, username:string, name:string, role:'pemilik'|'kasir', email:string, phone:string, passwordHash:string, status?:'aktif'|'menunggu'|'ditolak', createdAt?:string }>>}
 */
export const users = persisted('users', DEFAULT_USERS);

function mapRowToUser(row) {
	return {
		id: String(row.id ?? ''),
		username: String(row.username ?? ''),
		name: String(row.name ?? row.username ?? ''),
		role: /** @type {'pemilik'|'kasir'} */ (row.role === 'kasir' ? 'kasir' : 'pemilik'),
		email: normEmail(row.email),
		phone: normPhone(row.phone),
		passwordHash: String(row.password_hash ?? row.passwordHash ?? ''),
		status: /** @type {'aktif'|'menunggu'|'ditolak'} */ (
			row.status === 'menunggu' || row.status === 'ditolak' ? row.status : 'aktif'
		),
		createdAt: row.created_at || row.createdAt || new Date().toISOString()
	};
}

function mapUserToRow(u) {
	return {
		username: normUsername(u.username),
		name: u.name,
		role: u.role === 'kasir' ? 'kasir' : 'pemilik',
		email: normEmail(u.email),
		phone: normPhone(u.phone),
		password_hash: u.passwordHash,
		status: u.status || 'aktif',
		created_at: u.createdAt || new Date().toISOString()
	};
}

/**
 * Tarik data pengguna terbaru dari Supabase Cloud.
 * Dilindungi RLS: pemilik melihat semua akun, pengguna lain hanya profilnya sendiri.
 */
export async function syncUsersFromCloud() {
	if (!browser || !supabase) return;
	try {
		const { data, error } = await supabase
			.from('users')
			.select('*')
			.order('created_at', { ascending: true });

		if (error) {
			cloudConnected.set(false);
			cloudError.set(error.message || 'Tabel Supabase belum diinisialisasi');
			return;
		}

		cloudConnected.set(true);
		cloudError.set('');

		if (Array.isArray(data) && data.length > 0) {
			users.set(data.map(mapRowToUser));
		}
	} catch (err) {
		cloudConnected.set(false);
	}
}

// Migrasi lokal & inisialisasi sinkronisasi Cloud
//
// Mode cloud (Supabase): daftar pengguna HANYA berasal dari server. Akun demo/palsu di
// localStorage dibuang supaya tidak menghalangi pendaftaran (username/email/no. HP
// dianggap "sudah terdaftar" padahal tidak ada di database).
if (browser) {
	users.update((list) => {
		const arr = Array.isArray(list) ? [...list] : [];

		if (supabase) {
			return arr
				.filter((u) => u && u.id)
				.map((u) => ({
					username: String(u.username ?? ''),
					name: String(u.name ?? u.username ?? ''),
					role: u.role === 'kasir' ? 'kasir' : 'pemilik',
					email: normEmail(u.email),
					phone: normPhone(u.phone),
					passwordHash: '',
					status: u.status === 'menunggu' || u.status === 'ditolak' ? u.status : 'aktif',
					createdAt: u.createdAt || new Date().toISOString()
				}));
		}

		for (const d of DEFAULT_USERS) {
			const i = arr.findIndex((u) => normUsername(u?.username) === d.username);
			if (i === -1) {
				arr.push({ ...d });
			} else {
				arr[i] = {
					...d,
					...arr[i],
					email: arr[i].email || d.email,
					phone: arr[i].phone || d.phone,
					passwordHash: arr[i].passwordHash || d.passwordHash,
					username: arr[i].username || d.username,
					role: arr[i].role === 'kasir' ? 'kasir' : 'pemilik',
					status: arr[i].status || 'aktif'
				};
			}
		}
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

	// Jalankan sinkronisasi awal & berlangganan Realtime Supabase
	syncUsersFromCloud();

	if (supabase) {
		supabase
			.channel('public:users')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
				syncUsersFromCloud();
			})
			.subscribe();

		// Polling ringan setiap 8 detik agar di semua kondisi jaringan tetap real-time
		setInterval(syncUsersFromCloud, 8000);
	}
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

/**
 * Coba login pakai email (atau username bila akun lokal offline).
 * Saat terhubung ke Supabase, autentikasi memakai Supabase Auth sehingga
 * password diverifikasi di server (tidak memakai hash lokal).
 */
export async function login(identifier, password) {
	if (!String(identifier ?? '').trim() || !password) {
		return { ok: false, reason: 'Isi email / username dan password dulu ya.' };
	}

	const asMail = normEmail(identifier);
	const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asMail);

	// ---------------- Mode cloud (Supabase Auth) ----------------
	if (supabase && isEmail) {
		const { error } = await supabase.auth.signInWithPassword({ email: asMail, password });
		if (error) {
			const msg = String(error.message || '');
			if (/invalid login credentials/i.test(msg)) {
				return { ok: false, reason: 'Email atau password salah. Coba lagi.' };
			}
			if (/email not confirmed/i.test(msg)) {
				return {
					ok: false,
					reason:
						'Email belum dikonfirmasi. Buka Supabase → Authentication → Users, lalu klik "Confirm email" pada akun Anda.'
				};
			}
			if (/fetch|network|failed to fetch|timeout/i.test(msg)) {
				return {
					ok: false,
					reason: 'Tidak bisa menghubungi server database. Periksa koneksi internet lalu coba lagi.'
				};
			}
			return { ok: false, reason: msg || 'Gagal masuk. Coba lagi.' };
		}

		// Pendaftar pertama otomatis menjadi pemilik toko (slot diklaim sekali).
		// Kegagalan di sini tidak boleh menggagalkan login.
		try {
			await supabase.rpc('claim_owner');
		} catch {
			/* abaikan */
		}

		// Sinkronisasi daftar pengguna bersifat opsional — jangan sampai
		// kegagalan jaringan membuat login yang sudah berhasil ikut gagal.
		try {
			await syncUsersFromCloud();
		} catch {
			/* abaikan */
		}

		const profile = await fetchOwnProfile();
		if (!profile) {
			return {
				ok: false,
				reason:
					'Login berhasil, tetapi profil akun belum ada di tabel users. Jalankan skrip SQL perbaikan (scripts/fix-owner-wahyu17.sql) di Supabase SQL Editor.'
			};
		}
		if (profile.status === 'menunggu') {
			await supabase.auth.signOut();
			return {
				ok: false,
				reason:
					'Akun Anda sedang dalam peninjauan pembuat aplikasi / pemilik toko. Harap tunggu persetujuan.'
			};
		}
		if (profile.status === 'ditolak') {
			await supabase.auth.signOut();
			return { ok: false, reason: 'Pendaftaran akun Anda ditolak oleh pemilik toko.' };
		}

		session.set({
			username: profile.username,
			name: profile.name,
			role: profile.role,
			loginAt: new Date().toISOString()
		});
		await new Promise((r) => setTimeout(r, 30));
		return { ok: true };
	}

	// ---------------- Mode lokal / offline ----------------
	if (supabase && !isEmail) {
		return {
			ok: false,
			reason: 'Masuk ke database online memakai email. Isi alamat email Anda, bukan username.'
		};
	}

	await syncUsersFromCloud();

	const found = findUser(identifier);
	if (!found || found.passwordHash !== hashPassword(password)) {
		return { ok: false, reason: 'Akun atau password salah. Coba lagi.' };
	}
	if (found.status === 'menunggu') {
		return {
			ok: false,
			reason:
				'Akun Anda sedang dalam peninjauan pembuat aplikasi / pemilik toko. Harap tunggu persetujuan.'
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

	// Tunggu satu tick agar sesi sempat tersimpan di localStorage
	// sebelum halaman login melakukan redirect.
	await new Promise((r) => setTimeout(r, 30));
	return { ok: true };
}

/** Ambil profil akun yang sedang login dari server. */
export async function fetchOwnProfile() {
	if (!supabase) return null;
	const { data: auth } = await supabase.auth.getUser();
	const uid = auth?.user?.id;
	if (!uid) return null;

	// Coba beberapa kali: sesi yang baru dibuat kadang belum terbaca RLS
	// pada percobaan pertama (race condition token).
	for (let attempt = 0; attempt < 3; attempt++) {
		const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
		if (!error && data) return mapRowToUser(data);
		if (attempt < 2) await new Promise((r) => setTimeout(r, 250));
	}
	return null;
}

/** Keluar â€” hapus sesi lokal dan sesi Supabase. */
export async function logout() {
	session.set(null);
	if (supabase) {
		try {
			await supabase.auth.signOut();
		} catch {
			/* abaikan saat offline */
		}
	}
}

/**
 * Tambah pengguna baru (khusus pemilik â€” langsung aktif).
 * @param {{ username:string, name:string, role:string, email?:string, phone?:string, password:string }} data
 */
export async function addUser(data) {
	await syncUsersFromCloud();

	const username = normUsername(data.username);
	const name = String(data.name ?? '').trim();
	const role = data.role === 'kasir' ? 'kasir' : 'pemilik';
	const email = normEmail(data.email);
	const phone = normPhone(data.phone);
	const password = String(data.password ?? '');

	if (!username) return { ok: false, reason: 'Username wajib diisi.' };
	if (!/^[a-z0-9._-]{3,20}$/.test(username))
		return { ok: false, reason: 'Username 3â€“20 karakter (huruf/angka/titik/_/-).' };
	if (!name) return { ok: false, reason: 'Nama lengkap wajib diisi.' };
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return { ok: false, reason: 'Format email tidak valid.' };
	if (phone && (phone.length < 9 || phone.length > 15))
		return { ok: false, reason: 'No. HP tidak valid (9â€“15 digit).' };
	if (password.length < 6) return { ok: false, reason: 'Password minimal 6 karakter.' };

	const list = get(users);
	if (list.some((u) => normUsername(u.username) === username))
		return { ok: false, reason: `Username "${username}" sudah dipakai.` };
	if (email && list.some((u) => u.email && normEmail(u.email) === email))
		return { ok: false, reason: `Email "${email}" sudah terdaftar.` };
	if (phone && list.some((u) => u.phone && normPhone(u.phone) === phone))
		return { ok: false, reason: `No. HP "${phone}" sudah terdaftar.` };

	const newUser = {
		username,
		name,
		role: /** @type {'pemilik'|'kasir'} */ (role),
		email,
		phone,
		passwordHash: hashPassword(password),
		status: /** @type {'aktif'} */ ('aktif'),
		createdAt: new Date().toISOString()
	};

	users.update((arr) => [...arr, newUser]);

	if (supabase) {
		// Akun di Supabase Auth dibuat lewat signUp; profilnya diisi otomatis oleh trigger.
		// Akun karyawan yang dibuat pemilik langsung diaktifkan.
		const { data: signUp, error } = await supabase.auth.signUp({
			email: email || `${username}@toko-sejahtera.local`,
			password,
			options: { data: { username, name, phone, role } }
		});
		if (error) {
			users.update((arr) => arr.filter((u) => normUsername(u.username) !== username));
			cloudError.set(error.message);
			return { ok: false, reason: error.message };
		}
		const newId = signUp?.user?.id;
		if (newId) {
			await supabase
				.from('users')
				.update({ name, role, email: email || '', phone, status: 'aktif' })
				.eq('id', newId);
		}
		await syncUsersFromCloud();
	}
	return { ok: true };
}

/**
 * Ubah data pengguna (nama / role / email / phone). Username tidak bisa diubah.
 */
export async function updateUser(username, patch) {
	const key = normUsername(username);
	const name = String(patch.name ?? '').trim();
	const role = patch.role === 'kasir' ? 'kasir' : 'pemilik';
	const email = normEmail(patch.email);
	const phone = normPhone(patch.phone);

	if (!name) return { ok: false, reason: 'Nama lengkap wajib diisi.' };
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return { ok: false, reason: 'Format email tidak valid.' };
	if (phone && (phone.length < 9 || phone.length > 15))
		return { ok: false, reason: 'No. HP tidak valid (9â€“15 digit).' };

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

	if (supabase) {
		await supabase.from('users').update({ name, role, email, phone }).eq('username', key);
		await syncUsersFromCloud();
	}

	const s = get(session);
	if (s && normUsername(s.username) === key) {
		session.set({ ...s, name, role });
	}
	return { ok: true };
}

/** Reset password pengguna. */
export async function resetPassword(username, newPassword) {
	if (String(newPassword ?? '').length < 6)
		return { ok: false, reason: 'Password baru minimal 6 karakter.' };
	const key = normUsername(username);

	// Mode cloud: password dikelola Supabase Auth, tidak bisa diubah oleh akun lain
	// dari sisi klien. Pemilik me-reset lewat Dashboard (Authentication -> Users).
	if (supabase) {
		const me = get(session);
		if (!me || normUsername(me.username) !== key) {
			return {
				ok: false,
				reason:
					'Reset password akun lain dilakukan lewat Dashboard Supabase (Authentication â†’ Users).'
			};
		}
		const { error } = await supabase.auth.updateUser({ password: String(newPassword) });
		return error ? { ok: false, reason: error.message } : { ok: true };
	}

	const passwordHash = hashPassword(newPassword);
	let found = false;
	users.update((arr) =>
		arr.map((u) => {
			if (normUsername(u.username) === key) {
				found = true;
				return { ...u, passwordHash };
			}
			return u;
		})
	);
	return found ? { ok: true } : { ok: false, reason: 'Pengguna tidak ditemukan.' };
}

/** Hapus pengguna. Tidak bisa hapus diri sendiri / akun admin utama. */
export async function removeUser(username) {
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
	if (supabase && removed) {
		// Hapus profil; penghapusan akun auth.users dilakukan oleh pemilik lewat Dashboard
		// (butuh service_role key yang tidak boleh ada di frontend).
		await supabase.from('users').delete().eq('username', key);
		await syncUsersFromCloud();
	}
	return removed ? { ok: true } : { ok: false, reason: 'Pengguna tidak ditemukan.' };
}

/**
 * Pendaftaran akun mandiri dari halaman login.
 * Status otomatis 'menunggu' agar ditinjau/diawasi oleh pemilik/pembuat aplikasi.
 * @param {{ username:string, name:string, role?:string, email?:string, phone?:string, password:string }} data
 */
export async function registerAccount(data) {
	await syncUsersFromCloud();

	const username = normUsername(data.username);
	const name = String(data.name ?? '').trim();
	const role = data.role === 'pemilik' ? 'pemilik' : 'kasir';
	const email = normEmail(data.email);
	const phone = normPhone(data.phone);
	const password = String(data.password ?? '');

	if (!username) return { ok: false, reason: 'Username wajib diisi.' };
	if (!/^[a-z0-9._-]{3,20}$/.test(username))
		return { ok: false, reason: 'Username 3â€“20 karakter (huruf/angka/titik/_/-).' };
	if (!name) return { ok: false, reason: 'Nama lengkap wajib diisi.' };
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return { ok: false, reason: 'Format email tidak valid.' };
	if (phone && (phone.length < 9 || phone.length > 15))
		return { ok: false, reason: 'No. HP tidak valid (9â€“15 digit).' };
	if (password.length < 6) return { ok: false, reason: 'Password minimal 6 karakter.' };

	const list = get(users);
	if (list.some((u) => normUsername(u.username) === username))
		return { ok: false, reason: `Username "${username}" sudah dipakai.` };
	if (email && list.some((u) => u.email && normEmail(u.email) === email))
		return { ok: false, reason: `Email "${email}" sudah terdaftar.` };
	if (phone && list.some((u) => u.phone && normPhone(u.phone) === phone))
		return { ok: false, reason: `No. HP "${phone}" sudah terdaftar.` };

	const newUser = {
		username,
		name,
		role: /** @type {'pemilik'|'kasir'} */ (role),
		email,
		phone,
		passwordHash: hashPassword(password),
		status: /** @type {'menunggu'} */ ('menunggu'),
		createdAt: new Date().toISOString()
	};

	if (supabase) {
		if (!email) {
			return {
				ok: false,
				reason: 'Email wajib diisi agar akun cloud bisa dibuat dan diverifikasi pemilik toko.'
			};
		}
		// Daftar via Supabase Auth. Profil dibuat otomatis oleh trigger:
		// pendaftar pertama = pemilik aktif, berikutnya = kasir dengan status 'menunggu'.
		const { data: signUp, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { username, name, phone } }
		});
		if (error) {
			cloudError.set(error.message);
			return { ok: false, reason: error.message };
		}
		const newId = signUp?.user?.id;
		if (newId) {
			const ownerRes = await supabase.rpc('claim_owner');
			const isOwner = ownerRes?.data === true;
			users.update((arr) => [...arr, { ...newUser, role: isOwner ? 'pemilik' : role }]);
			// Segarkan sesi agar data profil terbaru terbaca
			await supabase.auth.refreshSession();
			await syncUsersFromCloud();
		}
		return { ok: true };
	}

	users.update((arr) => [...arr, newUser]);
	return { ok: true };
}

/** Setujui / terima akun baru yang mendaftar */
export async function approveUser(username) {
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
	if (supabase && found) {
		await supabase.from('users').update({ status: 'aktif' }).eq('username', key);
		await syncUsersFromCloud();
	}
	return found ? { ok: true } : { ok: false, reason: 'Pengguna tidak ditemukan.' };
}

/** Tolak akun baru yang mendaftar */
export async function rejectUser(username) {
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
	if (supabase && found) {
		await supabase.from('users').update({ status: 'ditolak' }).eq('username', key);
		await syncUsersFromCloud();
	}
	return found ? { ok: true } : { ok: false, reason: 'Pengguna tidak ditemukan.' };
}
