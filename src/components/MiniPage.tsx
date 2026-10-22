import { useEffect, useRef, useState } from 'react'
import type { Block, Page } from '../lib/types'
import { PublicPageView } from './PublicPageView'

/**
 * Página renderizada de verdade, reduzida, como um "cartão" de modelo.
 * Sem `width`, ocupa a largura do cartão e recalcula a escala quando ele muda de tamanho,
 * para a prévia nunca ficar cortada ou fora do centro.
 */
export function MiniPage({ page, blocks, width, height = 300 }: { page: Page; blocks: Block[]; width?: number; height?: number }) {
  const base = 390
  const ref = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(width ?? 0)

  useEffect(() => {
    if (width || !ref.current) return
    const el = ref.current
    const update = () => setMeasured(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  const w = width ?? measured
  const scale = w > 0 ? w / base : 0
  return (
    <div ref={ref} className="pointer-events-none overflow-hidden" style={{ width: width ?? '100%', height }} aria-hidden>
      {scale > 0 && (
        <div style={{ width: base, height: height / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <PublicPageView page={page} blocks={blocks} preview />
        </div>
      )}
    </div>
  )
}
