<script>
	/**
	 * LiveClock — jam & sapaan hidup di hero dashboard.
	 * Sapaan menyesuaikan jam lokal (pagi/siang/sore/malam) dan
	 * diperbarui tiap detik tanpa memicu reflow besar.
	 *
	 * @type {{ name?: string }}
	 */
	let { name = '' } = $props();

	/** @type {Date|null} */
	let now = $state(null);

	$effect(() => {
		now = new Date();
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	const sapaan = $derived.by(() => {
		const h = now?.getHours() ?? 9;
		if (h < 11) return 'Selamat pagi';
		if (h < 15) return 'Selamat siang';
		if (h < 19) return 'Selamat sore';
		return 'Selamat malam';
	});

	const jam = $derived(
		now
			? new Intl.DateTimeFormat('id-ID', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				})
					.format(now)
					.replace(/\./g, ':')
			: '--:--:--'
	);

	const tanggal = $derived(
		now
			? new Intl.DateTimeFormat('id-ID', {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				}).format(now)
			: ''
	);
</script>

<div class="flex flex-col gap-1">
	<span class="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase">
		{sapaan}{name ? `, ${name}` : ''}
	</span>
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
		<span
			class="font-mono text-lg font-bold tracking-tight text-white tabular-nums sm:text-xl"
			aria-label="Jam sekarang"
		>
			{jam}
		</span>
		<span class="text-xs font-medium text-white/70">{tanggal}</span>
	</div>
</div>
