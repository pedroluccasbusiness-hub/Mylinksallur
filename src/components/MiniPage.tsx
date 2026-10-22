import type { Block, Page } from '../lib/types'
import { PublicPageView } from './PublicPageView'

/** Página renderizada de verdade, reduzida, como um "cartão" de modelo. */
export function MiniPage({ page, blocks, width = 180, height = 300 }: { page: Page; blocks: Block[]; width?: number; height?: number }) {
  const base = 390
  const scale = width / base
  return (
    <div className="pointer-events-none overflow-hidden" style={{ width, height }} aria-hidden>
      <div style={{ width: base, height: height / scale, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <PublicPageView page={page} blocks={blocks} preview />
      </div>
    </div>
  )
}
