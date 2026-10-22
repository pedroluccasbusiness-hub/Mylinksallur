import { Building2, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { ErrorNote, errMsg, Field } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { DEMO_AGENCY, DEMO_CREATOR, seedDemo } from '../lib/demoSeed'
import type { LocalBackend } from '../lib/localBackend'
import type { AccountType } from '../lib/types'

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-5 py-10">
      <Logo />
      <div className="panel mt-10 w-full max-w-md p-7">
        <h1 className="mb-6 font-display text-3xl">{title}</h1>
        {children}
      </div>
    </div>
  )
}

export function Login() {
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

  async function demo(who: 'agency' | 'creator') {
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
    <Shell title="Entrar">
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
        Não tem conta?{' '}
        <Link to="/cadastro" className="font-semibold text-bone underline-offset-4 hover:underline">
          Criar conta
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
              Criadora demo
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
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { refresh } = useAuth()
  const nav = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const p = await api.signUp({ email, password, displayName: name, accountType: type })
      if (!p) {
        setInfo('Conta criada. Enviamos um link de confirmação para o seu e-mail; depois de confirmar, entre normalmente.')
        return
      }
      await refresh()
      nav('/app/paginas')
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const options: { id: AccountType; title: string; text: string; icon: typeof Building2 }[] = [
    { id: 'agency', title: 'Agência', text: 'Páginas ilimitadas', icon: Building2 },
    { id: 'creator', title: 'Criadora', text: 'Até 2 páginas', icon: Sparkles },
  ]

  return (
    <Shell title="Criar conta">
      {info ? (
        <p className="text-sm leading-relaxed text-haze">{info}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <fieldset>
            <legend className="label">Tipo de conta</legend>
            <div className="grid grid-cols-2 gap-2">
              {options.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  aria-pressed={type === o.id}
                  onClick={() => setType(o.id)}
                  className={`rounded-xl border p-3 text-left transition ${type === o.id ? 'border-orchid bg-orchid/10' : 'border-seam hover:border-haze/50'}`}
                >
                  <o.icon size={18} className={type === o.id ? 'text-orchid' : 'text-haze'} />
                  <span className="mt-2 block text-sm font-semibold">{o.title}</span>
                  <span className="block text-xs text-haze">{o.text}</span>
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
            {busy ? 'Criando…' : type === 'agency' ? 'Criar conta de agência' : 'Criar conta de criadora'}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-haze">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-semibold text-bone underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </Shell>
  )
}
