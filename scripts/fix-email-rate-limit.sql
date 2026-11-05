-- =====================================================================
--  PERBAIKAN: "email rate limit exceeded" saat menambah akun
--  Jalankan di Supabase Dashboard -> SQL Editor -> Run
--  Aman dijalankan berulang kali (idempotent).
-- =====================================================================
--
--  PENYEBAB:
--  Supabase mengirim email konfirmasi setiap kali akun dibuat. Kuota email
--  bawaan (SMTP default Supabase) hanya beberapa email per jam, jadi setelah
--  beberapa pendaftaran muncul error 429 "email rate limit exceeded".
--
--  SOLUSI:
--  Akun yang dibuat pemilik toko langsung aktif dan tidak butuh konfirmasi
--  email, jadi konfirmasi email dimatikan. Setelah ini, menambah akun tidak
--  lagi mengirim email dan tidak akan kena rate limit.
-- =====================================================================

-- 1. Matikan konfirmasi email (akun langsung aktif tanpa klik link email)
update auth.config
   set mailer_autoconfirm = true
 where true;

-- 2. Pastikan pendaftaran mandiri tetap boleh
update auth.config
   set disable_signup = false
 where true;

-- 3. Izinkan pemilik membuat profil akun langsung di tabel users.
--    Tanpa policy INSERT ini, jalur cadangan (saat kuota email habis) ditolak
--    dengan error 403 "new row violates row-level security policy".
drop policy if exists "users_owner_insert" on public.users;
create policy "users_owner_insert" on public.users
    for insert to authenticated
    with check (public.is_owner());

-- 4. Cek hasil
select mailer_autoconfirm, disable_signup from auth.config;

select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'users'
 order by cmd, policyname;
