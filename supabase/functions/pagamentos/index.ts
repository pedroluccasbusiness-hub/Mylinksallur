// Mensalidade por Pix com a Jungle Pagamentos (Supabase Edge Function, Deno).
//
//   POST /functions/v1/pagamentos           { action: 'create', plan, name, doc }  → gera o Pix do plano
//   POST /functions/v1/pagamentos           { action: 'check', paymentId }        → confere na Jungle se já foi pago
//   POST /functions/v1/pagamentos/webhook   aviso da Jungle (transaction.paid), assinado em X-Signature
//
// Segredos (Supabase → Edge Functions → Secrets), nunca no código nem no navegador:
//   JUNGLE_API_KEY         chave gw_... da loja (API e chaves)
//   JUNGLE_WEBHOOK_SECRET  segredo whsec_... da mesma loja
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já vêm prontos no Supabase.
//
// Segurança: o preço vem do banco (plan_price), nunca do navegador; o aviso só é aceito com a assinatura certa,
// e mesmo assim o pagamento é confirmado consultando a transação na API da Jungle antes de liberar o plano.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const JUNGLE = Deno.env.get('JUNGLE_API_URL') ?? 'https://app.junglepagamentos.com/api'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const PLAN_NAMES: Record<string, string> = {
  basic: 'Basic',
  plus: 'Plus',
  diamond: 'Diamond',
  platinum: 'Platinum',
  king: 'King OFM',
}
const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?mylinkhub\.pro$/,
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/,
  /^https:\/\/[a-z0-9-]+\.bolt\.host$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
]

type Payment = {
  id: string
  user_id: string
  plan: string
  amount: number
  status: string
  jungle_tx_id: string | null
  pix_code: string | null
  expires_at: string | null
  period_end: string | null
}

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const ok = ALLOWED_ORIGINS.some((r) => r.test(origin))
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  }
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
}

async function jungle(path: string, init: RequestInit = {}) {
  const key = Deno.env.get('JUNGLE_API_KEY')
  if (!key) throw new Error('JUNGLE_API_KEY não configurada')
  const res = await fetch(JUNGLE + path, {
    ...init,
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

// ---------- CPF / CNPJ ----------
function digits(s: string) {
  return String(s ?? '').replace(/\D/g, '')
}
function cpfOk(c: string) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  for (const n of [9, 10]) {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i)
    if (((s * 10) % 11) % 10 !== Number(c[n])) return false
  }
  return true
}
function cnpjOk(c: string) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  for (const n of [12, 13]) {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = w.reduce((acc, wi, i) => acc + Number(c[i]) * wi, 0)
    const d = s % 11 < 2 ? 0 : 11 - (s % 11)
    if (d !== Number(c[n])) return false
  }
  return true
}

// ---------- confirmação ----------
/** Consulta a transação na Jungle e atualiza o pagamento (e o plano, se pago). */
async function sync(db: SupabaseClient, pay: Payment): Promise<Payment> {
  if (pay.status === 'paid' || !pay.jungle_tx_id) return pay
  const r = await jungle(`/gateway/transactions/${encodeURIComponent(pay.jungle_tx_id)}`)
  if (!r.ok) return pay
  const tx = r.body?.data ?? {}
  const value = Math.max(Number(tx.productValue) || 0, Number(tx.amount) || 0)
  if (tx.status === 'PAID' && value + 0.001 >= Number(pay.amount)) {
    const { data, error } = await db.rpc('apply_payment', { p_payment: pay.id })
    if (error) throw error
    return data as Payment
  }
  if (tx.status === 'EXPIRED' || tx.status === 'FAILED') {
    const status = tx.status === 'EXPIRED' ? 'expired' : 'failed'
    await db.from('billing_payments').update({ status }).eq('id', pay.id).neq('status', 'paid')
    return { ...pay, status }
  }
  return pay
}

function publicView(p: Payment) {
  return {
    paymentId: p.id,
    plan: p.plan,
    amount: Number(p.amount),
    status: p.status,
    pixCode: p.pix_code,
    expiresAt: p.expires_at,
    periodEnd: p.period_end,
  }
}

