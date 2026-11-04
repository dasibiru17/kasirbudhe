<script>
	import { fly } from 'svelte/transition';
	import {
		users,
		session,
		addUser,
		updateUser,
		resetPassword,
		removeUser,
		approveUser,
		rejectUser
	} from '$lib/stores/auth.js';

	// Hanya pemilik yang boleh buka halaman ini (dijaga juga oleh layout)
	const isOwner = $derived($session?.role !== 'kasir');

	const pendingUsers = $derived($users.filter((u) => u.status === 'menunggu'));
	const activeUsers = $derived($users.filter((u) => u.status !== 'menunggu'));

	// ---------- Form tambah user ----------
	let fu = $state({ username: '', name: '', role: 'kasir', email: '', phone: '', password: '' });
	let showPw = $state(false);
	let msg = $state({ type: '', text: '' });

	/** @param {string} type @param {string} text */
	function notify(type, text) {
		msg = { type, text };
		if (type === 'ok') setTimeout(() => (msg = { type: '', text: '' }), 3000);
	}

	/** @param {{ username: string, name: string, role: string, email?: string, phone?: string }} u */
	function toggleEdit(u) {
		if (editing === u.username) {
			editing = null;
		} else {
			startEdit(u);
		}
	}

	/** @param {string} username */
	function togglePw(username) {
		pwTarget = pwTarget === username ? null : username;
		pwBaru = '';
	}

	/** @param {SubmitEvent} e */
	async function submitAdd(e) {
		e.preventDefault();
		const res = await addUser(fu);
		if (res.ok) {
			notify('ok', `✅ Pengguna "${fu.username.trim().toLowerCase()}" berhasil ditambahkan.`);
			fu = { username: '', name: '', role: 'kasir', email: '', phone: '', password: '' };
		} else {
			notify('err', `⚠️ ${res.reason}`);
		}
	}

	// ---------- Edit user ----------
	/** @type {string|null} */
	let editing = $state(null); // username yang sedang diedit
	let fe = $state({ name: '', role: 'kasir', email: '', phone: '' });

	/** @param {{ username: string, name: string, role: string, email?: string, phone?: string }} u */
	function startEdit(u) {
		editing = u.username;
		fe = { name: u.name, role: u.role, email: u.email || '', phone: u.phone || '' };
		msg = { type: '', text: '' };
	}

	/** @param {SubmitEvent} e @param {string} username */
	async function submitEdit(e, username) {
		e.preventDefault();
		const res = await updateUser(username, fe);
		if (res.ok) {
			notify('ok', `✅ Data "${username}" diperbarui.`);
			editing = null;
		} else {
			notify('err', `⚠️ ${res.reason}`);
		}
	}

	// ---------- Reset password ----------
	/** @type {string|null} */
	let pwTarget = $state(null);
	let pwBaru = $state('');

	/** @param {SubmitEvent} e @param {string} username */
	async function submitReset(e, username) {
		e.preventDefault();
		const res = await resetPassword(username, pwBaru);
		if (res.ok) {
			notify('ok', `✅ Password "${username}" berhasil direset.`);
			pwTarget = null;
			pwBaru = '';
		} else {
			notify('err', `⚠️ ${res.reason}`);
		}
	}

	/** @param {string} username @param {string} name */
	async function hapus(username, name) {
		if (confirm(`Hapus pengguna "${name}" (@${username})? Tidak bisa dikembalikan.`)) {
			const res = await removeUser(username);
			notify(
				res.ok ? 'ok' : 'err',
				res.ok ? `🗑 Pengguna "${username}" dihapus.` : `⚠️ ${res.reason}`
			);
		}
	}

	/** @param {string} role */
	function badge(role) {
		return role === 'kasir' ? 'bg-warning-100 text-warning-700' : 'bg-brand-100 text-brand-700';
	}
</script>

<svelte:head>
	<title>Kelola Pengguna — Mini POS</title>
</svelte:head>

