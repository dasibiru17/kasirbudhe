<script>
	/**
	 * NotaModal — popup struk/nota setelah transaksi berhasil.
	 * Menampilkan detail item, total, uang bayar, dan kembalian,
	 * lengkap dengan tombol "Cetak Nota" (print / Save as PDF).
	 *
	 * @type {{
	 *   open: boolean,
	 *   tx?: { id: string, date: string, items: Array<{ name: string, price: number, qty: number }>, total: number, paid: number, change: number } | null,
	 *   onclose?: () => void
	 * }}
	 */
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatRupiah, formatTanggalJam } from '$lib/utils/format.js';

	let { open = false, tx = null, onclose = () => {} } = $props();
	const close = () => onclose();

	/** @param {KeyboardEvent} e */
	function handleKey(e) {
		if (open && e.key === 'Escape') close();
	}

	/** Cetak nota: buka jendela print berisi struk thermal-style. */
	function cetak() {
		if (!tx) return;
		const rows = tx.items
			.map(
				(i) => `
				<tr>
					<td class="left">${i.name}<br /><span class="qty">${i.qty} × ${formatRupiah(i.price)}</span></td>
					<td class="right">${formatRupiah(i.qty * i.price)}</td>
				</tr>`
			)
			.join('');

		const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Nota ${tx.id}</title>
<style>
	* { box-sizing: border-box; }
	body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; margin: 0; padding: 16px; width: 300px; }
	h1 { font-size: 15px; text-align: center; margin: 0 0 2px; letter-spacing: 2px; }
	.sub { text-align: center; font-size: 10px; margin-bottom: 10px; }
	.garis { border-top: 1px dashed #000; margin: 8px 0; }
	table { width: 100%; border-collapse: collapse; }
	td { padding: 2px 0; vertical-align: top; }
	td.left { text-align: left; } td.right { text-align: right; white-space: nowrap; }
	.qty { font-size: 10px; color: #444; }
	tfoot td { font-weight: bold; padding-top: 4px; }
	.footer { text-align: center; font-size: 10px; margin-top: 12px; }
	@media print { body { width: auto; margin: 0; } }
</style>
</head>
<body>
	<h1>NOTA PENJUALAN</h1>
	<p class="sub">No: ${tx.id}<br />${formatTanggalJam(tx.date)}</p>
	<div class="garis"></div>
	<table>
		<tbody>${rows}</tbody>
		<tfoot>
			<tr><td class="left">TOTAL</td><td class="right">${formatRupiah(tx.total)}</td></tr>
			<tr><td class="left">BAYAR</td><td class="right">${formatRupiah(tx.paid)}</td></tr>
			<tr><td class="left">KEMBALIAN</td><td class="right">${formatRupiah(tx.change)}</td></tr>
		</tfoot>
	</table>
	<div class="garis"></div>
	<p class="footer">Terima kasih telah berbelanja!<br />Barang yang sudah dibeli tidak dapat ditukar.</p>
	<script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
</body>
</html>`;

		const w = window.open('', '_blank', 'width=380,height=640');
		if (!w) {
			alert('Popup diblokir browser. Izinkan popup untuk mencetak nota.');
			return;
		}
		w.document.write(html);
		w.document.close();
	}
</script>

<svelte:window onkeydown={handleKey} />

{#if open && tx}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
		onclick={close}
		aria-label="Tutup"
	></button>

	<!-- Panel nota -->
	<div
		class="fixed inset-x-0 top-1/2 z-50 mx-auto w-[92%] max-w-sm -translate-y-1/2"
		transition:scale={{ start: 0.85, duration: 350, easing: quintOut }}
		role="dialog"
		aria-modal="true"
	>
		<div class="card overflow-hidden shadow-2xl">
			<!-- Strip atas hijau -->
			<div class="bg-success-500 h-2"></div>

			<div class="flex flex-col items-center gap-3 p-6">
				<div
					class="bg-success-100 text-success-600 grid h-14 w-14 place-items-center rounded-full text-2xl"
					in:fade={{ duration: 300, delay: 200 }}
				>
					✓
				</div>

				<h2 class="text-h2">Transaksi Berhasil</h2>

				<!-- Struk -->
				<div class="border-line bg-surface-alt w-full rounded-lg border p-4 text-sm">
					<p class="text-caption text-center">
						Nota #{tx.id} · {formatTanggalJam(tx.date)}
					</p>

					<ul class="divide-line mt-3 divide-y">
						{#each tx.items as i (i.name)}
							<li class="flex items-start justify-between gap-2 py-1.5">
								<div class="min-w-0">
									<p class="text-ink-800 truncate text-xs font-semibold">{i.name}</p>
									<p class="text-caption tabular-nums">{i.qty} × {formatRupiah(i.price)}</p>
								</div>
								<span class="text-xs font-bold tabular-nums">{formatRupiah(i.qty * i.price)}</span>
							</li>
						{/each}
					</ul>

					<div class="border-line mt-2 space-y-1.5 border-t pt-3">
						<div class="flex justify-between text-xs">
							<span class="text-caption">Total</span>
							<span class="font-bold tabular-nums">{formatRupiah(tx.total)}</span>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-caption">Bayar</span>
							<span class="font-bold tabular-nums">{formatRupiah(tx.paid)}</span>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-caption">Kembalian</span>
							<span class="text-success-600 font-bold tabular-nums">{formatRupiah(tx.change)}</span>
						</div>
					</div>
				</div>

				<button
					class="btn-press border-line bg-surface-2 text-ink-800 w-full rounded-lg border py-2.5 text-sm font-bold"
					onclick={cetak}
				>
					🖨 Cetak Nota
				</button>
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
