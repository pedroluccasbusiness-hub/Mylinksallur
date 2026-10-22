-- LinkHub Agência — funções (RPC)

-- ---------------------------------------------------------------------------
-- Registro de view/clique (chamado pela página pública, inclusive anônimo)
-- IP nunca é gravado: vira hash diário por página com sal secreto.
-- ---------------------------------------------------------------------------
create or replace function public.track_event(
  p_page_id   uuid,
  p_kind      text,
  p_block_id  uuid default null,
  p_referrer  text default null,
  p_device    text default null,
  p_country   text default null,
  p_visitor   text default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_headers  json;
  v_ip       text;
  v_country  text;
  v_salt     text;
  v_hash     text;
  v_device   text;
  v_ref      text;
  v_window   interval;
begin
  if p_kind not in ('view', 'click') then
    return false;
  end if;

  if not exists (select 1 from pages where id = p_page_id and is_published) then
    return false;
  end if;

  if p_kind = 'click' and (p_block_id is null or not exists (
      select 1 from blocks where id = p_block_id and page_id = p_page_id)) then
    return false;
  end if;

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;

  v_ip := nullif(trim(split_part(coalesce(
            v_headers ->> 'cf-connecting-ip',
            v_headers ->> 'x-forwarded-for',
            v_headers ->> 'x-real-ip', ''), ',', 1)), '');

  v_country := upper(coalesce(nullif(v_headers ->> 'cf-ipcountry', ''), p_country, ''));
  if v_country !~ '^[A-Z]{2}$' or v_country = 'XX' then
    v_country := null;
  end if;

  select value #>> '{}' into v_salt from app_config where key = 'hash_salt';

  if coalesce(v_ip, p_visitor) is not null then
    v_hash := encode(sha256(convert_to(
      coalesce(v_ip, 'v:' || left(p_visitor, 64)) || '|' || current_date::text || '|' ||
      coalesce(v_salt, '') || '|' || p_page_id::text, 'UTF8')), 'hex');
  end if;

  v_device := case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'other' end;

  v_ref := lower(left(regexp_replace(coalesce(p_referrer, ''), '[^a-zA-Z0-9.\-]', '', 'g'), 100));
  if v_ref = '' then
    v_ref := null;
  end if;

  -- anti-inflação: mesma pessoa, mesmo alvo, em janela curta = não conta de novo
  v_window := case when p_kind = 'view' then interval '30 minutes' else interval '5 seconds' end;
  if v_hash is not null and exists (
      select 1 from events
       where page_id = p_page_id and kind = p_kind
         and block_id is not distinct from p_block_id
         and visitor_hash = v_hash
         and created_at > now() - v_window) then
    return false;
  end if;

  insert into events (page_id, block_id, kind, visitor_hash, referrer_host, device, country)
  values (p_page_id, case when p_kind = 'click' then p_block_id end, p_kind, v_hash, v_ref, v_device, v_country);
  return true;
end;
$$;

revoke all on function public.track_event(uuid, text, uuid, text, text, text, text) from public;
grant execute on function public.track_event(uuid, text, uuid, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Métricas agregadas. security invoker: o RLS de events/pages decide o que entra.
-- p_page_ids nulo = todas as páginas que o usuário gerencia (visão da agência).
-- ---------------------------------------------------------------------------
create or replace function public.get_stats(
  p_from     timestamptz,
  p_to       timestamptz,
  p_page_ids uuid[] default null,
  p_tz       text default 'America/Sao_Paulo'
)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with ev as (
    select e.*
      from events e
      join pages p on p.id = e.page_id
     where e.created_at >= p_from and e.created_at < p_to
       and (p_page_ids is null or e.page_id = any (p_page_ids))
       and public.can_manage_owner(p.owner_id)
  ),
  totals as (
    select count(*) filter (where kind = 'view')  as views,
           count(*) filter (where kind = 'click') as clicks,
           count(distinct visitor_hash) filter (where kind = 'view') as uniques
      from ev
  ),
  days as (
    select d::date as day
      from generate_series((p_from at time zone p_tz)::date, ((p_to - interval '1 second') at time zone p_tz)::date, interval '1 day') d
  ),
  series as (
    select d.day,
           count(ev.id) filter (where ev.kind = 'view')  as views,
           count(ev.id) filter (where ev.kind = 'click') as clicks
      from days d
      left join ev on (ev.created_at at time zone p_tz)::date = d.day
     group by d.day
  ),
  by_page as (
    select page_id,
           count(*) filter (where kind = 'view')  as views,
           count(*) filter (where kind = 'click') as clicks
      from ev group by page_id
  ),
  by_block as (
    select ev.block_id, ev.page_id, coalesce(b.data ->> 'title', b.data ->> 'alt', '') as title, count(*) as clicks
      from ev
      left join blocks b on b.id = ev.block_id
     where ev.kind = 'click' and ev.block_id is not null
     group by ev.block_id, ev.page_id, b.data
  ),
  dim as (
    select 'referrers' as dim, coalesce(referrer_host, 'direto') as key, count(*) as n from ev where kind = 'view' group by 2
    union all
    select 'devices', coalesce(device, 'other'), count(*) from ev where kind = 'view' group by 2
    union all
    select 'countries', coalesce(country, '??'), count(*) from ev where kind = 'view' group by 2
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
                 'views', views, 'clicks', clicks, 'uniques', uniques,
                 'ctr', case when views > 0 then round(clicks::numeric / views, 4) else 0 end)
               from totals),
    'series', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'clicks', clicks) order by day) from series), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('page_id', page_id, 'views', views, 'clicks', clicks) order by views desc) from by_page), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('block_id', block_id, 'page_id', page_id, 'title', title, 'clicks', clicks) order by clicks desc) from by_block), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc) from dim where dim = 'referrers'), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc) from dim where dim = 'devices'), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc) from dim where dim = 'countries'), '[]'::jsonb)
  );
