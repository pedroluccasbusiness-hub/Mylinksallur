// Teste da função de pagamento com Supabase e Jungle de mentira (nada é cobrado, nada vai para o banco real).
// Rodar:  npx deno@2.9.6 test --allow-net --allow-env supabase/functions/pagamentos/pagamentos_test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1'

const STUB = 54399
const USER = '11111111-1111-1111-1111-111111111111'
const SECRET = 'whsec_teste'
const rows: Record<string, any>[] = []
const charges: Record<string, any>[] = []
let tx = { status: 'PENDING', amount: 97.9, productValue: 97.9 }

function filter(url: URL) {
  return rows.filter((r) =>
    [...url.searchParams].every(([k, v]) => {
      if (!v.startsWith('eq.')) return true // gt/order/limit/select: ignorados no dublê
      return String(r[k]) === v.slice(3)
    }),
  )
}

const stub = Deno.serve({ port: STUB, onListen() {} }, async (req) => {
  const url = new URL(req.url)
  const p = url.pathname
  const one = (req.headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const out = (data: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } })

  if (p === '/auth/v1/user') {
    const a = req.headers.get('authorization')
    if (a === 'Bearer dono') return out({ id: USER, email: 'dono@teste.dev', aud: 'authenticated' })
    if (a === 'Bearer outro') return out({ id: crypto.randomUUID(), email: 'outro@teste.dev', aud: 'authenticated' })
    return out({ msg: 'invalid' }, { status: 401 })
  }
  if (p === '/rest/v1/profiles') return out(one ? { account_type: 'agency' } : [{ account_type: 'agency' }])
  if (p === '/rest/v1/rpc/plan_price') {
    const b = await req.json()
    return out(b.p_type === 'agency' && b.p_plan === 'plus' ? 97.9 : null)
  }
  if (p === '/rest/v1/rpc/apply_payment') {
    const b = await req.json()
    const r = rows.find((x) => x.id === b.p_payment)!
    if (r.status !== 'paid') Object.assign(r, { status: 'paid', period_end: '2026-12-01T00:00:00Z' })
    return out(r)
  }
  if (p === '/rest/v1/billing_payments') {
    if (req.method === 'HEAD') return new Response(null, { headers: { 'content-range': `*/${filter(url).length}` } })
    if (req.method === 'GET') {
      const f = filter(url).filter((r) => r.status === 'pending' || url.searchParams.has('id') || url.searchParams.has('jungle_tx_id'))
      return out(one ? f[0] ?? null : f)
    }
    if (req.method === 'POST') {
      const b = await req.json()
      const r = { id: crypto.randomUUID(), status: 'creating', jungle_tx_id: null, pix_code: null, expires_at: null, period_end: null, ...b }
      rows.push(r)
      return out(one ? r : [r], { status: 201 })
    }
    if (req.method === 'PATCH') {
      const b = await req.json()
      const f = filter(url).filter((r) => !url.searchParams.get('status')?.startsWith('neq.') || r.status !== 'paid')
      f.forEach((r) => Object.assign(r, b))
      return out(one ? f[0] : f)
    }
  }
  if (p === '/jungle/gateway/charges') {
    assertEquals(req.headers.get('x-api-key'), 'gw_teste')
    const b = await req.json()
    charges.push({ ...b, idem: req.headers.get('idempotency-key') })
    return out({ success: true, data: { transactionId: 'tx-1', pixCode: '00020126PIXTESTE', expiresAt: '2026-10-24T05:00:00Z', amount: b.product.value } }, { status: 201 })
  }
  if (p === '/jungle/gateway/transactions/tx-1') return out({ success: true, data: { id: 'tx-1', ...tx } })
  return out({ error: 'stub: rota desconhecida ' + req.method + ' ' + p }, { status: 404 })
})

Deno.env.set('SUPABASE_URL', `http://localhost:${STUB}`)
Deno.env.set('SUPABASE_ANON_KEY', 'anon')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service')
Deno.env.set('JUNGLE_API_KEY', 'gw_teste')
Deno.env.set('JUNGLE_WEBHOOK_SECRET', SECRET)
Deno.env.set('JUNGLE_API_URL', `http://localhost:${STUB}/jungle`)
await import('./index.ts') // sobe a função na porta 8000

