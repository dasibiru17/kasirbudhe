// qa-styleguide.mjs — QA halaman /styleguide + alur interaksi komponen UI
export default async function run(page, ui) {
	await page.goto('http://localhost:5174/styleguide', { waitUntil: 'networkidle' });
	const hasil = {};

	// Judul & konten styleguide terender
	hasil.judul = await page.evaluate(() => document.querySelector('h1')?.innerText);
	hasil.bagian = await page.evaluate(() =>
		[...document.querySelectorAll('h2')].map((h) => h.innerText.replace(/\s+/g, ' '))
	);

	// AnimatedNumber: klik +5000 → angka harus bertambah (verifikasi teks berubah)
	const angkaSebelum = await page.evaluate(
		() => document.querySelector('[data-testid=animated-counter]')?.innerText
	);
	await page.locator('button:has-text("+ 5.000")').click();
	await page.waitForTimeout(1200); // tunggu spring selesai
	const angkaSesudah = await page.evaluate(
		() => document.querySelector('[data-testid=animated-counter]')?.innerText
	);
	hasil.counter = { angkaSebelum, angkaSesudah, berubah: angkaSebelum !== angkaSesudah };

	// ProductCard: klik kartu produk pertama → CartItem slide masuk
	const kartuSebelum = await page.locator('button:has-text("Tambah ke Keranjang")').count();
	await page.locator('button:has-text("Tambah ke Keranjang")').first().click();
	await page.waitForTimeout(600);
	const itemKeranjang = await page.locator('button[aria-label="Hapus item"]').count();
	hasil.productCard = { tombolTambah: kartuSebelum, itemDiKeranjang: itemKeranjang };

	// SuccessModal: klik "Bayar Sekarang" → modal pop muncul
	await page.locator('button:has-text("Bayar Sekarang")').click();
	await page.waitForTimeout(600);
	hasil.modal = {
		muncul: await page.evaluate(() => document.body.innerText.includes('Transaksi Berhasil')),
		adaKembalian: await page.evaluate(() => document.body.innerText.includes('Total Tagihan'))
	};
	await page.locator('button:has-text("Selesai")').click();
	await page.waitForTimeout(500);
	hasil.modal.tutupBerfungsi = await page.evaluate(
		() => !document.body.innerText.includes('Transaksi Berhasil')
	);

	// Dark mode toggle di sidebar
	await page.locator('button:has-text("Mode Gelap")').click();
	await page.waitForTimeout(400);
	hasil.darkMode = {
		aktif: await page.evaluate(() => document.documentElement.classList.contains('dark')),
		tersimpan: await page.evaluate(() => localStorage.getItem('pos-kasir:theme'))
	};
	// Kembalikan ke light
	await page.locator('button:has-text("Mode Terang")').click();
	await page.waitForTimeout(300);

	return hasil;
}

