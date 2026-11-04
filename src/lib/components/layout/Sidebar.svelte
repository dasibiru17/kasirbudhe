<script>
	import { page } from '$app/state';

	/** @type {{ dark?: boolean, ontoggletheme?: () => void, user?: { name?: string, role?: string } | null, onlogout?: () => void }} */
	let { dark = false, ontoggletheme = () => {}, user = null, onlogout = () => {} } = $props();

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

<aside
	class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface-0)] px-4 py-6 lg:flex"
>
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
				class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
					{page.url.pathname === link.href
					? 'bg-brand-50 font-semibold text-brand-700'
					: 'text-[var(--color-ink-700)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink-900)]'}"
			>
				<span class="text-base">{link.icon}</span>
				{link.label}
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
				<p class="truncate text-xs font-bold text-[var(--color-ink-900)]">{user.name}</p>
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
</aside>
