import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorNote, errMsg, Field, useToast } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { LocalBackend } from '../lib/localBackend'
import { PlanCards } from '../components/PlanCards'
import { effectiveStatus, findPlan, GRACE_DAYS, pageLimit, STATUS_LABEL, type Plan } from '../lib/plans'
import { PixCheckout } from '../components/PixCheckout'

export default function Account() {
  const { profile, refresh } = useAuth()
  const [name, setName] = useState(profile?.displayName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState<Plan | null>(null)
  const toast = useToast()
  const nav = useNavigate()
  if (!profile) return null

  const status = effectiveStatus(profile)
  const current = findPlan(profile.accountType, profile.plan)
  const expires = profile.planExpiresAt ? new Date(profile.planExpiresAt) : null
  const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 864e5) : null
  const paidPlan = current && current.price > 0 ? current : null
  // botão de pagar/renovar o plano atual: pendente, atrasado ou perto de vencer
  const payCurrent = paidPlan && (status !== 'active' || (daysLeft !== null && daysLeft <= 7))
  const limit = pageLimit(profile)

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
            <p className="font-display text-3xl">{current?.name ?? 'Sem plano'}</p>
            <p className="mt-1 text-sm text-haze">
              {STATUS_LABEL[status]}
              {status === 'active' && expires && ` até ${expires.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`}.{' '}
              {limit === null ? 'Árvores ilimitadas.' : `Até ${limit} ${limit === 1 ? 'árvore' : 'árvores'} agora.`}
            </p>
            {status === 'active' && daysLeft !== null && daysLeft < 0 && (
              <p className="mt-1 text-sm text-amber-300">Venceu. Pague em até {GRACE_DAYS} dias para não voltar ao limite de 1 árvore.</p>
            )}
            {status === 'overdue' && (
              <p className="mt-1 text-sm text-amber-300">Mensalidade vencida: a conta está no limite de 1 árvore. As árvores criadas continuam no ar.</p>
            )}
          </div>
          {payCurrent && (
            <button className="btn-primary" onClick={() => setPaying(paidPlan)}>
              {status === 'active' ? `Renovar ${paidPlan.name}` : `Pagar ${paidPlan.name} por Pix`}
            </button>
          )}
        </div>
        <PlanCards
          audience={profile.accountType}
          current={status === 'active' ? profile.plan : null}
          onChoose={(p) => setPaying(p)}
        />
        <PixCheckout plan={paying} onClose={() => setPaying(null)} />
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
