-- =====================================================================
--  SKEMA DATABASE TOKO SEJAHTERA — VERSI AMAN (Supabase Auth + RLS)
-- =====================================================================
--  Jalankan SELURUH file ini di Supabase Dashboard -> SQL Editor -> Run.
--  Aman dijalankan ulang (idempotent) dan juga MIGRASI dari skema lama:
--    - kolom password_hash dihapus dari public.users (password kini
--      dikelola oleh Supabase Auth, tidak pernah disimpan di tabel publik)
--    - policy "Allow all" versi lama dibuang
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
--  1. PROFIL PENGGUNA (public.users) — tanpa password_hash
-- =====================================================================
create table if not exists public.users (
    id uuid primary key references auth.users (id) on delete cascade,
    username text not null,
    name text not null,
    role text not null default 'kasir' check (role in ('pemilik', 'kasir')),
    email text default '',
    phone text default '',
    status text not null default 'menunggu' check (status in ('aktif', 'menunggu', 'ditolak')),
    created_at timestamptz default now()
);

-- Migrasi dari skema lama (jika tabel sudah ada dari supabase-schema.sql)
alter table public.users add column if not exists id uuid references auth.users (id) on delete cascade;
alter table public.users drop column if exists password_hash;

create unique index if not exists users_username_key on public.users (username);

-- =====================================================================
--  2. PRODUK, TRANSAKSI, PENGELUARAN
-- =====================================================================
create table if not exists public.products (
    id text primary key,
    name text not null,
    category text default 'Lainnya',
    buy_price numeric not null default 0,
    sell_price numeric not null default 0,
    stock integer not null default 0,
    created_at timestamptz default now()
);

create table if not exists public.transactions (
    id text primary key,
    date timestamptz default now(),
    items jsonb not null default '[]'::jsonb,
    total numeric not null default 0,
    cost numeric not null default 0,
    profit numeric not null default 0,
    paid numeric not null default 0,
    change numeric not null default 0,
    cashier_username text default ''
);

create table if not exists public.expenses (
    id text primary key,
    date timestamptz default now(),
    note text not null,
    amount numeric not null default 0,
    created_at timestamptz default now()
);

-- =====================================================================
--  3. HELPER OTORISASI (SECURITY DEFINER agar tidak rekursif dgn RLS)
-- =====================================================================
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role from public.users
    where id = auth.uid() and status = 'aktif'
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_role() = 'pemilik', false)
$$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.users
        where id = auth.uid() and status = 'aktif'
    )
$$;

-- Penanda pemilik pertama (dipakai untuk "klaim" sekali saat pemilik belum ada)
create table if not exists public.app_config (
    key text primary key,
    value text not null
);
insert into public.app_config (key, value)
values ('owner_claimed', 'false')
on conflict (key) do nothing;

-- =====================================================================
--  4. TRIGGER: buat profil otomatis saat user mendaftar (auth.users)
--     - Pendaftar pertama (jika owner belum ada) -> pemilik, langsung aktif
--     - Pendaftar berikutnya -> kasir, status 'menunggu' (menunggu persetujuan)
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner_exists boolean;
    v_username text;
begin
    select exists (select 1 from public.users where role = 'pemilik')
      into v_owner_exists;

    v_username := coalesce(
        nullif(new.raw_user_meta_data ->> 'username', ''),
        'user_' || substr(new.id::text, 1, 8)
    );

    -- Username harus unik; tambahkan sufiks jika sudah dipakai
    if exists (select 1 from public.users where username = v_username) then
        v_username := v_username || '_' || substr(new.id::text, 1, 4);
    end if;

    insert into public.users (id, username, name, role, email, phone, status)
    values (
        new.id,
        v_username,
        coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), v_username),
        case when v_owner_exists then 'kasir' else 'pemilik' end,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data ->> 'phone', ''),
        case when v_owner_exists then 'menunggu' else 'aktif' end
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Tahap 2: klaim slot pemilik oleh pendaftar pertama yang login
create or replace function public.claim_owner()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_claimed text;
begin
    if auth.uid() is null then
        return false;
    end if;

    select value into v_claimed
    from public.app_config
    where key = 'owner_claimed'
    for update;

    if v_claimed = 'true' then
        return false;
    end if;

    if exists (select 1 from public.users where role = 'pemilik') then
        update public.app_config set value = 'true' where key = 'owner_claimed';
        return false;
    end if;

    update public.users set role = 'pemilik', status = 'aktif' where id = auth.uid();
    update public.app_config set value = 'true' where key = 'owner_claimed';
    return true;
end;
$$;

revoke all on function public.claim_owner() from public;
grant execute on function public.claim_owner() to authenticated;

-- =====================================================================
--  5. ROW LEVEL SECURITY
-- =====================================================================
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;
alter table public.app_config enable row level security;