const FN = 'http://localhost:8000/functions/v1/pagamentos'
const call = (body: unknown, token?: string) =>
  fetch(FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://mylinkhub.pro', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
async function sign(body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')
}
const hook = async (body: string, sig?: string) =>
  fetch(FN + '/webhook', { method: 'POST', headers: { 'x-signature': sig ?? (await sign(body)) }, body })

Deno.test({
  name: 'pagamento por Pix: gerar, aviso assinado, conferência na Jungle e liberação',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    let r = await call({ action: 'create', plan: 'plus', name: 'Fulano Silva', doc: '52998224725' })
    assertEquals(r.status, 401)
    await r.body?.cancel()

    r = await call({ action: 'create', plan: 'plus', name: 'Fulano Silva', doc: '12345678900' }, 'dono')
    assertEquals(r.status, 400)
    assertEquals((await r.json()).error, 'CPF ou CNPJ inválido.')

    r = await call({ action: 'create', plan: 'king', name: 'Fulano Silva', doc: '52998224725' }, 'dono')
    assertEquals(r.status, 400) // preço vem do banco: plano sem preço para a conta é recusado
    await r.body?.cancel()

    r = await call({ action: 'create', plan: 'plus', name: 'Fulano Silva', doc: '529.982.247-25', amount: 0.01 }, 'dono')
    assertEquals(r.status, 201)
    assertEquals(r.headers.get('access-control-allow-origin'), 'https://mylinkhub.pro')
    const pay = await r.json()
    assertEquals([pay.status, pay.amount, pay.pixCode], ['pending', 97.9, '00020126PIXTESTE'])
    assertEquals(charges.length, 1)
    const c = charges[0]
    assertEquals(c.product.value, 97.9) // valor do banco, não o "amount" enviado pelo navegador
    assertEquals(c.idem, pay.paymentId)
    assertEquals(c.customer, { name: 'Fulano Silva', email: 'dono@teste.dev', doc: '52998224725', docType: 'cpf' })
    assert(c.callbackUrl.endsWith('/functions/v1/pagamentos/webhook'))
    assertEquals(c.metadata.paymentId, pay.paymentId)

    // gerar de novo devolve o mesmo Pix, sem nova cobrança
    r = await call({ action: 'create', plan: 'plus', name: 'Fulano Silva', doc: '52998224725' }, 'dono')
    assertEquals((await r.json()).paymentId, pay.paymentId)
    assertEquals(charges.length, 1)

    // outra conta não consulta este pagamento
    r = await call({ action: 'check', paymentId: pay.paymentId }, 'outro')
    assertEquals(r.status, 404)
    await r.body?.cancel()

    const body = JSON.stringify({ event: 'transaction.paid', data: { id: 'tx-1', status: 'PAID' } })
    // aviso sem a assinatura certa é recusado
    r = await hook(body, 'abc')
    assertEquals(r.status, 401)
    await r.body?.cancel()
    // aviso assinado, mas a Jungle diz que ainda está pendente: nada muda
    r = await hook(body)
    assertEquals(r.status, 200)
    await r.body?.cancel()
    assertEquals(rows[0].status, 'pending')
    // pago com valor menor que o do plano: não libera
    tx = { status: 'PAID', amount: 1, productValue: 1 }
    r = await hook(body)
    await r.body?.cancel()
    assertEquals(rows[0].status, 'pending')
    // pago de verdade: libera
    tx = { status: 'PAID', amount: 97.9, productValue: 97.9 }
    r = await hook(body)
    await r.body?.cancel()
    assertEquals(rows[0].status, 'paid')

    r = await call({ action: 'check', paymentId: pay.paymentId }, 'dono')
    const done = await r.json()
    assertEquals([done.status, done.periodEnd], ['paid', '2026-12-01T00:00:00Z'])
    assertEquals('jungle_tx_id' in done, false) // o navegador não recebe dados internos

    await stub.shutdown()
  },
})
