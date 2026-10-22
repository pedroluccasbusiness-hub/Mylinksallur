-- LinkHub Agência — esquema principal
-- Contas: agência (páginas ilimitadas) e criadora (máximo 2 páginas).
-- O limite é garantido aqui no banco (trigger), não só na interface.

-- ---------------------------------------------------------------------------
-- Configuração
-- ---------------------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);

insert into public.app_config (key, value) values
  ('allow_agency_signup', 'true'::jsonb),   -- false = novas contas viram criadora
  ('creator_page_limit',  '2'::jsonb),
  ('hash_salt', to_jsonb(md5(random()::text || clock_timestamp()::text)))
on conflict (key) do nothing;

alter table public.app_config enable row level security;
-- sem policies: só funções security definer leem

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  account_type  text not null check (account_type in ('agency', 'creator')),
  display_name  text not null default '',
  agency_id     uuid references public.profiles (id) on delete set null,
  invite_code   text unique,
  created_at    timestamptz not null default now(),
  constraint agency_link_only_for_creators
    check (agency_id is null or account_type = 'creator')
);

create index if not exists profiles_agency_idx on public.profiles (agency_id);

create or replace function public.gen_invite_code()
returns text language sql volatile as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

-- Cria o perfil quando o usuário se cadastra (metadados vindos do signUp)
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

  insert into public.profiles (id, account_type, display_name, invite_code)
  values (
    new.id,
    v_type,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when v_type = 'agency' then public.gen_invite_code() end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuário não troca o próprio tipo de conta, nem se vincula direto (só via join_agency)
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
  if new.invite_code is distinct from old.invite_code then
    raise exception 'O código de convite não pode ser editado' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Elenco: modelos que a agência gerencia (sem conta própria)
-- ---------------------------------------------------------------------------
create table if not exists public.models (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  instagram   text not null default '',   -- @ principal, só para organização
  created_at  timestamptz not null default now()
);

create index if not exists models_owner_idx on public.models (owner_id);

-- ---------------------------------------------------------------------------
-- Páginas (árvores de links). A página pública é da modelo: nome, foto e @ dela.
-- ---------------------------------------------------------------------------
create table if not exists public.pages (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  slug             text not null,
  title            text not null default '',
  bio              text not null default '',
  avatar_url       text,
  handle           text not null default '',      -- @ do Instagram mostrado na página
  model_id         uuid references public.models (id) on delete set null,
  theme_id         text not null default 'noir-violeta',
  theme_overrides  jsonb not null default '{}'::jsonb,
  socials          jsonb not null default '[]'::jsonb,
  is_published     boolean not null default true,
  show_footer      boolean not null default true,  -- rodapé discreto do app; a agência pode desligar
  seo_title        text not null default '',
  seo_description  text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])$'),
  constraint slug_not_reserved check (slug not in (
    'app', 'api', 'admin', 'entrar', 'cadastro', 'login', 'signup', 'sair', 'auth',
    'assets', 'static', 'public', 'termos', 'privacidade', 'ajuda', 'suporte', 'r'))
);

create unique index if not exists pages_slug_key on public.pages (lower(slug));
create index if not exists pages_owner_idx on public.pages (owner_id);
create index if not exists pages_model_idx on public.pages (model_id);

-- A modelo vinculada precisa ser do mesmo dono da página
create or replace function public.check_page_model()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.model_id is not null and not exists (
      select 1 from public.models m where m.id = new.model_id and m.owner_id = new.owner_id) then
    raise exception 'Modelo não pertence a esta conta' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists pages_model_check on public.pages;
create trigger pages_model_check
  before insert or update of model_id, owner_id on public.pages
  for each row execute function public.check_page_model();

-- Limite de páginas da criadora
create or replace function public.enforce_creator_page_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_type  text;
  v_limit int;
  v_count int;
