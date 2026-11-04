// File: pos-kasir/qa.mjs — QA end-to-end alur kasir → laporan → stok
export default async function run(page, ui) {
	// 1. Dashboard
	await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
	const dashboard = await page.evaluate(() => document.body.innerText.slice(0, 400));

	// 2. Produk — catat stok awal
	await page.goto('http://localhost:5174/produk', { waitUntil: 'networkidle' });
	const stokAwal = await page.evaluate(() => {
		const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('Beras Premium'));
		return row ? row.innerText.match(/(\d+)\s*unit/)?.[1] : null;
	});

	// 3. Kasir — pilih produk pertama, cek keranjang
	await page.goto('http://localhost:5174/kasir', { waitUntil: 'networkidle' });
	const tombolProduk = page.locator('button:has-text("Beras Premium")').first();
	await tombolProduk.click();
	await page.waitForTimeout(400);
	const keranjangIsi = await page.evaluate(() => document.body.innerText.includes('Keranjang'));
	const totalMuncul = await page.evaluate(() => /Total \d+ item/.test(document.body.innerText));
	const totalText = await page.evaluate(() => {
		const m = document.body.innerText.match(/Rp\s?[\d.]+/g);
		return m ? m[m.length - 1] : null;
	});

	// 4. Bayar → isi uang → selesaikan
	await page.locator('button:has-text("Bayar Sekarang")').click();
	await page.waitForTimeout(400);
	await page.locator('#dibayar').fill('100000');
	await page.waitForTimeout(300);
	const kembalian = await page.evaluate(() => {
		const m = document.body.innerText.match(/Kembalian[\s\S]{0,20}(Rp\s?[\d.]+)/);
		return m ? m[1] : null;
	});
	await page.locator('button:has-text("Selesaikan Transaksi")').click();
	await page.waitForTimeout(800);

	// 5. Laporan — transaksi harus tercatat
	await page.goto('http://localhost:5174/laporan', { waitUntil: 'networkidle' });
	const laporanAdaRiwayat = await page.evaluate(
		() =>
			document.body.innerText.includes('Riwayat Transaksi Penjualan') &&
			!document.body.innerText.includes('Belum ada transaksi.')
	);
	const omzetLaporan = await page.evaluate(() => {
		const m = document.body.innerText.match(/Total Omzet \(Kas Masuk\)\s*\n?\s*(Rp\s?[\d.]+)/);
		return m ? m[1] : null;
	});

	// 6. Stok produk berkurang setelah checkout
	await page.goto('http://localhost:5174/produk', { waitUntil: 'networkidle' });
	const stokSetelah = await page.evaluate(() => {
		const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes('Beras Premium'));
		return row ? row.innerText.match(/(\d+)\s*unit/)?.[1] : null;
	});

	// 7. localStorage persist
	const localStorageKeys = await page.evaluate(() =>
		Object.keys(localStorage).filter((k) => k.startsWith('pos-kasir'))
	);

	return {
		stokAwal,
		stokSetelah,
		kurang: stokAwal !== null && stokSetelah !== null && Number(stokAwal) - Number(stokSetelah) === 1,
		keranjangIsi,
		totalMuncul,
		totalKasir: totalText,
		kembalian,
		laporanAdaRiwayat,
		omzetLaporan,
		localStorageKeys,
		dashboard: dashboard.replace(/\s+/g, ' ').slice(0, 200)
	};
}
