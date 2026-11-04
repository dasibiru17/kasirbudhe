/** Format angka menjadi Rupiah. */
export const formatIDR = formatRupiah;

export function formatRupiah(n) {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(Number(n) || 0);
}

/** Format tanggal ISO menjadi "18 Nov 2026". */
export function formatTanggal(iso) {
	return new Intl.DateTimeFormat('id-ID', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(new Date(iso));
}

/** Format tanggal + jam menjadi "18 Nov 2026, 14.30". */
export function formatTanggalJam(iso) {
	return new Intl.DateTimeFormat('id-ID', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(iso));
}
