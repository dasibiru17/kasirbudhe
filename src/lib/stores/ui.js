import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * ============================================================
 *  STATE UI GLOBAL
 * ============================================================
 *  `panduanTab` — tab aktif pada halaman gabungan Dashboard + Panduan.
 *  Halaman Panduan adalah bagian dari dashboard (tab), jadi setelah login
 *  pengguna langsung mendarat di tab "Beranda" lalu bisa berpindah tab
 *  tanpa pindah halaman.
 */
const PREFIX = 'pos-kasir';
const KEY = `${PREFIX}:panduan-tab`;

/** @type {import('svelte/store').Writable<'beranda'|'panduan'>} */
export const panduanTab = writable(
	browser && localStorage.getItem(KEY) === 'panduan' ? 'panduan' : 'beranda'
);

if (browser) {
	panduanTab.subscribe((tab) => {
		try {
			localStorage.setItem(KEY, tab);
		} catch {
			/* abaikan */
		}
	});
}

/**
 * Pindah ke halaman gabungan dengan tab tertentu.
 * @param {'beranda'|'panduan'} [tab]
 */
export function bukaPanduan(tab) {
	panduanTab.set(tab);
}
