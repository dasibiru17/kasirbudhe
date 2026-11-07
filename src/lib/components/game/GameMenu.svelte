<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatTanggalJam } from '$lib/utils/format.js';
	import { session } from '$lib/stores/auth.js';
	import { gameSummary, gameScores, SPIN_DAILY_LIMIT } from '$lib/stores/game.js';

	/**
	 * GameMenu — menu utama halaman Game Mini.
	 *
	 * Tampil sebagai "hub" sebelum pemain masuk ke sebuah permainan:
	 *  - Kartu ucapan + status penyimpanan (cloud / lokal)
	 *  - Dua tile besar: Cashier Speed Run & Spin & Win
	 *  - Ringkasan progres, pemenang terakhir roda, dan riwayat latihan terbaru
	 *
	 * Komponen ini hanya menyusun data yang sudah ada di store game — semua
	 * permainan tetap berjalan di komponen masing-masing (CashierSpeedRun /
	 * SpinWheel) yang dipasang oleh halaman induk.
	 *
	 * @type {{
	 *   mode?: 'cloud'|'lokal',
	 *   syncing?: boolean,
	 *   cloudError?: string,
	 *   onopen?: (game: 'kasir'|'konsumen') => void
	 * }}
	 */
	let {
		mode = 'lokal',
		syncing = false,
		cloudError = '',
		onopen = (/** @type {'kasir'|'konsumen'} */ _g) => {}
	} = $props();

	/** @type {Array<{ id:'kasir'|'konsumen', judul:string, subjudul:string, tagline:string, icon:string, fitur:string[], aksi:string }>} */
	const GAMES = [
		{
			id: 'kasir',
			judul: 'Cashier Speed Run',
			subjudul: 'Mode Internal · Latihan Kasir',
			tagline:
				'Hitung kembalian secepat kilat sebelum timer habis. Latih kasir baru tanpa risiko salah uang.',
			icon: '🧾',
			fitur: ['12 soal per sesi', '3 nyawa', 'Combo & bonus waktu'],
			aksi: 'Mulai Latihan'
		},
		{
			id: 'konsumen',
			judul: 'Spin & Win',
			subjudul: 'Mode Konsumen · Loyalitas',
			tagline:
				'Putar roda hadiah: diskon belanja, potongan langsung, dan poin reward yang bisa ditukar di kasir.',
			icon: '🎡',
			fitur: ['Diskon s.d. 20%', 'Kode unik SPN-XXXXXX', 'Berlaku 7 hari'],
			aksi: 'Putar Roda'
		}
	];

	const summary = gameSummary;

	const greeting = $derived(
		String($session?.name ?? 'Kawan')
			.trim()
			.split(' ')[0] || 'Kawan'
	);

	// Riwayat latihan terakhir (3 skor terbaru) — tandai milik user aktif.
	const recentScores = $derived(
		$gameScores
			.slice(0, 3)
			.map((s) => ({ ...s, isMe: s.username === String($session?.username ?? 'tamu') }))
	);

	/**
	 * Status ringkas tiap game untuk ditampilkan di tile.
	 * @param {'kasir'|'konsumen'} id
	 * @returns {{ text: string, tone: 'ink'|'brand'|'success'|'warning' }}
	 */
	function statusFor(id) {
		const s = $summary;
		if (id === 'kasir') {
			if (s.plays === 0) return { text: 'Belum pernah main', tone: 'ink' };
			return { text: `Terbaik ${s.best} poin · ${s.plays}× sesi`, tone: 'success' };
		}
		const sisa = Math.max(0, SPIN_DAILY_LIMIT - s.spinsToday);
		if (sisa > 0) return { text: `${sisa} spin tersisa hari ini`, tone: 'brand' };
		return { text: `Kuota habis · ${s.voucherAktif} voucher aktif`, tone: 'warning' };
	}

	/**
	 * @param {'ink'|'brand'|'success'|'warning'} tone
	 */
	function pillClass(tone) {
		if (tone === 'success') return 'bg-success-50 text-success-700 dark:bg-success-700/20';
		if (tone === 'brand')
			return 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200';
		if (tone === 'warning') return 'bg-warning-50 text-warning-700 dark:bg-warning-900/30';
		return 'bg-[var(--color-surface-2)] text-[var(--color-ink-500)]';
	}
