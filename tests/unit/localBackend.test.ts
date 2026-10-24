import { beforeEach, describe, expect, it } from 'vitest'
import { newBlock } from '../../src/lib/blocks'
import { hashPassword, LocalBackend, memoryKV, verifyPassword } from '../../src/lib/localBackend'
import { safeImageUrl, safeUrl, slugError, slugify } from '../../src/lib/slug'
import { effectiveStatus, pageLimit } from '../../src/lib/plans'
import { rangeFor } from '../../src/lib/stats'
import { resolveTheme, THEMES } from '../../src/lib/themes'
import { detectSource, detectTag } from '../../src/lib/track'

let api: LocalBackend

beforeEach(() => {
  api = new LocalBackend(memoryKV())
})

async function agency(email = 'ag@x.dev') {
  return api.signUp({ email, password: 'senha-forte-1', displayName: 'Agência', accountType: 'agency' })
}
async function creator(email = 'cr@x.dev') {
  return api.signUp({ email, password: 'senha-forte-1', displayName: 'Criadora', accountType: 'creator' })
}

describe('contas e limite de páginas', () => {
  it('modelo grátis tem 1 árvore; no Basic, 2', async () => {
    const p = await creator()
    expect([p.plan, p.planStatus]).toEqual(['free', 'active'])
    await api.createPage({ slug: 'cri-um' })
    await expect(api.createPage({ slug: 'cri-dois' })).rejects.toMatchObject({ code: 'plan_page_limit' })
    await expect(api.requestPlan('king')).rejects.toThrow(/inválido/)
    await api.requestPlan('basic') // na demonstração o plano ativa na hora
    await api.createPage({ slug: 'cri-dois' })
    await expect(api.createPage({ slug: 'cri-tres' })).rejects.toMatchObject({ code: 'plan_page_limit' })
    // duplicar também conta no limite
    const [first] = await api.listManagedPages()
    await expect(api.duplicatePage(first.id, 'cri-copia')).rejects.toMatchObject({ code: 'plan_page_limit' })
  })

  it('agência pendente tem 1 árvore de teste; cada plano libera o limite dele', async () => {
    const p = await agency()
    expect([p.plan, p.planStatus]).toEqual(['basic', 'pending'])
    await api.createPage({ slug: 'teste-0' })
    await expect(api.createPage({ slug: 'teste-1' })).rejects.toMatchObject({ code: 'plan_page_limit' })
    await api.requestPlan('plus')
    for (let i = 1; i < 5; i++) await api.createPage({ slug: `teste-${i}` })
    await expect(api.createPage({ slug: 'teste-5' })).rejects.toMatchObject({ code: 'plan_page_limit' })
  })

  it('agência King cria páginas sem limite', async () => {
    await agency()
    api.setPlan('ag@x.dev', 'king')
    for (let i = 0; i < 12; i++) await api.createPage({ slug: `pagina-${i}` })
    expect((await api.listManagedPages()).length).toBe(12)
  })

  it('recusa e-mail repetido, senha curta e login errado', async () => {
    await agency()
    await api.signOut()
    await expect(agency()).rejects.toThrow(/Já existe/)
    await expect(
      api.signUp({ email: 'b@x.dev', password: '123', displayName: '', accountType: 'creator' }),
    ).rejects.toThrow(/8 caracteres/)
    await expect(api.signIn('ag@x.dev', 'errada')).rejects.toThrow(/incorretos/)
    expect((await api.signIn('AG@x.dev', 'senha-forte-1')).accountType).toBe('agency')
  })

  it('slug único, válido e não reservado', async () => {
    await agency()
    await api.createPage({ slug: 'maria' })
    await expect(api.createPage({ slug: 'maria' })).rejects.toMatchObject({ code: 'slug_taken' })
    await expect(api.createPage({ slug: 'app' })).rejects.toMatchObject({ code: 'slug_invalid' })
    await expect(api.createPage({ slug: 'a' })).rejects.toMatchObject({ code: 'slug_invalid' })
  })
})

describe('vínculo agência e criadora', () => {
  it('agência só gerencia páginas da criadora depois do código', async () => {
    const ag = await agency()
    await api.signOut()
    await creator()
    const page = await api.createPage({ slug: 'cri-um', title: 'Minha' })
    await api.signOut()
    await api.signIn('ag@x.dev', 'senha-forte-1')
    await expect(api.getPage(page.id)).rejects.toMatchObject({ code: 'not_found' })

    await api.signOut()
    await api.signIn('cr@x.dev', 'senha-forte-1')
    await expect(api.joinAgency('ERRADO')).rejects.toThrow(/inválido/)
    await api.joinAgency(ag.inviteCode!.toLowerCase())
    await api.signOut()
    await api.signIn('ag@x.dev', 'senha-forte-1')
    const pages = await api.listManagedPages()
    expect(pages.map((p) => p.slug)).toEqual(['cri-um'])
    expect(pages[0].ownerType).toBe('creator')
    await api.updatePage(page.id, { title: 'Editada pela agência' })
    expect((await api.listCreators())[0].pageCount).toBe(1)

    await api.removeCreator((await api.listCreators())[0].id)
    expect(await api.listManagedPages()).toEqual([])
  })
})