{#if isOwner}
	<section>
		<h1 class="text-ink-800 text-2xl font-bold">Kelola Pengguna</h1>
		<p class="text-ink-500 mt-1 text-sm">
			Tambah akun kasir/pemilik baru. Login bisa memakai <b>username</b>, <b>email</b>, atau
			<b>no. HP</b>.
		</p>

		{#if msg.text}
			<p
				class="mt-4 rounded-lg border px-4 py-2.5 text-xs font-semibold {msg.type === 'ok'
					? 'border-success-200 bg-success-50 text-success-700'
					: 'border-danger-200 bg-danger-50 text-danger-700'}"
				in:fly={{ x: -12, duration: 250 }}
			>
				{msg.text}
			</p>
		{/if}

		<!-- ============ SECTION PENGAWASAN: PERMOHONAN AKUN BARU ============ -->
		{#if pendingUsers.length > 0}
			<div class="border-warning-300 bg-warning-50/70 mt-6 rounded-2xl border-2 p-5 shadow-sm">
				<div class="flex items-center justify-between gap-3">
					<div>
						<h2 class="text-h3 text-warning-900 flex items-center gap-2">
							<span
								class="bg-warning-500 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white"
							>
								{pendingUsers.length}
							</span>
							Permohonan Akun Baru (Menunggu Pengawasan)
						</h2>
						<p class="text-caption text-warning-700 mt-1">
							Pengguna berikut mendaftar secara mandiri melalui menu login dan memerlukan
							persetujuan pemilik sebelum bisa masuk.
						</p>
					</div>
				</div>

				<ul
					class="divide-warning-200 border-warning-200 bg-surface mt-4 divide-y rounded-xl border"
				>
					{#each pendingUsers as pu (pu.username)}
						<li class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
							<div class="flex items-center gap-3">
								<div
									class="bg-warning-500 grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
								>
									{(pu.name || pu.username).trim().charAt(0).toUpperCase()}
								</div>
								<div>
									<p class="text-ink-800 text-sm font-bold">
										{pu.name}
										<span
											class="bg-warning-100 text-warning-800 ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
										>
											{pu.role === 'kasir' ? '🧾 Kasir' : '👑 Pemilik'}
										</span>
										<span
											class="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
										>
											⏳ Menunggu Persetujuan
										</span>
									</p>
									<p class="text-caption mt-0.5 font-mono">
										@{pu.username}{pu.email ? ` · ✉️ ${pu.email}` : ''}{pu.phone
											? ` · 📱 ${pu.phone}`
											: ''}
									</p>
								</div>
							</div>

							<div class="flex items-center gap-2 self-end sm:self-auto">
								<button
									type="button"
									class="btn-press bg-success-600 hover:bg-success-700 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white transition-colors"
									onclick={() => {
										approveUser(pu.username);
										notify('ok', `✅ Akun "${pu.username}" berhasil disetujui dan kini aktif!`);
									}}
								>
									✓ Setujui & Aktifkan
								</button>
								<button
									type="button"
									class="border-danger-200 text-danger-600 hover:bg-danger-50 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors"
									onclick={() => {
										rejectUser(pu.username);
										notify('err', `🚫 Permohonan akun "${pu.username}" ditolak.`);
									}}
								>
									✕ Tolak
								</button>
								<button
									type="button"
									class="border-line text-ink-400 hover:text-danger-600 rounded-lg border px-2.5 py-1.5 text-xs"
									title="Hapus permohonan"
									onclick={() => hapus(pu.username, pu.name)}
								>
									🗑
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- ============ FORM TAMBAH ============ -->
			<form class="card h-fit p-5" onsubmit={submitAdd}>
				<h2 class="text-h3 mb-1">➕ Tambah Pengguna</h2>
				<p class="text-caption mb-4">Isi data akun baru di bawah ini.</p>

				<div class="space-y-3">
					<div>
						<label
							class="text-caption mb-1 block font-bold tracking-wide uppercase"
							for="u-username">Username *</label
						>
						<input
							id="u-username"
							class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
							placeholder="cth: kasir2"
							bind:value={fu.username}
						/>
					</div>
					<div>
						<label class="text-caption mb-1 block font-bold tracking-wide uppercase" for="u-name"
							>Nama Lengkap *</label
						>
						<input
							id="u-name"
							class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
							placeholder="cth: Budi Kasir"
							bind:value={fu.name}
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="text-caption mb-1 block font-bold tracking-wide uppercase" for="u-email"
								>Email</label
							>
							<input
								id="u-email"
								type="email"
								class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
								placeholder="nama@email.id"
								bind:value={fu.email}
							/>
						</div>
						<div>
							<label class="text-caption mb-1 block font-bold tracking-wide uppercase" for="u-phone"
								>No. HP</label
							>
							<input
								id="u-phone"
								type="tel"
								inputmode="tel"
								class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
								placeholder="08xx…"
								bind:value={fu.phone}
							/>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="text-caption mb-1 block font-bold tracking-wide uppercase" for="u-role"
								>Peran</label
							>
							<select
								id="u-role"
								class="border-ink-300 bg-surface focus:border-brand-500 w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
								bind:value={fu.role}
							>
								<option value="kasir">🧾 Kasir</option>
								<option value="pemilik">👑 Pemilik</option>
							</select>
						</div>
						<div>
							<label class="text-caption mb-1 block font-bold tracking-wide uppercase" for="u-pass"
								>Password *</label
							>
							<input
								id="u-pass"
								type={showPw ? 'text' : 'password'}
								minlength="6"
								class="border-ink-300 bg-surface placeholder:text-ink-400 focus:border-brand-500 focus:ring-brand-100 w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
								placeholder="min. 6 karakter"
								bind:value={fu.password}
							/>
						</div>
					</div>
					<label class="text-ink-500 flex cursor-pointer items-center gap-2 text-xs">
						<input type="checkbox" bind:checked={showPw} class="accent-brand-600" />
						Tampilkan password
					</label>
					<button
						type="submit"
						class="btn-press bg-brand-600 w-full rounded-lg py-2.5 text-sm font-bold text-white"
					>
						+ Tambah Pengguna
					</button>
				</div>
			</form>

			<!-- ============ DAFTAR USER ============ -->
			<div class="card p-5 lg:col-span-2">
				<h2 class="text-h3 mb-1">👥 Daftar Pengguna ({$users.length})</h2>
				<p class="text-caption mb-4">
					Klik ✏️ untuk edit · 🔑 untuk reset password · 🗑 untuk hapus. Akun
					<span class="font-mono font-bold">admin</span> & akun yang sedang login tidak bisa dihapus.
				</p>

				<ul class="divide-line divide-y">
					{#each $users as u (u.username)}
						{@const isMe = $session?.username === u.username}
						<li class="py-3.5">
							<div class="flex items-center gap-3">
								<div
									class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white {u.role ===
									'kasir'
										? 'bg-warning-500'
										: 'bg-brand-600'}"
								>
									{(u.name || u.username).trim().charAt(0).toUpperCase()}
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-ink-800 flex flex-wrap items-center gap-2 text-sm font-bold">
										{u.name}
										<span class="rounded-full px-2 py-0.5 text-[11px] font-bold {badge(u.role)}">
											{u.role === 'kasir' ? '🧾 Kasir' : '👑 Pemilik'}
										</span>
										{#if isMe}
											<span
												class="bg-success-100 text-success-700 rounded-full px-2 py-0.5 text-[11px] font-bold"
												>● sedang login</span
											>
										{/if}
										{#if u.status === 'ditolak'}
											<span
												class="bg-danger-100 text-danger-700 rounded-full px-2 py-0.5 text-[11px] font-bold"
											>
												✕ ditolak
											</span>
										{/if}
									</p>
									<p class="text-caption mt-0.5 font-mono">
										@{u.username}{u.email ? ` · ✉️ ${u.email}` : ''}{u.phone
											? ` · 📱 ${u.phone}`
											: ''}
									</p>
								</div>
								<div class="flex shrink-0 items-center gap-1.5">
									<button
										class="border-line hover:bg-surface-2 rounded-lg border px-2.5 py-1.5 text-xs"
										title="Edit data"
										aria-label="Edit {u.username}"
										onclick={() => toggleEdit(u)}>✏️</button
									>
									<button
										class="border-line hover:bg-surface-2 rounded-lg border px-2.5 py-1.5 text-xs"
										title="Reset password"
										aria-label="Reset password {u.username}"
										onclick={() => togglePw(u.username)}>🔑</button
									>
									<button
										class="border-danger-200 hover:bg-danger-50 rounded-lg border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
										title="Hapus pengguna"
										aria-label="Hapus {u.username}"
										disabled={u.username === 'admin' || isMe}
										onclick={() => hapus(u.username, u.name)}>🗑</button
									>
								</div>
							</div>

							<!-- Panel edit -->
							{#if editing === u.username}
								<form
									class="border-line bg-surface-alt mt-3 grid grid-cols-1 gap-2.5 rounded-xl border p-4 sm:grid-cols-2"
									onsubmit={(e) => submitEdit(e, u.username)}
									in:fly={{ y: -8, duration: 200 }}
								>
									<input
										class="border-ink-300 bg-surface focus:border-brand-500 rounded-lg border px-3 py-2 text-sm outline-none"
										placeholder="Nama lengkap"
										bind:value={fe.name}
									/>
									<select
										class="border-ink-300 bg-surface focus:border-brand-500 rounded-lg border px-3 py-2 text-sm outline-none"
										bind:value={fe.role}
									>
										<option value="kasir">🧾 Kasir</option>
										<option value="pemilik">👑 Pemilik</option>
									</select>
									<input
										type="email"
										class="border-ink-300 bg-surface focus:border-brand-500 rounded-lg border px-3 py-2 text-sm outline-none"
										placeholder="Email (opsional)"
										bind:value={fe.email}
									/>
									<input
										type="tel"
										class="border-ink-300 bg-surface focus:border-brand-500 rounded-lg border px-3 py-2 text-sm outline-none"
										placeholder="No. HP (opsional)"
										bind:value={fe.phone}
									/>
									<div class="flex gap-2 sm:col-span-2">
										<button
											type="submit"
											class="btn-press bg-success-600 flex-1 rounded-lg py-2 text-xs font-bold text-white"
											>💾 Simpan</button
										>
										<button
											type="button"
											class="border-line text-ink-600 hover:bg-surface-2 rounded-lg border px-4 py-2 text-xs font-semibold"
											onclick={() => (editing = null)}>Batal</button
										>
									</div>
								</form>
							{/if}

							<!-- Panel reset password -->
							{#if pwTarget === u.username}
								<form
									class="border-warning-200 bg-warning-50 mt-3 flex flex-col gap-2 rounded-xl border p-4 sm:flex-row"
									onsubmit={(e) => submitReset(e, u.username)}
									in:fly={{ y: -8, duration: 200 }}
								>
									<input
										type="text"
										minlength="6"
										required
										class="border-ink-300 bg-surface focus:border-brand-500 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
										placeholder="Password baru (min. 6 karakter)"
										bind:value={pwBaru}
									/>
									<div class="flex gap-2">
										<button
											type="submit"
											class="btn-press bg-warning-500 rounded-lg px-4 py-2 text-xs font-bold text-white"
											>🔑 Reset</button
										>
										<button
											type="button"
											class="border-line bg-surface text-ink-600 rounded-lg border px-4 py-2 text-xs font-semibold"
											onclick={() => (pwTarget = null)}>Batal</button
										>
									</div>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>
{:else}
	<p class="card text-ink-500 mt-6 p-8 text-center text-sm">
		Halaman ini khusus pemilik toko. Silakan kembali ke <a class="text-brand-600 font-bold" href="/"
			>Dashboard</a
		>.
	</p>
{/if}
