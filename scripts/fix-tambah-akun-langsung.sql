-- =====================================================================
--  TAMBAH AKUN LANGSUNG (tanpa email, tanpa rate limit)
--  Jalankan di Supabase Dashboard -> SQL Editor -> Run
--  Aman dijalankan berulang kali (idempotent).
-- =====================================================================
--
--  MASALAH:
--  Membuat akun lewat supabase.auth.signUp() selalu memicu pengiriman email
--  konfirmasi. Kuota email bawaan Supabase hanya beberapa per jam, sehingga
--  muncul error 429 "email rate limit exceeded" dan akun tidak pernah dibuat.
--
--  SOLUSI:
--  Fungsi create_user() di bawah membuat akun di auth.users LANGSUNG dari
--  database (bcrypt), tanpa mengirim email sama sekali. Akun langsung aktif
--  dan bisa dipakai login. Profil di public.users dibuat otomatis oleh
--  trigger handle_new_user() yang sudah ada.
--
--  Hanya pemilik toko (is_owner()) yang boleh memanggil fungsi ini.
-- =====================================================================

-- 1. Pastikan ekstensi kripto tersedia untuk hash password bcrypt
create extension if not exists pgcrypto with schema extensions;

-- 2. Fungsi pembuat akun
create or replace function public.create_user(
    p_username text,
    p_name     text,
    p_password text,
    p_role     text default 'kasir',
    p_email    text default '',
    p_phone    text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_uid      uuid := gen_random_uuid();
    v_username text := lower(trim(p_username));
    v_email    text := lower(trim(coalesce(p_email, '')));
    v_role     text := case when p_role = 'pemilik' then 'pemilik' else 'kasir' end;
begin
    -- Hanya pemilik toko yang boleh menambah akun
    if not public.is_owner() then
        raise exception 'Hanya pemilik toko yang dapat menambah akun.';
    end if;

    if v_username = '' then
        raise exception 'Username wajib diisi.';
    end if;
    if length(coalesce(p_password, '')) < 6 then
        raise exception 'Password minimal 6 karakter.';
    end if;

    -- Username harus unik
    if exists (select 1 from public.users where lower(username) = v_username) then
        raise exception 'Username "%" sudah dipakai.', v_username;
    end if;

    -- Email opsional; kalau kosong pakai email internal agar kolom auth terisi
    if v_email = '' then
        v_email := v_username || '@toko-sejahtera.local';
    end if;

    if exists (select 1 from auth.users where lower(email) = v_email) then
        raise exception 'Email "%" sudah terdaftar.', v_email;
    end if;

    -- Buat akun login langsung (tanpa kirim email, langsung terkonfirmasi)
    insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_email, crypt(p_password, gen_salt('bf')),
        now(), now(), now(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('username', v_username, 'name', p_name, 'phone', coalesce(p_phone, '')),
        '', '', '', ''
    );

    -- Identitas email (dipakai Supabase Auth saat login)
    insert into auth.identities (
        id, user_id, provider_id, provider, identity_data,
        last_sign_in_at, created_at, updated_at
    ) values (
        gen_random_uuid(), v_uid, v_uid::text, 'email',
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        now(), now(), now()
    );

    -- Profil di public.users (trigger handle_new_user juga membuatnya;
    -- perintah ini memastikan data sesuai input pemilik)
    insert into public.users (id, username, name, role, email, phone, status)
    values (v_uid, v_username, coalesce(nullif(trim(p_name), ''), v_username), v_role, v_email, coalesce(p_phone, ''), 'aktif')
    on conflict (id) do update
        set username = excluded.username,
            name     = excluded.name,
            role     = excluded.role,
            email    = excluded.email,
            phone    = excluded.phone,
            status   = 'aktif';

    return v_uid;
end;
$$;

-- 3. Hak akses: hanya pengguna login (pemilik) yang boleh memanggil
revoke all on function public.create_user(text, text, text, text, text, text) from public;
grant execute on function public.create_user(text, text, text, text, text, text) to authenticated;

-- 4. Izinkan pemilik menulis profil akun (dibutuhkan saat update profil)
drop policy if exists "users_owner_insert" on public.users;
create policy "users_owner_insert" on public.users
    for insert to authenticated
    with check (public.is_owner());

-- 5. Matikan konfirmasi email agar pendaftaran mandiri tidak kena rate limit
update auth.config set mailer_autoconfirm = true where true;

-- 6. Muat ulang skema PostgREST
notify pgrst, 'reload schema';

-- 7. Cek hasil
select proname, pg_get_function_identity_arguments(oid) as args
  from pg_proc
 where proname = 'create_user';

select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'users'
 order by cmd, policyname;
