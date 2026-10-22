import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import { visibleBlocks, type Backend, type NewPage } from './backend'
import { slugError } from './slug'
import { emptyStats, TZ } from './stats'
import {
  AppError,
  CREATOR_PAGE_LIMIT,
  type Block,
  type Model,
  type Page,
  type PageWithOwner,
  type Profile,
  type SignUpInput,
  type Stats,
  type TrackInput,
} from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

function toProfile(r: Row, email = ''): Profile {
  return {
    id: r.id,
    email,
    accountType: r.account_type,
    displayName: r.display_name,
    agencyId: r.agency_id,
    inviteCode: null, // fica em agency_invites (só a própria agência lê)
  }
}

function toPage(r: Row): Page {
  return {
    id: r.id,
    ownerId: r.owner_id,
    slug: r.slug,
    title: r.title,
    bio: r.bio,
    avatarUrl: r.avatar_url,
    handle: r.handle ?? '',
    modelId: r.model_id,
    themeId: r.theme_id,
    themeOverrides: r.theme_overrides ?? {},
    socials: r.socials ?? [],
    isPublished: r.is_published,
    showFooter: r.show_footer,
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function fromPage(p: Partial<Page>): Row {
  const map: Record<string, string> = {
    slug: 'slug',
    title: 'title',
    bio: 'bio',
    avatarUrl: 'avatar_url',
    handle: 'handle',
    modelId: 'model_id',
    themeId: 'theme_id',
    themeOverrides: 'theme_overrides',
    socials: 'socials',
    isPublished: 'is_published',
    showFooter: 'show_footer',
    seoTitle: 'seo_title',
    seoDescription: 'seo_description',
  }
  const out: Row = {}
  for (const [k, col] of Object.entries(map)) {
    const v = (p as Row)[k]
    if (v !== undefined) out[col] = v
  }
  return out
}

function toModel(r: Row): Model {
  return { id: r.id, ownerId: r.owner_id, name: r.name, instagram: r.instagram, createdAt: r.created_at }
}

function toBlock(r: Row): Block {
  return {
    id: r.id,
    pageId: r.page_id,
    type: r.type,
    position: r.position,
    data: r.data ?? {},
    isActive: r.is_active,
    highlight: r.highlight,
    sensitive: r.sensitive,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
  }
}

function fromBlock(b: Block, position: number): Row {
  return {
    id: b.id,
    page_id: b.pageId,
    type: b.type,
    position,
    data: b.data,
    is_active: b.isActive,
    highlight: b.highlight,
    sensitive: b.sensitive,
    starts_at: b.startsAt,
    ends_at: b.endsAt,
  }
}

function fail(e: PostgrestError | { message: string; code?: string; hint?: string } | null): never {
  const err = e as PostgrestError
  if (err?.hint === 'creator_page_limit' || /no máximo/.test(err?.message ?? ''))
    throw new AppError(`Conta de criadora permite no máximo ${CREATOR_PAGE_LIMIT} páginas.`, 'creator_page_limit')
  if (err?.code === '23505') throw new AppError('Esse endereço já está em uso. Escolha outro.', 'slug_taken')
  if (err?.code === '23514') throw new AppError('Endereço inválido ou reservado.', 'slug_invalid')
  throw new AppError(err?.message || 'Algo deu errado. Tente de novo.')
}

const AUTH_MSG: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Já existe uma conta com esse e-mail.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos e entre de novo.',
}

export class SupabaseBackend implements Backend {
  mode = 'supabase' as const
  private sb: SupabaseClient

  constructor(
    private url: string,
    private anonKey: string,
  ) {
    this.sb = createClient(url, anonKey)
  }

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new AppError('Entre na sua conta para continuar.', 'auth')
    return id
  }

  async currentProfile() {
    const { data } = await this.sb.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    const { data: row, error } = await this.sb.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (error) fail(error)
    if (!row) return null
    const profile = toProfile(row, user.email ?? '')
    if (profile.accountType === 'agency') {
      const { data: inv } = await this.sb.from('agency_invites').select('code').eq('agency_id', user.id).maybeSingle()
      profile.inviteCode = inv?.code ?? null
    }
    return profile
  }

  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange(() => cb())
    return () => data.subscription.unsubscribe()
  }

  async signUp(input: SignUpInput) {
    if (input.password.length < 8) throw new AppError('A senha precisa ter pelo menos 8 caracteres.')
    const { data, error } = await this.sb.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: { account_type: input.accountType, display_name: input.displayName.trim() },
        emailRedirectTo: `${location.origin}/app`,
      },
    })
    if (error) throw new AppError(AUTH_MSG[error.message] ?? error.message)
    if (!data.session) return null
    return this.currentProfile()
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new AppError(AUTH_MSG[error.message] ?? error.message)
    const p = await this.currentProfile()
    if (!p) throw new AppError('Perfil não encontrado. Confira se as migrações do banco foram aplicadas.')
    return p
  }

  async signOut() {
    await this.sb.auth.signOut()
  }

  async updateProfile(patch: { displayName: string }) {
    const id = await this.uid()
    const { error } = await this.sb.from('profiles').update({ display_name: patch.displayName.trim() }).eq('id', id)
    if (error) fail(error)
  }

  async listManagedPages(): Promise<PageWithOwner[]> {
    const me = await this.uid()
    const { data: people, error: e1 } = await this.sb
      .from('profiles')
      .select('*')
      .or(`id.eq.${me},agency_id.eq.${me}`)
    if (e1) fail(e1)
    const owners = new Map((people ?? []).map((p) => [p.id as string, p]))
    const { data: models } = await this.sb.from('models').select('id, name')
    const modelName = new Map((models ?? []).map((m) => [m.id as string, m.name as string]))
    const { data, error } = await this.sb
      .from('pages')
      .select('*, blocks(*)')
      .in('owner_id', [...owners.keys()])
      .order('created_at', { ascending: false })
    if (error) fail(error)
    return (data ?? []).map((r) => {
      const o = owners.get(r.owner_id)!
      return {
        ...toPage(r),
        ownerName: o.display_name,
        ownerType: o.account_type,
        modelName:
          modelName.get(r.model_id) ?? (o.account_type === 'creator' ? o.display_name : r.title || r.slug),
        blocks: ((r.blocks ?? []) as Row[]).map(toBlock).sort((a, b) => a.position - b.position),
      }
    })
  }

  async getPage(id: string) {
    const { data, error } = await this.sb.from('pages').select('*').eq('id', id).maybeSingle()
    if (error) fail(error)
    if (!data) throw new AppError('Página não encontrada.', 'not_found')
    const { data: blocks, error: e2 } = await this.sb.from('blocks').select('*').eq('page_id', id).order('position')
    if (e2) fail(e2)
    return { page: toPage(data), blocks: (blocks ?? []).map(toBlock) }
  }

  async createPage(input: NewPage) {
    const slug = input.slug.trim().toLowerCase()
    const err = slugError(slug)
    if (err) throw new AppError(err, 'slug_invalid')
    const owner = await this.uid()
    const { data, error } = await this.sb
      .from('pages')
      .insert({ ...fromPage(input), slug, owner_id: owner })
      .select('*')
      .single()
    if (error) fail(error)
    return toPage(data)
  }

  async updatePage(id: string, patch: Partial<Page>) {
    const row = fromPage(patch)
    if (row.slug !== undefined) {
      row.slug = String(row.slug).trim().toLowerCase()
      const err = slugError(row.slug)
      if (err) throw new AppError(err, 'slug_invalid')
    }
    const { data, error } = await this.sb.from('pages').update(row).eq('id', id).select('*').single()
    if (error) fail(error)
    return toPage(data)
  }

  async deletePage(id: string) {
    const { error } = await this.sb.from('pages').delete().eq('id', id)
    if (error) fail(error)
  }

  async duplicatePage(id: string, slug: string) {
    const { page, blocks } = await this.getPage(id)
    const { id: _i, ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = page
    const copy = await this.createPage({ ...rest, slug, title: `${page.title} (cópia)` })
    await this.saveBlocks(
      copy.id,
      blocks.map((b) => ({ ...b, id: crypto.randomUUID(), pageId: copy.id })),
    )
    return copy
  }

  async saveBlocks(pageId: string, blocks: Block[]) {
    const rows = blocks.map((b, i) => fromBlock({ ...b, pageId }, i))
    if (rows.length) {
      const { error } = await this.sb.from('blocks').upsert(rows)
      if (error) fail(error)
    }
    let del = this.sb.from('blocks').delete().eq('page_id', pageId)
    if (rows.length) del = del.not('id', 'in', `(${rows.map((r) => r.id).join(',')})`)
    const { error } = await del
    if (error) fail(error)
  }

  async slugAvailable(slug: string, pageId?: string) {
    const { data, error } = await this.sb.rpc('slug_available', { p_slug: slug, p_page_id: pageId ?? null })
    if (error) fail(error)
    return Boolean(data)
  }

  async uploadImage(file: Blob) {
    const me = await this.uid()
    const path = `${me}/${crypto.randomUUID()}.webp`
    const { error } = await this.sb.storage.from('avatars').upload(path, file, {
      contentType: file.type || 'image/webp',
      upsert: false,
    })
    if (error) throw new AppError('Não foi possível enviar a imagem: ' + error.message)
    return this.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  async getPublicPage(slug: string) {
    const { data, error } = await this.sb
      .from('pages')
      .select('*')
      .eq('slug', slug.toLowerCase())
      .eq('is_published', true)
      .maybeSingle()
    if (error) fail(error)
    if (!data) return null
    const page = toPage(data)
    // para visitantes o RLS já filtra; o filtro local cobre quem está logado vendo a própria página
    const { data: blocks, error: e2 } = await this.sb
      .from('blocks')
      .select('*')
      .eq('page_id', page.id)
      .eq('is_active', true)
      .order('position')
    if (e2) fail(e2)
    return { page, blocks: visibleBlocks((blocks ?? []).map(toBlock)) }
  }

  /** fetch com keepalive: o registro do clique sobrevive à saída da página para o destino */
  async track(ev: TrackInput) {
    await fetch(`${this.url}/rest/v1/rpc/track_event`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_page_id: ev.pageId,
        p_kind: ev.kind,
        p_block_id: ev.blockId ?? null,
        p_source: ev.source ?? null,
        p_tag: ev.tag ?? null,
        p_device: ev.device ?? null,
        p_country: ev.country ?? null,
        p_visitor: ev.visitor ?? null,
      }),
    })
  }

  async getStats(from: Date, to: Date, pageIds?: string[] | null): Promise<Stats> {
    const { data, error } = await this.sb.rpc('get_stats', {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_page_ids: pageIds ?? null,
      p_tz: TZ,
    })
    if (error) fail(error)
    const s = (data ?? emptyStats()) as Stats
    s.totals.ctr = Number(s.totals.ctr)
    return s
  }

  async listModels() {
    const me = await this.uid()
    const { data, error } = await this.sb.from('models').select('*').eq('owner_id', me).order('name')
    if (error) fail(error)
    return (data ?? []).map(toModel)
  }

  async createModel(input: { name: string; instagram?: string }) {
    const me = await this.uid()
    const name = input.name.trim()
    if (!name) throw new AppError('Digite o nome da modelo.')
    const { data, error } = await this.sb
      .from('models')
      .insert({ owner_id: me, name, instagram: (input.instagram ?? '').trim() })
      .select('*')
      .single()
    if (error) fail(error)
    return toModel(data)
  }

  async updateModel(id: string, patch: { name?: string; instagram?: string }) {
    const row: Row = {}
    if (patch.name !== undefined && patch.name.trim()) row.name = patch.name.trim()
    if (patch.instagram !== undefined) row.instagram = patch.instagram.trim()
    const { error } = await this.sb.from('models').update(row).eq('id', id)
    if (error) fail(error)
  }

  async deleteModel(id: string) {
    const { error } = await this.sb.from('models').delete().eq('id', id)
    if (error) fail(error)
  }

  async listCreators() {
    const me = await this.uid()
    const { data, error } = await this.sb.from('profiles').select('*').eq('agency_id', me)
    if (error) fail(error)
    const ids = (data ?? []).map((r) => r.id)
    const counts = new Map<string, number>()
    if (ids.length) {
      const { data: pages } = await this.sb.from('pages').select('owner_id').in('owner_id', ids)
      for (const p of pages ?? []) counts.set(p.owner_id, (counts.get(p.owner_id) ?? 0) + 1)
    }
    return (data ?? []).map((r) => ({ ...toProfile(r), pageCount: counts.get(r.id) ?? 0 }))
  }

  async getAgency() {
    const p = await this.currentProfile()
    if (!p?.agencyId) return null
    const { data } = await this.sb.from('profiles').select('*').eq('id', p.agencyId).maybeSingle()
    return data ? toProfile(data) : null
  }

  async joinAgency(code: string) {
    const { error } = await this.sb.rpc('join_agency', { p_code: code })
    if (error) throw new AppError(error.message)
  }

  async leaveAgency() {
    const { error } = await this.sb.rpc('leave_agency')
    if (error) fail(error)
  }

  async removeCreator(creatorId: string) {
    const { error } = await this.sb.rpc('remove_creator', { p_creator: creatorId })
    if (error) fail(error)
  }

  async rotateInviteCode() {
    const { data, error } = await this.sb.rpc('rotate_invite_code')
    if (error) fail(error)
    return String(data)
  }
}
