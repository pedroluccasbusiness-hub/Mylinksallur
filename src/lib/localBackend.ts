// Modo demonstração: mesmo comportamento do Supabase (limite de páginas, permissões,
// anti-duplicação de eventos), mas com os dados guardados no navegador.
import type { Backend, NewPage } from './backend'
import { visibleBlocks } from './backend'
import { slugError } from './slug'
import { aggregate, type RawEvent } from './stats'
import { DEFAULT_THEME_ID } from './themes'
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

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface UserRow {
  id: string
  email: string
  passHash: string
  profile: Profile
}

interface DB {
  users: UserRow[]
  models: Model[]
  pages: Page[]
  blocks: Block[]
  events: RawEvent[]
  sessionUserId: string | null
}

const KEY = 'linkhub-demo-v1'

function emptyDb(): DB {
  return { users: [], models: [], pages: [], blocks: [], events: [], sessionUserId: null }
}

export function memoryKV(): KV {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const PBKDF2_ITERATIONS = 210_000

function hex(buf: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Senha da demonstração: PBKDF2-SHA256 com sal aleatório (nunca a senha em texto). */
export async function hashPassword(password: string, saltHex?: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = saltHex ? new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return `pbkdf2$${iterations}$${hex(salt)}$${hex(bits)}`
}

/** Compara em tempo constante. Aceita o formato antigo (sha256) para não travar dados de demonstração existentes. */
export async function verifyPassword(password: string, stored: string, email: string): Promise<boolean> {
  let candidate: string
  if (stored.startsWith('pbkdf2$')) {
    const [, iter, salt] = stored.split('$')
    candidate = await hashPassword(password, salt, Number(iter))
  } else {
    candidate = await sha256(`${email}:${password}`)
  }
  if (candidate.length !== stored.length) return false
  let diff = 0
  for (let i = 0; i < stored.length; i++) diff |= candidate.charCodeAt(i) ^ stored.charCodeAt(i)
  return diff === 0
}

function inviteCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
}

export class LocalBackend implements Backend {
  mode = 'demo' as const
  private listeners = new Set<() => void>()
  /** relógio injetável para testes */
  now: () => Date = () => new Date()

  constructor(private kv: KV) {}

  // ---------------- armazenamento ----------------
  private read(): DB {
    try {
      const raw = this.kv.getItem(KEY)
      return raw ? { ...emptyDb(), ...JSON.parse(raw) } : emptyDb()
    } catch {
      return emptyDb()
    }
  }

  private write(db: DB) {
    try {
      this.kv.setItem(KEY, JSON.stringify(db))
    } catch {
      throw new AppError('O armazenamento do navegador está cheio. Remova imagens grandes ou limpe a demonstração.')
    }
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  private me(db: DB): Profile {
    const u = db.users.find((x) => x.id === db.sessionUserId)
    if (!u) throw new AppError('Entre na sua conta para continuar.', 'auth')
    return u.profile
  }

  private canManageOwner(db: DB, me: Profile, ownerId: string) {
    if (ownerId === me.id) return true
    const owner = db.users.find((u) => u.id === ownerId)?.profile
    return !!owner && owner.agencyId === me.id
  }

  private managedPage(db: DB, me: Profile, id: string): Page {
    const p = db.pages.find((x) => x.id === id)
    if (!p || !this.canManageOwner(db, me, p.ownerId)) throw new AppError('Página não encontrada.', 'not_found')
    return p
  }

  private checkSlug(db: DB, slug: string, pageId?: string) {
    const err = slugError(slug)
    if (err) throw new AppError(err, 'slug_invalid')
    if (db.pages.some((p) => p.slug.toLowerCase() === slug.toLowerCase() && p.id !== pageId))
      throw new AppError('Esse endereço já está em uso. Escolha outro.', 'slug_taken')
  }

  private checkModel(db: DB, ownerId: string, modelId: string | null | undefined) {
    if (modelId && !db.models.some((m) => m.id === modelId && m.ownerId === ownerId))
      throw new AppError('Modelo não pertence a esta conta.', 'model_invalid')
  }

  private checkLimit(db: DB, owner: Profile) {
    if (owner.accountType !== 'creator') return
    const count = db.pages.filter((p) => p.ownerId === owner.id).length
    if (count >= CREATOR_PAGE_LIMIT)
      throw new AppError(`Conta de criadora permite no máximo ${CREATOR_PAGE_LIMIT} páginas.`, 'creator_page_limit')
  }

  // ---------------- auth ----------------
  async currentProfile() {
    const db = this.read()
    return db.users.find((u) => u.id === db.sessionUserId)?.profile ?? null
  }

  onAuthChange(cb: () => void) {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }

  async signUp(input: SignUpInput) {
    const db = this.read()
    const email = input.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError('Digite um e-mail válido.')
    if (input.password.length < 8) throw new AppError('A senha precisa ter pelo menos 8 caracteres.')
    if (db.users.some((u) => u.email === email)) throw new AppError('Já existe uma conta com esse e-mail.')
    const id = crypto.randomUUID()
    const profile: Profile = {
      id,
      email,
      accountType: input.accountType,
      displayName: input.displayName.trim() || email.split('@')[0],
      agencyId: null,
      inviteCode: input.accountType === 'agency' ? inviteCode() : null,
    }
    db.users.push({ id, email, passHash: await hashPassword(input.password), profile })
    db.sessionUserId = id
    this.write(db)
    this.emit()
    return profile
  }

  async signIn(email: string, password: string) {
    const db = this.read()
    const e = email.trim().toLowerCase()
    const u = db.users.find((x) => x.email === e)
    if (!u || !(await verifyPassword(password, u.passHash, e))) throw new AppError('E-mail ou senha incorretos.')
    if (!u.passHash.startsWith('pbkdf2$')) u.passHash = await hashPassword(password) // atualiza hash antigo
    db.sessionUserId = u.id
    this.write(db)
    this.emit()
    return u.profile
  }

  async signOut() {
    const db = this.read()
    db.sessionUserId = null
    this.write(db)
    this.emit()
  }

  async updateProfile(patch: { displayName: string }) {
    const db = this.read()
    const me = this.me(db)
    const u = db.users.find((x) => x.id === me.id)!
    u.profile.displayName = patch.displayName.trim() || u.profile.displayName
    this.write(db)
    this.emit()
  }

  // ---------------- páginas ----------------
  async listManagedPages(): Promise<PageWithOwner[]> {
    const db = this.read()
    const me = this.me(db)
    return db.pages
      .filter((p) => this.canManageOwner(db, me, p.ownerId))
      .map((p) => {
        const owner = db.users.find((u) => u.id === p.ownerId)!.profile
        const model = db.models.find((m) => m.id === p.modelId)
        return {
          ...p,
          ownerName: owner.displayName,
          ownerType: owner.accountType,
          modelName: model?.name ?? (owner.accountType === 'creator' ? owner.displayName : p.title || p.slug),
          blocks: db.blocks.filter((b) => b.pageId === p.id).sort((a, b) => a.position - b.position),
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getPage(id: string) {
    const db = this.read()
    const page = this.managedPage(db, this.me(db), id)
    return { page, blocks: db.blocks.filter((b) => b.pageId === id).sort((a, b) => a.position - b.position) }
  }

  async createPage(input: NewPage) {
    const db = this.read()
    const me = this.me(db)
    const slug = input.slug.trim().toLowerCase()
    this.checkSlug(db, slug)
    this.checkModel(db, me.id, input.modelId)
    this.checkLimit(db, me)
    const ts = this.now().toISOString()
    const page: Page = {
      id: crypto.randomUUID(),
      ownerId: me.id,
      title: '',
      bio: '',
      avatarUrl: null,
      handle: '',
      modelId: null,
      themeId: DEFAULT_THEME_ID,
      themeOverrides: {},
      socials: [],
      isPublished: true,
      showFooter: true,
      seoTitle: '',
      seoDescription: '',
      ...input,
      slug,
      createdAt: ts,
      updatedAt: ts,
    }
    db.pages.push(page)
    this.write(db)
    return page
  }

  async updatePage(id: string, patch: Partial<Page>) {
    const db = this.read()
    const page = this.managedPage(db, this.me(db), id)
    const { id: _i, ownerId: _o, createdAt: _c, ...rest } = patch
    if (rest.slug !== undefined) {
      rest.slug = rest.slug.trim().toLowerCase()
      this.checkSlug(db, rest.slug, id)
    }
    if (rest.modelId !== undefined) this.checkModel(db, page.ownerId, rest.modelId)
    Object.assign(page, rest, { updatedAt: this.now().toISOString() })
    this.write(db)
    return page
  }

  async deletePage(id: string) {
    const db = this.read()
    this.managedPage(db, this.me(db), id)
    db.pages = db.pages.filter((p) => p.id !== id)
    db.blocks = db.blocks.filter((b) => b.pageId !== id)
    db.events = db.events.filter((e) => e.pageId !== id)
    this.write(db)
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
    const db = this.read()
    this.managedPage(db, this.me(db), pageId)
    db.blocks = db.blocks
      .filter((b) => b.pageId !== pageId)
      .concat(blocks.map((b, i) => ({ ...b, pageId, position: i })))
    this.write(db)
  }

  async slugAvailable(slug: string, pageId?: string) {
    const db = this.read()
    return !db.pages.some((p) => p.slug.toLowerCase() === slug.toLowerCase() && p.id !== pageId)
  }

  async uploadImage(file: Blob) {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new AppError('Não foi possível ler a imagem.'))
      r.readAsDataURL(file)
    })
  }

  // ---------------- público ----------------
  async getPublicPage(slug: string) {
    const db = this.read()
    const page = db.pages.find((p) => p.slug === slug.toLowerCase() && p.isPublished)
    if (!page) return null
    return { page, blocks: visibleBlocks(db.blocks.filter((b) => b.pageId === page.id), this.now()) }
  }

  async track(ev: TrackInput) {
    const db = this.read()
    const page = db.pages.find((p) => p.id === ev.pageId && p.isPublished)
    if (!page) return
    if (ev.kind === 'click' && !db.blocks.some((b) => b.id === ev.blockId && b.pageId === page.id)) return
    const now = this.now()
    const day = now.toISOString().slice(0, 10)
    const visitorHash = await sha256(`${ev.visitor ?? 'anon'}|${day}|${page.id}`)
    const windowMs = ev.kind === 'view' ? 30 * 60_000 : 5_000
    const dup = db.events.some(
      (e) =>
        e.pageId === page.id &&
        e.kind === ev.kind &&
        (e.blockId ?? null) === (ev.kind === 'click' ? ev.blockId ?? null : null) &&
        e.visitorHash === visitorHash &&
        now.getTime() - new Date(e.createdAt).getTime() < windowMs,
    )
    if (dup) return
    db.events.push({
      pageId: page.id,
      blockId: ev.kind === 'click' ? ev.blockId ?? null : null,
      kind: ev.kind,
      createdAt: now.toISOString(),
      visitorHash,
      source: ev.source ?? 'direto',
      tag: ev.tag?.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || null,
      device: ev.device ?? 'other',
      country: ev.country && /^[A-Z]{2}$/.test(ev.country) ? ev.country : null,
    })
    this.write(db)
  }

  async getStats(from: Date, to: Date, pageIds?: string[] | null): Promise<Stats> {
    const db = this.read()
    const me = this.me(db)
    const allowed = new Set(db.pages.filter((p) => this.canManageOwner(db, me, p.ownerId)).map((p) => p.id))
    const stats = aggregate(
      db.events.filter((e) => allowed.has(e.pageId) && (!pageIds || pageIds.includes(e.pageId))),
      from,
      to,
    )
    const titles = new Map(db.blocks.map((b) => [b.id, b.data.title ?? b.data.alt ?? '']))
    stats.blocks = stats.blocks.map((b) => ({ ...b, title: titles.get(b.block_id) ?? '' }))
    return stats
  }

  // ---------------- elenco ----------------
  async listModels() {
    const db = this.read()
    const me = this.me(db)
    return db.models.filter((m) => m.ownerId === me.id).sort((a, b) => a.name.localeCompare(b.name))
  }

  async createModel(input: { name: string; instagram?: string }) {
    const db = this.read()
    const me = this.me(db)
    const name = input.name.trim()
    if (!name) throw new AppError('Digite o nome da modelo.')
    const model: Model = {
      id: crypto.randomUUID(),
      ownerId: me.id,
      name,
      instagram: (input.instagram ?? '').trim(),
      createdAt: this.now().toISOString(),
    }
    db.models.push(model)
    this.write(db)
    return model
  }

  async updateModel(id: string, patch: { name?: string; instagram?: string }) {
    const db = this.read()
    const me = this.me(db)
    const m = db.models.find((x) => x.id === id && x.ownerId === me.id)
    if (!m) throw new AppError('Modelo não encontrada.', 'not_found')
    if (patch.name !== undefined) m.name = patch.name.trim() || m.name
    if (patch.instagram !== undefined) m.instagram = patch.instagram.trim()
    this.write(db)
  }

  async deleteModel(id: string) {
    const db = this.read()
    const me = this.me(db)
    db.models = db.models.filter((m) => !(m.id === id && m.ownerId === me.id))
    db.pages.forEach((p) => {
      if (p.modelId === id) p.modelId = null
    })
    this.write(db)
  }

  // ---------------- agência <-> criadora ----------------
  async listCreators() {
    const db = this.read()
    const me = this.me(db)
    return db.users
      .filter((u) => u.profile.agencyId === me.id)
      .map((u) => ({ ...u.profile, pageCount: db.pages.filter((p) => p.ownerId === u.id).length }))
  }

  async getAgency() {
    const db = this.read()
    const me = this.me(db)
    if (!me.agencyId) return null
    return db.users.find((u) => u.id === me.agencyId)?.profile ?? null
  }

  async joinAgency(code: string) {
    const db = this.read()
    const me = this.me(db)
    if (me.accountType !== 'creator') throw new AppError('Só contas de criadora podem se vincular a uma agência.')
    const agency = db.users.find(
      (u) => u.profile.accountType === 'agency' && u.profile.inviteCode === code.trim().toUpperCase(),
    )
    if (!agency) throw new AppError('Código de agência inválido.')
    db.users.find((u) => u.id === me.id)!.profile.agencyId = agency.id
    this.write(db)
    this.emit()
  }

  async leaveAgency() {
    const db = this.read()
    const me = this.me(db)
    db.users.find((u) => u.id === me.id)!.profile.agencyId = null
    this.write(db)
    this.emit()
  }

  async removeCreator(creatorId: string) {
    const db = this.read()
    const me = this.me(db)
    const c = db.users.find((u) => u.id === creatorId && u.profile.agencyId === me.id)
    if (c) c.profile.agencyId = null
    this.write(db)
  }

  async rotateInviteCode() {
    const db = this.read()
    const me = this.me(db)
    if (me.accountType !== 'agency') throw new AppError('Só contas de agência têm código de convite.')
    const code = inviteCode()
    db.users.find((u) => u.id === me.id)!.profile.inviteCode = code
    this.write(db)
    this.emit()
    return code
  }

  // ---------------- demonstração ----------------
  /** Injeta eventos sintéticos (usado só pelo seed da demonstração). */
  seedEvents(events: RawEvent[]) {
    const db = this.read()
    db.events.push(...events)
    this.write(db)
  }

  reset() {
    this.write(emptyDb())
    this.emit()
  }

  hasData() {
    return this.read().users.length > 0
  }
}
