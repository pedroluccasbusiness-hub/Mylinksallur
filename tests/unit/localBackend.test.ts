import { beforeEach, describe, expect, it } from 'vitest'
import { newBlock } from '../../src/lib/blocks'
import { LocalBackend, memoryKV } from '../../src/lib/localBackend'
import { safeUrl, slugError, slugify } from '../../src/lib/slug'
import { rangeFor } from '../../src/lib/stats'
import { resolveTheme, THEMES } from '../../src/lib/themes'

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
  it('criadora cria no máximo 2 páginas', async () => {
    await creator()
    await api.createPage({ slug: 'cri-um' })
    await api.createPage({ slug: 'cri-dois' })
    await expect(api.createPage({ slug: 'cri-tres' })).rejects.toMatchObject({ code: 'creator_page_limit' })
    // duplicar também conta no limite
    const [p] = await api.listManagedPages()
    await expect(api.duplicatePage(p.id, 'cri-copia')).rejects.toMatchObject({ code: 'creator_page_limit' })
  })

  it('agência cria páginas sem limite', async () => {
    await agency()
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

    await api.track({ pageId: p.id, kind: 'view', visitor: 'v1', device: 'mobile', referrer: 'instagram.com', country: 'BR' })
    await api.track({ pageId: p.id, kind: 'view', visitor: 'v1', device: 'mobile' }) // repetida em 30 min
    await api.track({ pageId: p.id, kind: 'view', visitor: 'v2', device: 'desktop' })
    await api.track({ pageId: p.id, kind: 'click', blockId: link.id, visitor: 'v1' })
    await api.track({ pageId: p.id, kind: 'click', blockId: 'nao-existe', visitor: 'v1' })

    const { from, to } = rangeFor(7)
    const s = await api.getStats(from, to, [p.id])
    expect(s.totals).toEqual({ views: 2, clicks: 1, uniques: 2, ctr: 0.5 })
    expect(s.blocks).toEqual([{ block_id: link.id, page_id: p.id, title: 'L', clicks: 1 }])
    expect(s.referrers).toEqual([
      { key: 'instagram.com', count: 1 },
      { key: 'direto', count: 1 },
    ])
    expect(s.series.length).toBe(7)
    expect(s.series.at(-1)!.views).toBe(2)
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
