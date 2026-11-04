<script>
	import { page } from '$app/state';
	import { users } from '$lib/stores/auth.js';

	/** @type {{ dark?: boolean, ontoggletheme?: () => void, user?: { name?: string, role?: string } | null, onlogout?: () => void, mobileOpen?: boolean, onclose?: () => void }} */
	let { dark = false, ontoggletheme = () => {}, user = null, onlogout = () => {}, mobileOpen = false, onclose = () => {} } = $props();
	/** @type {HTMLDialogElement} */
	let mobileDialog;

	const pendingCount = $derived($users.filter((u) => u.status === 'menunggu').length);

	$effect(() => {
	if (mobileOpen && mobileDialog && !mobileDialog.open) mobileDialog.showModal();
	if (!mobileOpen && mobileDialog?.open) mobileDialog.close();
	});

	$effect(() => {
	if (!mobileOpen) return;
	const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
	const desktop = window.matchMedia('(min-width: 1024px)');
	const closeOnDesktop = () => { if (desktop.matches) onclose(); };
		desktop.addEventListener('change', closeOnDesktop);
	closeOnDesktop();
	return () => {
		document.body.style.overflow = previous;
		desktop.removeEventListener('change', closeOnDesktop);
	};
	});

	const links = [
		{ href: '/', label: 'Dashboard', icon: '📊' },
		{ href: '/kasir', label: 'Kasir (POS)', icon: '🛒' },
		{ href: '/produk', label: 'Produk & Stok', icon: '📦' },
		{ href: '/laporan', label: 'Laporan / Buku Kas', icon: '📒', owner: true },
		{ href: '/pengguna', label: 'Kelola Pengguna', icon: '👥', owner: true },
		{ href: '/styleguide', label: 'Style Guide', icon: '🎨' }
	];

	const visibleLinks = $derived(
		(user?.role === 'kasir' ? links.filter((l) => !l.owner) : links)
	);
</script>

{#snippet menuContent()}
	<!-- Logo / Brand -->
	<div class="mb-8 flex items-center gap-3 px-2">
		<div
			class="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm"
		>
			K
		</div>
		<div>
			<p class="text-sm font-bold text-[var(--color-ink-900)]">Toko Sejahtera</p>
			<p class="text-xs text-[var(--color-ink-400)]">Mini POS & Bookkeeping</p>
		</div>
	</div>

	<!-- Navigasi -->
	<nav class="flex flex-1 flex-col gap-1">
		{#each visibleLinks as link (link.href)}
			<a
				href={link.href}
				onclick={onclose}
				class="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
					{page.url.pathname === link.href
					? 'bg-brand-50 font-semibold text-brand-700'
					: 'text-[var(--color-ink-700)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink-900)]'}"
			>
				<span class="flex items-center gap-3">
					<span class="text-base">{link.icon}</span>
					{link.label}
				</span>
				{#if link.href === '/pengguna' && pendingCount > 0}
					<span class="grid h-5 min-w-5 place-items-center rounded-full bg-warning-500 px-1.5 text-[10px] font-extrabold text-white">
						{pendingCount}
					</span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Profil user yang sedang login -->
	{#if user}
		<div class="mb-2 flex items-center gap-2.5 rounded-xl border border-[var(--color-line)] px-3 py-2.5">
			<div
				class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white text-sm font-bold {user.role === 'kasir'
					? 'bg-warning-500'
					: 'bg-brand-600'}"
			>
				{(user.name || '?').trim().charAt(0).toUpperCase()}
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-xs font-bold break-words text-[var(--color-ink-900)]">{user.name}</p>
				<p class="text-[11px] text-[var(--color-ink-400)] capitalize">👤 {user.role || 'pengguna'}</p>
			</div>
			<button
				class="shrink-0 rounded-lg px-2 py-1.5 text-sm text-[var(--color-ink-400)] transition-colors hover:bg-danger-50 hover:text-danger-600"
				onclick={onlogout}
				title="Keluar dari aplikasi"
				aria-label="Keluar dari aplikasi"
			>
				⏻
			</button>
		</div>
	{/if}

	<!-- Toggle tema Light/Dark -->
	<button
		class="mb-2 flex items-center justify-center gap-2 rounded-lg border border-[var(--color-line)] px-3 py-2 text-xs font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-2)]"
		onclick={ontoggletheme}
	>
		{dark ? '☀️ Mode Terang' : '🌙 Mode Gelap'}
	</button>

	<p class="px-3 text-xs text-[var(--color-ink-400)]">v1.1 — design by Dasi.biru17</p>
{/snippet}

<aside class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-surface-0)] px-4 py-6 lg:flex">
	{@render menuContent()}
</aside>

<dialog
	bind:this={mobileDialog}
	id="mobile-menu"
	aria-label="Menu utama Toko Sejahtera"
	onclose={onclose}
	onclick={(event) => { if (event.target === mobileDialog) onclose(); }}
	class="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-[var(--color-ink-900)] backdrop:bg-black/50 lg:hidden"
>
	<div class="flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto bg-[var(--color-surface-0)] px-4 py-5 shadow-xl">
	<button
		type="button"
	class="mb-4 min-h-11 self-end rounded-lg border-[var(--color-line)] px-3 text-sm font-semibold hover:bg-[var(--color-surface-2)]"
		onclick={onclose}
	aria-label="Tutup menu"
	>✕ Tutup</button>
	{@render menuContent()}
	</div>
</dialog>
