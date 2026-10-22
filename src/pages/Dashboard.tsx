import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatsPanel } from '../components/StatsPanel'
import { ErrorNote, errMsg, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { PageWithOwner } from '../lib/types'

export default function Dashboard() {
  const { profile } = useAuth()
  const [pages, setPages] = useState<PageWithOwner[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creator, setCreator] = useState('')

  useEffect(() => {
    api.listManagedPages().then(setPages).catch((e) => setError(errMsg(e)))
  }, [])

  const creators = useMemo(
    () => [...new Set((pages ?? []).map((p) => p.creatorLabel || p.ownerName).filter(Boolean))].sort(),
    [pages],
  )
  const filtered = useMemo(
    () => (pages ?? []).filter((p) => !creator || (p.creatorLabel || p.ownerName) === creator),
    [pages, creator],
  )
  const isAgency = profile?.accountType === 'agency'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Olá, {profile?.displayName}</h1>
          <p className="mt-1 text-sm text-haze">
            {isAgency ? 'Resultados de todas as páginas que a agência gerencia.' : 'Resultados das suas páginas.'}
          </p>
        </div>
        {isAgency && creators.length > 1 && (
          <select className="field w-auto" value={creator} onChange={(e) => setCreator(e.target.value)} aria-label="Filtrar por criadora">
            <option value="">Todas as criadoras</option>
            {creators.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
      <ErrorNote error={error} />
      {!pages && !error && <Spinner />}
      {pages && pages.length === 0 && (
        <div className="panel flex flex-col items-center px-6 py-14 text-center">
          <p className="font-display text-2xl">Comece criando uma página</p>
          <p className="mt-2 max-w-sm text-sm text-haze">As métricas aparecem aqui assim que a página receber as primeiras visitas.</p>
          <Link to="/app/paginas" className="btn-primary mt-6">
            <Plus size={16} /> Criar página
          </Link>
        </div>
      )}
      {pages && pages.length > 0 && (
        <StatsPanel pageIds={creator ? filtered.map((p) => p.id) : null} pages={filtered} />
      )}
    </div>
  )
}
