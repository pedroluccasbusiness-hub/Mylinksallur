import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorNote, errMsg, Field, useToast } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { LocalBackend } from '../lib/localBackend'
import { PlanCards } from '../components/PlanCards'
import { findPlan, pageLimit, STATUS_LABEL, type Plan } from '../lib/plans'

export default function Account() {
  const { profile, refresh } = useAuth()
  const [name, setName] = useState(profile?.displayName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [planMsg, setPlanMsg] = useState<string | null>(null)
  const toast = useToast()
  const nav = useNavigate()
  if (!profile) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await api.updateProfile({ displayName: name })
      await refresh()
      toast('Nome salvo')
    } catch (err) {
      setError(errMsg(err))
    }
  }

  async function choose(p: Plan) {
    setBusy(p.id)
    setPlanMsg(null)
    try {
      await api.requestPlan(p.id)
      await refresh()
      setPlanMsg(
        isDemo
          ? `Plano ${p.name} ativado (na demonstração não há cobrança).`
          : `Pedido registrado: plano ${p.name}. Você vai receber o link de pagamento (Pix, cartão ou boleto); o plano é liberado assim que o pagamento for confirmado.`,
      )
    } catch (err) {
      setPlanMsg(errMsg(err))
    } finally {
      setBusy(null)
    }
  }

  function resetDemo() {
    const local = api as LocalBackend
    local.reset()
    nav('/')
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">Conta</h1>
      <section id="plano" className="space-y-5">
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-haze">Seu plano</p>
            <p className="font-display text-3xl">{findPlan(profile.accountType, profile.plan)?.name ?? 'Sem plano'}</p>
            <p className="mt-1 text-sm text-haze">
              {STATUS_LABEL[profile.planStatus]}.{' '}
              {pageLimit(profile) === null ? 'Árvores ilimitadas.' : `Até ${pageLimit(profile)} ${pageLimit(profile) === 1 ? 'árvore' : 'árvores'} agora.`}
              {profile.requestedPlan && ` Pedido em andamento: ${findPlan(profile.accountType, profile.requestedPlan)?.name}.`}
            </p>
          </div>
        </div>
        {planMsg && <p className="rounded-lg border border-orchid/40 bg-orchid/10 px-4 py-3 text-sm text-bone">{planMsg}</p>}
        <PlanCards audience={profile.accountType} current={profile.planStatus === 'active' ? profile.plan : null} onChoose={choose} busy={busy} />
      </section>
      <div className="max-w-xl space-y-6">
      <form onSubmit={submit} className="panel space-y-4 p-5">
        <Field label={profile.accountType === 'agency' ? 'Nome da agência' : 'Nome artístico'}>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input className="field opacity-70" value={profile.email} disabled />
        </Field>
        <ErrorNote error={error} />
        <button className="btn-primary">Salvar nome</button>
      </form>
      <div className="panel p-5 text-sm">
        <p className="font-semibold">{profile.accountType === 'agency' ? 'Conta de agência' : 'Conta de modelo'}</p>
        <p className="mt-1 text-haze">O tipo de conta não pode ser trocado depois de criado.</p>
      </div>
      <button
        className="btn-ghost"
        onClick={async () => {
          await api.signOut()
          nav('/entrar')
        }}
      >
        Sair da conta
      </button>
      {isDemo && (
        <div className="panel p-5 text-sm">
          <p className="font-semibold">Demonstração</p>
          <p className="mt-1 text-haze">Apaga todas as contas, páginas e métricas guardadas neste navegador.</p>
          <button className="btn-danger mt-4" onClick={resetDemo}>
            Apagar dados da demonstração
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
