import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublicPageView } from '../components/PublicPageView'
import { Spinner } from '../components/ui'
import { api } from '../lib/api'
import { countryHint, detectDevice, referrerHost, visitorId } from '../lib/track'
import type { Block, Page } from '../lib/types'

export default function PublicPage() {
  const { slug = '' } = useParams()
  const [state, setState] = useState<{ page: Page; blocks: Block[] } | null | undefined>(undefined)
  const tracked = useRef(false)

  useEffect(() => {
    let alive = true
    api
      .getPublicPage(slug)
      .then((r) => alive && setState(r))
      .catch(() => alive && setState(null))
    return () => {
      alive = false
    }
  }, [slug])

  useEffect(() => {
    if (!state) return
    const { page } = state
    document.title = page.seoTitle || page.title || page.slug
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = page.seoDescription || page.bio
    if (!tracked.current) {
      tracked.current = true
      void api.track({
        pageId: page.id,
        kind: 'view',
        referrer: referrerHost(),
        device: detectDevice(),
        country: countryHint(),
        visitor: visitorId(),
      })
    }
  }, [state])

  async function handleClick(block: Block, url: string) {
    if (!state) return
    const t = api.track({
      pageId: state.page.id,
      kind: 'click',
      blockId: block.id,
      device: detectDevice(),
      country: countryHint(),
      visitor: visitorId(),
    })
    // espera o registro no máximo 600 ms para não atrasar a visita
    await Promise.race([t.catch(() => {}), new Promise((r) => setTimeout(r, 600))])
    window.location.assign(url)
  }

  if (state === undefined)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )

  if (state === null)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-5xl">404</p>
        <p className="text-haze">Não existe página publicada em /{slug}.</p>
        <Link to="/" className="btn-ghost">
          Ir para o início
        </Link>
      </div>
    )

  return (
    <div className="min-h-screen" style={{ minHeight: '100dvh', display: 'flex' }}>
      <PublicPageView page={state.page} blocks={state.blocks} onLinkClick={handleClick} />
    </div>
  )
}
