import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorNote, errMsg, Field, useToast } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { LocalBackend } from '../lib/localBackend'
import { CREATOR_PAGE_LIMIT } from '../lib/types'

export default function Account() {
  const { profile, refresh } = useAuth()
  const [name, setName] = useState(profile?.displayName ?? '')
  const [error, setError] = useState<string | null>(null)
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

  function resetDemo() {
    const local = api as LocalBackend
    local.reset()
    nav('/')
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-4xl">Conta</h1>
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
        <p className="font-semibold">{profile.accountType === 'agency' ? 'Conta de agência' : 'Conta de criadora'}</p>
        <p className="mt-1 text-haze">
          {profile.accountType === 'agency'
            ? 'Páginas ilimitadas e acesso às páginas das criadoras vinculadas.'
            : `Até ${CREATOR_PAGE_LIMIT} páginas próprias. O tipo de conta não pode ser trocado depois de criado.`}
        </p>
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
  )
}
