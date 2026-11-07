<script>
	import { fly, scale, fade } from 'svelte/transition';
	import { quintOut, backOut } from 'svelte/easing';
	import { formatTanggalJam } from '$lib/utils/format.js';
	import { session } from '$lib/stores/auth.js';
	import CashierSpeedRun from '$lib/components/game/CashierSpeedRun.svelte';
	import SpinWheel from '$lib/components/game/SpinWheel.svelte';
	import GameMenu from '$lib/components/game/GameMenu.svelte';
	import {
		leaderboard,
		myStats,
		vouchers,
		voucherStats,
		gameDbMode,
		gameCloudError,
		syncGameFromCloud,
		markExpiredVouchers,
		voucherLabel,
		SPIN_DAILY_LIMIT
	} from '$lib/stores/game.js';

	/**
	 * Halaman "Game Mini & Interaktif".
	 *  - Menu  : hub pemilihan game (GameMenu) — tampilan default saat halaman dibuka
	 *  - Kasir : Cashier Speed Run (latihan hitung kembalian)
	 *  - Konsumen : Spin & Win (roda hadiah → kode voucher)
	 */

	/** @type {'menu'|'kasir'|'konsumen'} */
	let tab = $state('menu');
	let mode = $state(gameDbMode());
	let syncing = $state(false);
	let running = $state(false);
	let lastResult = $state(/** @type {any} */ (null));
	let milestone = $state(/** @type {any} */ (null));

	const isOwner = $derived($session?.role === 'pemilik');
	const myVouchers = $derived(
		$vouchers.filter((v) => v.username === String($session?.username ?? 'tamu'))
	);

	// Sinkronkan data cloud sekali saat halaman dibuka + tandai voucher kedaluwarsa
	$effect(() => {
		markExpiredVouchers();
		if (mode === 'cloud') {
			syncing = true;
			syncGameFromCloud().finally(() => {
				syncing = false;
				mode = gameDbMode(); // bisa turun ke 'lokal' bila tabel belum ada
			});
		}
	});

	/** @param {'menu'|'kasir'|'konsumen'} next */
	function pindahTab(next) {
		if (tab === next) return;
		tab = next;
		running = false;
		lastResult = null;
	}

	function mulaiLatihan() {
		running = true;
		lastResult = null;
		milestone = null;
	}

	/** @param {any} hasil */
	function onGameResult(hasil) {
		running = false;
		lastResult = hasil;
		milestone = hasil.rank;
	}

	/** @param {any} v */
	function onVoucherWon(v) {
		milestone = { label: `Hadiah: ${voucherLabel(v)}`, icon: '🎉', tone: 'success' };
	}
</script>

