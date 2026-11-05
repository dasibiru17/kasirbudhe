<script>
	/**
	 * Sparkline — grafik tren mini tanpa dependensi.
	 *
	 * Menggambar garis + area gradasi dari array angka, dengan animasi
	 * "draw" (stroke-dashoffset) saat pertama muncul. Skala otomatis
	 * berdasarkan nilai min/max, aman untuk data kosong atau datar.
	 *
	 * @type {{
	 *   data?: number[],
	 *   height?: number,
	 *   tone?: 'brand'|'success'|'warning',
	 *   animate?: boolean
	 * }}
	 */
	let { data = [], height = 48, tone = 'brand', animate = true } = $props();

	const W = 100;

	const colors = {
		brand: { line: 'var(--color-brand-500)', fill: 'var(--color-brand-500)' },
		success: { line: 'var(--color-success-600)', fill: 'var(--color-success-600)' },
		warning: { line: 'var(--color-warning-500)', fill: 'var(--color-warning-500)' }
	};
	const c = $derived(colors[tone] ?? colors.brand);

	/** Ubah deret angka → titik SVG (koordinat viewBox 100 x height). */
	const points = $derived.by(() => {
		if (!data.length) return [];
		const min = Math.min(...data);
		const max = Math.max(...data);
		const span = max - min || 1;
		const pad = 4;
		const usableH = height - pad * 2;
		return data.map((v, i) => {
			const x = data.length === 1 ? W / 2 : (i / (data.length - 1)) * W;
			const y = pad + usableH - ((v - min) / span) * usableH;
			return { x, y };
		});
	});

	/** Kurva halus (Catmull-Rom → Bezier) agar terasa lembut, bukan zig-zag. */
	const linePath = $derived.by(() => {
		const p = points;
		if (!p.length) return '';
		if (p.length === 1) return `M ${p[0].x} ${p[0].y}`;
		let d = `M ${p[0].x.toFixed(2)} ${p[0].y.toFixed(2)}`;
		for (let i = 0; i < p.length - 1; i++) {
			const p0 = p[i - 1] ?? p[i];
			const p1 = p[i];
			const p2 = p[i + 1];
			const p3 = p[i + 2] ?? p2;
			const t = 0.16;
			const c1x = p1.x + (p2.x - p0.x) * t;
			const c1y = p1.y + (p2.y - p0.y) * t;
			const c2x = p2.x - (p3.x - p1.x) * t;
			const c2y = p2.y - (p3.y - p1.y) * t;
			d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
		}
		return d;
	});

	const areaPath = $derived(linePath ? `${linePath} L ${W} ${height} L 0 ${height} Z` : '');

	let sparkId = 0;
	const uid = `spark-${++sparkId}`;
</script>

<svg
	viewBox="0 0 {W} {height}"
	preserveAspectRatio="none"
	class="h-full w-full overflow-visible"
	role="img"
	aria-label="Grafik tren penjualan"
>
	<defs>
		<linearGradient id="{uid}-fill" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color={c.fill} stop-opacity="0.28" />
			<stop offset="100%" stop-color={c.fill} stop-opacity="0" />
		</linearGradient>
	</defs>

	{#if areaPath}
		<path
			d={areaPath}
			fill="url(#{uid}-fill)"
			class:spark-in={animate}
			style="animation-delay: 120ms"
		/>
	{/if}

	{#if linePath}
		<path
			d={linePath}
			fill="none"
			stroke={c.line}
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			pathLength="1"
			class:spark-draw={animate}
			vector-effect="non-scaling-stroke"
		/>
		{#if points.length}
			<circle
				cx={points[points.length - 1].x}
				cy={points[points.length - 1].y}
				r="2.6"
				fill={c.line}
				class:spark-dot={animate}
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	{/if}
</svg>

<style>
	.spark-draw {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: spark-draw 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}
	@keyframes spark-draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	.spark-in {
		opacity: 0;
		animation: spark-in 800ms ease-out forwards;
	}
	@keyframes spark-in {
		to {
			opacity: 1;
		}
	}
	.spark-dot {
		opacity: 0;
		animation: spark-in 400ms ease-out forwards;
		animation-delay: 900ms;
		transform-box: fill-box;
		transform-origin: center;
	}
	@media (prefers-reduced-motion: reduce) {
		.spark-draw,
		.spark-in,
		.spark-dot {
			animation: none;
			opacity: 1;
			stroke-dashoffset: 0;
		}
	}
</style>
