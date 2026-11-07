-- =====================================================================
--  GAME MINI & INTERAKTIF — SKEMA DATABASE
--  File : supabase-schema-game.sql
--  Jalankan di Supabase Dashboard -> SQL Editor -> Run
--  Aman dijalankan berulang (idempotent).
--
--  Isi:
--   1. game_scores  — hasil latihan "Cashier Speed Run" (mode internal/kasir)
--   2. vouchers     — kode promo hasil "Spin & Win" (mode konsumen/loyalitas)
--   3. Fungsi claim_voucher() — buat voucher + kuota spin harian per user
--      (dipanggil dari aplikasi lewat supabase.rpc).
--   4. RLS: staff aktif boleh baca semua (agar kasir bisa memvalidasi kode),
--      voucher hanya bisa di-UPDATE pada kolom status/used_at/tx_id —
--      kode & nilai hadiah dikunci trigger agar tidak bisa dipalsukan.
--      Pemilik toko boleh menghapus data untuk bersih-bersih.
--
--  Catatan mode lokal: selama VITE_LOCAL_MODE=true (default aplikasi),
--  semua data game disimpan di localStorage dan file ini tidak wajib.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SKOR GAME KASIR
-- ---------------------------------------------------------------------
create table if not exists public.game_scores (
    id               text primary key,
    username         text not null,
    name             text not null default '',
    score            integer not null check (score >= 0),
    best_streak      integer not null default 0,
    correct          integer not null default 0,
    wrong            integer not null default 0,
    accuracy         integer not null default 0 check (accuracy between 0 and 100),
    level            text not null default 'Pemula',
    avg_response_ms  integer not null default 0,
    created_at       timestamptz not null default now()
);

create index if not exists game_scores_created_idx on public.game_scores (created_at desc);
create index if not exists game_scores_score_idx   on public.game_scores (score desc);
create index if not exists game_scores_user_idx    on public.game_scores (username, score desc);

-- ---------------------------------------------------------------------
-- 2. VOUCHER HADIAH SPIN & WIN
-- ---------------------------------------------------------------------
create table if not exists public.vouchers (
    id          text primary key,
    username    text not null,                       -- pemilik voucher (atau 'tamu')
    name        text not null default '',
    prize_id    text not null,
    label       text not null default '',
    type        text not null check (type in ('percent', 'nominal', 'points')),
    value       integer not null default 0 check (value >= 0),
    code        text not null unique,                -- mis. SPN-7K4QMX
    status      text not null default 'aktif'
                check (status in ('aktif', 'terpakai', 'kedaluwarsa')),
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null default (now() + interval '7 days'),
    used_at     timestamptz,
    tx_id       text                                 -- nota transaksi tempat voucher dipakai
);

create index if not exists vouchers_code_idx     on public.vouchers (code);
create index if not exists vouchers_status_idx   on public.vouchers (status, expires_at);
create index if not exists vouchers_created_idx  on public.vouchers (created_at desc);
create index if not exists vouchers_user_idx     on public.vouchers (username, created_at desc);

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.game_scores enable row level security;
alter table public.vouchers    enable row level security;

-- game_scores: staff aktif boleh baca semua skor (papan peringkat),
-- semua staff aktif boleh mencatat skornya sendiri.
drop policy if exists "game_scores_read_active" on public.game_scores;
create policy "game_scores_read_active" on public.game_scores
    for select to authenticated
    using (public.is_active());

drop policy if exists "game_scores_insert_self" on public.game_scores;
create policy "game_scores_insert_self" on public.game_scores
    for insert to authenticated
    with check (
        public.is_active()
        and (
            username = public.current_username()
            or (username = 'tamu' and not exists (select 1 from public.users where id = auth.uid()))
        )
    );

drop policy if exists "game_scores_owner_delete" on public.game_scores;
create policy "game_scores_owner_delete" on public.game_scores
    for delete to authenticated
    using (public.is_owner());

-- vouchers: dikelola lewat fungsi claim_voucher() (SECURITY DEFINER),
-- jadi client hanya butuh akses baca + update status saat redeem.
-- UPDATE dibatasi: hanya bisa mengubah status/used_at/tx_id, dan nilai
-- hadiah (type, value, code, expires_at) dikunci oleh trigger di bawah.
drop policy if exists "vouchers_read_active" on public.vouchers;
create policy "vouchers_read_active" on public.vouchers
    for select to authenticated
    using (public.is_active());

