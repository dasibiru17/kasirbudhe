-- =====================================================================
--  PERBAIKAN AKUN PEMILIK: wahyu17
--  Jalankan di Supabase Dashboard -> SQL Editor -> Run
--  Aman dijalankan berulang kali (idempotent).
-- =====================================================================

-- 1. Pastikan tabel konfigurasi & penanda pemilik siap
create table if not exists public.app_config (key text primary key, value text not null);
insert into public.app_config (key, value) values ('owner_claimed', 'false')
on conflict (key) do nothing;

-- 2. Pastikan kolom wajib ada
alter table public.users add column if not exists username text;
alter table public.users add column if not exists name text;
alter table public.users add column if not exists phone text default '';
alter table public.users add column if not exists status text default 'menunggu';
alter table public.users add column if not exists created_at timestamptz default now();

-- 3. Isi profil pemilik dari akun Auth (email harus sudah terdaftar di Authentication -> Users)
update public.users u
   set username = 'wahyu17',
       name     = coalesce(nullif(u.name, ''), 'Wahyu'),
       role     = 'pemilik',
       status   = 'aktif'
 where u.id in (
     select id from auth.users
      where lower(email) = 'wahyuizharullahkairanvi@gmail.com'
 );

-- 4. Kalau profilnya belum ada sama sekali, buatkan
insert into public.users (id, username, name, role, email, phone, status)
select au.id, 'wahyu17', 'Wahyu', 'pemilik', au.email, '', 'aktif'
  from auth.users au
 where lower(au.email) = 'wahyuizharullahkairanvi@gmail.com'
on conflict (id) do update
   set username = 'wahyu17', role = 'pemilik', status = 'aktif';

-- 5. Tandai slot pemilik sudah diklaim supaya pendaftar berikutnya jadi kasir 'menunggu'
insert into public.app_config (key, value) values ('owner_claimed', 'true')
on conflict (key) do update set value = 'true';

-- 6. Muat ulang skema PostgREST
notify pgrst, 'reload schema';

-- 7. Cek hasil
select u.id, u.username, u.name, u.role, u.status, u.email, au.email_confirmed_at
  from public.users u
  join auth.users au on au.id = u.id
 order by u.created_at;
