-- LinkHub Agência — funções de conta (vínculo agência/criadora, convite, slug, storage)

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