-- Bersihkan policy lama (termasuk "Allow all" dari skema versi awal)
do $$
declare r record;
begin
    for r in
        select policyname, tablename
        from pg_policies
        where schemaname = 'public'
          and tablename in ('users', 'products', 'transactions', 'expenses', 'app_config')
    loop
        execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

-- --- users -----------------------------------------------------------
-- Setiap user bisa membaca datanya sendiri (agar bisa lolos status 'menunggu')
create policy "users_read_self" on public.users
    for select to authenticated
    using (id = auth.uid());

-- Pemilik bisa membaca & mengelola semua akun
create policy "users_owner_read_all" on public.users
    for select to authenticated
    using (public.is_owner());

create policy "users_owner_update" on public.users
    for update to authenticated
    using (public.is_owner())
    with check (public.is_owner());

create policy "users_owner_delete" on public.users
    for delete to authenticated
    using (public.is_owner() and id <> auth.uid());

-- Kasir boleh mengubah profilnya sendiri, TAPI tidak boleh menaikkan
-- role/status (dijaga oleh trigger di bawah)
create policy "users_update_self_profile" on public.users
    for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

create or replace function public.guard_user_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_owner() then
        return new;
    end if;
    -- Non-pemilik tidak boleh mengubah role & status
    if new.role is distinct from old.role or new.status is distinct from old.status then
        raise exception 'Hanya pemilik toko yang dapat mengubah peran/status akun.';
    end if;
    if new.id is distinct from old.id then
        raise exception 'ID pengguna tidak boleh diubah.';
    end if;
    return new;
end;
$$;

drop trigger if exists guard_user_self_update on public.users;
create trigger guard_user_self_update
    before update on public.users
    for each row execute function public.guard_user_self_update();

-- --- products --------------------------------------------------------
create policy "products_read_active" on public.products
    for select to authenticated
    using (public.is_active());

create policy "products_write_owner" on public.products
    for all to authenticated
    using (public.is_owner())
    with check (public.is_owner());

-- Kasir hanya boleh memperbarui stok saat transaksi (UPDATE terbatas)
create policy "products_kasir_update_stock" on public.products
    for update to authenticated
    using (public.is_active())
    with check (public.is_active());

create or replace function public.guard_product_stock_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_owner() then
        return new;
    end if;
    if new.name is distinct from old.name
       or new.category is distinct from old.category
       or new.buy_price is distinct from old.buy_price
       or new.sell_price is distinct from old.sell_price then
        raise exception 'Hanya pemilik toko yang dapat mengubah detail produk.';
    end if;
    return new;
end;
$$;

drop trigger if exists guard_product_stock_only on public.products;
create trigger guard_product_stock_only
    before update on public.products
    for each row execute function public.guard_product_stock_only();

-- --- transactions ----------------------------------------------------
create policy "transactions_read_active" on public.transactions
    for select to authenticated
    using (public.is_active());

create policy "transactions_insert_active" on public.transactions
    for insert to authenticated
    with check (public.is_active());

create policy "transactions_owner_manage" on public.transactions
    for all to authenticated
    using (public.is_owner())
    with check (public.is_owner());

-- --- expenses --------------------------------------------------------
create policy "expenses_read_active" on public.expenses
    for select to authenticated
    using (public.is_active());

create policy "expenses_owner_manage" on public.expenses
    for all to authenticated
    using (public.is_owner())
    with check (public.is_owner());

-- --- app_config ------------------------------------------------------
create policy "app_config_owner_read" on public.app_config
    for select to authenticated
    using (public.is_owner());

-- =====================================================================
--  6. DATA PRODUK AWAL
-- =====================================================================
insert into public.products (id, name, category, buy_price, sell_price, stock)
values
    ('p-1', 'Beras Premium 5kg', 'Sembako', 58000, 68000, 25),
    ('p-2', 'Minyak Goreng 1L', 'Sembako', 14000, 17500, 40),
    ('p-3', 'Gula Pasir 1kg', 'Sembako', 13000, 16000, 30),
    ('p-4', 'Kopi Sachet', 'Minuman', 1200, 2000, 100),
    ('p-5', 'Air Mineral 600ml', 'Minuman', 2500, 4000, 60),
    ('p-6', 'Mie Instan Goreng', 'Makanan', 2800, 3500, 80),
    ('p-7', 'Sabun Mandi Batang', 'Perawatan', 3800, 5000, 20),
    ('p-8', 'Deterjen 800g', 'Perawatan', 15500, 19000, 15)
on conflict (id) do nothing;

-- =====================================================================
--  SELESAI
-- =====================================================================
-- Langkah berikutnya (di Dashboard Supabase):
--   Authentication -> Sign In / Providers -> Email:
--     matikan "Confirm email" agar login langsung aktif tanpa verifikasi
--     email (atau biarkan aktif dan klik tautan konfirmasi di email).
--   Lalu buka aplikasi -> tab "Buat Akun Baru" -> daftarkan akun pemilik
--   PERTAMA. Pendaftar pertama otomatis menjadi pemilik & langsung aktif.
-- =====================================================================
