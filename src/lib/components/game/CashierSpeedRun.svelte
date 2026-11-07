<script>
	import { fly, fade, scale } from 'svelte/transition';
	import { quintOut, backOut } from 'svelte/easing';
	import { formatRupiah } from '$lib/utils/format.js';
	import AnimatedNumber from '$lib/components/ui/AnimatedNumber.svelte';
	import {
		createRound,
		scoreFor,
		accuracyOf,
		rankOf,
		saveGameScore,
		gameDbMode
	} from '$lib/stores/game.js';

	/**
	 * CashierSpeedRun — latihan kasir menghitung kembalian.
	 *
	 * Aturan main:
	 *  - Tiap soal menampilkan daftar belanja + uang yang dibayar.
	 *  - Kasir mengetik kembalian yang benar sebelum timer habis.
	 *  - Benar  : +poin (cepat = poin besar), combo naik, soal berikutnya.
	 *  - Salah  : combo hangus, nyawa berkurang 1.
	 *  - Waktu habis: dihitung salah, nyawa berkurang 1.
	 *  - Nyawa habis (3) → sesi berakhir, skor & akurasi disimpan.
	 */

	let { started = false, onresult = () => {} } = $props();

	const TOTAL_ROUNDS = 12;
	const MAX_LIVES = 3;

	let phase = $state('idle'); // idle | playing | over
	let round = $state(null); // soal aktif
	let roundIndex = $state(0);
	let input = $state('');
	/** Jawaban via pilihan ganda: index opsi yang dipilih, atau -1 saat belum memilih. */
	let selected = $state(-1);
	/** Mode menjawab soal aktif: 'pilgan' (tombol) atau 'ketik' (input manual). */
	let answerMode = $state(/** @type {'pilgan'|'ketik'} */ ('pilgan'));
	let lives = $state(MAX_LIVES);
	let combo = $state(0);
	let bestStreak = $state(0);
	let score = $state(0);
	let correct = $state(0);
	let wrong = $state(0);
	let timeLeft = $state(0);
	let deadline = 0;
	let responseTimes = $state([]); // ms per jawaban
	let feedback = $state(null); // { ok, change, reason }
	let shake = $state(false);
	let floating = $state(''); // teks poin melayang
	/** @type {HTMLInputElement | undefined} */
	let inputEl = $state();

	// `started` hanya dibaca sekali saat mount; reset sesi berikutnya lewat tombol "Main Lagi".
	$effect(() => {
		if (started) start();
	});

	/** Buat soal baru dan set deadline. */
	function nextRound() {
		const r = createRound(roundIndex);
		round = r;
		input = '';
		selected = -1;
		// Mode menjawab ikut pilihan pemain antar soal (tidak direset per soal)
		feedback = null;
		timeLeft = r.seconds * 1000;
		deadline = performance.now() + r.seconds * 1000;
		phase = 'playing';
		if (answerMode === 'ketik') focusInput();
	}

	/** Timer berbasis requestAnimationFrame supaya bar mulus & tidak “melompat”. */
	$effect(() => {
		// Re-run saat soal berganti: setiap soal punya deadline baru.
		void deadline;
		if (phase !== 'playing') return;
		let raf = 0;
		const tick = () => {
			const left = deadline - performance.now();
			timeLeft = Math.max(0, left);
			if (left <= 0) {
				endRound(false, 'waktu');
				return;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	function focusInput() {
		queueMicrotask(() => inputEl?.focus());
	}

	/** Mulai sesi baru dari nol. */
	function start() {
		phase = 'playing';
		roundIndex = 0;
		lives = MAX_LIVES;
		combo = 0;
		bestStreak = 0;
		score = 0;
		correct = 0;
		wrong = 0;
		responseTimes = [];
		feedback = null;
		floating = '';
		selected = -1;
		nextRound();
	}

	/**
	 * Selesaikan satu soal.
	 * @param {boolean} ok
	 * @param {'jawab'|'waktu'} via
	 */
	function endRound(ok, via) {
		if (phase !== 'playing' || !round) return;
		phase = 'feedback';

		if (ok) {
			correct++;
			combo++;
			bestStreak = Math.max(bestStreak, combo);
			const maxMs = round.seconds * 1000;
			const gained = scoreFor(true, timeLeft, maxMs, combo);
			score += gained;
			feedback = { ok: true, change: round.change, gained, combo };
			floating = `+${gained}`;
			const spent = maxMs - timeLeft;
			responseTimes = [...responseTimes, spent];
		} else {
			wrong++;
			combo = 0;
			lives--;
			feedback = { ok: false, change: round.change, reason: via };
			shake = true;
			setTimeout(() => (shake = false), 420);
		}

		setTimeout(
			() => {
				floating = '';
				if (lives <= 0 || (ok && roundIndex + 1 >= TOTAL_ROUNDS)) {
					finish();
				} else {
					roundIndex++;
					nextRound();
				}
			},
			ok ? 620 : 1500
		);
	}

	/** Cek jawaban kasir (mode ketik). */
	function submit() {
		if (phase !== 'playing' || !round) return;
		const value = Number(String(input).replace(/\D/g, ''));
		if (String(input).trim() === '') return;
		endRound(value === round.change, 'jawab');
	}

	/**
	 * Jawab lewat pilihan ganda.
	 * @param {number} value nilai kembalian dari opsi yang diklik
	 */
	function pilih(value) {
		if (phase !== 'playing' || !round) return;
		selected = round.options.indexOf(value);
		endRound(value === round.change, 'jawab');
	}

	/** @param {KeyboardEvent} e */
	function onKeydown(e) {
		if (answerMode !== 'ketik') return;
		if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
	}

	/** @param {string} text */
	function tap(text) {
		if (phase !== 'playing') return;
		if (text === 'del') input = String(input).slice(0, -1);
		else input = String(input) + text;
		focusInput();
	}

	/** Sesi selesai: simpan ke game_scores lalu laporkan ke parent. */
	async function finish() {
		phase = 'over';
		const avg = responseTimes.length
			? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
			: 0;
		const accuracy = accuracyOf(correct, wrong);
		const rank = rankOf(accuracy, correct);
		const saved = await saveGameScore({
			correct,
			wrong,
			bestStreak,
			score,
			level: rank.label,
			avgResponseMs: avg
		});
		onresult({
			score,
			correct,
			wrong,
			accuracy,
			bestStreak,
			rank,
			avgResponseMs: avg,
			saved: saved.ok,
			dbMode: gameDbMode()
		});
	}

	let rank = $derived(rankOf(accuracyOf(correct, wrong), correct));
	/** Empat kartu ringkas di atas papan permainan. */
	const hud = $derived([
		{ label: 'Skor', value: /** @type {number|string} */ (score), icon: '🏆' },
		{ label: 'Combo', value: /** @type {number|string} */ (combo), icon: '🔥' },
		{ label: 'Benar', value: /** @type {number|string} */ (correct), icon: '✅' },
		{
			label: 'Soal',
			value: /** @type {number|string} */ (
				`${Math.min(roundIndex + 1, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`
			),
			icon: '🧾'
		}
	]);

	let timePct = $derived(round ? (timeLeft / (round.seconds * 1000)) * 100 : 0);
	let urgent = $derived(timeLeft < 3000 && phase === 'playing');
	let timerColor = $derived(
		timePct > 50
			? 'var(--color-success-500)'
			: timePct > 25
				? 'var(--color-warning-500)'
				: 'var(--color-danger-500)'
	);
</script>

<div class="space-y-4">
	<!-- Papan skor mini -->
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
		{#each hud as s (s.label)}
			<div
				class="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-0)] px-3 py-2"
			>
				<p class="text-[10px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase">
					{s.icon}
					{s.label}
				</p>
				<p class="text-stat-sm">
					{#if typeof s.value === 'number'}
						<AnimatedNumber value={s.value} duration={260} />
					{:else}
						{s.value}
					{/if}
				</p>
			</div>
		{/each}
	</div>

	<!-- Nyawa -->
	<div class="flex items-center gap-1.5">
		<span class="text-[10px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase"
			>Nyawa</span
		>
		{#each Array(MAX_LIVES) as _, i (i)}
			<span
				class="text-base transition-all duration-300 {i < lives
					? 'scale-100'
					: 'scale-90 opacity-25 grayscale'}">{i < lives ? '❤️' : '🤍'}</span
			>
		{/each}
		{#if combo >= 3}
			<span
				class="ml-auto rounded-full bg-warning-100 px-2.5 py-1 text-[10px] font-black text-warning-700"
				in:scale={{ start: 0.6, duration: 260, easing: backOut }}
			>
				🔥 Combo x{combo}
			</span>
		{/if}
	</div>

	<!-- Kartu soal -->
	<div
		class="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4 shadow-sm transition-transform
			{shake ? 'animate-shake' : ''}"
	>
		<!-- Timer bar -->
		<div class="absolute inset-x-0 top-0 h-1.5 bg-[var(--color-surface-2)]">
			<div
				class="h-full transition-colors duration-300 {urgent ? 'animate-pulse' : ''}"
				style="width:{timePct}%; background:{timerColor};"
			></div>
		</div>

		{#if round}
			<div class="mt-1 flex items-center justify-between gap-2">
				<span class="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
					Soal #{roundIndex + 1} · {round.levelLabel}
				</span>
				<span
					class="text-xs font-black tabular-nums {urgent
						? 'text-danger-600'
						: 'text-[var(--color-ink-500)]'}"
				>
					{(timeLeft / 1000).toFixed(1)}s
				</span>
			</div>

			<!-- Daftar belanja -->
			<ul class="mt-3 divide-y divide-[var(--color-line)] rounded-xl bg-[var(--color-surface-2)]">
				{#each round.items as it (it.name)}
					<li class="flex items-center gap-2 px-3 py-2 text-xs">
						<span class="text-base">{it.icon}</span>
						<span class="flex-1 font-semibold text-[var(--color-ink-900)]">
							{it.name}
							{#if it.qty > 1}<span class="text-brand-600"> ×{it.qty}</span>{/if}
						</span>
						<span class="font-bold text-[var(--color-ink-700)] tabular-nums">
							{formatRupiah(it.price * it.qty)}
						</span>
					</li>
				{/each}
			</ul>

			<!-- Total & uang dibayar -->
			<div class="mt-3 grid grid-cols-2 gap-2">
				<div class="rounded-xl border border-[var(--color-line)] px-3 py-2">
					<p class="text-[10px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase">
						Total belanja
					</p>
					<p class="text-lg font-black text-[var(--color-ink-900)] tabular-nums">
						{formatRupiah(round.total)}
					</p>
				</div>
				<div
					class="rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2 dark:bg-brand-900/20"
				>
					<p class="text-[10px] font-bold tracking-wide text-brand-500 uppercase">Uang dibayar</p>
					<p class="text-lg font-black text-brand-700 tabular-nums dark:text-brand-200">
						{formatRupiah(round.paid)}
					</p>
				</div>
			</div>

			<!-- Pilihan ganda kembalian -->
			{#if answerMode === 'pilgan'}
				<div class="mt-4">
					<div class="flex items-center justify-between">
						<p class="text-[10px] font-bold tracking-wide text-[var(--color-ink-500)] uppercase">
							Pilih kembalian yang benar
						</p>
						<button
							type="button"
							class="rounded-lg border border-[var(--color-line)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]"
							onclick={() => {
								answerMode = 'ketik';
								selected = -1;
								focusInput();
							}}
						>
							⌨️ Ketik manual
						</button>
					</div>

					<div class="mt-2 grid grid-cols-2 gap-2">
						{#each round.options as opt, i (opt)}
							{@const picked = selected === i}
							{@const revealed = feedback !== null && phase !== 'playing'}
							<button
								type="button"
								disabled={phase !== 'playing'}
								onclick={() => pilih(opt)}
								class="flex min-h-[52px] btn-press items-center justify-between gap-1 rounded-xl border-2 px-3 py-2.5 text-left transition-all
									{revealed && opt === round.change
									? 'border-success-500 bg-success-50 dark:bg-success-700/20'
									: picked
										? 'border-danger-500 bg-danger-50 dark:bg-danger-700/20'
										: phase === 'playing'
											? 'border-[var(--color-line)] bg-[var(--color-surface-0)] hover:border-brand-400 hover:bg-brand-50/60 dark:hover:bg-brand-900/25'
											: 'border-[var(--color-line)] bg-[var(--color-surface-2)] opacity-60'}"
							>
								<span
									class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-black text-white"
								>
									{String.fromCharCode(65 + i)}
								</span>
								<span class="flex-1 text-base font-black text-[var(--color-ink-900)] tabular-nums">
									{formatRupiah(opt)}
								</span>
								{#if revealed && opt === round.change}
									<span class="text-base">✅</span>
								{:else if picked && revealed}
									<span class="text-base">❌</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<!-- Input kembalian manual -->
				<div class="mt-4 flex items-center justify-between">
					<label
						class="text-[10px] font-bold tracking-wide text-[var(--color-ink-500)] uppercase"
						for="kembalian"
					>
						Kembalian yang diberikan
					</label>
					<button
						type="button"
						class="rounded-lg border border-[var(--color-line)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]"
						onclick={() => {
							answerMode = 'pilgan';
							selected = -1;
						}}
					>
						🔠 Pilihan ganda
					</button>
				</div>
				<div class="relative mt-1.5">
					<span
						class="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-sm font-black text-[var(--color-ink-400)]"
						>Rp</span
					>
					<input
						id="kembalian"
						bind:this={inputEl}
						bind:value={input}
						onkeydown={onKeydown}
						inputmode="numeric"
						autocomplete="off"
						disabled={phase !== 'playing'}
						placeholder="0"
						class="w-full rounded-xl border-2 py-3 pr-4 pl-11 text-2xl font-black tabular-nums transition-all outline-none
							{feedback?.ok === false
							? 'border-danger-500 bg-danger-50 text-danger-700'
							: feedback?.ok === true
								? 'border-success-500 bg-success-50 text-success-700'
								: 'border-[var(--color-line)] bg-[var(--color-surface-0)] text-[var(--color-ink-900)] focus:border-brand-500 focus:ring-4 focus:ring-brand-100'}
							disabled:opacity-80"
					/>
				</div>

				<!-- Numpad cepat: meniru keyboard kasir -->
				<div class="mt-2 grid grid-cols-3 gap-1.5 sm:hidden">
					{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'] as k (k)}
						<button
							type="button"
							class="btn-press rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-0)] py-2.5 text-sm font-black text-[var(--color-ink-700)]"
							onclick={() => tap(k)}
						>
							{k === 'del' ? '⌫' : k}
						</button>
					{/each}
				</div>

				<button
					type="button"
					class="mt-2 w-full btn-press rounded-xl bg-brand-600 py-3 text-sm font-black text-white shadow-md shadow-brand-600/25 disabled:opacity-40"
					disabled={phase !== 'playing' || String(input).trim() === ''}
					onclick={submit}
				>
					Kirim Kembalian <span class="opacity-70">(Enter)</span>
				</button>
			{/if}

			<!-- Umpan balik -->
			{#if feedback}
				<div
					class="pointer-events-none absolute inset-x-0 top-1/3 z-10 text-center"
					in:fly={{ y: 18, duration: 320, easing: quintOut }}
					out:fade={{ duration: 220 }}
				>
					{#if feedback.ok}
						<p
							class="mx-auto inline-block rounded-2xl bg-success-600 px-4 py-2 text-lg font-black text-white shadow-lg"
						>
							✅ Tepat! <span class="opacity-80">{formatRupiah(feedback.change)}</span>
						</p>
					{:else}
						<div
							class="mx-auto inline-block rounded-2xl bg-danger-600 px-4 py-3 text-white shadow-lg"
						>
							<p class="text-sm font-black">
								{feedback.reason === 'waktu' ? '⏰ Waktu habis!' : '❌ Belum tepat'}
							</p>
							<p class="mt-0.5 text-xs opacity-90">
								Kembalian seharusnya <b class="tabular-nums">{formatRupiah(feedback.change)}</b>
							</p>
						</div>
					{/if}
				</div>
			{/if}

			{#if floating}
				<p
					class="pointer-events-none absolute top-2 right-4 text-2xl font-black text-success-600"
					in:fly={{ y: 10, duration: 300 }}
					out:fly={{ y: -40, duration: 500 }}
				>
					{floating}
				</p>
			{/if}
		{:else}
			<div class="grid h-48 place-items-center">
				<p class="text-sm font-semibold text-[var(--color-ink-400)]">Menyiapkan soal…</p>
			</div>
		{/if}

		<!-- Overlay sesi selesai -->
		{#if phase === 'over'}
			<div
				class="absolute inset-0 z-20 grid place-items-center bg-[var(--color-surface-0)]/95 backdrop-blur-sm"
			>
				<div class="text-center" in:scale={{ start: 0.8, duration: 380, easing: backOut }}>
					<p class="text-5xl">{rank.icon}</p>
					<p class="mt-2 text-lg font-black text-[var(--color-ink-900)]">Sesi selesai!</p>
					<p class="text-xs text-[var(--color-ink-500)]">
						Skor akhir <b class="text-brand-600 tabular-nums">{score}</b> · akurasi
						<b>{accuracyOf(correct, wrong)}%</b> · {rank.label}
					</p>
					<button
						type="button"
						class="mt-3 btn-press rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-black text-white"
						onclick={start}
					>
						🔄 Main Lagi
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Goyang singkat saat jawaban salah — memberi rasa “fisik” seperti mesin kasir */
	:global(.animate-shake) {
		animation: shake 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}
	@keyframes shake {
		10%,
		90% {
			transform: translateX(-2px);
		}
		20%,
		80% {
			transform: translateX(4px);
		}
		30%,
		50%,
		70% {
			transform: translateX(-7px);
		}
		40%,
		60% {
			transform: translateX(7px);
		}
	}
</style>
