// Dados de exemplo do modo demonstração. Contas fictícias, só existem no navegador.
import { newBlock } from './blocks'
import type { LocalBackend } from './localBackend'
import type { RawEvent } from './stats'
import type { Block, HeaderLayout, SocialLink } from './types'

export const DEMO_AGENCY = { email: 'agencia@demo.local', password: 'demo-agencia-2026', name: 'Agência Demo' }
export const DEMO_CREATOR = { email: 'criadora@demo.local', password: 'demo-criadora-2026', name: 'Luna Demo' }

/** Avatar gerado (iniciais sobre gradiente), sem foto de ninguém. */
export function initialsAvatar(name: string, a: string, b: string): string {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="73" font-family="Georgia,serif" font-size="44" fill="#fff" text-anchor="middle">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// elenco da agência; Valentina tem duas árvores (uma por perfil de Instagram)
const ROSTER = [
  {
    model: 'Valentina',
    instagram: '@valentina.rs',
    colors: ['#8E2C4A', '#E7C9A1'],
    pages: [
      { slug: 'valentina', title: 'Valentina Rosé', handle: 'valentina.rs', theme: 'vinho-creme', bio: 'Conteúdo exclusivo todo dia.', layout: 'shape' },
      { slug: 'valentina2', title: 'Valentina Rosé', handle: 'valentina.reserva', theme: 'creme-vinho', bio: 'Perfil reserva. Os mesmos links de sempre.', layout: 'banner' },
    ],
  },
  { model: 'Mel', instagram: '@mel.noir', colors: ['#5b2a9e', '#1a0b2b'], pages: [{ slug: 'mel', title: 'Mel Noir', handle: 'mel.noir', theme: 'noir-violeta', bio: 'Ensaios novos toda semana.', layout: 'portrait' }] },
  { model: 'Bia', instagram: '@bia.dourada', colors: ['#C9A46A', '#2b2418'], pages: [{ slug: 'bia', title: 'Bia Dourada', handle: 'bia.dourada', theme: 'onix-dourado', bio: 'Assinatura com desconto só hoje.', layout: 'banner' }] },
  { model: 'Nina', instagram: '@nina.neon', colors: ['#FF3DCB', '#00E5FF'], pages: [{ slug: 'nina', title: 'Nina Neon', handle: 'nina.neon', theme: 'neon-noite', bio: 'Lives às quintas, 22h.', layout: 'minimal' }] },
]

function socials(handle: string): SocialLink[] {
  return [
    { platform: 'instagram', url: `https://instagram.com/${handle}` },
    { platform: 'tiktok', url: `https://tiktok.com/@${handle}` },
    { platform: 'telegram', url: `https://t.me/${handle.replace(/\./g, '_')}` },
  ]
}

function starterBlocks(pageId: string): Block[] {
  const list = [
    newBlock(pageId, 'link', { title: 'Meu Privacy', subtitle: 'Conteúdo completo', url: 'https://privacy.com.br' }),
    newBlock(pageId, 'link', { title: 'OnlyFans', url: 'https://onlyfans.com' }),
    newBlock(pageId, 'link', { title: 'Grupo VIP no Telegram', url: 'https://t.me/exemplo' }),
    newBlock(pageId, 'header', { text: 'Grátis' }),
    newBlock(pageId, 'link', { title: 'TikTok', url: 'https://tiktok.com/@exemplo' }),
    newBlock(pageId, 'link', { title: 'Fale comigo no WhatsApp', url: 'https://wa.me/5500000000000' }),
  ]
  list[0].highlight = 'shine'
  list[1].sensitive = true
  return list
}

const SOURCES = ['instagram', 'instagram', 'instagram', 'instagram', 'instagram', 'tiktok', 'direto', 'x']
const DEVICES = ['mobile', 'mobile', 'mobile', 'mobile', 'mobile', 'desktop', 'tablet']
const COUNTRIES = ['BR', 'BR', 'BR', 'BR', 'BR', 'PT', 'US', 'AR']

function rnd<T>(list: T[], r: () => number) {
  return list[Math.floor(r() * list.length)]
}

/** Gerador determinístico para os prints saírem iguais. */
function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function seedDemo(api: LocalBackend) {
  api.reset()
  const r = mulberry(42)

  // criadora com conta própria, vinculada à agência
  await api.signUp({ email: DEMO_CREATOR.email, password: DEMO_CREATOR.password, displayName: DEMO_CREATOR.name, accountType: 'creator' })
  const luna = await api.createPage({
    slug: 'luna',
    title: 'Luna',
    handle: 'luna.oficial',
    bio: 'Fotos, vídeos e bastidores.',
    themeId: 'rose-nude',
    socials: socials('luna.oficial'),
    avatarUrl: initialsAvatar('Luna', '#B5675A', '#F4E1DA'),
  })
  await api.saveBlocks(luna.id, starterBlocks(luna.id))

  await api.signUp({ email: DEMO_AGENCY.email, password: DEMO_AGENCY.password, displayName: DEMO_AGENCY.name, accountType: 'agency' })
  const agency = await api.currentProfile()
  const pageIds: { id: string; blocks: Block[]; tags: string[] }[] = []
  for (const m of ROSTER) {
    const model = await api.createModel({ name: m.model, instagram: m.instagram })
    for (const [i, s] of m.pages.entries()) {
      const p = await api.createPage({
        slug: s.slug,
        title: s.title,
        handle: s.handle,
        bio: s.bio,
        themeId: s.theme,
        themeOverrides: s.layout ? { headerLayout: s.layout as HeaderLayout } : {},
        modelId: model.id,
        socials: socials(s.handle),
        avatarUrl: initialsAvatar(s.title, m.colors[0], m.colors[1]),
        showFooter: false,
      })
      const blocks = starterBlocks(p.id)
      await api.saveBlocks(p.id, blocks)
      pageIds.push({ id: p.id, blocks, tags: i === 0 ? ['ig-principal', 'ig-stories'] : ['ig-reserva'] })
    }
  }

  // vincula a criadora à agência
  await api.signOut()
  await api.signIn(DEMO_CREATOR.email, DEMO_CREATOR.password)
  await api.joinAgency(agency!.inviteCode!)
  const lunaBlocks = (await api.getPage(luna.id)).blocks
  pageIds.push({ id: luna.id, blocks: lunaBlocks, tags: ['ig-bio'] })
  await api.signOut()

  // 30 dias de tráfego sintético
  const events: RawEvent[] = []
  const now = Date.now()
  pageIds.forEach(({ id, blocks, tags }, pi) => {
    const links = blocks.filter((b) => b.type === 'link')
    for (let d = 29; d >= 0; d--) {
      const base = 18 + pi * 5 + Math.round(10 * Math.sin((d + pi) / 4))
      const views = Math.max(3, Math.round(base * (0.7 + r() * 0.6)))
      for (let v = 0; v < views; v++) {
        const at = new Date(now - d * 86400_000 - Math.floor(r() * 20) * 3600_000)
        const visitor = `v${pi}-${d}-${Math.floor(r() * views * 0.8)}`
        const source = rnd(SOURCES, r)
        const tag = source === 'instagram' ? rnd(tags, r) : null
        events.push({ pageId: id, blockId: null, kind: 'view', createdAt: at.toISOString(), visitorHash: visitor, source, tag, device: rnd(DEVICES, r), country: rnd(COUNTRIES, r) })
        if (r() < 0.55) {
          const weights = links.map((_, i) => 1 / (i + 1))
          let x = r() * weights.reduce((a, b) => a + b, 0)
          let li = 0
          while (x > weights[li] && li < links.length - 1) x -= weights[li++]
          events.push({ pageId: id, blockId: links[li].id, kind: 'click', createdAt: new Date(at.getTime() + 20_000).toISOString(), visitorHash: visitor, source, tag, device: null, country: null })
        }
      }
    }
  })
  api.seedEvents(events)
}
