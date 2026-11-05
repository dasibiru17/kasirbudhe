<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fly, fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { session, login, registerAccount } from '$lib/stores/auth.js';
	import { supabase } from '$lib/db-config.js';
	import { panduanTab } from '$lib/stores/ui.js';

	let mode = $state('login'); // 'login' | 'register'
	let identifier = $state('');
	let password = $state('');
	let showPw = $state(false);
	let error = $state('');
	let successMsg = $state('');
	let loading = $state(false);

	// Form registrasi mandiri
	let reg = $state({
		username: '',
		name: '',
		role: 'kasir',
		email: '',
		phone: '',
		password: ''
	});
	let regShowPw = $state(false);

	// Akun demo hanya berlaku saat aplikasi berjalan tanpa database cloud.
	// Di mode cloud password diverifikasi Supabase Auth, jadi akun demo tidak bisa dipakai.
	const demoAvailable = !supabase;

	const redirect = $derived(page.url.searchParams.get('redirect') || '/');

	function fillDemo(u, p) {
		mode = 'login';
		identifier = u;
		password = p;
		error = '';
		successMsg = '';
	}

	async function submit(e) {
		e.preventDefault();
		if (loading) return;
		error = '';
		successMsg = '';
		loading = true;
		// Jeda kecil agar animasi loading sempat terlihat
		await new Promise((r) => setTimeout(r, 300));
		const res = await login(identifier, password);
		loading = false;
		if (res.ok) {
			// Setelah masuk, selalu mendarat di menu gabungan (Dashboard + Panduan).
			// Redirect yang tersimpan hanya dipakai bila mengarah ke halaman lain.
			const tujuan = redirect && redirect !== '/' ? redirect : '/';
			if (tujuan === '/') panduanTab.set('beranda');
			goto(tujuan);
		} else {
			error = res.reason || 'Gagal masuk.';
		}
	}

	async function submitRegister(e) {
		e.preventDefault();
		if (loading) return;
		error = '';
		successMsg = '';
		loading = true;
		await new Promise((r) => setTimeout(r, 300));
		const res = await registerAccount(reg);
		loading = false;
		if (res.ok) {
			successMsg = `Permohonan akun "${reg.username.trim().toLowerCase()}" berhasil dikirim! Akun Anda sedang menunggu verifikasi/persetujuan dari pemilik toko sebelum dapat digunakan untuk masuk.`;
			identifier = reg.username.trim().toLowerCase();
			reg = {
				username: '',
				name: '',
				role: 'kasir',
				email: '',
				phone: '',
				password: ''
			};
			mode = 'login';
		} else {
			error = res.reason || 'Gagal mendaftar akun.';
		}
	}
</script>

<svelte:head>
	<title>Masuk — Mini POS Toko Sejahtera</title>
</svelte:head>