begin
  if tg_op = 'UPDATE' and new.owner_id = old.owner_id then
    return new;
  end if;

  select account_type into v_type from public.profiles where id = new.owner_id;
  if v_type = 'creator' then
    -- trava o perfil para evitar corrida entre dois inserts simultâneos
    perform 1 from public.profiles where id = new.owner_id for update;
    select (value)::text::int into v_limit from public.app_config where key = 'creator_page_limit';
    select count(*) into v_count from public.pages where owner_id = new.owner_id;
    if v_count >= coalesce(v_limit, 2) then
      raise exception 'Conta de criadora permite no máximo % páginas', coalesce(v_limit, 2)
        using errcode = 'P0001', hint = 'creator_page_limit';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pages_creator_limit on public.pages;
create trigger pages_creator_limit
  before insert or update of owner_id on public.pages
  for each row execute function public.enforce_creator_page_limit();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before update on public.pages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Blocos
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.pages (id) on delete cascade,
  type        text not null check (type in ('link', 'header', 'text', 'image', 'video', 'embed', 'divider')),
  position    int not null default 0,
  data        jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  highlight   text not null default 'none' check (highlight in ('none', 'pulse', 'shine', 'glow')),
  sensitive   boolean not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists blocks_page_idx on public.blocks (page_id, position);

-- ---------------------------------------------------------------------------
-- Eventos (views e cliques). Sem IP em claro: só hash diário com sal.
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id             bigint generated always as identity primary key,
  page_id        uuid not null references public.pages (id) on delete cascade,
  block_id       uuid references public.blocks (id) on delete set null,
  kind           text not null check (kind in ('view', 'click')),
  created_at     timestamptz not null default now(),
  visitor_hash   text,
  source         text,   -- instagram, tiktok, direto... (referrer, utm_source ou navegador do app)
  tag            text,   -- ?src= da árvore, ex.: ig-perfil1
  device         text check (device in ('mobile', 'tablet', 'desktop', 'other')),
  country        text
);

create index if not exists events_page_time_idx on public.events (page_id, created_at);
create index if not exists events_block_idx on public.events (block_id) where block_id is not null;

-- ---------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------
-- Quem pode gerenciar as páginas de um dono: o próprio ou a agência à qual a criadora está vinculada
create or replace function public.can_manage_owner(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
    p_owner = auth.uid()
    or exists (select 1 from public.profiles c where c.id = p_owner and c.agency_id = auth.uid())
  );
$$;

create or replace function public.can_manage_page(p_page uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.pages p where p.id = p_page and public.can_manage_owner(p.owner_id));
$$;

alter table public.profiles enable row level security;
alter table public.models   enable row level security;
alter table public.pages    enable row level security;
alter table public.blocks   enable row level security;
alter table public.events   enable row level security;

-- profiles (helper security definer evita recursão de RLS na própria tabela)
create or replace function public.my_agency_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select agency_id from public.profiles where id = auth.uid();
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or agency_id = auth.uid() or id = public.my_agency_id());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- models: só o dono
drop policy if exists models_owner on public.models;
create policy models_owner on public.models for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- pages
drop policy if exists pages_public_read on public.pages;
create policy pages_public_read on public.pages for select to anon, authenticated
  using (is_published);

drop policy if exists pages_manage_read on public.pages;
create policy pages_manage_read on public.pages for select to authenticated
  using (public.can_manage_owner(owner_id));

drop policy if exists pages_insert on public.pages;
create policy pages_insert on public.pages for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists pages_update on public.pages;
create policy pages_update on public.pages for update to authenticated
  using (public.can_manage_owner(owner_id)) with check (public.can_manage_owner(owner_id));

drop policy if exists pages_delete on public.pages;
create policy pages_delete on public.pages for delete to authenticated
  using (public.can_manage_owner(owner_id));

-- blocks
drop policy if exists blocks_public_read on public.blocks;
create policy blocks_public_read on public.blocks for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and exists (select 1 from public.pages p where p.id = page_id and p.is_published)
  );

drop policy if exists blocks_manage on public.blocks;
create policy blocks_manage on public.blocks for all to authenticated
  using (public.can_manage_page(page_id)) with check (public.can_manage_page(page_id));

-- events: leitura só para quem gerencia a página; escrita só pela função track_event
drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated
  using (public.can_manage_page(page_id));

grant usage on schema public to anon, authenticated;
grant select on public.pages, public.blocks to anon;
grant select, insert, update, delete on public.pages, public.blocks to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.models to authenticated;
grant select on public.events to authenticated;
