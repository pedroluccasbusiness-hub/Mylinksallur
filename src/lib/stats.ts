import type { Count, Stats } from './types'

export interface RawEvent {
  pageId: string
  blockId: string | null
  kind: 'view' | 'click'
  createdAt: string
  visitorHash: string | null
  referrerHost: string | null
  device: string | null
  country: string | null
}

export const TZ = 'America/Sao_Paulo'

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

export function dayKey(d: Date): string {
  return dayFmt.format(d)
}

export function emptyStats(): Stats {
  return {
    totals: { views: 0, clicks: 0, uniques: 0, ctr: 0 },
    series: [],
    pages: [],
    blocks: [],
    referrers: [],
    devices: [],
    countries: [],
  }
}

/** Mesma forma que a função get_stats do Postgres devolve. */
export function aggregate(events: RawEvent[], from: Date, to: Date): Stats {
  const inRange = events.filter((e) => {
    const t = new Date(e.createdAt).getTime()
    return t >= from.getTime() && t < to.getTime()
  })
  const views = inRange.filter((e) => e.kind === 'view')
  const clicks = inRange.filter((e) => e.kind === 'click')

  const days: string[] = []
  const cursor = new Date(from)
  const last = dayKey(new Date(to.getTime() - 1000))
  for (let i = 0; i < 400; i++) {
    const k = dayKey(cursor)
    if (!days.includes(k)) days.push(k)
    if (k === last) break
    cursor.setTime(cursor.getTime() + 6 * 3600_000)
  }
  const series = days.map((day) => ({ day, views: 0, clicks: 0 }))
  const idx = new Map(series.map((s, i) => [s.day, i]))
  for (const e of inRange) {
    const i = idx.get(dayKey(new Date(e.createdAt)))
    if (i === undefined) continue
    if (e.kind === 'view') series[i].views++
    else series[i].clicks++
  }

  const pageMap = new Map<string, { page_id: string; views: number; clicks: number }>()
  for (const e of inRange) {
    const p = pageMap.get(e.pageId) ?? { page_id: e.pageId, views: 0, clicks: 0 }
    if (e.kind === 'view') p.views++
    else p.clicks++
    pageMap.set(e.pageId, p)
  }

  const blockMap = new Map<string, { block_id: string; page_id: string; clicks: number }>()
  for (const e of clicks) {
    if (!e.blockId) continue
    const b = blockMap.get(e.blockId) ?? { block_id: e.blockId, page_id: e.pageId, clicks: 0 }
    b.clicks++
    blockMap.set(e.blockId, b)
  }

  return {
    totals: {
      views: views.length,
      clicks: clicks.length,
      uniques: new Set(views.map((v) => v.visitorHash).filter(Boolean)).size,
      ctr: views.length ? Math.round((clicks.length / views.length) * 10000) / 10000 : 0,
    },
    series,
    pages: [...pageMap.values()].sort((a, b) => b.views - a.views),
    blocks: [...blockMap.values()].sort((a, b) => b.clicks - a.clicks),
    referrers: countBy(views, (e) => e.referrerHost ?? 'direto'),
    devices: countBy(views, (e) => e.device ?? 'other'),
    countries: countBy(views, (e) => e.country ?? '??'),
  }
}

function countBy(list: RawEvent[], key: (e: RawEvent) => string): Count[] {
  const m = new Map<string, number>()
  for (const e of list) m.set(key(e), (m.get(key(e)) ?? 0) + 1)
  return [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)
}

export function rangeFor(days: number, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now.getTime() + 60_000)
  const from = new Date(now.getTime() - (days - 1) * 86400_000)
  // começa à meia-noite (aprox. no fuso de SP, UTC-3)
  from.setUTCHours(3, 0, 0, 0)
  if (from.getTime() > now.getTime()) from.setTime(from.getTime() - 86400_000)
  return { from, to }
}

export function pct(n: number): string {
  return `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function num(n: number): string {
  return n.toLocaleString('pt-BR')
}
