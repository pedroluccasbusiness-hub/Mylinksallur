import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { num, pct, rangeFor } from '../lib/stats'
import { SOURCE_LABEL } from '../lib/track'
import type { PageWithOwner, Stats } from '../lib/types'
import { BarList, TrendChart } from './Charts'
import { ErrorNote, errMsg, Spinner } from './ui'

const RANGES = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
]

const DEVICE_LABEL: Record<string, string> = { mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet', other: 'Outro' }

let regionNames: Intl.DisplayNames | null = null
try {
  regionNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' })
} catch {
  regionNames = null
}
const countryLabel = (k: string) => (k === '??' ? 'Desconhecido' : (regionNames?.of(k) ?? k))

interface Props {
  /** nulo = todas as páginas gerenciadas */
  pageIds?: string[] | null
  /** visão consolidada: mostra a tabela por página e o nome da página em cada link */
  pages?: PageWithOwner[]
}

export function StatsPanel({ pageIds = null, pages = [] }: Props) {
  const overview = pages.length > 0
  const key = pageIds?.join(',') ?? 'all'
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    const { from, to } = rangeFor(days)
    api
      .getStats(from, to, pageIds)
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(errMsg(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, key])

  const pageName = new Map(pages.map((p) => [p.id, p]))
  const viewsByPage = new Map((stats?.pages ?? []).map((p) => [p.page_id, p.views]))

  return (
    <section aria-label="Métricas" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Métricas</h2>
        <div className="flex rounded-lg border border-seam p-0.5" role="group" aria-label="Período">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${days === r.days ? 'bg-bone text-ink' : 'text-haze hover:text-bone'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote error={error} />
      {!stats && !error && <Spinner label="Calculando métricas" />}
      {stats && (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-seam bg-seam lg:grid-cols-4">
            <Kpi label="Visualizações" value={num(stats.totals.views)} />
            <Kpi label="Visitantes únicos" value={num(stats.totals.uniques)} />
            <Kpi label="Cliques" value={num(stats.totals.clicks)} />
            <Kpi label="Taxa de clique (CTR)" value={pct(stats.totals.ctr)} />
          </dl>

          <div className="panel p-5">
            {stats.totals.views === 0 && stats.totals.clicks === 0 ? (
              <p className="py-8 text-center text-sm text-haze">
                Ainda não há visitas neste período. Compartilhe o link da página para começar a medir.
              </p>
            ) : (
              <TrendChart series={stats.series} />
            )}
          </div>

          {overview && (
            <div className="panel overflow-x-auto p-5">
              <h3 className="mb-3 font-semibold">Por página</h3>
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-haze">
                  <tr>
                    <th className="pb-2 font-medium">Página</th>
                    <th className="pb-2 font-medium">Modelo</th>
                    <th className="pb-2 text-right font-medium">Visualizações</th>
                    <th className="pb-2 text-right font-medium">Cliques</th>
                    <th className="pb-2 text-right font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {pages
                    .map((p) => ({ p, s: stats.pages.find((x) => x.page_id === p.id) ?? { views: 0, clicks: 0 } }))
                    .sort((a, b) => b.s.views - a.s.views)
                    .map(({ p, s }) => (
                      <tr key={p.id} className="border-t border-seam/70">
                        <td className="py-2.5">
                          <Link to={`/app/paginas/${p.id}/metricas`} className="font-medium text-bone hover:text-orchid">
                            {p.title || p.slug}
                          </Link>
                          <span className="block text-xs text-haze">/{p.slug}</span>
                        </td>
                        <td className="py-2.5 text-haze">{p.modelName}</td>
                        <td className="py-2.5 text-right tabular-nums">{num(s.views)}</td>
                        <td className="py-2.5 text-right tabular-nums">{num(s.clicks)}</td>
                        <td className="py-2.5 text-right tabular-nums">{pct(s.views ? s.clicks / s.views : 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="panel overflow-x-auto p-5">
              <h3 className="mb-3 font-semibold">Cliques por link</h3>
              {stats.blocks.length === 0 ? (
                <p className="py-4 text-sm text-haze">Nenhum clique no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-haze">
                    <tr>
                      <th className="pb-2 font-medium">Link</th>
                      <th className="pb-2 text-right font-medium">Cliques</th>
                      <th className="pb-2 text-right font-medium">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.blocks.slice(0, 10).map((b) => {
                      const views = viewsByPage.get(b.page_id) ?? 0
                      return (
                        <tr key={b.block_id} className="border-t border-seam/70">
                          <td className="py-2.5">
                            <span className="block font-medium">{b.title || 'Link removido'}</span>
                            {overview && <span className="block text-xs text-haze">{pageName.get(b.page_id)?.title ?? ''}</span>}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{num(b.clicks)}</td>
                          <td className="py-2.5 text-right tabular-nums">{pct(views ? b.clicks / views : 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="panel p-5">
              <h3 className="mb-3 font-semibold">De onde vêm as visitas</h3>
              <BarList items={stats.sources} labels={(k) => SOURCE_LABEL[k] ?? k} />
              <p className="mt-3 text-xs text-haze/80">Instagram inclui quem abriu pelo navegador do próprio app.</p>
            </div>
            <div className="panel overflow-x-auto p-5">
              <h3 className="mb-1 font-semibold">Por link divulgado</h3>
              <p className="mb-3 text-xs text-haze">Compara perfis que usam a mesma árvore, pelo final ?src= do link.</p>
              {stats.tags.length === 0 ? (
                <p className="py-2 text-sm text-haze">Nenhuma visita com ?src= no período. Gere os links em Configurações da página.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-haze">
                    <tr>
                      <th className="pb-2 font-medium">src</th>
                      <th className="pb-2 text-right font-medium">Visualizações</th>
                      <th className="pb-2 text-right font-medium">Cliques</th>
                      <th className="pb-2 text-right font-medium">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.tags.slice(0, 10).map((t) => (
                      <tr key={t.key} className="border-t border-seam/70">
                        <td className="py-2.5 font-medium">{t.key}</td>
                        <td className="py-2.5 text-right tabular-nums">{num(t.views)}</td>
                        <td className="py-2.5 text-right tabular-nums">{num(t.clicks)}</td>
                        <td className="py-2.5 text-right tabular-nums">{pct(t.views ? t.clicks / t.views : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="panel p-5">
              <h3 className="mb-3 font-semibold">Dispositivo</h3>
              <BarList items={stats.devices} labels={(k) => DEVICE_LABEL[k] ?? k} />
            </div>
            <div className="panel p-5">
              <h3 className="mb-3 font-semibold">País</h3>
              <BarList items={stats.countries} labels={countryLabel} />
              <p className="mt-3 text-xs text-haze/80">Estimado pela rede ou pelo idioma do navegador. O IP nunca é guardado.</p>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-plum px-5 py-4">
      <dt className="text-[13px] text-haze">{label}</dt>
      <dd className="mt-1 font-display text-3xl tabular-nums text-bone">{value}</dd>
    </div>
  )
}
