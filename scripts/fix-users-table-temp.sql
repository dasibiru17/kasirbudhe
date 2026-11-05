-- =====================================================================
--  PERBAIKAN TAHAP 3 — buat ulang public.users dengan struktur yang benar
--  dan isi profil untuk akun auth yang sudah ada (wahyu17 = pemilik).
--  Aman: tabel public.users saat ini 0 baris.
--  Jalankan di Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

-- 1. Buat ulang tabel profil
drop table if exists public.users cascade;

create table public.users (
    id uuid primary key references auth.users (id) on delete cascade,
    username text not null,
    name text not null,
    role text not null default 'kasir' check (role in ('pemilik', 'kasir')),
    email text default '',
    phone text default '',
    status text not null default 'menunggu' check (status in ('aktif', 'menunggu', 'ditolak')),
    created_at timestamptz default now()
);
create unique index users_username_key on public.users (username);

-- 2. Fungsi helper dibuat ulang (cascade di atas bisa menjatuhkan yang bergantung)
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
    select role from public.users where id = auth.uid() and status = 'aktif'
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(public.current_role() = 'pemilik', false)
$$;

create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.users where id = auth.uid() and status = 'aktif')
$$;

-- 3. RLS + policy untuk users
alter table public.users enable row level security;

create policy "users_read_self" on public.users
    for select to authenticated using (id = auth.uid());
create policy "users_owner_read_all" on public.users
    for select to authenticated using (public.is_owner());
create policy "users_owner_update" on public.users
    for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "users_owner_delete" on public.users
    for delete to authenticated using (public.is_owner() and id <> auth.uid());
create policy "users_update_self_profile" on public.users
    for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 4. Trigger penjaga role/status
create or replace function public.guard_user_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if public.is_owner() then
        return new;
    end if;
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

-- 5. Trigger pembuatan profil otomatis (tanpa menelan error lagi)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    v_owner_exists boolean;
    v_username text;
begin
    select exists (select 1 from public.users where role = 'pemilik') into v_owner_exists;

    v_username := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''),
                           'user_' || substr(new.id::text, 1, 8));
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
alter function public.handle_new_user() owner to postgres;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- 6. Isi profil akun pemilik: wahyu17
insert into public.users (id, username, name, role, email, phone, status)
select id, 'wahyu17', 'Wahyu', 'pemilik', email, '', 'aktif'
from auth.users
where lower(email) = 'wahyuizharullahkairanvi@gmail.com'
on conflict (id) do update
    set username = 'wahyu17', role = 'pemilik', status = 'aktif';

-- 7. Tandai slot pemilik sudah diklaim
insert into public.app_config (key, value) values ('owner_claimed', 'true')
on conflict (key) do update set value = 'true';

notify pgrst, 'reload schema';

-- 8. Tampilkan hasil
select id, username, name, role, email, status from public.users;
