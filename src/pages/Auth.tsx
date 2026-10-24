import { Building2, Sparkles } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { MiniPage } from '../components/MiniPage'
import { ErrorNote, errMsg, Field } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { DEMO_AGENCY, DEMO_CREATOR, seedDemo } from '../lib/demoSeed'
import type { LocalBackend } from '../lib/localBackend'
import { brl, findPlan, plansFor } from '../lib/plans'
import { samplePage } from '../lib/samples'
import type { AccountType } from '../lib/types'

const SIDE: Record<AccountType, { title: string; text: string; sample: ReturnType<typeof samplePage> }> = {
  agency: {
    title: 'Todo o elenco num painel só.',
    text: 'Cada modelo com a árvore dela, e você vendo de qual perfil vêm os cliques.',
    sample: samplePage('noir-violeta', 'Mel Noir', 'Ensaios novos toda semana.', ['#5b2a9e', '#1a0b2b']),
  },
  creator: {
    title: 'Seu link na bio, com a sua cara.',
    text: 'Nome, foto e @ seus. Comece grátis e veja quem clica em cada link.',
    sample: samplePage('rose-nude', 'Luna', 'Fotos, vídeos e bastidores.', ['#B5675A', '#F4E1DA']),
  },
}

function Shell({ type, children }: { type: AccountType; children: ReactNode }) {
  const side = SIDE[type]
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r border-seam bg-plum/40 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo />
        <div>
          <p className="max-w-sm font-display text-4xl leading-tight">{side.title}</p>
          <p className="mt-3 max-w-sm text-haze">{side.text}</p>
        </div>
        <div className="absolute -bottom-24 right-10 w-[230px] rotate-6 overflow-hidden rounded-[30px] border border-white/10 shadow-2xl shadow-black/60" aria-hidden>
          <MiniPage page={side.sample.page} blocks={side.sample.blocks} height={420} />
        </div>
      </aside>
      <main className="flex flex-col items-center px-5 py-10 lg:justify-center">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mt-8 w-full max-w-md lg:mt-0">{children}</div>
      </main>
    </div>
  )
}

/** Seletor "Sou agência / Sou modelo" do topo das telas de acesso. */
function TypeTabs({ value, onChange }: { value: AccountType; onChange: (t: AccountType) => void }) {
  const opts: { id: AccountType; label: string; icon: typeof Building2 }[] = [
    { id: 'agency', label: 'Sou agência', icon: Building2 },
    { id: 'creator', label: 'Sou modelo', icon: Sparkles },
  ]
  return (
    <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-seam p-1" role="tablist" aria-label="Tipo de conta">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${value === o.id ? 'bg-bone text-ink' : 'text-haze hover:text-bone'}`}
        >
          <o.icon size={16} /> {o.label}
        </button>
      ))}
    </div>
  )
}

export function Login() {
  const [params] = useSearchParams()
  const [type, setType] = useState<AccountType>(params.get('tipo') === 'creator' ? 'creator' : 'agency')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { refresh } = useAuth()
  const nav = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.signIn(email, password)
      await refresh()
      nav('/app')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  async function demo(who: AccountType) {
    const local = api as LocalBackend
    const acc = who === 'agency' ? DEMO_AGENCY : DEMO_CREATOR
    const ok = await local.signIn(acc.email, acc.password).catch(() => null)
    if (!ok) {
      await seedDemo(local)
      await local.signIn(acc.email, acc.password)
    }
    await refresh()
    nav('/app')
  }

  return (
    <Shell type={type}>
      <TypeTabs value={type} onChange={setType} />
      <h1 className="font-display text-3xl">{type === 'agency' ? 'Entrar no painel da agência' : 'Entrar na sua conta de modelo'}</h1>
      <p className="mb-6 mt-1 text-sm text-haze">
        {type === 'agency' ? 'Suas modelos, árvores e métricas te esperando.' : 'Edite seu link e veja quem clicou.'}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-mail">
          <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha">
          <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-haze">
        Ainda não tem conta?{' '}
        <Link to={`/cadastro?tipo=${type}`} className="font-semibold text-bone underline-offset-4 hover:underline">
          {type === 'agency' ? 'Criar conta de agência' : 'Criar meu link grátis'}
        </Link>
      </p>
      {isDemo && (
        <div className="mt-6 border-t border-seam pt-5">
          <p className="mb-3 text-sm text-haze">Modo demonstração, com dados de exemplo:</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => demo('agency')}>
              Agência demo
            </button>
            <button className="btn-ghost" onClick={() => demo('creator')}>
              Modelo demo
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}

export function Signup() {
  const [params] = useSearchParams()
  const [type, setType] = useState<AccountType>(params.get('tipo') === 'creator' ? 'creator' : 'agency')
  const [plan, setPlan] = useState<string>(() => {
    const want = params.get('plano')
    const t: AccountType = params.get('tipo') === 'creator' ? 'creator' : 'agency'
    return findPlan(t, want)?.id ?? (t === 'agency' ? 'plus' : 'free')
  })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { refresh } = useAuth()
  const nav = useNavigate()

  function changeType(t: AccountType) {
    setType(t)
    setPlan(t === 'agency' ? 'plus' : 'free')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const p = await api.signUp({ email, password, displayName: name, accountType: type, plan: plan === 'free' ? undefined : plan })
      if (!p) {
        setInfo('Conta criada. Enviamos um link de confirmação para o seu e-mail; depois de confirmar, entre normalmente.')
        return
      }
      await refresh()
      nav(plan !== 'free' ? '/app/conta#plano' : '/app/paginas')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const options = plansFor(type)

  return (
    <Shell type={type}>
      <TypeTabs value={type} onChange={changeType} />
      <h1 className="font-display text-3xl">{type === 'agency' ? 'Criar conta de agência' : 'Criar meu link na bio'}</h1>
      <p className="mb-6 mt-1 text-sm text-haze">
        {type === 'agency'
          ? 'Você já pode montar a primeira árvore enquanto a assinatura é confirmada.'
          : 'Grátis para sempre com 1 árvore. Sem cartão.'}
      </p>
      {info ? (
        <p className="text-sm leading-relaxed text-haze">{info}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <fieldset>
            <legend className="label">Plano</legend>
            <div className={`grid gap-2 ${type === 'agency' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
              {options.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  aria-pressed={plan === o.id}
                  onClick={() => setPlan(o.id)}
                  className={`rounded-xl border p-3 text-left transition ${plan === o.id ? 'border-orchid bg-orchid/10' : 'border-seam hover:border-haze/50'}`}
                >
                  <span className="block text-sm font-semibold">{o.name}</span>
                  <span className="block text-xs text-haze">
                    {o.price ? `${brl(o.price)}/mês` : 'Grátis'} | {o.limit === null ? 'ilimitado' : `${o.limit} ${o.limit === 1 ? 'árvore' : 'árvores'}`}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <Field label={type === 'agency' ? 'Nome da agência' : 'Seu nome artístico'}>
            <input className="field" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail">
            <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Senha" hint="Pelo menos 8 caracteres.">
            <input className="field" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Criando…' : type === 'agency' ? 'Criar conta de agência' : 'Criar conta de modelo'}
          </button>
          {plan !== 'free' && (
            <p className="text-center text-xs text-haze">
              Depois do cadastro, pague o plano {findPlan(type, plan)?.name} por Pix em Conta: ele é liberado na hora. Sem fidelidade.
            </p>
          )}
        </form>
      )}
      <p className="mt-5 text-center text-sm text-haze">
        Já tem conta?{' '}
        <Link to={`/entrar?tipo=${type}`} className="font-semibold text-bone underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </Shell>
  )
}