$$;

grant execute on function public.get_stats(timestamptz, timestamptz, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- Vínculo criadora <-> agência
-- ---------------------------------------------------------------------------
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

  select id into v_agency from profiles
   where account_type = 'agency' and invite_code = upper(trim(p_code));
  if v_agency is null then
    raise exception 'Código de agência inválido';
  end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set agency_id = v_agency where id = v_me.id;
  perform set_config('app.bypass_profile_guard', 'off', true);
  return v_agency;
end;
$$;

-- criadora sai da agência
create or replace function public.leave_agency()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set agency_id = null where id = auth.uid();
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

-- agência desvincula uma criadora
create or replace function public.remove_creator(p_creator uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set agency_id = null where id = p_creator and agency_id = auth.uid();
  perform set_config('app.bypass_profile_guard', 'off', true);
end;
$$;

-- agência gera novo código de convite
create or replace function public.rotate_invite_code()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code text := public.gen_invite_code();
begin
  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set invite_code = v_code where id = auth.uid() and account_type = 'agency';
  perform set_config('app.bypass_profile_guard', 'off', true);
  if not found then
    raise exception 'Só contas de agência têm código de convite';
  end if;
  return v_code;
end;
$$;

-- slug livre? (usado no editor antes de salvar)
create or replace function public.slug_available(p_slug text, p_page_id uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from pages where lower(slug) = lower(p_slug) and id is distinct from p_page_id);
$$;

revoke all on function public.join_agency(text), public.leave_agency(), public.remove_creator(uuid),
  public.rotate_invite_code() from public;
grant execute on function public.join_agency(text), public.leave_agency(), public.remove_creator(uuid),
  public.rotate_invite_code() to authenticated;
grant execute on function public.slug_available(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: fotos de perfil (bucket público, cada usuário escreve só na sua pasta)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
      on conflict (id) do nothing;

    execute $p$drop policy if exists avatars_read on storage.objects$p$;
    execute $p$create policy avatars_read on storage.objects for select using (bucket_id = 'avatars')$p$;
    execute $p$drop policy if exists avatars_write on storage.objects$p$;
    execute $p$create policy avatars_write on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$drop policy if exists avatars_update on storage.objects$p$;
    execute $p$create policy avatars_update on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$drop policy if exists avatars_delete on storage.objects$p$;
    execute $p$create policy avatars_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end;
$$;
