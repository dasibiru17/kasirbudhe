<script>
	import { fly, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { formatTanggalJam } from '$lib/utils/format.js';
	import {
		PRIZES,
		pickPrize,
		prizeIndex,
		createVoucher,
		spinsToday,
		SPIN_DAILY_LIMIT,
		voucherLabel
	} from '$lib/stores/game.js';
	import { session } from '$lib/stores/auth.js';

	/**
	 * SpinWheel — roda putar hadiah untuk konsumen (Spin & Win).
	 *
	 * Cara kerja animasi:
	 *  - Roda = div berbentuk lingkaran dengan `conic-gradient` (CSS murni, tanpa canvas).
	 *  - Pemenang DITENTUKAN DULU oleh `pickPrize()` (bobot + mercy setelah 2x zonk).
	 *  - Rotasi dihitung agar segmen pemenang berhenti tepat di pointer atas (12 jam).
	 *  - `transition: transform 4.2s cubic-bezier(...)` memberi efek melambat alami;
	 *    roda juga bisa di-drag untuk diputar manual sebelum menekan tombol.
	 */

	let { onWon = () => {} } = $props();

	const SEG = PRIZES.length;
	const SEG_DEG = 360 / SEG;

	let rotation = $state(0);
	let spinning = $state(false);
	let result = $state(
		/** @type {null | { id:string, label:string, type:string, value:number, icon?:string }} */ (
			null
		)
	);
	let voucher = $state(/** @type {null | any} */ (null));
	let errorMsg = $state('');
	let zonkStreak = $state(0);
	let copied = $state(false);
	let showPrizeList = $state(false);

	const username = $derived(String($session?.username ?? 'tamu'));
	const usedToday = $derived(spinsToday(username));
	const remaining = $derived(Math.max(0, SPIN_DAILY_LIMIT - usedToday));
	const canSpin = $derived(!spinning && remaining > 0);

	/** conic-gradient dari warna tiap segmen — urutan segmen = urutan PRIZES. */
	const wheelBg = $derived(
		`conic-gradient(${PRIZES.map((p, i) => {
			const from = i * SEG_DEG;
			const to = (i + 1) * SEG_DEG;
			return `${p.color} ${from}deg ${to}deg`;
		}).join(', ')})`
	);

	/**
	 * Label pendek per segmen agar muat di dalam sektor 45° tanpa terpotong
	 * (label panjang tetap tampil lengkap di daftar hadiah & kartu voucher).
	 * @type {Record<string, string>}
	 */
	const SHORT = {
		diskon5: '5%',
		poin50: '50 Poin',
		diskon10: '10%',
		zonk: 'Zonk',
		potongan2k: 'Rp2rb',
		diskon15: '15%',
		potongan5k: 'Rp5rb',
		diskon20: '20%'
	};

	/**
	 * Label tiap segmen.
	 * - `place`: rotasi jari-jari segmen dari titik tengah roda (0deg = jam 12).
	 * - `flip` : rotasi balik agar teks tetap tegak (tidak ikut miring).
	 * Teks digeser keluar sejauh `--r` (dihitung dari ukuran roda) oleh kelas `.seg-label`.
	 */
	const labels = $derived(
		PRIZES.map((p, i) => {
			const angle = i * SEG_DEG + SEG_DEG / 2;
			return { ...p, place: angle, flip: 90 - angle, short: SHORT[p.id] ?? p.label };
		})
	);

	/** Putar roda. */
	async function spin() {
		if (!canSpin) return;
		errorMsg = '';
		voucher = null;
		result = null;
		spinning = true;

		const prize = pickPrize(zonkStreak);
		const idx = prizeIndex(prize.id);

		// Segmen idx harus berhenti di pointer (0deg). Putaran selalu beberapa rotasi penuh
		// + jitter kecil agar tidak selalu berhenti di titik geometris yang sama.
		const jitter = (Math.random() - 0.5) * SEG_DEG * 0.6;
		const targetMod = (360 - (idx * SEG_DEG + SEG_DEG / 2) + jitter + 360) % 360;
		const currentMod = ((rotation % 360) + 360) % 360;
		const extra =
			360 * (5 + Math.floor(Math.random() * 3)) + ((targetMod - currentMod + 360) % 360);

		rotation = rotation + extra;

		await new Promise((r) => setTimeout(r, 4300)); // durasi animasi + jeda manis

		spinning = false;
		result = { ...prize, icon: prize.icon };

		if (prize.type === 'zonk') {
			zonkStreak++;
			return;
		}

		zonkStreak = 0;
		const res = await createVoucher(prize, $session?.name);
		if (!res.ok) {
			errorMsg = res.reason || 'Gagal menyimpan voucher.';
			return;
		}
		// Kode tetap dibuat walau penyimpanan cloud gagal → hadiah dibayarkan di lokal.
		voucher = res.record;
		onWon(res.record);
	}

	/** Salin kode voucher ke clipboard. */
	async function copyCode() {
		if (!voucher) return;
		try {
			await navigator.clipboard.writeText(voucher.code);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* clipboard diblokir — kode tetap terlihat di layar */
		}
	}

	/** Reset tampilan hadiah setelah ditutup. */
	function closeResult() {
		result = null;
	}

	// ------- Drag untuk memutar manual -------
	let dragging = $state(false);
	let startAngle = 0;
	let startRotation = 0;
	/** @type {HTMLElement | undefined} */
	let wheelEl = $state();

	/** @param {PointerEvent} e */
	function pointerAngle(e) {
		if (!wheelEl) return 0;
		const r = wheelEl.getBoundingClientRect();
		const cx = r.left + r.width / 2;
		const cy = r.top + r.height / 2;
		return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
	}

	/** @param {PointerEvent} e */
	function startDrag(e) {
		if (spinning) return;
		dragging = true;
		startAngle = pointerAngle(e);
		startRotation = rotation;
		wheelEl?.setPointerCapture(e.pointerId);
	}

	/** @param {PointerEvent} e */
	function moveDrag(e) {
		if (!dragging) return;
		const delta = pointerAngle(e) - startAngle;
		rotation = startRotation + delta;
	}

	/** @param {PointerEvent} e */
	function endDrag(e) {
		if (!dragging) return;
		dragging = false;
		wheelEl?.releasePointerCapture?.(e.pointerId);
	}
</script>

<div class="grid gap-5 lg:grid-cols-2">
	<!-- ================= RODA ================= -->
	<div class="flex flex-col items-center">
		<div class="relative w-full max-w-[340px]">
			<!-- Pointer -->
			<div class="absolute -top-1 left-1/2 z-20 -translate-x-1/2">
				<div
					class="h-0 w-0 border-x-[11px] border-t-[20px] border-x-transparent border-t-danger-600 drop-shadow-md"
				></div>
			</div>

			<!-- Cincin luar + lampu (ukuran dipatok: 100% lebar pembungkus, kotak) -->
			<div
				class="relative w-full rounded-full border-[10px] border-brand-700 bg-brand-900 p-1 shadow-2xl shadow-brand-900/30"
				style="aspect-ratio:1/1"
			>
				<!-- Lampu berkelip di tepi roda -->
				{#each Array(12) as _, i (i)}
					<span
						class="pointer-events-none absolute inset-0 rounded-full {spinning
							? 'animate-blink'
							: ''}"
						style="transform: rotate({i * 30}deg);"
					>
						<span
							class="absolute top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-warning-500 shadow-[0_0_6px_2px_rgba(245,158,11,0.75)]"
						></span>
					</span>
				{/each}

				<!-- Roda berputar (label dipotong oleh mask bundar agar rapi di tepi) -->
				<div
					bind:this={wheelEl}
					role="img"
					aria-label="Roda undian hadiah"
					class="wheel relative h-full w-full rounded-full {dragging
						? 'cursor-grabbing'
						: 'cursor-grab'}"
					style="background:{wheelBg}; transform: rotate({rotation}deg);"
					onpointerdown={startDrag}
					onpointermove={moveDrag}
					onpointerup={endDrag}
					onpointercancel={endDrag}
				>
					<!-- Lapisan label (dipisah dari roda agar ukuran teks/hitungan translate tidak terpengaruh) -->
					<div class="seg-layer">
						{#each labels as l (l.id)}
							<span class="seg-label" style="--a:{l.place}deg;">
								<span
									class="seg-text leading-tight font-black whitespace-nowrap text-white drop-shadow-md"
									style="--f:{l.flip}deg;"
								>
									<span class="block text-[14px] leading-none">{l.icon}</span>
									<span class="block text-[10px] leading-tight">{l.short}</span>
								</span>
							</span>
						{/each}
					</div>

					<!-- Kubah tengah -->
					<div
						class="absolute top-1/2 left-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-brand-700 text-lg font-black text-white shadow-lg"
					>
						🎁
					</div>
				</div>
			</div>
		</div>

		<!-- Tombol spin & kuota -->
		<div class="mt-5 w-full max-w-[340px] space-y-2">
			<button
				type="button"
				class="w-full btn-press rounded-2xl bg-linear-to-r from-warning-500 to-orange-500 py-3.5 text-sm font-black text-white shadow-lg shadow-warning-500/30 disabled:from-slate-400 disabled:to-slate-500 disabled:shadow-none"
				disabled={!canSpin}
				onclick={spin}
			>
				{spinning ? '🎡 Berputar…' : remaining > 0 ? '🎯 PUTAR RODA' : '⛔ Kuota hari ini habis'}
			</button>
			<p class="text-center text-[11px] font-medium text-[var(--color-ink-400)]">
				Sisa spin hari ini: <b class="text-[var(--color-ink-700)]">{remaining}</b> /
				{SPIN_DAILY_LIMIT} · voucher hadiah berlaku 7 hari
			</p>
			{#if zonkStreak > 0}
				<p class="text-center text-[11px] font-bold text-warning-600">
					🙈 {zonkStreak}× belum beruntung — peluang hadiah berikutnya dinaikkan!
				</p>
			{/if}
			{#if errorMsg}
				<p class="rounded-lg bg-danger-50 px-3 py-2 text-[11px] font-semibold text-danger-700">
					{errorMsg}
				</p>
			{/if}
		</div>
	</div>

	<!-- ================= PANEL HADIAH ================= -->
	<div class="space-y-3">
		<div
			class="relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-4"
		>
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-bold text-[var(--color-ink-900)]">Daftar Hadiah</h3>
				<button
					type="button"
					class="rounded-lg border border-[var(--color-line)] px-2 py-1 text-[10px] font-bold text-[var(--color-ink-500)] hover:bg-[var(--color-surface-2)]"
					onclick={() => (showPrizeList = !showPrizeList)}
				>
					{showPrizeList ? 'Sembunyikan' : 'Lihat semua'}
				</button>
			</div>

			<ul class="mt-3 space-y-1.5">
				{#each PRIZES.filter((p) => p.type !== 'zonk').slice(0, showPrizeList ? 99 : 4) as p (p.id)}
					<li
						class="flex items-center gap-2.5 rounded-lg bg-[var(--color-surface-2)] px-2.5 py-2"
						in:fly={{ x: 12, duration: 260 }}
					>
						<span
							class="grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs"
							style="background:{p.color}1f; color:{p.color}">{p.icon}</span
						>
						<span class="flex-1 text-xs font-semibold text-[var(--color-ink-900)]">{p.label}</span>
						<span class="text-[10px] font-bold text-[var(--color-ink-400)]">
							{p.weight}% peluang*
						</span>
					</li>
				{/each}
			</ul>
			<p class="mt-2 text-[10px] leading-relaxed text-[var(--color-ink-400)]">
				*Setelah 2× "Coba Lagi", peluang hadiah dinaikkan otomatis (anti frustrasi).
			</p>
		</div>

		<!-- Hasil spin -->
		{#if result}
			<div
				class="relative overflow-hidden rounded-2xl border p-4 {result.type === 'zonk'
					? 'border-[var(--color-line)] bg-[var(--color-surface-2)]'
					: 'border-success-500/40 bg-success-50 dark:bg-success-700/15'}"
				in:scale={{ start: 0.9, duration: 320, easing: backOut }}
			>
				<button
					type="button"
					class="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full text-[var(--color-ink-400)] hover:bg-black/5"
					onclick={closeResult}
					aria-label="Tutup hasil"
				>
					✕
				</button>

				{#if result.type === 'zonk'}
					<p class="text-sm font-black text-[var(--color-ink-700)]">🙈 Coba Lagi!</p>
					<p class="mt-1 text-[11px] text-[var(--color-ink-500)]">
						Belum beruntung kali ini. Putar sekali lagi — peluang hadiahmu sudah dinaikkan.
					</p>
				{:else if voucher}
					<p class="text-[10px] font-black tracking-[0.16em] text-success-700 uppercase">
						🎉 Selamat! Kamu menang
					</p>
					<p class="mt-0.5 text-lg font-black text-[var(--color-ink-900)]">
						{result.icon}
						{voucherLabel(voucher)}
					</p>

					<!-- Kartu kode voucher -->
					<div
						class="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-success-500 bg-white/70 p-2.5 dark:bg-slate-900/40"
					>
						<div class="min-w-0 flex-1">
							<p class="text-[9px] font-bold tracking-wide text-[var(--color-ink-400)] uppercase">
								Kode promo
							</p>
							<p class="font-mono text-lg font-black tracking-widest text-[var(--color-ink-900)]">
								{voucher.code}
							</p>
						</div>
						<button
							type="button"
							class="btn-press rounded-lg bg-success-600 px-3 py-2 text-[11px] font-black text-white"
							onclick={copyCode}
						>
							{copied ? '✅ Tersalin' : '📋 Salin'}
						</button>
					</div>

					<p class="mt-2 text-[10px] leading-relaxed text-[var(--color-ink-500)]">
						Tunjukkan kode ini di kasir. Berlaku sampai
						<b>{formatTanggalJam(voucher.expiresAt)}</b>.
					</p>
				{/if}
			</div>
		{/if}

		<!-- Cara pakai -->
		<div class="rounded-2xl border border-brand-200 bg-brand-50 p-3.5 dark:bg-brand-900/25">
			<p class="text-[11px] font-black text-brand-700 dark:text-brand-200">Cara pakai hadiah</p>
			<ol
				class="mt-1.5 space-y-1 text-[11px] leading-relaxed text-brand-700/80 dark:text-brand-100/80"
			>
				<li>1. Putar roda & salin kode promo (format SPN-XXXXXX).</li>
				<li>2. Sebutkan kode saat membayar di kasir.</li>
				<li>3. Kasir memverifikasi kode → potongan langsung diterapkan.</li>
			</ol>
		</div>
	</div>
</div>

<style>
	/* Perputaran roda: decelerate panjang supaya terasa seperti undian sungguhan */
	.wheel {
		transition: transform 4.2s cubic-bezier(0.12, 0.72, 0.06, 1);
		touch-action: none;
		will-change: transform;
		/* Label tidak boleh "bocor" ke luar lingkaran */
		overflow: hidden;
	}

	/* Lapisan label menutupi roda persis, tanpa transform → tidak mewarisi rotasi roda */
	.seg-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		container-type: size;
	}

	/*
	 * Label segmen.
	 * `--a` = sudut tengah segmen (0deg = jam 12). Posisi dihitung dari pusat roda
	 * memakai cqw (container query unit) = 1% lebar lapisan, jadi proporsional di
	 * layar HP maupun desktop. `--f` memutar teks balik agar tetap tegak.
	 * 33cqw ≈ 66% radius → teks nyaman dibaca tanpa menyentuh cincin.
	 */
	.seg-label {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	/*
	 * Teks label: titik jangkar = pusat roda (0,0 dari .seg-label).
	 * 1) rotate(var(--a))  → sejajarkan dengan jari-jari segmen
	 * 2) translateY(...)   → geser keluar 33cqw (≈66% radius), minus setengah tinggi
	 *                        teks agar pusat teks tepat di jarak itu
	 * 3) rotate(var(--f))  → putar balik supaya tulisan tetap tegak dibaca
	 * `translate: -50% 0` hanya memusatkan horizontal; tinggi teks (px) tidak
	 * memengaruhi jarak karena translateY memakai nilai absolut dari cqw.
	 */
	.seg-text {
		position: absolute;
		left: 0;
		top: 0;
		line-height: 1.05;
		width: min-content;
		white-space: nowrap;
		text-align: center;
		transform: rotate(var(--a)) translateY(calc(-33cqw - 1.1em)) rotate(var(--f));
		transform-origin: 0 0;
		translate: -50% 0;
	}

	/* Lampu tepi berkelip saat roda berputar */
	:global(.animate-blink) {
		animation: blink 0.55s steps(2, end) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0.25;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.wheel {
			transition-duration: 0.6s;
		}
	}
</style>
