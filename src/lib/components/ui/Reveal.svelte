<script>
	/**
	 * Reveal — animasi "muncul saat discroll" (fade + slide-up + blur).
	 *
	 * Memakai IntersectionObserver, jadi animasi hanya berjalan ketika elemen
	 * benar-benar masuk viewport. Dihormati juga preferensi `prefers-reduced-
	 * motion`: pengguna yang meminta gerak minimal langsung melihat konten.
	 *
	 * @type {{
	 *   delay?: number,   // penundaan (ms) — untuk efek stagger
	 *   y?: number,       // jarak geser awal (px)
	 *   duration?: number,
	 *   once?: boolean,   // true = hanya animasi sekali
	 *   class?: string,
	 *   children?: import('svelte').Snippet
	 * }} Props
	 */
	let { delay = 0, y = 18, duration = 560, once = true, class: klass = '', children } = $props();

	/** @type {HTMLElement} */
	let el;
	let shown = $state(false);

	$effect(() => {
		if (!el) return;

		const reduce =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		if (reduce || typeof IntersectionObserver === 'undefined') {
			shown = true;
			return;
		}

		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					shown = true;
					if (once) io.disconnect();
				} else if (!once) {
					shown = false;
				}
			},
			{ threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
		);
		io.observe(el);
		return () => io.disconnect();
	});

	const style = $derived(
		shown
			? `opacity:1; transform:translateY(0) scale(1); filter:blur(0px); transition:opacity ${duration}ms ${delay}ms, transform ${duration}ms ${delay}ms cubic-bezier(0.22,1,0.36,1), filter ${duration}ms ${delay}ms;`
			: `opacity:0; transform:translateY(${y}px) scale(0.985); filter:blur(6px); transition:opacity ${duration}ms ${delay}ms, transform ${duration}ms ${delay}ms cubic-bezier(0.22,1,0.36,1), filter ${duration}ms ${delay}ms;`
	);
</script>

<div bind:this={el} class={klass} {style} data-revealed={shown}>
	{@render children?.()}
</div>
