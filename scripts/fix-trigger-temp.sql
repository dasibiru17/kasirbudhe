-- =====================================================================
--  PERBAIKAN TAHAP 2 — buat public.handle_new_user() KEBAL row level security
--  Gejala: setiap signUp gagal "Database error saving new user"
--
--  Jalankan di Supabase Dashboard -> SQL Editor -> Run (setelah file 1)
-- =====================================================================

-- 1. Pastikan fungsi trigger memakai SECURITY DEFINER (bypass RLS) + owner tabel
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
exception when others then
    -- Jangan sampai kegagalan profil menggagalkan pembuatan akun auth
    raise warning 'handle_new_user gagal: % | %', sqlstate, sqlerrm;
    return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

-- 2. Penanda pemilik
create table if not exists public.app_config (key text primary key, value text not null);
insert into public.app_config (key, value) values ('owner_claimed', 'false')
on conflict (key) do nothing;

-- 3. claim_owner() juga harus SECURITY DEFINER
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

    select value into v_claimed from public.app_config where key = 'owner_claimed' for update;

    if exists (select 1 from public.users where role = 'pemilik' and id <> auth.uid()) then
        update public.app_config set value = 'true' where key = 'owner_claimed';
        return false;
    end if;

    update public.users set role = 'pemilik', status = 'aktif' where id = auth.uid();
    update public.app_config set value = 'true' where key = 'owner_claimed';
    return true;
end;
$$;

alter function public.claim_owner() owner to postgres;
grant execute on function public.claim_owner() to authenticated;

-- 4. Muat ulang cache PostgREST
notify pgrst, 'reload schema';