<div class="grid min-h-screen font-sans lg:grid-cols-2">
	<!-- ============ PANEL KIRI: branding ============ -->
	<div
		class="from-brand-600 via-brand-700 to-brand-900 relative hidden overflow-hidden bg-linear-to-br lg:flex lg:flex-col lg:justify-between lg:p-12"
	>
		<!-- Dekorasi: lingkaran blur + pola grid -->
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			<div class="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"></div>
			<div
				class="absolute -right-20 -bottom-24 h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl"
			></div>
			<div
				class="absolute inset-0 opacity-[0.15]"
				style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 22px 22px;"
			></div>
		</div>

		<div
			class="relative flex items-center gap-3"
			in:fly={{ y: -16, duration: 500, easing: quintOut }}
		>
			<div
				class="text-brand-700 grid h-11 w-11 place-items-center rounded-xl bg-white text-xl font-bold shadow-lg"
			>
				K
			</div>
			<div>
				<p class="text-base font-bold text-white">Toko Sejahtera</p>
				<p class="text-brand-200 text-xs">Mini POS & Bookkeeping</p>
			</div>
		</div>

		<div class="relative max-w-md" in:fly={{ y: 24, duration: 600, delay: 100, easing: quintOut }}>
			<p class="text-brand-200 text-xs font-bold tracking-[0.2em] uppercase">
				Selamat datang kembali
			</p>
			<h1 class="mt-3 text-4xl leading-tight font-extrabold tracking-tight text-white">
				Kelola toko<br />lebih cepat & rapi.
			</h1>
			<p class="text-brand-100 mt-4 text-sm leading-relaxed">
				Satu pintu masuk ke kasir, stok produk, dan laporan keuangan tokomu — semua tersimpan
				otomatis dan bisa jalan offline.
			</p>

			<ul class="mt-8 space-y-4">
				{#each [['🛒', 'Kasir kilat', 'Transaksi + nota cetak dalam hitungan detik'], ['📦', 'Stok terkontrol', 'Peringatan otomatis saat stok menipis'], ['📒', 'Laporan jelas', 'Omzet, modal & laba — export PDF/Excel']] as [icon, judul, deskripsi] (judul)}
					<li class="flex items-center gap-4">
						<span
							class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl backdrop-blur-sm"
							>{icon}</span
						>
						<span>
							<span class="block text-sm font-bold text-white">{judul}</span>
							<span class="text-brand-200 block text-xs">{deskripsi}</span>
						</span>
					</li>
				{/each}
			</ul>
		</div>

		<p class="text-brand-200/80 relative text-xs" in:fade={{ delay: 400 }}>
			v1.1 — design by Dasi.biru17
		</p>
	</div>

	<!-- ============ PANEL KANAN: form ============ -->
	<div class="bg-surface-1 flex items-center justify-center p-6 sm:p-10">
		<div class="w-full max-w-md" in:scale={{ start: 0.96, duration: 400, easing: quintOut }}>
			<!-- Logo untuk mobile -->
			<div class="mb-8 flex items-center gap-3 lg:hidden">
				<div
					class="bg-brand-600 grid h-10 w-10 place-items-center rounded-xl text-lg font-bold text-white"
				>
					K
				</div>
				<div>
					<p class="text-ink-900 text-sm font-bold">Toko Sejahtera</p>
					<p class="text-ink-400 text-xs">Mini POS & Bookkeeping</p>
				</div>
			</div>

			<!-- Tab Pilihan: Masuk vs Buat Akun -->
			<div
				class="mt-4 flex rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1"
			>
				<button
					type="button"
					class="flex-1 rounded-lg py-2 text-xs font-bold transition-all
						{mode === 'login'
						? 'text-brand-700 bg-[var(--color-surface-0)] shadow-xs'
						: 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]'}"
					onclick={() => {
						mode = 'login';
						error = '';
						successMsg = '';
					}}
				>
					🔑 Masuk Akun
				</button>
				<button
					type="button"
					class="flex-1 rounded-lg py-2 text-xs font-bold transition-all
						{mode === 'register'
						? 'text-brand-700 bg-[var(--color-surface-0)] shadow-xs'
						: 'text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]'}"
					onclick={() => {
						mode = 'register';
						error = '';
						successMsg = '';
					}}
				>
					➕ Buat Akun Baru
				</button>
			</div>

			{#if successMsg}
				<div
					class="border-success-200 bg-success-50 text-success-800 mt-4 rounded-xl border p-4 text-xs font-medium"
					in:fly={{ y: -8, duration: 250 }}
				>
					<p class="text-success-900 font-bold">✅ Permohonan Terkirim!</p>
					<p class="mt-1 leading-relaxed">{successMsg}</p>
					<p class="text-success-700 mt-2 text-[11px]">
						💡 <i
							>Admin/pemilik toko dapat langsung menyetujui akun Anda di menu <b>Kelola Pengguna</b
							>.</i
						>
					</p>
				</div>
			{/if}

			{#if mode === 'login'}
				<h2 class="text-h1 mt-6">Masuk ke aplikasi</h2>
				<p class="text-body mt-1">Masuk dengan username, email, atau no. HP dan password tokomu.</p>

				<form class="card mt-6 space-y-4 p-6" onsubmit={submit}>
					<div>
						<label
							class="text-caption mb-1.5 block font-bold tracking-wide uppercase"
							for="identifier">Username / Email / No. HP</label
						>
						<input
							id="identifier"
							type="text"
							autocomplete="username"
							placeholder="cth: admin atau admin@tokosejahtera.id"
							class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none focus:ring-2"
							bind:value={identifier}
						/>
					</div>

					<div>
						<label
							class="text-caption mb-1.5 block font-bold tracking-wide uppercase"
							for="password">Password</label
						>
						<div class="relative">
							<input
								id="password"
								type={showPw ? 'text' : 'password'}
								autocomplete="current-password"
								placeholder="••••••••"
								class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-4 py-2.5 pr-12 text-sm transition-colors outline-none focus:ring-2"
								bind:value={password}
							/>
							<button
								type="button"
								class="text-ink-400 hover:text-ink-700 absolute inset-y-0 right-0 px-3.5 text-sm transition-colors"
								onclick={() => (showPw = !showPw)}
								aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
							>
								{showPw ? '🙈' : '👁'}
							</button>
						</div>
					</div>

					{#if error}
						{#key error}
							<p
								class="border-danger-200 bg-danger-50 text-danger-700 rounded-lg border px-3.5 py-2.5 text-xs font-semibold"
								in:fly={{ x: -12, duration: 250 }}
							>
								⚠️ {error}
							</p>
						{/key}
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="btn-press bg-brand-600 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
					>
						{#if loading}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
							></span>
							Memeriksa…
						{:else}
							Masuk →
						{/if}
					</button>
				</form>

				<!-- Akun demo: hanya tersedia di mode lokal/offline -->
				{#if !demoAvailable}
					<div
						class="border-line text-ink-500 mt-5 rounded-xl border bg-[var(--color-surface-2)] p-3.5 text-center text-[11px] leading-relaxed"
					>
						🔐 Masuk memakai <b>email</b> dan password yang terdaftar di server. Akun demo (admin/
						kasir) hanya berlaku saat aplikasi berjalan dalam mode lokal tanpa database.
					</div>
				{:else}
				<div class="mt-5">
					<p class="text-caption mb-2 text-center">Coba langsung — klik salah satu akun demo:</p>
					<div class="grid grid-cols-2 gap-3">
						<button
							class="btn-press card hover:border-brand-300 p-3.5 text-left transition-colors"
							onclick={() => fillDemo('admin', 'admin123')}
						>
							<p class="text-ink-800 text-sm font-bold">👑 Pemilik</p>
							<p class="text-caption mt-0.5 font-mono">user: admin</p>
							<p class="text-caption mt-0.5 font-mono">pass: admin123</p>
							<p class="text-caption text-success-600 mt-1">Akses semua halaman</p>
						</button>
						<button
							class="btn-press card hover:border-brand-300 p-3.5 text-left transition-colors"
							onclick={() => fillDemo('kasir', 'kasir123')}
						>
							<p class="text-ink-800 text-sm font-bold">🧾 Kasir</p>
							<p class="text-caption mt-0.5 font-mono">user: kasir</p>
							<p class="text-caption mt-0.5 font-mono">pass: kasir123</p>
							<p class="text-caption text-warning-600 mt-1">Tanpa halaman laporan</p>
						</button>
					</div>
				</div>
				{/if}
			{:else}
				<!-- Mode Buat Akun Sendiri (Perlu Persetujuan Pembuat/Pemilik) -->
				<h2 class="text-h1 mt-6">Daftar Akun Baru</h2>
				<p class="text-body mt-1">
					Buat akun baru. Akun pertama menjadi pemilik toko; akun berikutnya menunggu persetujuan
					pemilik.
				</p>

				<form class="card mt-6 space-y-4 p-6" onsubmit={submitRegister}>
					<div class="border-brand-200 bg-brand-50 text-brand-800 rounded-lg border p-3 text-xs">
						🛡️ <b>Mode Pengawasan:</b> Setiap akun yang didaftarkan mandiri berstatus
						<i>Menunggu Persetujuan</i> sampai dikonfirmasi oleh pemilik toko.
					</div>

					<div>
						<label
							class="text-caption mb-1.5 block font-bold tracking-wide uppercase"
							for="reg-username">Username *</label
						>
						<input
							id="reg-username"
							type="text"
							required
							placeholder="cth: kasir_budi (3-20 huruf/angka)"
							class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none focus:ring-2"
							bind:value={reg.username}
						/>
					</div>

					<div>
						<label
							class="text-caption mb-1.5 block font-bold tracking-wide uppercase"
							for="reg-name">Nama Lengkap *</label
						>
						<input
							id="reg-name"
							type="text"
							required
							placeholder="cth: Budi Setiawan"
							class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none focus:ring-2"
							bind:value={reg.name}
						/>
					</div>

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label
								class="text-caption mb-1.5 block font-bold tracking-wide uppercase"
								for="reg-email">Email (opsional)</label
							>
							<input
								id="reg-email"
								type="email"
								placeholder="nama@email.id"
								class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none focus:ring-2"
								bind:value={reg.email}
							/>
						</div>
						<div>
							<label
								class="text-caption mb-1.5 block font-bold tracking-wide uppercase"
								for="reg-phone">No. HP (opsional)</label
							>
							<input
								id="reg-phone"
								type="tel"
								placeholder="0812…"
								class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none focus:ring-2"
								bind:value={reg.phone}
							/>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label
								class="text-caption mb-1.5 block font-bold tracking-wide uppercase"
								for="reg-role">Peran Akun</label
							>
							<select
								id="reg-role"
								class="border-ink-300 bg-surface focus:border-brand-500 w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
								bind:value={reg.role}
							>
								<option value="kasir">🧾 Kasir (POS)</option>
								<option value="pemilik">👑 Pemilik Toko</option>
							</select>
						</div>
						<div>
							<label
								class="text-caption mb-1.5 block font-bold tracking-wide uppercase"
								for="reg-pass">Password *</label
							>
							<div class="relative">
								<input
									id="reg-pass"
									type={regShowPw ? 'text' : 'password'}
									minlength="6"
									required
									placeholder="min. 6 karakter"
									class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm transition-colors outline-none focus:ring-2"
									bind:value={reg.password}
								/>
								<button
									type="button"
									class="text-ink-400 hover:text-ink-700 absolute inset-y-0 right-0 px-3 text-sm transition-colors"
									onclick={() => (regShowPw = !regShowPw)}
									aria-label={regShowPw ? 'Sembunyikan password' : 'Tampilkan password'}
								>
									{regShowPw ? '🙈' : '👁'}
								</button>
							</div>
						</div>
					</div>

					{#if error}
						{#key error}
							<p
								class="border-danger-200 bg-danger-50 text-danger-700 rounded-lg border px-3.5 py-2.5 text-xs font-semibold"
								in:fly={{ x: -12, duration: 250 }}
							>
								⚠️ {error}
							</p>
						{/key}
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="btn-press bg-brand-600 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
					>
						{#if loading}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
							></span>
							Mendaftarkan…
						{:else}
							Ajukan Pendaftaran Akun →
						{/if}
					</button>

					<p class="text-caption text-center">
						Sudah punya akun?
						<button
							type="button"
							class="text-brand-600 font-bold hover:underline"
							onclick={() => {
								mode = 'login';
								error = '';
							}}
						>
							Masuk di sini
						</button>
					</p>
				</form>
			{/if}
		</div>
	</div>
</div>
