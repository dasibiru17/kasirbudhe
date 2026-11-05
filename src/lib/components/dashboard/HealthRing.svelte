<script>
	/**
	 * HealthRing — cincin progres SVG dengan animasi "isi" saat mount.
	 * Dipakai untuk skor kesehatan stok (persentase produk yang stoknya aman).
	 *
	 * @type {{ percent?: number, label?: string, size?: number }}
	 */
	let { percent = 0, label = '', size = 132 } = $props();

	const safePercent = $derived(Math.max(0, Math.min(100, Math.round(percent))));

	const R = 52;
	const C = 2 * Math.PI * R;

	let mounted = $state(false);
	$effect(() => {
		const id = requestAnimationFrame(() => (mounted = true));
		return () => cancelAnimationFrame(id);
	});

	const offset = $derived(C - (safePercent / 100) * C);

	/** Warna cincin mengikuti tingkat kesehatan. */
	const stroke = $derived(
		safePercent >= 80
			? 'var(--color-success-500)'
			: safePercent >= 50
				? 'var(--color-warning-500)'
				: 'var(--color-danger-500)'
	);
	const verdict = $derived(
		safePercent >= 80 ? 'Sehat' : safePercent >= 50 ? 'Perlu perhatian' : 'Kritis'
	);
	const verdictColor = $derived(
		safePercent >= 80
			? 'text-success-600'
			: safePercent >= 50
				? 'text-warning-600'
				: 'text-danger-600'
	);
</script>

<div class="flex flex-col items-center">
	<div class="relative" style="width:{size}px; height:{size}px">
		<svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
			<circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-surface-2)" stroke-width="11" />
			<circle
				cx="60"
				cy="60"
				r={R}
				fill="none"
				{stroke}
				stroke-width="11"
				stroke-linecap="round"
				stroke-dasharray={C}
				stroke-dashoffset={mounted ? offset : C}
				style="transition: stroke-dashoffset 1200ms cubic-bezier(0.22,1,0.36,1), stroke 400ms ease;"
			/>
		</svg>
		<div class="absolute inset-0 grid place-items-center">
			<div class="text-center">
				<p class="text-2xl font-extrabold tracking-tight text-[var(--color-ink-900)] tabular-nums">
					{safePercent}%
				</p>
				<p class="text-[10px] font-semibold tracking-wide text-[var(--color-ink-400)] uppercase">
					{label || 'aman'}
				</p>
			</div>
		</div>
	</div>
	<p class="mt-2 text-xs font-bold {verdictColor}">{verdict}</p>
</div>
