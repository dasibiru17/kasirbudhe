<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import AnimatedNumber from '$lib/components/ui/AnimatedNumber.svelte';
	import Sparkline from './Sparkline.svelte';

	/**
	 * HeroStat — kartu statistik utama dengan sparkline + delta tren.
	 *
	 * @type {{
	 *   title: string,
	 *   value: number,
	 *   format?: (n: number) => string,
	 *   icon: string,
	 *   tone?: 'brand'|'success'|'warning'|'danger',
	 *   spark?: number[],
	 *   delta?: number|null,
	 *   deltaLabel?: string,
	 *   delay?: number
	 * }}
	 */
	let {
		title,
		value,
		format = (n) => String(n),
		icon,
		tone = 'brand',
		spark = [],
		delta = null,
		deltaLabel = 'vs kemarin',
		delay = 0
	} = $props();

	const tones = {
		brand: {
			chip: 'bg-brand-50 text-brand-600',
			ring: 'hover:border-brand-300',
			glow: 'bg-brand-500/10'
		},
		success: {
			chip: 'bg-success-50 text-success-600',
			ring: 'hover:border-success-500/40',
			glow: 'bg-success-500/10'
		},
		warning: {
			chip: 'bg-warning-50 text-warning-600',
			ring: 'hover:border-warning-500/40',
			glow: 'bg-warning-500/10'
		},
		danger: {
			chip: 'bg-danger-50 text-danger-600',
			ring: 'hover:border-danger-500/40',
			glow: 'bg-danger-500/10'
		}
	};
	const t = $derived(tones[tone] ?? tones.brand);

	const sparkTone = $derived(tone === 'danger' ? 'brand' : tone);
</script>

<div
	class="group relative overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-0)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg {t.ring}"
	in:fly={{ y: 26, duration: 520, delay, easing: quintOut }}
>
	<!-- Cahaya lembut di sudut, membesar saat hover -->
	<div
		class="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125 {t.glow}"
		aria-hidden="true"
	></div>

	<div class="relative flex items-start justify-between gap-3">
		<p class="min-w-0 truncate text-caption font-semibold tracking-wide uppercase">{title}</p>
		<div
			class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 {t.chip}"
		>
			{icon}
		</div>
	</div>

	<!-- Angka nilai dapat barisnya sendiri agar nominal panjang tidak terpotong -->
	<AnimatedNumber
		{value}
		{format}
		class="relative mt-2 block text-[1.05rem] leading-tight font-extrabold whitespace-nowrap sm:text-xl"
	/>

	<div class="relative mt-3 flex items-end justify-between gap-3">
		{#if delta !== null}
			<span
				class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold {delta >
				0
					? 'bg-success-50 text-success-700'
					: delta < 0
						? 'bg-danger-50 text-danger-700'
						: 'bg-[var(--color-surface-2)] text-[var(--color-ink-500)]'}"
			>
				{delta > 0 ? '▲' : delta < 0 ? '▼' : '–'}
				{Math.abs(delta).toFixed(0)}%
			</span>
			<span class="truncate text-[10px] text-[var(--color-ink-400)]">{deltaLabel}</span>
		{:else}
			<span class="truncate text-[10px] text-[var(--color-ink-400)]">total berjalan</span>
		{/if}
		<div class="h-10 w-20 shrink-0 sm:w-24">
			<Sparkline data={spark} tone={sparkTone} />
		</div>
	</div>
</div>
