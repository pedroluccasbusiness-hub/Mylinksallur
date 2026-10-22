import { useMemo, useRef, useState } from 'react'
import { num } from '../lib/stats'
import type { Count } from '../lib/types'

// cores validadas (OKLCH, CVD) contra a superfície #1E1222
export const SERIES = { views: '#9D6BEA', clicks: '#BF8432' }

const fmtDay = (d: string) => {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

export function TrendChart({ series }: { series: { day: string; views: number; clicks: number }[] }) {
  const W = 720
  const H = 220
  const P = { l: 36, r: 24, t: 12, b: 26 }
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)

  const max = Math.max(4, ...series.map((s) => Math.max(s.views, s.clicks)))
  const niceMax = Math.ceil(max / 4) * 4
  const x = (i: number) => P.l + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (W - P.l - P.r))
  const y = (v: number) => P.t + (1 - v / niceMax) * (H - P.t - P.b)

  const paths = useMemo(() => {
    const line = (k: 'views' | 'clicks') => series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join('')
    return { views: line('views'), clicks: line('clicks') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, niceMax])

  function onMove(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (series.length - 1))
    setHover(Math.max(0, Math.min(series.length - 1, i)))
  }

  const step = Math.max(1, Math.ceil(series.length / 7))
  const h = hover !== null ? series[hover] : null

  return (
    <figure className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-haze">
        <Legend color={SERIES.views} label="Visualizações" />
        <Legend color={SERIES.clicks} label="Cliques" />
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Visualizações e cliques por dia"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="#3A2740" strokeWidth={1} strokeDasharray={f ? '2 4' : undefined} />
            <text x={P.l - 8} y={y(niceMax * f) + 4} textAnchor="end" fontSize={11} fill="#B09AAE">
              {num(Math.round(niceMax * f))}
            </text>
          </g>
        ))}
        {series.map((s, i) =>
          i % step === 0 || i === series.length - 1 ? (
            <text key={s.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="#B09AAE">
              {fmtDay(s.day)}
            </text>
          ) : null,
        )}
        <path d={paths.views} fill="none" stroke={SERIES.views} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={paths.clicks} fill="none" stroke={SERIES.clicks} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="#B09AAE" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(h.views)} r={4.5} fill={SERIES.views} stroke="#1E1222" strokeWidth={2} />
            <circle cx={x(hover)} cy={y(h.clicks)} r={4.5} fill={SERIES.clicks} stroke="#1E1222" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && h && (
        <div
          className="pointer-events-none absolute top-8 rounded-lg border border-seam bg-ink px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 70px), calc(100% - 150px))` }}
        >
          <div className="mb-1 font-semibold text-bone">{fmtDay(h.day)}</div>
          <div className="flex items-center gap-2 text-haze">
            <i className="h-2 w-2 rounded-full" style={{ background: SERIES.views }} /> {num(h.views)} visualizações
          </div>
          <div className="flex items-center gap-2 text-haze">
            <i className="h-2 w-2 rounded-full" style={{ background: SERIES.clicks }} /> {num(h.clicks)} cliques
          </div>
        </div>
      )}
    </figure>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <i className="h-0.5 w-4 rounded" style={{ background: color }} />
      {label}
    </span>
  )
}

/** Barras horizontais simples (magnitude, uma cor) com valor e % em texto. */
export function BarList({ items, labels, empty = 'Sem dados no período.' }: { items: Count[]; labels?: (k: string) => string; empty?: string }) {
  const total = items.reduce((a, b) => a + b.count, 0)
  const top = items.slice(0, 6)
  if (!top.length) return <p className="py-4 text-sm text-haze">{empty}</p>
  const max = top[0].count
  return (
    <ul className="space-y-2.5">
      {top.map((it) => (
        <li key={it.key} title={`${num(it.count)} (${Math.round((it.count / total) * 100)}%)`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-bone">{labels ? labels(it.key) : it.key}</span>
            <span className="shrink-0 tabular-nums text-haze">
              {num(it.count)} <span className="text-haze/70">({Math.round((it.count / total) * 100)}%)</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-seam/60">
            <div className="h-1.5 rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: SERIES.views }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
