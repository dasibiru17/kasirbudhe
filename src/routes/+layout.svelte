<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import '../app.css';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import { session, logout } from '$lib/stores/auth.js';

	let { children } = $props();

	// Toggle tema Light/Dark — disimpan agar tetap saat reload
	let dark = $state(false);
	$effect(() => {
		document.documentElement.classList.toggle('dark', dark);
		localStorage.setItem('pos-kasir:theme', dark ? 'dark' : 'light');
	});
	// Muat preferensi tersimpan saat app start
	if (typeof localStorage !== 'undefined' && localStorage.getItem('pos-kasir:theme') === 'dark') {
		dark = true;
	}

	const PUBLIC_PATHS = ['/login'];
	const KASIR_BLOCKED = ['/laporan', '/pengguna'];

	// Penjaga akses: belum login → lempar ke /login;
	// sudah login tapi buka /login → kembali ke aplikasi;
	// role kasir → tidak boleh buka /laporan.
	$effect(() => {
		const path = page.url.pathname;
		const user = $session;
		if (!user && !PUBLIC_PATHS.includes(path)) {
			goto(`/login?redirect=${encodeURIComponent(path)}`);
		} else if (user && path === '/login') {
			goto(page.url.searchParams.get('redirect') || '/');
		} else if (user?.role === 'kasir' && KASIR_BLOCKED.includes(path)) {
			goto('/kasir');
		}
	});

	function keluar() {
		logout();
		goto('/login');
	}
</script>

{#if page.url.pathname === '/login'}
	{@render children()}
{:else if $session}
	<div class="min-h-screen bg-[var(--color-surface-1)] font-sans">
		<Sidebar {dark} ontoggletheme={() => (dark = !dark)} user={$session} onlogout={keluar} />

		<!-- Bar atas untuk mobile -->
		<header
			class="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface-0)] px-4 py-3 lg:hidden"
		>
			<div
				class="bg-brand-600 grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white"
			>
				K
			</div>
			<span class="font-bold text-[var(--color-ink-900)]">TOKO BUDhE</span>
			<button
				class="ml-auto rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-ink-700)]"
				onclick={keluar}
				aria-label="Keluar"
			>
				⏻ Keluar
			</button>
		</header>

		<main class="p-4 sm:p-6 lg:pl-72">
			{@render children()}
		</main>
	</div>
{/if}