</script>

<div class="space-y-4">
	<!-- ================= SAPAAN + STATUS ================= -->
	<div
		class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] px-4 py-3"
		in:fly={{ y: 12, duration: 380, easing: quintOut }}
	>
		<div class="min-w-0">
			<p class="text-sm font-black text-[var(--color-ink-900)]">Hai, {greeting} 👋</p>
			<p class="text-[11px] text-[var(--color-ink-400)]">
				Pilih permainan di bawah untuk mulai. Progres tersimpan otomatis.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if $summary.lastPlayedAt}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-ink-500)]"
				>
					🕒 Latihan terakhir {formatTanggalJam($summary.lastPlayedAt)}
				</span>
			{/if}
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black
					{mode === 'cloud' && !cloudError
					? 'bg-success-50 text-success-700 dark:bg-success-700/20'
					: 'dark:bg-warning-900/30 bg-warning-50 text-warning-700'}"
			>
				{mode === 'cloud' && !cloudError ? '☁️ Cloud aktif' : '💾 Mode lokal'}
			</span>
			{#if syncing}
				<span class="text-[10px] font-semibold text-[var(--color-ink-400)]">sinkronisasi…</span>
			{/if}
		</div>
	</div>

	<!-- ================= TILE GAME ================= -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		{#each GAMES as game, i (game.id)}
			{@const st = statusFor(game.id)}
			<button
				type="button"
				onclick={() => onopen(game.id)}
				class="group relative overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-900/10
					{game.id === 'konsumen' ? 'hover:border-warning-400 hover:shadow-warning-900/10' : ''}"
				in:fly={{ y: 18, duration: 420, delay: i * 90, easing: quintOut }}
			>
				<!-- Aksen latar -->
				<div
					class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
					aria-hidden="true"
				>
					<div
						class="absolute -top-16 -right-12 h-48 w-48 rounded-full blur-3xl
							{game.id === 'konsumen' ? 'bg-warning-300/30' : 'bg-brand-300/30'}"
					></div>
				</div>

				<div class="relative">
					<div class="flex items-start gap-3">
						<!-- Ikon besar -->
						<div
							class="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6
								{game.id === 'konsumen'
								? 'to-warning-200 dark:from-warning-900/50 bg-linear-to-br from-warning-100 dark:to-warning-700/30'
								: 'bg-linear-to-br from-brand-100 to-brand-200 dark:from-brand-900/50 dark:to-brand-700/30'}"
						>
							{game.icon}
						</div>

						<div class="min-w-0 flex-1">
							<p
								class="text-[10px] font-black tracking-[0.14em] uppercase
									{game.id === 'konsumen' ? 'text-warning-600' : 'text-brand-600'}"
							>
								{game.subjudul}
							</p>
							<h3 class="mt-0.5 text-lg leading-tight font-black text-[var(--color-ink-900)]">
								{game.judul}
							</h3>
							<span
								class="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold {pillClass(
									st.tone
								)}"
							>
								{st.text}
							</span>
						</div>
					</div>

					<p class="mt-3 text-[12px] leading-relaxed text-[var(--color-ink-700)]">
						{game.tagline}
					</p>

					<ul class="mt-3 flex flex-wrap gap-1.5">
						{#each game.fitur as f (f)}
							<li
								class="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--color-ink-500)]"
							>
								{f}
							</li>
						{/each}
					</ul>

					<div
						class="mt-4 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-black text-white shadow-md transition-all duration-300
							{game.id === 'konsumen'
							? 'bg-linear-to-r from-warning-500 to-orange-500 shadow-warning-500/25'
							: 'bg-linear-to-r from-brand-600 to-brand-800 shadow-brand-600/25'}"
					>
						<span>▶ {game.aksi}</span>
						<span class="text-base transition-transform duration-300 group-hover:translate-x-1"
							>→</span
						>
					</div>
				</div>
			</button>
		{/each}
	</div>

	<!-- ================= RINGKASAN PROGRES ================= -->
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
		{#each [{ l: 'Skor Terbaik', v: String($summary.best), i: '🏆' }, { l: 'Sesi Latihan', v: String($summary.plays), i: '🧾' }, { l: 'Akurasi Rata²', v: `${$summary.accuracy}%`, i: '🎯' }, { l: 'Voucher Aktif', v: String($summary.voucherAktif), i: '🎟️' }] as s, i (s.l)}
			<div
				class="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-2.5"
				in:fly={{ y: 14, duration: 380, delay: 120 + i * 60, easing: quintOut }}
			>
				<p class="text-[9px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase">
					{s.i}
					{s.l}
				</p>
				<p class="text-stat-sm">{s.v}</p>
			</div>
		{/each}
	</div>

	<!-- ================= AKTIVITAS TERBARU ================= -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<!-- Latihan terakhir -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
			in:fly={{ y: 16, duration: 400, delay: 120, easing: quintOut }}
		>
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-bold text-[var(--color-ink-900)]">🧾 Latihan Terakhir</h3>
				<button
					type="button"
					onclick={() => onopen('kasir')}
					class="text-[11px] font-bold text-brand-600 hover:underline"
				>
					Buka game →
				</button>
			</div>

			{#if recentScores.length === 0}
				<p
					class="mt-3 rounded-lg bg-[var(--color-surface-2)] p-3 text-center text-[11px] text-[var(--color-ink-400)]"
				>
					Belum ada riwayat. Mainkan Cashier Speed Run untuk mengisi papan skor.
				</p>
			{:else}
				<ul class="mt-2 divide-y divide-[var(--color-line)]">
					{#each recentScores as s (s.id)}
						<li class="flex items-center gap-2 py-2">
							<span class="text-base">{s.level === 'Kasir Legendaris' ? '👑' : '⭐'}</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-[11px] font-bold text-[var(--color-ink-900)]">
									{s.isMe ? 'Kamu' : s.name || s.username}
									<span class="ml-1 font-medium text-[var(--color-ink-400)]">· {s.level}</span>
								</p>
								<p class="text-[10px] text-[var(--color-ink-400)]">
									{formatTanggalJam(s.createdAt)} · akurasi {s.accuracy}%
								</p>
							</div>
							<span class="text-xs font-black text-brand-600 tabular-nums">{s.score}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Aktivitas roda -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
			in:fly={{ y: 16, duration: 400, delay: 180, easing: quintOut }}
		>
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-bold text-[var(--color-ink-900)]">🎡 Aktivitas Roda</h3>
				<button
					type="button"
					onclick={() => onopen('konsumen')}
					class="text-[11px] font-bold text-warning-600 hover:underline"
				>
					Putar roda →
				</button>
			</div>

			<div class="mt-3 grid grid-cols-3 gap-2">
				{#each [{ l: 'Spin Kamu', v: `${$summary.spinsToday}/${SPIN_DAILY_LIMIT}` }, { l: 'Hadiah Hari Ini', v: String($summary.totalVoucherHariIni) }, { l: 'Voucher Saya', v: String($summary.vouchers) }] as k (k.l)}
					<div class="rounded-xl bg-[var(--color-surface-2)] px-2.5 py-2 text-center">
						<p class="text-[9px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase">
							{k.l}
						</p>
						<p class="text-base font-black text-[var(--color-ink-900)] tabular-nums">{k.v}</p>
					</div>
				{/each}
			</div>

			<p
				class="dark:bg-warning-900/25 mt-3 rounded-lg bg-warning-50 p-2.5 text-[10px] leading-relaxed text-warning-700 dark:text-warning-100"
			>
				💡 Kode promo hasil putaran langsung bisa ditukar di halaman Kasir — sebutkan kode
				<b>SPN-XXXXXX</b> saat membayar.
			</p>
		</div>
	</div>
</div>
