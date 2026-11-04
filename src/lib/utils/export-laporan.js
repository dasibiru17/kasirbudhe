import { formatRupiah, formatTanggalJam } from './format.js';

/**
 * Util export Laporan Transaksi → PDF (via dialog print browser, pilih "Save as PDF")
 * dan Excel (file .xls berisi tabel HTML — bisa dibuka Excel/LibreOffice/Google Sheets).
 *
 * Laporan berisi per transaksi: waktu, item, omzet (total), modal (cost),
 * laba/rugi, serta ringkasan total di bagian bawah.
 */

/** @param {Array<any>} txs */
function hitungRingkasan(txs) {
	const omzet = txs.reduce((s, t) => s + (t.total || 0), 0);
	const modal = txs.reduce((s, t) => s + (t.cost || 0), 0);
	const laba = omzet - modal; // bisa negatif = rugi
	return { omzet, modal, laba, rugi: laba < 0 ? -laba : 0 };
}

/** @param {any} t */
function itemsText(t) {
	return (t.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ');
}

/**
 * Buka jendela print berisi laporan → user bisa "Save as PDF" atau print langsung.
 * @param {Array<any>} txs riwayat transaksi
 * @param {{ judul?: string }} [opts]
 */
export function exportPDF(txs, opts = {}) {
	const { omzet, modal, laba } = hitungRingkasan(txs);
	const judul = opts.judul || 'Laporan Transaksi Penjualan';
	const dicetak = formatTanggalJam(new Date().toISOString());

	const rows = txs
		.map(
			(t, i) => `
			<tr>
				<td>${i + 1}</td>
				<td>${formatTanggalJam(t.date)}</td>
				<td class="left">${itemsText(t)}</td>
				<td>${formatRupiah(t.total)}</td>
				<td>${formatRupiah(t.cost || 0)}</td>
				<td class="${(t.total || 0) - (t.cost || 0) >= 0 ? 'laba' : 'rugi'}">${formatRupiah((t.total || 0) - (t.cost || 0))}</td>
			</tr>`
		)
		.join('');

	const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${judul}</title>
<style>
	* { box-sizing: border-box; }
	body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 32px; font-size: 12px; }
	h1 { font-size: 20px; margin: 0; }
	.meta { color: #64748b; font-size: 11px; margin-top: 4px; }
	.ringkasan { display: flex; gap: 12px; margin: 20px 0; }
	.kartu { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
	.kartu .label { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: .4px; }
	.kartu .nilai { font-size: 16px; font-weight: 700; margin-top: 4px; }
	.laba { color: #059669; } .rugi { color: #dc2626; }
	table { width: 100%; border-collapse: collapse; margin-top: 8px; }
	th, td { border: 1px solid #e2e8f0; padding: 7px 9px; text-align: right; }
	th { background: #eef2ff; color: #3730a3; font-size: 10px; text-transform: uppercase; }
	td.left, th.left { text-align: left; }
	tfoot td { font-weight: 700; background: #f8fafc; }
	@media print { .no-print { display: none; } }
</style>
</head>
<body>
	<h1>${judul}</h1>
	<p class="meta">Dicetak: ${dicetak} — ${txs.length} transaksi</p>

	<div class="ringkasan">
		<div class="kartu"><div class="label">Total Omzet</div><div class="nilai">${formatRupiah(omzet)}</div></div>
		<div class="kartu"><div class="label">Total Modal (HPP)</div><div class="nilai">${formatRupiah(modal)}</div></div>
		<div class="kartu"><div class="label">${laba >= 0 ? 'Laba Bersih' : 'Rugi'}</div><div class="nilai ${laba >= 0 ? 'laba' : 'rugi'}">${formatRupiah(Math.abs(laba))}</div></div>
	</div>

	<table>
		<thead>
			<tr>
				<th>#</th><th>Waktu</th><th class="left">Item</th>
				<th>Omzet</th><th>Modal</th><th>Laba / Rugi</th>
			</tr>
		</thead>
		<tbody>${rows || '<tr><td colspan="6" class="left">Belum ada transaksi.</td></tr>'}</tbody>
		<tfoot>
			<tr><td colspan="3">TOTAL</td><td>${formatRupiah(omzet)}</td><td>${formatRupiah(modal)}</td>
			<td class="${laba >= 0 ? 'laba' : 'rugi'}">${formatRupiah(laba)}</td></tr>
		</tfoot>
	</table>

	<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

	const w = window.open('', '_blank', 'width=900,height=700');
	if (!w) {
		alert('Popup diblokir browser. Izinkan popup untuk mencetak laporan.');
		return;
	}
	w.document.write(html);
	w.document.close();
}

/**
 * Unduh laporan sebagai file Excel (.xls, format SpreadsheetML/HTML table).
 * @param {Array<any>} txs riwayat transaksi
 * @param {{ judul?: string }} [opts]
 */
export function exportExcel(txs, opts = {}) {
	const { omzet, modal, laba } = hitungRingkasan(txs);
	const judul = opts.judul || 'Laporan-Transaksi';
	const namaFile = `${judul}-${new Date().toISOString().slice(0, 10)}.xls`;

	const esc = (s) => String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
	const rows = txs
		.map(
			(t, i) => `
			<tr>
				<td>${i + 1}</td>
				<td>${esc(formatTanggalJam(t.date))}</td>
				<td>${esc(itemsText(t))}</td>
				<td>${t.total || 0}</td>
				<td>${t.cost || 0}</td>
				<td>${(t.total || 0) - (t.cost || 0)}</td>
			</tr>`
		)
		.join('');

	const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Laporan</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
<table border="1">
	<tr><th colspan="6">${esc(judul)}</th></tr>
	<tr><th>#</th><th>Waktu</th><th>Item</th><th>Omzet (Rp)</th><th>Modal (Rp)</th><th>Laba/Rugi (Rp)</th></tr>
	${rows || '<tr><td colspan="6">Belum ada transaksi.</td></tr>'}
	<tr><td colspan="3"><b>TOTAL</b></td><td><b>${omzet}</b></td><td><b>${modal}</b></td><td><b>${laba}</b></td></tr>
</table>
</body></html>`;

	const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = namaFile;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
