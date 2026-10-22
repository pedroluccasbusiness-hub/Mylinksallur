import { Copy, RefreshCw, UserMinus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ErrorNote, errMsg, Field, Modal, Spinner, useToast } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { CREATOR_PAGE_LIMIT, type Profile } from '../lib/types'

export default function Team() {
  const { profile } = useAuth()
  if (!profile) return null
  return profile.accountType === 'agency' ? <AgencyTeam profile={profile} /> : <CreatorAgency />
}

function AgencyTeam({ profile }: { profile: Profile }) {
  const [creators, setCreators] = useState<(Profile & { pageCount: number })[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Profile | null>(null)
  const toast = useToast()
  const { refresh } = useAuth()

  const load = useCallback(() => {
    api.listCreators().then(setCreators).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(load, [load])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">Criadoras</h1>
        <p className="mt-1 max-w-[60ch] text-sm text-haze">
          Criadoras com conta própria podem se vincular à agência com o código abaixo. Depois do vínculo, a agência edita as
          páginas delas e vê as métricas junto com as outras.
        </p>
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-haze">Código de convite da agência</p>
          <p className="mt-1 font-display text-4xl tracking-[0.12em]" data-testid="invite-code">
            {profile.inviteCode}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(profile.inviteCode ?? '')
                toast('Código copiado')
              } catch {
                toast('Não foi possível copiar')
              }
            }}
          >
            <Copy size={15} /> Copiar
          </button>
          <button
            className="btn-ghost"
            onClick={async () => {
              await api.rotateInviteCode()
              await refresh()
              toast('Novo código gerado. O anterior deixou de funcionar.')
            }}
          >
            <RefreshCw size={15} /> Gerar novo
          </button>
        </div>
      </div>

      <ErrorNote error={error} />
      {!creators && !error && <Spinner />}
      {creators && creators.length === 0 && (
        <p className="rounded-xl border border-dashed border-seam px-6 py-10 text-center text-sm text-haze">
          Nenhuma criadora vinculada ainda. Envie o código; ela digita na tela Agência da conta dela.
        </p>
      )}
      {creators && creators.length > 0 && (
        <ul className="divide-y divide-seam rounded-2xl border border-seam">
          {creators.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-semibold">{c.displayName}</p>
                <p className="text-xs text-haze">
                  {c.pageCount} de {CREATOR_PAGE_LIMIT} páginas na conta dela
                </p>
              </div>
              <button className="btn-danger px-3 py-2 text-[13px]" onClick={() => setRemoving(c)}>
                <UserMinus size={14} /> Desvincular
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Desvincular criadora">
        <p className="text-sm text-haze">
          A agência deixa de ver e editar as páginas de <strong className="text-bone">{removing?.displayName}</strong>. As páginas
          continuam na conta dela.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setRemoving(null)}>
            Cancelar
          </button>
          <button
            className="btn-danger"
            onClick={async () => {
              await api.removeCreator(removing!.id)
              setRemoving(null)
              toast('Criadora desvinculada')
              load()
            }}
          >
            Desvincular
          </button>
        </div>
      </Modal>
    </div>
  )
}

function CreatorAgency() {
  const [agency, setAgency] = useState<Profile | null | undefined>(undefined)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const { refresh } = useAuth()

  const load = useCallback(() => {
    api.getAgency().then(setAgency).catch(() => setAgency(null))
  }, [])
  useEffect(load, [load])

  async function join(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.joinAgency(code)
      await refresh()
      toast('Vinculada à agência')
      load()
    } catch (err) {
      setError(errMsg(err))
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-4xl">Agência</h1>
        <p className="mt-1 text-sm text-haze">
          Vinculada, a agência pode editar suas páginas e ver as métricas delas. Você continua dona das páginas e pode sair quando
          quiser.
        </p>
      </div>
      {agency === undefined && <Spinner />}
      {agency && (
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-haze">Vinculada a</p>
            <p className="font-display text-2xl">{agency.displayName}</p>
          </div>
          <button
            className="btn-danger"
            onClick={async () => {
              await api.leaveAgency()
              await refresh()
              toast('Você saiu da agência')
              load()
            }}
          >
            Sair da agência
          </button>
        </div>
      )}
      {agency === null && (
        <form onSubmit={join} className="panel space-y-4 p-5">
          <Field label="Código da agência" hint="Peça o código de 8 caracteres para a sua agência.">
            <input className="field uppercase tracking-[0.15em]" required maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <button className="btn-primary">Vincular à agência</button>
        </form>
      )}
    </div>
  )
}
