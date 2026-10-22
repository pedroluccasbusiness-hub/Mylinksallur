-- LinkHub Agência — reforço de segurança
-- Pode rodar num banco novo ou num banco onde as migrações anteriores já foram aplicadas.
-- Senhas: ficam no Supabase Auth (auth.users), guardadas com bcrypt; o app nunca vê nem grava senha.

-- ---------------------------------------------------------------------------
-- 1. Código de convite fora da tabela de perfis
--    (antes, uma criadora vinculada conseguia ler o código da agência)
-- ---------------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text language sql volatile as $$
  -- gen_random_uuid usa o gerador criptográfico do Postgres
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

create table if not exists public.agency_invites (
  agency_id   uuid primary key references public.profiles (id) on delete cascade,
  code        text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.agency_invites enable row level security;
drop policy if exists agency_invites_own on public.agency_invites;
create policy agency_invites_own on public.agency_invites for select to authenticated
  using (agency_id = auth.uid());
revoke all on public.agency_invites from anon;
grant select on public.agency_invites to authenticated;

-- migra códigos existentes e remove a coluna antiga
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles' and column_name = 'invite_code') then
    insert into public.agency_invites (agency_id, code)
      select id, coalesce(invite_code, public.gen_invite_code())
        from public.profiles where account_type = 'agency'
      on conflict (agency_id) do nothing;
  end if;
end;
$$;

create or replace function public.protect_profile_fields()
returns trigger language plpgsql as $$
begin
  if current_setting('app.bypass_profile_guard', true) = 'on' then
    return new;
  end if;
  if new.account_type is distinct from old.account_type then
    raise exception 'O tipo de conta não pode ser alterado' using errcode = '42501';
  end if;
  if new.agency_id is distinct from old.agency_id then
    raise exception 'Use o código de convite para vincular a uma agência' using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.profiles drop column if exists invite_code;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'creator');
  v_allow boolean;
begin
  select (value)::text::boolean into v_allow from public.app_config where key = 'allow_agency_signup';
  if v_type not in ('agency', 'creator') or (v_type = 'agency' and not coalesce(v_allow, true)) then
    v_type := 'creator';
  end if;

  insert into public.profiles (id, account_type, display_name)
  values (
    new.id,
    v_type,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1)), 80)
  );
  if v_type = 'agency' then
    insert into public.agency_invites (agency_id, code) values (new.id, public.gen_invite_code());
  end if;
  return new;
end;
$$;

create or replace function public.join_agency(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me     profiles;
  v_agency uuid;
begin
  select * into v_me from profiles where id = auth.uid();
  if v_me.id is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if v_me.account_type <> 'creator' then
    raise exception 'Só contas de criadora podem se vincular a uma agência';
  end if;

  select agency_id into v_agency from agency_invites where code = upper(trim(p_code));
  if v_agency is null then
    raise exception 'Código de agência inválido';
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set agency_id = v_agency where id = v_me.id;
  perform set_config('app.bypass_profile_guard', 'off', true);
  return v_agency;
end;
$$;

create or replace function public.rotate_invite_code()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code text := public.gen_invite_code();
begin
  if not exists (select 1 from profiles where id = auth.uid() and account_type = 'agency') then
    raise exception 'Só contas de agência têm código de convite';
  end if;
  insert into agency_invites (agency_id, code) values (auth.uid(), v_code)
    on conflict (agency_id) do update set code = excluded.code, created_at = now();
  return v_code;
end;
$$;

revoke all on function public.gen_invite_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dono da página não muda (impede uma agência de "puxar" a página de uma criadora)
-- ---------------------------------------------------------------------------
create or replace function public.protect_page_owner()
returns trigger language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'O dono da página não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists pages_owner_guard on public.pages;
create trigger pages_owner_guard
  before update of owner_id on public.pages
  for each row execute function public.protect_page_owner();

-- ---------------------------------------------------------------------------
-- 3. Limites de tamanho (evita abuso e páginas gigantes)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pages_sizes') then
    alter table public.pages add constraint pages_sizes check (
      length(title) <= 80 and length(bio) <= 300 and length(handle) <= 40
      and length(seo_title) <= 70 and length(seo_description) <= 160
      and (avatar_url is null or length(avatar_url) <= 2048)
      and jsonb_typeof(socials) = 'array' and jsonb_array_length(socials) <= 12
      and pg_column_size(theme_overrides) <= 4096
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'blocks_data_size') then
    alter table public.blocks add constraint blocks_data_size check (pg_column_size(data) <= 4096) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_name_size') then
    alter table public.profiles add constraint profiles_name_size check (length(display_name) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'models_instagram_size') then
    alter table public.models add constraint models_instagram_size check (length(instagram) <= 40) not valid;
  end if;
end;
$$;

-- no máximo 300 blocos por página
create or replace function public.enforce_block_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from blocks where page_id = new.page_id) >= 300 then
    raise exception 'Limite de 300 blocos por página' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists blocks_limit on public.blocks;
create trigger blocks_limit before insert on public.blocks
  for each row execute function public.enforce_block_limit();

-- ---------------------------------------------------------------------------
-- 4. Anti-robô nas métricas: a mesma pessoa registra no máximo 30 eventos por minuto
-- ---------------------------------------------------------------------------
create or replace function public.events_rate_limit()
returns trigger language plpgsql as $$
begin
  if new.visitor_hash is not null and (
      select count(*) from public.events
       where visitor_hash = new.visitor_hash and created_at > now() - interval '1 minute') >= 30 then
    return null; -- descarta em silêncio
  end if;
  return new;
end;
$$;

drop trigger if exists events_rate on public.events;
create trigger events_rate before insert on public.events
  for each row execute function public.events_rate_limit();

create index if not exists events_visitor_time_idx on public.events (visitor_hash, created_at);

-- ---------------------------------------------------------------------------
-- 5. Sal do hash de IP com gerador criptográfico (troca o sal antigo)
-- ---------------------------------------------------------------------------
update public.app_config
   set value = to_jsonb(encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'))
 where key = 'hash_salt';
revoke all on public.app_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Fotos: só imagens, até 2 MB
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets
       set file_size_limit = 2097152,
           allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
     where id = 'avatars';
  end if;
end;
$$;