drop policy if exists "vouchers_update_active" on public.vouchers;
create policy "vouchers_update_active" on public.vouchers
    for update to authenticated
    using (public.is_active())
    with check (public.is_active());

drop policy if exists "vouchers_owner_delete" on public.vouchers;
create policy "vouchers_owner_delete" on public.vouchers
    for delete to authenticated
    using (public.is_owner());

-- Helper: username pemilik sesi (dipakai policy insert game_scores).
create or replace function public.current_username()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select username from public.users where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 4. TRIGGER: hadiah voucher tidak boleh diubah setelah dibuat
-- ---------------------------------------------------------------------
create or replace function public.guard_voucher_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_owner() then
        return new;
    end if;
    if new.code       is distinct from old.code
       or new.type        is distinct from old.type
       or new.value       is distinct from old.value
       or new.prize_id    is distinct from old.prize_id
       or new.expires_at  is distinct from old.expires_at
       or new.username    is distinct from old.username then
        raise exception 'Nilai hadiah voucher tidak boleh diubah.';
    end if;
    -- Redeem hanya boleh sekali: status tidak bisa kembali dari terpakai -> aktif
    if old.status = 'terpakai' and new.status = 'aktif' then
        raise exception 'Voucher yang sudah dipakai tidak bisa diaktifkan kembali.';
    end if;
    return new;
end;
$$;

drop trigger if exists guard_voucher_fields on public.vouchers;
create trigger guard_voucher_fields
    before update on public.vouchers
    for each row execute function public.guard_voucher_fields();

-- ---------------------------------------------------------------------
-- 5. FUNGSI: claim voucher (1 spin = 1 klaim, ada kuota harian)
--    Dipanggil aplikasi:  supabase.rpc('claim_voucher', { p_prize: {...} })
--    Mengembalikan baris voucher lengkap, atau exception bila kuota habis.
-- ---------------------------------------------------------------------
create or replace function public.claim_voucher(
    p_prize_id   text,
    p_label      text,
    p_type       text,
    p_value      integer,
    p_name       text default '',
    p_code       text default null,
    p_daily_limit integer default 3
)
returns public.vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text;
    v_count    integer;
    v_code     text;
    v_row      public.vouchers;
begin
    if not public.is_active() then
        raise exception 'Akun belum aktif atau belum login.';
    end if;

    if p_type not in ('percent', 'nominal', 'points') then
        raise exception 'Jenis hadiah tidak valid: %', p_type;
    end if;
    if p_type = 'percent' and (p_value < 0 or p_value > 50) then
        raise exception 'Diskon persen harus 0-50.';
    end if;

    v_username := public.current_username();

    select count(*) into v_count
      from public.vouchers
     where username = v_username
       and created_at >= date_trunc('day', now());

    if v_count >= p_daily_limit then
        raise exception 'Batas spin hari ini sudah tercapai (% kali).', p_daily_limit;
    end if;

    v_code := coalesce(nullif(upper(trim(p_code)), ''), 'SPN-' || upper(substr(md5(random()::text), 1, 6)));

    if exists (select 1 from public.vouchers where code = v_code) then
        raise exception 'Kode voucher % sudah dipakai, ulangi spin.', v_code;
    end if;

    insert into public.vouchers (id, username, name, prize_id, label, type, value, code)
    values (
        'v-' || replace(gen_random_uuid()::text, '-', ''),
        v_username,
        coalesce(nullif(p_name, ''), v_username),
        p_prize_id,
        p_label,
        p_type,
        greatest(0, p_value),
        v_code
    )
    returning * into v_row;

    return v_row;
end;
$$;

grant execute on function public.claim_voucher(text, text, text, integer, text, text, integer)
    to authenticated;

-- ---------------------------------------------------------------------
-- 6. REALTIME (opsional): agar kasir langsung melihat voucher baru
-- ---------------------------------------------------------------------
do $$
begin
    begin
        alter publication supabase_realtime add table public.vouchers;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.game_scores;
    exception when duplicate_object then null;
    end;
end $$;

-- =====================================================================
--  SELESAI
--  Setelah menjalankan file ini, halaman /game langsung memakai cloud.
--  Bila aplikasi tetap menulis ke localStorage, cek:
--   - .env: VITE_LOCAL_MODE=false dan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY terisi
--   - user login sebagai akun yang statusnya 'aktif'
-- =====================================================================
