-- ============================================================
-- SKEMA DATABASE TOKO SEJAHTERA (SUPABASE)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ============================================================

-- 1. TABEL PENGGUNA (USERS)
create table if not exists public.users (
    username text primary key,
    name text not null,
    role text not null default 'kasir' check (role in ('pemilik', 'kasir')),
    email text default '',
    phone text default '',
    password_hash text not null,
    status text not null default 'menunggu' check (status in ('aktif', 'menunggu', 'ditolak')),
    created_at timestamptz default now()
);

-- 2. TABEL PRODUK (PRODUCTS)
create table if not exists public.products (
    id text primary key,
    name text not null,
    category text default 'Lainnya',
    buy_price numeric not null default 0,
    sell_price numeric not null default 0,
    stock integer not null default 0,
    created_at timestamptz default now()
);

-- 3. TABEL TRANSAKSI PENJUALAN (TRANSACTIONS)
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

-- 4. TABEL PENGELUARAN OPERASIONAL (EXPENSES)
create table if not exists public.expenses (
    id text primary key,
    date timestamptz default now(),
    note text not null,
    amount numeric not null default 0,
    created_at timestamptz default now()
);

-- ============================================================
-- DATA BAWAAN (DEFAULT USERS & PRODUCTS)
-- ============================================================

-- Akun admin (password: admin123) dan kasir bawaan (password: kasir123)
insert into public.users (username, name, role, email, phone, password_hash, status)
values
    ('admin', 'Pemilik Toko', 'pemilik', 'admin@tokosejahtera.id', '081234567890', '1uox9ycb9e1p', 'aktif'),
    ('kasir', 'Kasir Toko', 'kasir', '', '', '1ux14k2e9w5s', 'aktif')
on conflict (username) do nothing;

-- Produk awal contoh
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

-- ============================================================
-- KEBIJAKAN AKSES (ROW LEVEL SECURITY)
-- Memberikan akses penuh untuk koneksi anon publik aplikasi
-- ============================================================
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;

create policy "Allow all on users" on public.users for all using (true) with check (true);
create policy "Allow all on products" on public.products for all using (true) with check (true);
create policy "Allow all on transactions" on public.transactions for all using (true) with check (true);
create policy "Allow all on expenses" on public.expenses for all using (true) with check (true);
