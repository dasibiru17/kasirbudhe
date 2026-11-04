<script>
	/**
	 * SuccessModal — popup "Transaksi Berhasil" dengan animasi:
	 *  - backdrop: fade
	 *  - panel: pop (scale + translateY) dengan easing bouncy
	 *  - ikon centang: fade + delay agar muncul setelah panel
	 *
	 * @type {{ open: boolean, total?: number, change?: number, onclose?: (id?: any) => void }}
	 */
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let { open = false, total = 0, change = 0, onclose = () => {} } = $props();
	const close = () => onclose();

	import { formatIDR } from '$lib/utils/format';

	/** @param {KeyboardEvent} e */
	function handleKey(e) {
		if (open && e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKey} />

{#if open}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
		onclick={close}
		aria-label="Tutup"
	></button>

	<!-- Panel -->
	<div
		class="fixed inset-x-0 top-1/2 z-50 mx-auto w-[92%] max-w-sm -translate-y-1/2"
		transition:scale={{ start: 0.85, duration: 350, easing: quintOut }}
		role="dialog"
		aria-modal="true"
	>
		<div class="card overflow-hidden text-center shadow-2xl">
			<!-- Strip atas hijau -->
			<div class="bg-success-500 h-2"></div>

			<div class="flex flex-col items-center gap-3 p-6">
				<!-- Ikon centang -->
				<div
					class="bg-success-100 text-success-600 grid h-16 w-16 place-items-center rounded-full text-3xl"
					in:fade={{ duration: 300, delay: 200 }}
				>
					✓
				</div>

				<h2 class="text-h2">Transaksi Berhasil</h2>

				<div class="w-full space-y-2 rounded-lg bg-[var(--color-surface-2)] p-4 text-sm">
					<div class="flex justify-between">
						<span class="text-caption">Total Tagihan</span>
						<span class="font-bold tabular-nums">{formatIDR(total)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-caption">Kembalian</span>
						<span class="text-success-600 font-bold tabular-nums">{formatIDR(change)}</span>
					</div>
				</div>

				<button
					class="btn-press bg-brand-600 w-full rounded-lg py-3 text-sm font-bold text-white"
					onclick={close}
				>
					Selesai
				</button>
			</div>
		</div>
	</div>
{/if}
