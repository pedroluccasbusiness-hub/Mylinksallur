-- LinkHub — mensalidade por Pix (Jungle Pagamentos)
-- A Jungle só cria cobranças Pix avulsas; a assinatura é montada aqui:
--   cada pagamento confirmado libera o plano por 30 dias (plan_expires_at).
--   vencido há mais de 3 dias, a conta volta ao limite de teste até pagar de novo.
--   as árvores que já existem continuam no ar; só não dá para criar novas acima do limite.
-- Quem confirma o pagamento são as funções do servidor (supabase/functions), com a chave service_role.

alter table public.profiles add column if not exists plan_expires_at timestamptz;

-- dias de tolerância depois do vencimento
create or replace function public.plan_grace() returns interval language sql immutable as $$ select interval '3 days' $$;

-- situação real da mensalidade, levando o vencimento em conta (null = sem vencimento, ex.: plano dado no SQL Editor)
create or replace function public.effective_plan_status(p_status text, p_expires timestamptz)
returns text language sql stable as $$
  select case
    when p_status = 'active' and p_expires is not null and p_expires + public.plan_grace() < now() then 'overdue'
    else p_status
  end;
$$;

-- preço de cada plano: o servidor cobra este valor, nunca o que vier do navegador
create or replace function public.plan_price(p_type text, p_plan text)
returns numeric language sql immutable as $$
  select case
    when p_type = 'creator' and p_plan = 'basic' then 9.90
    when p_type = 'agency' and p_plan = 'basic' then 49.90
    when p_type = 'agency' and p_plan = 'plus' then 97.90
    when p_type = 'agency' and p_plan = 'diamond' then 249.70
    when p_type = 'agency' and p_plan = 'platinum' then 497.00
    when p_type = 'agency' and p_plan = 'king' then 997.00
  end;
$$;

create table if not exists public.billing_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  plan         text not null,
  amount       numeric(10, 2) not null check (amount > 0),
  status       text not null default 'creating' check (status in ('creating', 'pending', 'paid', 'expired', 'failed')),
  jungle_tx_id text unique,
  pix_code     text,
  expires_at   timestamptz,
  paid_at      timestamptz,
  period_end   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists billing_payments_user_idx on public.billing_payments (user_id, created_at desc);

alter table public.billing_payments enable row level security;
-- cada conta só vê os próprios pagamentos; criar e alterar é só pelo servidor
drop policy if exists billing_payments_own on public.billing_payments;
create policy billing_payments_own on public.billing_payments for select to authenticated using (user_id = auth.uid());
revoke all on public.billing_payments from anon, authenticated;
grant select on public.billing_payments to authenticated;

-- Confirma um pagamento e estende o plano. Idempotente: chamar duas vezes não dá 60 dias.
create or replace function public.apply_payment(p_payment uuid)
returns public.billing_payments
language plpgsql security definer set search_path = public
as $$
declare
  v_pay  billing_payments;
  v_prof profiles;
  v_base timestamptz;
begin
  select * into v_pay from billing_payments where id = p_payment for update;
  if v_pay.id is null then
    raise exception 'Pagamento não encontrado';
  end if;
  if v_pay.status = 'paid' then
    return v_pay;
  end if;

  select * into v_prof from profiles where id = v_pay.user_id for update;
  -- mesmo plano ainda em dia: soma 30 dias ao vencimento atual; troca de plano ou vencido: conta a partir de hoje
  if v_prof.plan = v_pay.plan and v_prof.plan_status = 'active' and v_prof.plan_expires_at > now() then
    v_base := v_prof.plan_expires_at;
  else
    v_base := now();
  end if;

  update billing_payments
     set status = 'paid', paid_at = now(), period_end = v_base + interval '30 days'
   where id = v_pay.id
  returning * into v_pay;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles
     set plan = v_pay.plan, plan_status = 'active', requested_plan = null,
         plan_expires_at = v_pay.period_end, plan_updated_at = now()
   where id = v_pay.user_id;
  perform set_config('app.bypass_profile_guard', 'off', true);
  return v_pay;
end;
$$;

revoke all on function public.apply_payment(uuid) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid) to service_role;

-- o limite de árvores passa a respeitar o vencimento
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
  v_limit := plan_page_limit(v_profile.account_type, v_profile.plan,
                             effective_plan_status(v_profile.plan_status, v_profile.plan_expires_at));
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

-- o vencimento também só muda pelo pagamento
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
     or new.requested_plan is distinct from old.requested_plan
     or new.plan_expires_at is distinct from old.plan_expires_at then
    raise exception 'O plano é alterado só pelo pagamento' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ativação manual continua valendo e não tem vencimento (cortesia, parceiro, conta do dono)
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
     set plan = p_plan, plan_status = p_status, requested_plan = null, plan_updated_at = now(), plan_expires_at = null
   where id = v_id;
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

revoke all on function public.admin_set_plan(text, text, text) from public, anon, authenticated;
revoke all on function public.plan_price(text, text) from public, anon;
grant execute on function public.plan_price(text, text) to authenticated, service_role;
