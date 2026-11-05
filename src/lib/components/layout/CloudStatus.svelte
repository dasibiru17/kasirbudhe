<script>
	/**
	 * CloudStatus — indikator koneksi database Supabase.
	 *
	 * Menampilkan 3 keadaan:
	 *  - "Mode Lokal"  : kredensial Supabase belum diisi (VITE_LOCAL_MODE=true / kosong)
	 *  - "Terputus"    : kredensial ada tapi koneksi/tabel bermasalah
	 *  - "Cloud Aktif" : tersambung dan data tersinkron
	 *
	 * Dipakai di Sidebar agar pemilik toko selalu tahu datanya tersimpan di mana.
	 */
	import { cloudConnected, cloudError } from '$lib/stores/auth.js';
	import { supabase } from '$lib/db-config.js';

	const configured = $derived(Boolean(supabase));
	const tersambung = $derived(configured && $cloudConnected);

	// Cek koneksi saat komponen dipasang (untuk kasus belum ada sync berjalan)
	$effect(() => {
		if (!configured || $cloudConnected) return;
		let cancelled = false;
		supabase
			.from('users')
			.select('id')
			.limit(1)
			.then(({ error }) => {
				if (cancelled) return;
				if (!error) {
					cloudConnected.set(true);
					cloudError.set('');
				}
			});
		return () => {
			cancelled = true;
		};
	});

	// Sambungkan listener auth → refresh status saat login/logout
	$effect(() => {
		if (!configured) return;
		const { data } = supabase.auth.onAuthStateChange(() => {
			// paksa cek ulang
			cloudConnected.set(false);
		});
		return () => data?.subscription?.unsubscribe();
	});
</script>

{#if configured}
	<!-- Kredensial Supabase terisi: tampilkan status koneksi -->
	<button
		type="button"
		class="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors
			{tersambung
			? 'border-success-200 dark:border-success-800 dark:bg-success-900/20 bg-success-50'
			: 'border-warning-200 dark:border-warning-800 dark:bg-warning-900/20 bg-warning-50'}"
		title={$cloudError || (tersambung ? 'Terhubung ke Supabase' : 'Menyambungkan…')}
	>
		<span class="relative grid h-2.5 w-2.5 shrink-0 place-items-center">
			<span
				class="absolute h-2.5 w-2.5 rounded-full {tersambung ? 'bg-success-500' : 'bg-warning-500'}"
			></span>
			{#if tersambung}
				<span class="ping-dot bg-success-400 absolute h-2.5 w-2.5 rounded-full"></span>
			{/if}
		</span>
		<span class="min-w-0 flex-1">
			<span
				class="block text-[11px] font-bold {tersambung ? 'text-success-700' : 'text-warning-700'}"
			>
				{tersambung ? 'Cloud Aktif' : 'Menyambungkan…'}
			</span>
			<span
				class="block truncate text-[10px] {tersambung ? 'text-success-600' : 'text-warning-600'}"
			>
				{tersambung ? 'Supabase · data tersinkron' : $cloudError || 'Memeriksa koneksi…'}
			</span>
		</span>
		<span class="text-xs {tersambung ? 'text-success-500' : 'text-warning-500'}">☁️</span>
	</button>
{:else}
	<!-- Belum dikonfigurasi: mode lokal -->
	<div
		class="flex items-center gap-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2.5"
		title="Data tersimpan di browser ini saja. Isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY di .env untuk mengaktifkan sinkronisasi cloud."
	>
		<span class="grid h-2.5 w-2.5 shrink-0 place-items-center">
			<span class="h-2.5 w-2.5 rounded-full bg-[var(--color-ink-400)]"></span>
		</span>
		<span class="min-w-0 flex-1">
			<span class="block text-[11px] font-bold text-[var(--color-ink-700)]">Mode Lokal</span>
			<span class="block truncate text-[10px] text-[var(--color-ink-400)]">
				Data di browser ini saja
			</span>
		</span>
		<span class="text-xs text-[var(--color-ink-400)]">💾</span>
	</div>
{/if}

<style>
	/* Denyut halus pada titik status saat tersambung */
	.ping-dot {
		animation: ping-dot 2s cubic-bezier(0, 0, 0.2, 1) infinite;
	}
	@keyframes ping-dot {
		0% {
			transform: scale(1);
			opacity: 0.7;
		}
		75%,
		100% {
			transform: scale(2.2);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ping-dot {
			animation: none;
		}
	}
</style>
