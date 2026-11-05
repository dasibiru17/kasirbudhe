<script>
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	/**
	 * AnimatedNumber — angka statistik yang "bertumbuh" (animated counter).
	 * Berbasis Tween Svelte (deterministik, default 600ms): saat `value`
	 * berubah, angka bergerak halus ke nilai baru, lalu berkedip hijau/merah
	 * sesuai arah perubahan.
	 *
	 * @type {{
	 *   value: number,
	 *   format?: (n: number) => string,
	 *   duration?: number,
	 *   flash?: boolean,  // true = warna berkedip saat naik/turun
	 *   class?: string    // kelas tambahan (mis. ukuran/weight dari pemanggil)
	 * }}
	 */
	let {
		value = 0,
		format = (n) => String(n),
		duration = 600,
		flash = true,
		class: klass = ''
	} = $props();

	// Tween deterministik: setiap perubahan value dianimasikan dengan `duration`
	// (bukan $state: Tween sudah reaktif sendiri lewat tween.current)
	const tween = new Tween(0, { easing: cubicOut });
	let display = $derived(Math.round(tween.current));

	// Dorong tween ke nilai target setiap kali value/duration berubah
	$effect(() => {
		const target = value;
		const ms = duration;
		tween.set(target, { duration: ms });
	});

	// Kedip warna sesuai arah perubahan (naik = hijau, turun = merah)
	let prev = $state(0);
	let direction = $state(0); // 1 naik, -1 turun, 0 netral
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timeout;

	$effect(() => {
		if (!flash || value === prev) return;
		direction = value > prev ? 1 : -1;
		prev = value;
		clearTimeout(timeout);
		timeout = setTimeout(() => (direction = 0), 600);
		return () => clearTimeout(timeout);
	});

	const color = $derived(
		direction === 1
			? 'text-success-600'
			: direction === -1
				? 'text-danger-600'
				: 'text-ink-900'
	);
</script>

<span data-testid="animated-counter" class="tabular-nums transition-colors duration-300 {klass} {color}">
	{format(display)}
</span>