describe('página pública e métricas', () => {
  it('mostra só blocos ativos e dentro do agendamento', async () => {
    await agency()
    const p = await api.createPage({ slug: 'publica' })
    const a = newBlock(p.id, 'link', { title: 'Ativo', url: 'https://a.com' })
    const off = { ...newBlock(p.id, 'link', { title: 'Oculto' }), isActive: false }
    const future = { ...newBlock(p.id, 'link', { title: 'Futuro' }), startsAt: new Date(Date.now() + 86400_000).toISOString() }
    const past = { ...newBlock(p.id, 'link', { title: 'Expirado' }), endsAt: new Date(Date.now() - 1000).toISOString() }
    await api.saveBlocks(p.id, [a, off, future, past])
    const pub = await api.getPublicPage('publica')
    expect(pub!.blocks.map((b) => b.data.title)).toEqual(['Ativo'])

    await api.updatePage(p.id, { isPublished: false })
    expect(await api.getPublicPage('publica')).toBeNull()
  })

  it('conta views e cliques sem duplicar e calcula CTR por página', async () => {
    await agency()
    const p = await api.createPage({ slug: 'metricas' })
    const link = newBlock(p.id, 'link', { title: 'L', url: 'https://a.com' })
    await api.saveBlocks(p.id, [link])

    await api.track({ pageId: p.id, kind: 'view', visitor: 'v1', device: 'mobile', source: 'instagram', tag: 'IG-Perfil1', country: 'BR' })
    await api.track({ pageId: p.id, kind: 'view', visitor: 'v1', device: 'mobile' }) // repetida em 30 min
    await api.track({ pageId: p.id, kind: 'view', visitor: 'v2', device: 'desktop' })
    await api.track({ pageId: p.id, kind: 'click', blockId: link.id, visitor: 'v1', source: 'instagram', tag: 'ig-perfil1' })
    await api.track({ pageId: p.id, kind: 'click', blockId: 'nao-existe', visitor: 'v1' })

    const { from, to } = rangeFor(7)
    const s = await api.getStats(from, to, [p.id])
    expect(s.totals).toEqual({ views: 2, clicks: 1, uniques: 2, ctr: 0.5 })
    expect(s.blocks).toEqual([{ block_id: link.id, page_id: p.id, title: 'L', clicks: 1 }])
    expect(s.sources).toEqual([
      { key: 'instagram', count: 1 },
      { key: 'direto', count: 1 },
    ])
    expect(s.tags).toEqual([{ key: 'ig-perfil1', views: 1, clicks: 1 }])
    expect(s.series.length).toBe(7)
    expect(s.series.at(-1)!.views).toBe(2)
  })
})

describe('elenco', () => {
  it('agência liga várias árvores à mesma modelo e não usa modelo de outra conta', async () => {
    await agency('a1@x.dev')
    api.setPlan('a1@x.dev', 'king')
    const m = await api.createModel({ name: 'Valentina', instagram: '@val' })
    await api.createPage({ slug: 'val', modelId: m.id, handle: 'val' })
    await api.createPage({ slug: 'val2', modelId: m.id, handle: 'val.reserva' })
    const pages = await api.listManagedPages()
    expect(pages.map((p) => p.modelName)).toEqual(['Valentina', 'Valentina'])
    await api.signOut()
    await agency('a2@x.dev')
    await expect(api.createPage({ slug: 'roubo', modelId: m.id })).rejects.toMatchObject({ code: 'model_invalid' })
    expect(await api.listModels()).toEqual([])
  })
})

describe('origem da visita', () => {
  const IG_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,2; iOS 17_5; pt_BR)'
  const IG_ANDROID =
    'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36 Instagram 330.0.0.0 Android'
  it('reconhece o navegador interno do Instagram mesmo sem referrer', () => {
    expect(detectSource(IG_IOS, '', '', 'x.com')).toBe('instagram')
    expect(detectSource(IG_ANDROID, '', '', 'x.com')).toBe('instagram')
  })
  it('usa utm_source e depois o referrer', () => {
    const chrome = 'Mozilla/5.0 (Windows NT 10.0) Chrome/124'
    expect(detectSource(chrome, '?utm_source=ig', '', 'meu.app')).toBe('instagram')
    expect(detectSource(chrome, '', 'https://l.instagram.com/?u=x', 'meu.app')).toBe('instagram')
    expect(detectSource(chrome, '', 'https://www.tiktok.com/', 'meu.app')).toBe('tiktok')
    expect(detectSource(chrome, '', 'https://blog.qualquer.com/', 'meu.app')).toBe('outro')
    expect(detectSource(chrome, '', '', 'meu.app')).toBe('direto')
  })
  it('lê o ?src= e limpa caracteres', () => {
    expect(detectTag('?src=IG-Perfil1')).toBe('ig-perfil1')
    expect(detectTag('?utm_campaign=stories')).toBe('stories')
    expect(detectTag('?src=<script>')).toBe('script')
    expect(detectTag('')).toBeNull()
  })
})

