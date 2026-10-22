import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatsPanel } from '../components/StatsPanel'
import { ErrorNote, errMsg, Spinner } from '../components/ui'
import { api } from '../lib/api'
import type { Page } from '../lib/types'

export default function PageStats() {
  const { id = '' } = useParams()
  const [page, setPage] = useState<Page | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.getPage(id).then((r) => setPage(r.page)).catch((e) => setError(errMsg(e)))
  }, [id])
  if (error) return <ErrorNote error={error} />
  if (!page) return <Spinner />
  return (
    <div className="space-y-6">
      <div>
        <Link to={`/app/paginas/${page.id}`} className="text-xs text-haze hover:text-bone">
          Voltar ao editor
        </Link>
        <h1 className="font-display text-4xl">{page.title || page.slug}</h1>
        <a href={`/${page.slug}`} target="_blank" rel="noreferrer" className="text-sm text-haze hover:text-bone">
          {location.host}/{page.slug}
        </a>
      </div>
      <StatsPanel pageIds={[page.id]} />
    </div>
  )
}
