-- =====================================================================
--  PERBAIKAN: tabel public.users kehilangan kolom "username"
--  (dialog "Create table" Supabase pernah menimpa skema)
--  Jalankan di Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

-- 1. Tambah kolom yang hilang
alter table public.users add column if not exists username text;

-- 2. Isi username untuk baris lama (jika ada) agar NOT NULL + UNIQUE bisa dipasang
update public.users
   set username = coalesce(nullif(split_part(email, '@', 1), ''), 'user_' || substr(id::text, 1, 8))
 where username is null or username = '';

-- 3. Tegakkan aturan
alter table public.users alter column username set not null;
create unique index if not exists users_username_key on public.users (username);

-- 4. Pastikan semua kolom lain juga ada (idempoten)
alter table public.users add column if not exists name text;
alter table public.users add column if not exists role text default 'kasir';
alter table public.users add column if not exists email text default '';
alter table public.users add column if not exists phone text default '';
alter table public.users add column if not exists status text default 'menunggu';
alter table public.users add column if not exists created_at timestamptz default now();

-- 5. Pastikan tabel konfigurasi & penanda pemilik siap
create table if not exists public.app_config (key text primary key, value text not null);
insert into public.app_config (key, value) values ('owner_claimed', 'false')
on conflict (key) do nothing;

-- 6. Muat ulang schema cache PostgREST agar kolom baru langsung dikenali API
notify pgrst, 'reload schema';