describe('segurança', () => {
  it('senha da demonstração vira PBKDF2 com sal e nunca fica em texto', async () => {
    const h1 = await hashPassword('senha-forte-1')
    const h2 = await hashPassword('senha-forte-1')
    expect(h1).toMatch(/^pbkdf2\$210000\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
    expect(h1).not.toBe(h2) // sal diferente
    expect(h1).not.toContain('senha')
    expect(await verifyPassword('senha-forte-1', h1, 'a@b.c')).toBe(true)
    expect(await verifyPassword('errada', h1, 'a@b.c')).toBe(false)
  })

  it('o banco da demonstração não guarda a senha', async () => {
    const kv = memoryKV()
    const local = new LocalBackend(kv)
    await local.signUp({ email: 'x@y.dev', password: 'minha-senha-123', displayName: 'X', accountType: 'creator' })
    expect(kv.getItem('linkhub-demo-v1')).not.toContain('minha-senha-123')
  })

  it('imagens só aceitam https, blob ou data:image', () => {
    expect(safeImageUrl('https://cdn.exemplo.com/a.png')).toBe('https://cdn.exemplo.com/a.png')
    expect(safeImageUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(safeImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeImageUrl('http://inseguro.com/a.png')).toBeNull()
    expect(safeImageUrl('data:text/html,<script>')).toBeNull()
  })
})

describe('utilitários', () => {
  it('slugify e validação', () => {
    expect(slugify('Ana Júlia Oficial!')).toBe('ana-julia-oficial')
    expect(slugError('ana-julia')).toBeNull()
    expect(slugError('-ana')).not.toBeNull()
  })

  it('bloqueia URLs perigosas', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,x')).toBeNull()
    expect(safeUrl('instagram.com/ana')).toBe('https://instagram.com/ana')
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
  })

  it('temas resolvem com personalização', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(8)
    const t = resolveTheme({ themeId: 'vinho-creme', themeOverrides: { accent: '#123456', buttonShape: 'square', accentX: 1 } as never })
    expect(t.accent).toBe('#123456')
    expect(t.buttonShape).toBe('square')
    expect(resolveTheme({ themeId: 'nao-existe', themeOverrides: { accent: 'red' } }).id).toBe('noir-violeta')
  })
})

describe('mensalidade por Pix', () => {
  it('na demonstração o Pix é gerado e, ao confirmar, libera 30 dias (renovar soma)', async () => {
    await agency()
    await expect(api.startPayment('free', { name: 'Fulano Silva', doc: '' })).rejects.toThrow(/inválido/)
    const pay = await api.startPayment('plus', { name: 'Fulano Silva', doc: '529.982.247-25' })
    expect([pay.status, pay.amount]).toEqual(['pending', 97.9])
    const paid = await api.checkPayment(pay.paymentId)
    expect(paid.status).toBe('paid')
    let me = (await api.currentProfile())!
    expect([me.plan, me.planStatus]).toEqual(['plus', 'active'])
    const days = (iso: string | null | undefined) => Math.round((new Date(iso!).getTime() - Date.now()) / 864e5)
    expect(days(me.planExpiresAt)).toBe(30)
    await api.checkPayment(pay.paymentId) // conferir de novo não soma
    expect(days((await api.currentProfile())!.planExpiresAt)).toBe(30)
    const again = await api.startPayment('plus', { name: 'Fulano Silva', doc: '529.982.247-25' })
    await api.checkPayment(again.paymentId)
    me = (await api.currentProfile())!
    expect(days(me.planExpiresAt)).toBe(60)
  })

  it('plano vencido além da tolerância conta como atrasado e volta a 1 árvore', () => {
    const base = { accountType: 'agency' as const, plan: 'platinum', planStatus: 'active' as const }
    const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString()
    expect(effectiveStatus({ ...base, planExpiresAt: ago(1) })).toBe('active')
    expect(effectiveStatus({ ...base, planExpiresAt: ago(4) })).toBe('overdue')
    expect(effectiveStatus({ ...base, planExpiresAt: null })).toBe('active')
    expect(pageLimit({ ...base, planExpiresAt: ago(4) })).toBe(1)
    expect(pageLimit({ ...base, planExpiresAt: ago(1) })).toBe(30)
  })
})