// ---------- aviso da Jungle ----------
async function webhook(req: Request) {
  const secret = Deno.env.get('JUNGLE_WEBHOOK_SECRET')
  if (!secret) return new Response('not configured', { status: 500 })
  const raw = await req.text()
  const keyData = new TextEncoder().encode(secret)
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')
  const got = (req.headers.get('x-signature') ?? '').trim().toLowerCase()
  let diff = expected.length ^ got.length
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (got.charCodeAt(i) || 0)
  if (diff !== 0) return new Response('bad signature', { status: 401 })

  let body: Record<string, any> = {}
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response('ok')
  }
  const d = body.data ?? body.transaction ?? body
  const txIds = [d?.id, d?.transactionId, body.transactionId, body.id].filter((v) => typeof v === 'string')
  const payId = d?.metadata?.paymentId ?? body.metadata?.paymentId

  const db = admin()
  let pay: Payment | null = null
  for (const id of txIds) {
    const { data } = await db.from('billing_payments').select('*').eq('jungle_tx_id', id).maybeSingle()
    if (data) {
      pay = data as Payment
      break
    }
  }
  if (!pay && typeof payId === 'string' && /^[0-9a-f-]{36}$/i.test(payId)) {
    const { data } = await db.from('billing_payments').select('*').eq('id', payId).maybeSingle()
    pay = (data as Payment) ?? null
  }
  if (pay) await sync(db, pay)
  return new Response('ok')
}

// ---------- pedidos do painel ----------
async function app(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data: u } = await userClient.auth.getUser()
  const user = u?.user
  if (!user) return json(req, 401, { error: 'Entre na sua conta para pagar.' })

  const input = await req.json().catch(() => ({}))
  const db = admin()

  if (input.action === 'check') {
    const { data } = await db
      .from('billing_payments')
      .select('*')
      .eq('id', String(input.paymentId ?? ''))
      .eq('user_id', user.id)
      .maybeSingle()
    if (!data) return json(req, 404, { error: 'Pagamento não encontrado.' })
    return json(req, 200, publicView(await sync(db, data as Payment)))
  }

  if (input.action !== 'create') return json(req, 400, { error: 'Pedido inválido.' })

  const plan = String(input.plan ?? '')
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ')
  const doc = digits(input.doc)
  if (name.length < 3 || name.length > 80) return json(req, 400, { error: 'Informe o nome completo do pagador.' })
  if (!(cpfOk(doc) || cnpjOk(doc))) return json(req, 400, { error: 'CPF ou CNPJ inválido.' })

  const { data: prof } = await db.from('profiles').select('account_type').eq('id', user.id).single()
  const { data: price } = await db.rpc('plan_price', { p_type: prof?.account_type, p_plan: plan })
  if (!price) return json(req, 400, { error: 'Plano inválido para este tipo de conta.' })

  // já existe um Pix deste plano ainda válido? devolve o mesmo, em vez de gerar outro
  const soon = new Date(Date.now() + 5 * 60_000).toISOString()
  const { data: open } = await db
    .from('billing_payments')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan', plan)
    .eq('status', 'pending')
    .gt('expires_at', soon)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (open) return json(req, 200, publicView(open as Payment))

  // freio contra abuso: no máximo 6 cobranças por hora por conta
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db
    .from('billing_payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gt('created_at', hourAgo)
  if ((count ?? 0) >= 6) return json(req, 429, { error: 'Muitas tentativas. Espere alguns minutos.' })

  const { data: created, error: insErr } = await db
    .from('billing_payments')
    .insert({ user_id: user.id, plan, amount: price })
    .select('*')
    .single()
  if (insErr || !created) return json(req, 500, { error: 'Não foi possível iniciar o pagamento.' })

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const r = await jungle('/gateway/charges', {
    method: 'POST',
    headers: { 'Idempotency-Key': created.id },
    body: JSON.stringify({
      product: { name: `My Link Hub — plano ${PLAN_NAMES[plan] ?? plan} (30 dias)`, value: Number(price) },
      customer: {
        name,
        email: user.email,
        doc,
        docType: doc.length === 14 ? 'cnpj' : 'cpf',
        ...(ip ? { ip } : {}),
      },
      metadata: { paymentId: created.id, userId: user.id, plan },
      expiracaoSegundos: 3600,
      callbackUrl: `${SUPABASE_URL}/functions/v1/pagamentos/webhook`,
    }),
  })
  const tx = r.body?.data
  if (!r.ok || !tx?.transactionId || !tx?.pixCode) {
    await db.from('billing_payments').update({ status: 'failed' }).eq('id', created.id)
    console.error('jungle charge failed', r.status, r.body?.error)
    return json(req, 502, { error: 'A Jungle não gerou o Pix agora. Tente de novo em instantes.' })
  }
  const { data: saved } = await db
    .from('billing_payments')
    .update({
      status: 'pending',
      jungle_tx_id: tx.transactionId,
      pix_code: tx.pixCode,
      expires_at: tx.expiresAt ?? new Date(Date.now() + 3600_000).toISOString(),
    })
    .eq('id', created.id)
    .select('*')
    .single()
  return json(req, 201, publicView(saved as Payment))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  try {
    if (new URL(req.url).pathname.endsWith('/webhook')) return await webhook(req)
    return await app(req)
  } catch (e) {
    console.error(e)
    return json(req, 500, { error: 'Erro no pagamento. Tente de novo.' })
  }
})
