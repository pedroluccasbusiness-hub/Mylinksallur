-- LinkHub — planos e limites de árvores de links
-- Pode rodar num banco que já tem as migrações anteriores.
--
-- Modelo (conta própria, sem agência): free = 1 árvore | basic (R$ 9,90) = 2
-- Agência: basic (R$ 49,90) = 2 | plus (R$ 97,90) = 5 | diamond (R$ 249,70) = 10
--          platinum (R$ 497,00) = 30 | king (R$ 997,00) = sem limite
-- Enquanto a mensalidade não está ativa (pendente ou atrasada), a conta fica no limite de teste: 1 árvore.
-- Quem ativa o plano é o processador de pagamento (Asaas, via função do servidor) ou o dono, no SQL Editor.
-- O usuário nunca muda o próprio plano: só pede (requested_plan).

alter table public.profiles add column if not exists plan text;
alter table public.profiles add column if not exists plan_status text not null default 'pending';
alter table public.profiles add column if not exists requested_plan text;
alter table public.profiles add column if not exists plan_updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_plan_valid') then
    alter table public.profiles add constraint profiles_plan_valid check (
      (account_type = 'creator' and (plan is null or plan in ('free', 'basic')))
      or (account_type = 'agency' and (plan is null or plan in ('basic', 'plus', 'diamond', 'platinum', 'king')))
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_plan_status_valid') then
    alter table public.profiles add constraint profiles_plan_status_valid check (plan_status in ('active', 'pending', 'overdue', 'canceled'));
  end if;
end;
$$;

-- contas que já existiam: criadoras no plano grátis; agências existentes (as do dono) ficam sem limite
update public.profiles set plan = 'free', plan_status = 'active'
 where account_type = 'creator' and plan is null;
update public.profiles set plan = 'king', plan_status = 'active'
 where account_type = 'agency' and plan is null;

-- Quantas árvores a conta pode ter. null = sem limite.
create or replace function public.plan_page_limit(p_type text, p_plan text, p_status text)
returns int language sql immutable as $$
  select case
    when p_type = 'creator' then
      case when p_status = 'active' and p_plan = 'basic' then 2 else 1 end
    when p_status <> 'active' then 1
    when p_plan = 'basic' then 2
    when p_plan = 'plus' then 5
    when p_plan = 'diamond' then 10
    when p_plan = 'platinum' then 30
    when p_plan = 'king' then null
    else 1
  end;
$$;

-- O limite agora vale para modelo e agência, conforme o plano
create or replace function public.enforce_creator_page_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_profile profiles;
  v_limit   int;
  v_count   int;
begin
  if tg_op = 'UPDATE' and new.owner_id = old.owner_id then
    return new;
  end if;

  -- trava o perfil para evitar corrida entre dois inserts simultâneos
  select * into v_profile from profiles where id = new.owner_id for update;
  v_limit := plan_page_limit(v_profile.account_type, v_profile.plan, v_profile.plan_status);
  if v_limit is not null then
    select count(*) into v_count from pages where owner_id = new.owner_id;
    if v_count >= v_limit then
      raise exception 'Seu plano permite no máximo % árvores de links', v_limit
        using errcode = 'P0001', hint = 'plan_page_limit';
    end if;
  end if;
  return new;
end;
$$;

-- novas contas: modelo começa no grátis (ativo); agência começa pendente com o plano escolhido no cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_type  text := coalesce(new.raw_user_meta_data ->> 'account_type', 'creator');
  v_want  text := new.raw_user_meta_data ->> 'plan';
  v_allow boolean;
begin
  select (value)::text::boolean into v_allow from public.app_config where key = 'allow_agency_signup';
  if v_type not in ('agency', 'creator') or (v_type = 'agency' and not coalesce(v_allow, true)) then
    v_type := 'creator';
  end if;
  -- coalesce: sem plano escolhido, "null not in (...)" seria nulo e passaria direto
  if v_type = 'creator' and coalesce(v_want, '') not in ('basic') then v_want := null; end if;
  if v_type = 'agency' and coalesce(v_want, '') not in ('basic', 'plus', 'diamond', 'platinum', 'king') then v_want := 'basic'; end if;

  insert into public.profiles (id, account_type, display_name, plan, plan_status, requested_plan)
  values (
    new.id,
    v_type,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1)), 80),
    case when v_type = 'creator' then 'free' else v_want end,
    case when v_type = 'creator' then 'active' else 'pending' end,
    case when v_type = 'creator' then v_want end
  );
  if v_type = 'agency' then
    insert into public.agency_invites (agency_id, code) values (new.id, public.gen_invite_code());
  end if;
  return new;
end;
$$;

-- o usuário não troca plano nem status sozinho
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
  if new.plan is distinct from old.plan or new.plan_status is distinct from old.plan_status
     or new.requested_plan is distinct from old.requested_plan then
    raise exception 'O plano é alterado só pelo pagamento' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- pedido de plano (a cobrança no Asaas usa este pedido)
create or replace function public.request_plan(p_plan text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_type text;
begin
  select account_type into v_type from profiles where id = auth.uid();
  if v_type is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if (v_type = 'creator' and coalesce(p_plan, '') not in ('basic'))
     or (v_type = 'agency' and coalesce(p_plan, '') not in ('basic', 'plus', 'diamond', 'platinum', 'king')) then
    raise exception 'Plano inválido para este tipo de conta';
  end if;
  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set requested_plan = p_plan where id = auth.uid();
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

revoke all on function public.request_plan(text) from public, anon;
grant execute on function public.request_plan(text) to authenticated;

-- Ativação manual (SQL Editor / servidor de pagamento). Ninguém do site consegue chamar.
--   select admin_set_plan('email@cliente.com', 'plus', 'active');
create or replace function public.admin_set_plan(p_email text, p_plan text, p_status text default 'active')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Nenhuma conta com esse e-mail';
  end if;
  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles
     set plan = p_plan, plan_status = p_status, requested_plan = null, plan_updated_at = now()
   where id = v_id;
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

revoke all on function public.admin_set_plan(text, text, text) from public, anon, authenticated;
revoke all on function public.plan_page_limit(text, text, text) from public, anon;
grant execute on function public.plan_page_limit(text, text, text) to authenticated;