<svelte:head>
	<title>Game Mini — Mini POS Toko Sejahtera</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-5">
	<!-- ============================ HERO ============================ -->
	<div
		class="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 p-6 shadow-lg shadow-brand-900/15 sm:p-7"
		in:fly={{ y: -12, duration: 480, easing: quintOut }}
	>
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-16 right-0 h-52 w-52 rounded-full bg-white/10 blur-3xl"></div>
			<div
				class="absolute inset-0 opacity-[0.1]"
				style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 20px 20px;"
			></div>
			<div class="absolute -right-6 -bottom-10 text-[120px] opacity-15 select-none">🎮</div>
		</div>

		<div class="relative">
			<p class="text-[11px] font-bold tracking-[0.18em] text-brand-200 uppercase">
				Game Mini & Interaktif
			</p>
			<h1 class="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
				Latih Kasir, Manjakan Pelanggan
			</h1>
			<p class="mt-2 max-w-2xl text-sm leading-relaxed text-brand-100">
				Dua mini-game dalam satu tempat: <b>Cashier Speed Run</b> untuk melatih kecepatan & akurasi
				kasir, dan <b>Spin & Win</b> untuk membagikan diskon, kupon, serta poin loyalitas ke pelanggan.
			</p>

			<div class="mt-4 flex flex-wrap items-center gap-2">
				<span
					data-testid="db-badge"
					class="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm"
				>
					{mode === 'cloud' && !$gameCloudError
						? '☁️ Tersimpan di Supabase'
						: '💾 Tersimpan di browser ini (lokal)'}
				</span>
				{#if syncing}
					<span class="text-[11px] font-semibold text-brand-200">sinkronisasi…</span>
				{/if}
			</div>

			{#if mode === 'lokal' && $gameCloudError}
				<p
					class="border-warning-300/40 mt-3 max-w-2xl rounded-xl border bg-warning-500/15 px-3 py-2 text-[11px] leading-relaxed text-warning-100 backdrop-blur-sm"
				>
					⚠️ Tabel game belum siap di Supabase, jadi skor & voucher disimpan di browser ini
					sementara. Jalankan <b>supabase-schema-game.sql</b> di SQL Editor Supabase untuk mengaktifkan
					cloud.
				</p>
			{/if}
		</div>
	</div>

	<!-- ============================ MENU GAME ============================ -->
	{#if tab === 'menu'}
		<GameMenu
			mode={mode === 'cloud' ? 'cloud' : 'lokal'}
			{syncing}
			cloudError={$gameCloudError}
			onopen={pindahTab}
		/>
	{:else}
		<!-- Navigasi kembali ke menu + posisi game yang sedang dibuka -->
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => pindahTab('menu')}
				class="inline-flex btn-press items-center gap-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-ink-700)] hover:border-brand-300 hover:text-brand-700"
			>
				← Menu Game
			</button>
			<span class="text-[11px] text-[var(--color-ink-400)]">
				Menu / <b class="text-[var(--color-ink-900)]">
					{tab === 'kasir' ? '🧾 Cashier Speed Run' : '🎡 Spin & Win'}
				</b>
			</span>
			<button
				type="button"
				onclick={() => pindahTab(tab === 'kasir' ? 'konsumen' : 'kasir')}
				class="ml-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
			>
				Ganti game: {tab === 'kasir' ? '🎡 Spin & Win' : '🧾 Cashier Speed Run'}
			</button>
		</div>
	{/if}

	<!-- ============================ TAB KASIR ============================ -->
	{#if tab === 'kasir'}
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
			<!-- Area game -->
			<div class="lg:col-span-2" in:fly={{ y: 20, duration: 440, easing: quintOut }}>
				<div class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4">
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
						<div>
							<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Latihan Kasir</h2>
							<p class="text-[11px] text-[var(--color-ink-400)]">
								3 nyawa · 12 soal · makin cepat, makin besar poinnya
							</p>
						</div>
						{#if !running}
							<button
								type="button"
								class="btn-press rounded-xl bg-brand-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-brand-600/25"
								onclick={mulaiLatihan}
							>
								▶ {lastResult ? 'Ulangi Latihan' : 'Mulai Latihan'}
							</button>
						{/if}
					</div>

					{#if running}
						<CashierSpeedRun started onresult={onGameResult} />
					{:else if lastResult}
						<!-- Kartu hasil sesi -->
						<div
							class="relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-600 to-brand-900 p-5 text-white"
							in:scale={{ start: 0.94, duration: 380, easing: backOut }}
						>
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-[10px] font-black tracking-[0.18em] text-brand-200 uppercase">
										Hasil Latihan
									</p>
									<p class="mt-1 text-3xl font-black tabular-nums">{lastResult.score}</p>
									<p class="text-xs text-brand-100">poin</p>
								</div>
								<div class="text-right">
									<p class="text-3xl">{lastResult.rank.icon}</p>
									<p class="text-[11px] font-bold text-brand-100">{lastResult.rank.label}</p>
								</div>
							</div>

							<div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
								{#each [{ l: 'Akurasi', v: `${lastResult.accuracy}%` }, { l: 'Benar', v: lastResult.correct }, { l: 'Salah', v: lastResult.wrong }, { l: 'Combo', v: lastResult.bestStreak }] as s (s.l)}
									<div class="rounded-xl bg-white/10 px-2.5 py-2 backdrop-blur-sm">
										<p class="text-[9px] font-bold tracking-wide text-brand-200 uppercase">{s.l}</p>
										<p class="text-base font-black tabular-nums">{s.v}</p>
									</div>
								{/each}
							</div>

							<p class="mt-3 flex items-center gap-1.5 text-[11px] text-brand-100">
								{#if lastResult.saved && lastResult.dbMode === 'cloud'}
									✅ Tersimpan ke <b>game_scores (Supabase)</b>
								{:else}
									💾 Tersimpan di <b>browser ini</b> — jalankan supabase-schema-game.sql agar masuk cloud.
								{/if}
							</p>
						</div>
					{:else}
						<!-- Aturan main -->
						<div
							class="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface-2)] p-5"
						>
							<p class="text-center text-4xl">🧾⌨️</p>
							<p class="mt-2 text-center text-sm font-black text-[var(--color-ink-900)]">
								Siap melatih refleks kasir?
							</p>
							<ol
								class="mx-auto mt-3 max-w-md space-y-1.5 text-[12px] leading-relaxed text-[var(--color-ink-700)]"
							>
								<li>1. Layar menampilkan daftar belanja, total, dan uang yang dibayar.</li>
								<li>2. Ketik <b>kembalian</b> yang benar lalu tekan Enter sebelum timer habis.</li>
								<li>3. Jawaban benar beruntun menambah <b>combo</b> → poin makin besar.</li>
								<li>4. Salah atau kehabisan waktu mengurangi 1 nyawa (total 3 nyawa).</li>
								<li>5. Skor & akurasi otomatis masuk papan peringkat di samping.</li>
							</ol>
						</div>
					{/if}
				</div>
			</div>

			<!-- Papan peringkat & statistik -->
			<div class="space-y-4">
				<div
					class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
					in:fly={{ y: 20, duration: 460, delay: 80, easing: quintOut }}
				>
					<h2 class="flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink-900)]">
						🏆 Papan Peringkat
					</h2>
					<p class="text-[10px] text-[var(--color-ink-400)]">Skor tertinggi tiap pemain</p>

					{#if $leaderboard.length === 0}
						<p
							class="mt-4 rounded-lg bg-[var(--color-surface-2)] p-3 text-center text-[11px] text-[var(--color-ink-400)]"
						>
							Belum ada skor. Jadilah yang pertama!
						</p>
					{:else}
						<ol class="mt-3 space-y-1">
							{#each $leaderboard as row, i (row.username + row.id)}
								<li
									class="flex items-center gap-2.5 rounded-lg px-2 py-1.5
										{String(row.username) === String($session?.username)
										? 'bg-brand-50 dark:bg-brand-900/30'
										: 'odd:bg-[var(--color-surface-2)]'}"
									in:fly={{ x: 14, duration: 300, delay: i * 40 }}
								>
									<span
										class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black
											{i === 0
											? 'bg-warning-500 text-white'
											: i === 1
												? 'bg-slate-400 text-white'
												: i === 2
													? 'bg-orange-400 text-white'
													: 'bg-[var(--color-surface-0)] text-[var(--color-ink-500)]'}"
									>
										{i + 1}
									</span>
									<span
										class="min-w-0 flex-1 truncate text-[11px] font-bold text-[var(--color-ink-900)]"
									>
										{row.name || row.username}
									</span>
									<span class="text-[11px] font-black text-brand-600 tabular-nums">{row.score}</span
									>
								</li>
							{/each}
						</ol>
					{/if}
				</div>

				<div
					class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
					in:fly={{ y: 20, duration: 460, delay: 140, easing: quintOut }}
				>
					<h2 class="text-sm font-bold text-[var(--color-ink-900)]">📈 Statistik Saya</h2>
					<div class="mt-3 grid grid-cols-2 gap-2">
						{#each [{ l: 'Skor Terbaik', v: $myStats.best }, { l: 'Sesi', v: $myStats.plays }, { l: 'Akurasi', v: `${$myStats.accuracy}%` }, { l: 'Combo Maks', v: $myStats.bestStreak }] as s (s.l)}
							<div class="rounded-xl bg-[var(--color-surface-2)] px-2.5 py-2">
								<p class="text-[9px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase">
									{s.l}
								</p>
								<p class="text-stat-sm">{s.v}</p>
							</div>
						{/each}
					</div>
					<p
						class="mt-3 rounded-lg bg-brand-50 p-2.5 text-[10px] leading-relaxed text-brand-700 dark:bg-brand-900/25 dark:text-brand-200"
					>
						💡 Akurasi dihitung dari total jawaban benar ÷ seluruh percobaan (termasuk waktu habis).
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- ============================ TAB KONSUMEN ============================ -->
	{#if tab === 'konsumen'}
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4 sm:p-5"
			in:fly={{ y: 20, duration: 440, easing: quintOut }}
		>
			<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 class="text-sm font-bold text-[var(--color-ink-900)]">Roda Keberuntungan</h2>
					<p class="text-[11px] text-[var(--color-ink-400)]">
						Hadiah: diskon belanja, potongan langsung, dan poin reward toko
					</p>
				</div>
				<a
					href="/kasir"
					class="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-ink-700)] hover:bg-[var(--color-surface-2)]"
				>
					🛒 Tukar di Kasir
				</a>
			</div>

			<SpinWheel onWon={onVoucherWon} />
		</div>

		<!-- Voucher milik saya -->
		<div
			class="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
			in:fly={{ y: 20, duration: 460, delay: 100, easing: quintOut }}
		>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-sm font-bold text-[var(--color-ink-900)]">🎟️ Voucher Saya</h2>
				{#if isOwner}
					<p class="text-[11px] font-semibold text-[var(--color-ink-400)]">
						Total {$voucherStats.total} voucher · terpakai {$voucherStats.dipakai} ({$voucherStats.conversion}%)
					</p>
				{/if}
			</div>

			{#if myVouchers.length === 0}
				<p
					class="mt-3 rounded-lg bg-[var(--color-surface-2)] p-3 text-center text-[11px] text-[var(--color-ink-400)]"
				>
					Belum ada voucher. Putar roda di atas untuk memenangkan hadiah pertamamu!
				</p>
			{:else}
				<ul class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each myVouchers as v (v.id)}
						<li
							class="relative overflow-hidden rounded-xl border p-3
								{v.status === 'aktif'
								? 'border-success-500/40 bg-success-50 dark:bg-success-700/15'
								: 'border-[var(--color-line)] bg-[var(--color-surface-2)] opacity-70'}"
							in:fly={{ y: 12, duration: 300 }}
						>
							<p class="text-[10px] font-black tracking-wide text-[var(--color-ink-500)] uppercase">
								{voucherLabel(v)}
							</p>
							<p class="font-mono text-base font-black tracking-widest text-[var(--color-ink-900)]">
								{v.code}
							</p>
							<div class="mt-1 flex items-center justify-between gap-2">
								<span class="text-[9px] text-[var(--color-ink-400)]">
									s.d. {formatTanggalJam(v.expiresAt)}
								</span>
								<span
									class="rounded-full px-2 py-0.5 text-[9px] font-black
										{v.status === 'aktif'
										? 'bg-success-600 text-white'
										: v.status === 'terpakai'
											? 'bg-brand-600 text-white'
											: 'bg-slate-500 text-white'}"
								>
									{v.status.toUpperCase()}
								</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>

<!-- ============================ TOAST PENCAPAIAN ============================ -->
{#if milestone}
	<div
		class="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[var(--color-ink-900)] px-4 py-3 text-white shadow-2xl"
			in:fly={{ y: 24, duration: 380, easing: backOut }}
			out:fly={{ y: 24, duration: 260 }}
		>
			<span class="text-2xl">{milestone.icon}</span>
			<div>
				<p class="text-xs font-black">{milestone.label}</p>
				<p class="text-[10px] text-white/60">Tersimpan ke riwayat game</p>
			</div>
			<button
				type="button"
				class="ml-2 rounded-lg px-2 py-1 text-xs text-white/60 hover:text-white"
				onclick={() => (milestone = null)}
				aria-label="Tutup notifikasi"
			>
				✕
			</button>
		</div>
	</div>
{/if}
