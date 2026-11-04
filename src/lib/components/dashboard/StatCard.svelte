<script>
	import AnimatedNumber from '$lib/components/ui/AnimatedNumber.svelte';

	/**
	 * StatCard — kartu statistik dashboard (design system v1.1).
	 * Tone memakai makna warna aplikasi: brand = indigo CTA,
	 * success = kas masuk, warning = stok menipis, danger = kas keluar.
	 * Angka otomatis beranimasi via AnimatedNumber (Tween 600ms).
	 *
	 * @type {{
	 *   title: string,
	 *   value: number|string,
	 *   icon: string,
	 *   tone?: 'brand'|'success'|'warning'|'danger',
	 *   format?: (n: number) => string  // khusus value berupa angka
	 * }}
	 */
	let { title, value, icon, tone = 'brand', format } = $props();

	const tones = {
		brand: 'bg-brand-50 text-brand-600',
		success: 'bg-success-50 text-success-600',
		warning: 'bg-warning-50 text-warning-600',
		danger: 'bg-danger-50 text-danger-600'
	};
</script>

<div
	class="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 transition-colors"
>
	<div class="grid h-12 w-12 place-items-center rounded-xl text-2xl {tones[tone]}">{icon}</div>
	<div>
		<p class="text-caption font-medium text-ink-400">{title}</p>
		{#if typeof value === 'number'}
			<AnimatedNumber {value} {format} class="text-h3 font-bold text-ink-800" />
		{:else}
			<p class="text-h3 font-bold text-ink-800">{value}</p>
		{/if}
	</div>
</div>
