<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import '../app.css';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import { session, logout } from '$lib/stores/auth.js';

	let { children } = $props();
	let mobileMenuOpen = $state(false);

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
		void logout();
		goto('/login');
	}
</script>

{#if page.url.pathname === '/login'}
	{@render children()}
{:else if $session}
	<div class="min-h-screen bg-[var(--color-surface-1)] font-sans">
		<Sidebar
			{dark}
			ontoggletheme={() => (dark = !dark)}
			user={$session}
			onlogout={keluar}
			mobileOpen={mobileMenuOpen}
			onclose={() => (mobileMenuOpen = false)}
		/>

		<!-- Bar atas untuk mobile -->
		<header
			class="sticky top-0 z-30 flex items-center gap-2.5 border-b border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-2.5 sm:px-4 lg:hidden"
		>
			<button
				type="button"
				class="hover:bg-brand-50 hover:text-brand-700 flex h-10 items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 text-xs font-bold text-[var(--color-ink-900)] shadow-xs transition-colors active:scale-95"
				onclick={() => (mobileMenuOpen = true)}
				aria-label="Buka Menu Navigasi"
			>
				<span class="text-base leading-none">☰</span>
				<span>Menu</span>
			</button>
			<div
				class="bg-brand-600 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white shadow-xs"
			>
				K
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-xs font-bold text-[var(--color-ink-900)] sm:text-sm">
					Toko Sejahtera
				</p>
				<p class="truncate text-[10px] text-[var(--color-ink-400)] sm:text-xs">
					Mini POS & Bookkeeping
				</p>
			</div>
			<button
				type="button"
				class="hover:bg-danger-50 hover:text-danger-600 shrink-0 rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] transition-colors"
				onclick={keluar}
				aria-label="Keluar"
			>
				⏻ Keluar
			</button>
		</header>

		<!-- Bottom bar navigasi cepat untuk HP -->
		<nav
			class="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[var(--color-line)] bg-[var(--color-surface-0)]/95 py-1.5 backdrop-blur-md lg:hidden"
			aria-label="Navigasi Bawah Mobile"
		>
			<a
				href="/"
				class="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-semibold transition-colors
					{page.url.pathname === '/'
					? 'text-brand-600 font-bold'
					: 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]'}"
			>
				<span class="text-base leading-none">📊</span>
				<span>Dashboard</span>
			</a>
			<a
				href="/kasir"
				class="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-semibold transition-colors
					{page.url.pathname === '/kasir'
					? 'text-brand-600 font-bold'
					: 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]'}"
			>
				<span class="text-base leading-none">🛒</span>
				<span>Kasir</span>
			</a>
			<a
				href="/produk"
				class="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-semibold transition-colors
					{page.url.pathname === '/produk'
					? 'text-brand-600 font-bold'
					: 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]'}"
			>
				<span class="text-base leading-none">📦</span>
				<span>Produk</span>
			</a>
			<button
				type="button"
				class="hover:text-brand-600 flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-semibold text-[var(--color-ink-500)] transition-colors"
				onclick={() => (mobileMenuOpen = true)}
			>
				<span class="text-base leading-none">☰</span>
				<span>Lainnya</span>
			</button>
		</nav>

		<main class="p-3 pb-20 sm:p-6 lg:p-6 lg:pb-6 lg:pl-72">
			{@render children()}
		</main>
	</div>
{/if}
