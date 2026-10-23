// Roda as migrações reais num Postgres em WASM (PGlite) com um "auth" simulado
// igual ao do Supabase, e confere limite de páginas, RLS e métricas.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const MIGRATIONS = join(__dirname, '../../supabase/migrations')

const AUTH_STUB = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;
`

let db: PGlite

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ''])
    await tx.query(`select set_config('request.headers', $1, true)`, [
      JSON.stringify({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'cf-ipcountry': 'BR' }),
    ])
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`)
    return (await tx.query<T>(sql, params)).rows
  })
}

async function signUp(id: string, type: 'agency' | 'creator', name: string) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${name}@teste.dev`,
    JSON.stringify({ account_type: type, display_name: name }),
  ])
}

const AG = '00000000-0000-0000-0000-00000000000a'
const CR = '00000000-0000-0000-0000-00000000000c'
const CR2 = '00000000-0000-0000-0000-0000000000c2'

beforeAll(async () => {
  db = new PGlite()
  await db.exec(AUTH_STUB)
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  }
  await signUp(AG, 'agency', 'agencia')
  await signUp(CR, 'creator', 'criadora')
  await signUp(CR2, 'creator', 'outra')
}, 60_000)

describe('migrações Supabase', () => {
  it('cria perfis com o tipo certo e código de convite só para agência', async () => {
    const rows = await db.query<{ id: string; account_type: string; invite_code: string | null }>(
      `select p.id, p.account_type, i.code as invite_code
         from public.profiles p left join public.agency_invites i on i.agency_id = p.id order by p.id`,
    )
    const ag = rows.rows.find((r) => r.id === AG)!
    const cr = rows.rows.find((r) => r.id === CR)!
    expect(ag.account_type).toBe('agency')
    expect(ag.invite_code).toMatch(/^[A-F0-9]{10}$/)
    expect(cr.account_type).toBe('creator')
    expect(cr.invite_code).toBeNull()
  })

  it('modelo grátis tem 1 árvore; no Basic ativo tem 2; ninguém muda o próprio plano', async () => {
    await as(CR, `insert into pages (owner_id, slug, title) values ($1, 'cri-um', 'Um')`, [CR])
    await expect(
      as(CR, `insert into pages (owner_id, slug, title) values ($1, 'cri-dois', 'Dois')`, [CR]),
    ).rejects.toThrow(/no máximo 1 árvores/)
    // a própria modelo não consegue se dar o plano
    await expect(as(CR, `update profiles set plan = 'basic' where id = $1`, [CR])).rejects.toThrow(/só pelo pagamento/)
    await expect(as(CR, `select admin_set_plan('criadora@teste.dev', 'basic')`)).rejects.toThrow(/permission denied/)
    // pedido de plano fica registrado para a cobrança
    await as(CR, `select request_plan('basic')`)
    await expect(as(CR, `select request_plan('king')`)).rejects.toThrow(/inválido/)
    // pagamento confirmado (servidor/SQL Editor)
    await db.query(`select admin_set_plan('criadora@teste.dev', 'basic', 'active')`)
    await as(CR, `insert into pages (owner_id, slug, title) values ($1, 'cri-dois', 'Dois')`, [CR])
    await expect(
      as(CR, `insert into pages (owner_id, slug, title) values ($1, 'cri-tres', 'Tres')`, [CR]),
    ).rejects.toThrow(/no máximo 2/)
  })

  it('agência pendente fica em 1 árvore; cada plano libera o seu limite; King é ilimitado', async () => {
    const lim = async (plan: string, status = 'active') =>
      (await db.query<{ n: number | null }>(`select plan_page_limit('agency', $1, $2) as n`, [plan, status])).rows[0].n
    expect(await lim('basic')).toBe(2)
    expect(await lim('plus')).toBe(5)
    expect(await lim('diamond')).toBe(10)
    expect(await lim('platinum')).toBe(30)
    expect(await lim('king')).toBeNull()
    expect(await lim('king', 'overdue')).toBe(1)

    const [{ plan, plan_status }] = (await db.query<{ plan: string; plan_status: string }>(
      `select plan, plan_status from profiles where id = $1`, [AG])).rows
    expect([plan, plan_status]).toEqual(['basic', 'pending'])
    await as(AG, `insert into pages (owner_id, slug, title) values ($1, 'ag-pagina-0', 'P')`, [AG])
    await expect(
      as(AG, `insert into pages (owner_id, slug, title) values ($1, 'ag-pagina-x', 'P')`, [AG]),
    ).rejects.toThrow(/no máximo 1/)
    await db.query(`select admin_set_plan('agencia@teste.dev', 'king', 'active')`)
    for (let i = 1; i < 6; i++) {
      await as(AG, `insert into pages (owner_id, slug, title) values ($1, $2, 'P')`, [AG, `ag-pagina-${i}`])
    }
    const r = await as<{ n: number }>(AG, `select count(*)::int as n from pages where owner_id = $1`, [AG])
    expect(r[0].n).toBe(6)
  })

  it('ninguém cria página em nome de outro e não troca o tipo de conta', async () => {
    await expect(
      as(CR2, `insert into pages (owner_id, slug) values ($1, 'invasao')`, [AG]),
    ).rejects.toThrow(/row-level security/)
    await expect(as(CR, `update profiles set account_type = 'agency' where id = $1`, [CR])).rejects.toThrow(
      /não pode ser alterado/,
    )
  })

  it('slug reservado ou inválido é recusado', async () => {
    await expect(as(AG, `insert into pages (owner_id, slug) values ($1, 'app')`, [AG])).rejects.toThrow()
    await expect(as(AG, `insert into pages (owner_id, slug) values ($1, 'Com Espaço')`, [AG])).rejects.toThrow()
    await expect(as(AG, `insert into pages (owner_id, slug) values ($1, 'cri-um')`, [AG])).rejects.toThrow(
      /duplicate|unique/,
    )
  })

  it('visitante anônimo só vê páginas publicadas e blocos ativos/agendados', async () => {
    await as(CR, `update pages set is_published = false where slug = 'cri-dois'`)
    const [{ id: pageId }] = await as<{ id: string }>(CR, `select id from pages where slug = 'cri-um'`)
    await as(
      CR,
      `insert into blocks (page_id, type, position, data, is_active, starts_at) values
        ($1, 'link', 0, '{"title":"Ativo","url":"https://exemplo.com"}', true, null),
        ($1, 'link', 1, '{"title":"Oculto"}', false, null),
        ($1, 'link', 2, '{"title":"Futuro"}', true, now() + interval '1 day')`,
      [pageId],
    )
    const pages = await as<{ slug: string }>(null, `select slug from pages where slug like 'cri-%'`)
    expect(pages.map((p) => p.slug)).toEqual(['cri-um'])
    const blocks = await as<{ title: string }>(null, `select data->>'title' as title from blocks where page_id = $1`, [pageId])
    expect(blocks.map((b) => b.title)).toEqual(['Ativo'])
    // dona vê tudo
    const own = await as(CR, `select id from blocks where page_id = $1`, [pageId])
    expect(own.length).toBe(3)
  })

  it('agência só vê páginas da criadora depois do vínculo por código', async () => {
    const before = await as(AG, `select id from pages where owner_id = $1`, [CR])
    expect(before.length).toBe(1) // só a publicada (leitura pública)
    await expect(as(AG, `update pages set title = 'x' where owner_id = $1 returning id`, [CR])).resolves.toEqual([])

    const [{ invite_code }] = await db.query<{ invite_code: string }>(
      `select code as invite_code from agency_invites where agency_id = $1`,
      [AG],
    ).then((r) => r.rows)
    await expect(as(CR, `select join_agency('ERRADO1')`)).rejects.toThrow(/inválido/)
    await as(CR, `select join_agency($1)`, [invite_code.toLowerCase()])

    const after = await as(AG, `select id from pages where owner_id = $1`, [CR])
    expect(after.length).toBe(2)
    const upd = await as(AG, `update pages set title = 'Editado pela agência' where owner_id = $1 returning id`, [CR])
    expect(upd.length).toBe(2)
    // a criadora continua presa ao limite mesmo vinculada
    await expect(
      as(CR, `insert into pages (owner_id, slug) values ($1, 'cri-tres')`, [CR]),
    ).rejects.toThrow(/no máximo 2/)
    // outra criadora não enxerga as páginas não publicadas
    const other = await as(CR2, `select id from pages where owner_id = $1`, [CR])
    expect(other.length).toBe(1)
  })

  it('registra view e clique com IP em hash, sem duplicar, e agrega métricas', async () => {
    const [{ id: pageId }] = await as<{ id: string }>(CR, `select id from pages where slug = 'cri-um'`)
    const [{ id: blockId }] = await as<{ id: string }>(
      CR,
      `select id from blocks where page_id = $1 and data->>'title' = 'Ativo'`,
      [pageId],
    )
    const track = (kind: string, block: string | null) =>
      as<{ ok: boolean }>(
        null,
        `select track_event($1, $2, $3, 'instagram', 'IG-Perfil1!', 'mobile', null, null) as ok`,
        [pageId, kind, block],
      ).then((r) => r[0].ok)

    expect(await track('view', null)).toBe(true)
    expect(await track('view', null)).toBe(false) // mesma pessoa em 30 min
    expect(await track('click', blockId)).toBe(true)
    expect(await track('click', null)).toBe(false) // clique sem bloco

    // anônimo não lê eventos
    await expect(as(null, `select * from events`)).rejects.toThrow(/permission denied/)

    const ev = await db.query<{ visitor_hash: string; country: string; source: string; tag: string }>(
      `select visitor_hash, country, source, tag from events where page_id = $1`,
      [pageId],
    )
    expect(ev.rows.length).toBe(2)
    for (const e of ev.rows) {
      expect(e.visitor_hash).toMatch(/^[a-f0-9]{64}$/)
      expect(e.visitor_hash).not.toContain('203.0.113.7')
      expect(e.country).toBe('BR')
      expect(e.source).toBe('instagram')
      expect(e.tag).toBe('ig-perfil1')
    }

    const statsSql = `select get_stats(now() - interval '7 days', now() + interval '1 minute', array[$1::uuid]) as s`
    const [{ s }] = await as<{ s: any }>(CR, statsSql, [pageId])
    expect(s.totals).toMatchObject({ views: 1, clicks: 1, uniques: 1 })
    expect(Number(s.totals.ctr)).toBe(1)
    expect(s.blocks[0]).toMatchObject({ block_id: blockId, title: 'Ativo', clicks: 1 })
    expect(s.devices[0]).toMatchObject({ key: 'mobile', count: 1 })
    expect(s.sources[0]).toMatchObject({ key: 'instagram', count: 1 })
    expect(s.tags[0]).toMatchObject({ key: 'ig-perfil1', views: 1, clicks: 1 })
    expect(s.series.length).toBeGreaterThanOrEqual(7)

    // agência vinculada vê as métricas consolidadas; outra criadora não vê nada
    const [{ s: ag }] = await as<{ s: any }>(AG, `select get_stats(now() - interval '7 days', now() + interval '1 minute', null) as s`)
    expect(ag.totals.views).toBe(1)
    const [{ s: other }] = await as<{ s: any }>(CR2, `select get_stats(now() - interval '7 days', now() + interval '1 minute', null) as s`)
    expect(other.totals.views).toBe(0)
  })

  it('origem desconhecida vira "outro" e elenco só aceita modelo do próprio dono', async () => {
    const [{ n }] = await as<{ n: string }>(null, `select normalize_source('site-qualquer') as n`)
    expect(n).toBe('outro')

    const [{ id: modelId }] = await as<{ id: string }>(
      AG,
      `insert into models (owner_id, name, instagram) values ($1, 'Valentina', '@val') returning id`,
      [AG],
    )
    await as(AG, `insert into pages (owner_id, slug, model_id) values ($1, 'val-perfil1', $2)`, [AG, modelId])
    await as(AG, `insert into pages (owner_id, slug, model_id) values ($1, 'val-perfil2', $2)`, [AG, modelId])
    const pages = await as(AG, `select id from pages where model_id = $1`, [modelId])
    expect(pages.length).toBe(2)
    // outra conta não vê o elenco nem usa a modelo
    expect(await as(CR2, `select id from models`)).toEqual([])
    await expect(
      as(AG, `insert into models (owner_id, name) values ($1, 'x')`, [CR2]),
    ).rejects.toThrow(/row-level security/)
  })

  it('segurança: código de convite, dono da página, tamanhos e anti-robô', async () => {
    // criadora vinculada não lê o código da agência; a agência lê o próprio
    await as(CR2, `select join_agency((select code from agency_invites where agency_id = '${AG}'))`).catch(() => null)
    expect(await as(CR2, `select code from agency_invites`)).toEqual([])
    expect((await as(AG, `select code from agency_invites`)).length).toBe(1)
    // ninguém lê o sal do hash
    await expect(as(AG, `select * from app_config`)).rejects.toThrow(/permission denied/)
    // agência não consegue "puxar" para si a página de uma criadora vinculada
    await as(CR, `select join_agency((select code from agency_invites where agency_id = '${AG}'))`).catch(() => null)
    const [{ code }] = (await db.query<{ code: string }>(`select code from agency_invites where agency_id = $1`, [AG])).rows
    await as(CR, `select join_agency($1)`, [code])
    await expect(as(AG, `update pages set owner_id = $1 where owner_id = $2`, [AG, CR])).rejects.toThrow(/dono da página/)
    // tamanhos
    await expect(as(AG, `insert into pages (owner_id, slug, bio) values ($1, 'bio-longa', repeat('x', 400))`, [AG])).rejects.toThrow(/pages_sizes/)
    // anti-robô: o 31º evento do mesmo visitante no minuto é descartado
    const [{ id: pageId }] = await as<{ id: string }>(AG, `select id from pages where slug = 'ag-pagina-0'`)
    await db.query(
      `insert into events (page_id, kind, visitor_hash) select $1, 'view', 'robo' from generate_series(1, 40)`,
      [pageId],
    )
    const [{ n }] = (await db.query<{ n: number }>(`select count(*)::int as n from events where visitor_hash = 'robo'`)).rows
    expect(n).toBe(30)
    await as(CR, `select leave_agency()`)
  })

  it('criadora sai da agência e a agência perde o acesso', async () => {
    await as(CR, `select leave_agency()`)
    const rows = await as(AG, `select id from pages where owner_id = $1`, [CR])
    expect(rows.length).toBe(1)
  })
})
