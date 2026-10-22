import {
  Flame,
  Globe,
  Heart,
  Instagram,
  Lock,
  Mail,
  MessageCircle,
  Music2,
  Send,
  Twitter,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { useState, type CSSProperties, type MouseEvent } from 'react'
import { embedSrc, videoEmbed } from '../lib/blocks'
import { safeUrl } from '../lib/slug'
import { resolveTheme, SHAPE_RADIUS, type ResolvedTheme } from '../lib/themes'
import type { Block, Page, SocialPlatform } from '../lib/types'

export const SOCIAL_META: Record<SocialPlatform, { label: string; icon: LucideIcon }> = {
  instagram: { label: 'Instagram', icon: Instagram },
  tiktok: { label: 'TikTok', icon: Music2 },
  x: { label: 'X (Twitter)', icon: Twitter },
  youtube: { label: 'YouTube', icon: Youtube },
  telegram: { label: 'Telegram', icon: Send },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  onlyfans: { label: 'OnlyFans', icon: Lock },
  privacy: { label: 'Privacy', icon: Heart },
  fansly: { label: 'Fansly', icon: Flame },
  email: { label: 'E-mail', icon: Mail },
  site: { label: 'Site', icon: Globe },
}

export const BRAND = 'LinkHub'

function buttonStyle(t: ResolvedTheme): CSSProperties {
  const radius = SHAPE_RADIUS[t.buttonShape]
  switch (t.buttonStyle) {
    case 'solid':
      return { background: t.surface, color: t.surfaceText, borderRadius: radius, border: `1px solid ${t.surface}` }
    case 'outline':
      return { background: 'transparent', color: t.text, borderRadius: radius, border: `1.5px solid ${t.accent}` }
    case 'glass':
      return {
        background: t.dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.55)',
        color: t.text,
        borderRadius: radius,
        border: `1px solid ${t.dark ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.8)'}`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }
    case 'soft':
    default:
      return {
        background: t.surface,
        color: t.surfaceText,
        borderRadius: radius,
        border: '1px solid transparent',
        boxShadow: '0 6px 18px -8px rgba(0,0,0,.35)',
      }
  }
}

interface Props {
  page: Page
  blocks: Block[]
  /** prévia no editor/cards: sem contagem e sem navegar */
  preview?: boolean
  /** registra o clique e navega; sem ela o link abre normalmente */
  onLinkClick?: (block: Block, url: string) => void
}

export function PublicPageView({ page, blocks, preview, onLinkClick }: Props) {
  const t = resolveTheme(page)
  const [confirming, setConfirming] = useState<string | null>(null)

  const root: CSSProperties = {
    background: t.bgImage
      ? `linear-gradient(rgba(0,0,0,${t.bgDim}), rgba(0,0,0,${t.bgDim})), url("${t.bgImage}") center / cover no-repeat`
      : t.background,
    color: t.text,
    fontFamily: t.font.body,
    ['--lh-accent-a' as string]: `${t.accent}66`,
  }
  const btn = buttonStyle(t)

  // Os botões são links de verdade (<a href> com o destino real): nada de redirecionamento escondido.
  function open(e: MouseEvent, block: Block, url: string | null) {
    if (preview || !url) {
      e.preventDefault()
      return
    }
    if (block.sensitive && confirming !== block.id) {
      e.preventDefault()
      setConfirming(block.id)
      return
    }
    setConfirming(null)
    if (onLinkClick) {
      e.preventDefault()
      onLinkClick(block, url)
    }
  }
  const handle = page.handle.replace(/^@+/, '').trim()

  return (
    <div style={root} className="relative min-h-full w-full">
      <div
        className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-5"
        style={
          preview
            ? { paddingTop: 48, paddingBottom: 32 }
            : {
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 40px)',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
                paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
              }
        }
      >
        <header className="flex flex-col items-center text-center">
          {page.avatarUrl ? (
            <img
              src={page.avatarUrl}
              alt=""
              className="h-24 w-24 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 3px ${t.accent}55, 0 10px 30px -10px rgba(0,0,0,.6)` }}
            />
          ) : (
            <div className="h-24 w-24 rounded-full" style={{ background: `${t.accent}33`, boxShadow: `0 0 0 3px ${t.accent}55` }} />
          )}
          <h1 className="mt-4 text-[1.75rem] leading-tight" style={{ fontFamily: t.font.heading, fontWeight: 600 }}>
            {page.title || page.slug}
          </h1>
          {handle && (
            <p className="mt-1 text-[15px] font-medium" style={{ color: t.muted }}>
              @{handle}
            </p>
          )}
          {page.bio && (
            <p className="mt-2 max-w-[34ch] whitespace-pre-line text-[15px] leading-relaxed" style={{ color: t.muted }}>
              {page.bio}
            </p>
          )}
          {page.socials.length > 0 && (
            <ul className="mt-5 flex flex-wrap justify-center gap-2.5">
              {page.socials.map((s, i) => {
                const meta = SOCIAL_META[s.platform]
                const url = s.platform === 'email' && !/^mailto:/i.test(s.url) ? `mailto:${s.url}` : safeUrl(s.url)
                if (!meta || !url) return null
                const Icon = meta.icon
                return (
                  <li key={i}>
                    <a
                      href={preview ? undefined : url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={meta.label}
                      title={meta.label}
                      className="flex h-11 w-11 items-center justify-center rounded-full transition hover:opacity-80"
                      style={{ background: t.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', color: t.text }}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </header>

        <main className="mt-8 flex flex-col gap-3">
          {blocks.map((b) => {
            switch (b.type) {
              case 'link': {
                const fx = b.highlight === 'none' ? '' : `lh-${b.highlight}`
                const url = safeUrl(b.data.url)
                return (
                  <div key={b.id}>
                    <a
                      href={preview ? undefined : (url ?? undefined)}
                      rel="noopener"
                      onClick={(e) => open(e, b, url)}
                      data-block={b.id}
                      className={`flex min-h-[58px] w-full items-center gap-3 px-4 py-3 text-left no-underline transition hover:brightness-110 active:scale-[.99] ${fx}`}
                      style={btn}
                    >
                      {b.data.thumb ? (
                        <img src={b.data.thumb} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="h-10 w-1 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 text-center">
                        <span className="block truncate text-base font-semibold">{b.data.title || 'Link'}</span>
                        {b.data.subtitle && <span className="block truncate text-xs opacity-75">{b.data.subtitle}</span>}
                      </span>
                      <span className="flex w-10 shrink-0 justify-end text-[11px] font-bold opacity-80">{b.sensitive ? '+18' : ''}</span>
                    </a>
                    {confirming === b.id && (
                      <div className="mt-2 flex items-center justify-between gap-3 px-1 text-sm" style={{ color: t.muted }}>
                        <span>Este link tem conteúdo para maiores de 18 anos.</span>
                        <span className="flex shrink-0 gap-2">
                          <button className="min-h-[44px] px-1 underline" onClick={() => setConfirming(null)}>
                            Voltar
                          </button>
                          <a className="flex min-h-[44px] items-center px-1 font-semibold" href={url ?? undefined} style={{ color: t.text }} onClick={(e) => open(e, b, url)}>
                            Continuar
                          </a>
                        </span>
                      </div>
                    )}
                  </div>
                )
              }
              case 'header':
                return (
                  <h2 key={b.id} className="mt-4 text-center text-lg" style={{ fontFamily: t.font.heading, fontWeight: 600 }}>
                    {b.data.text}
                  </h2>
                )
              case 'text':
                return (
                  <p key={b.id} className="whitespace-pre-line text-center text-[15px] leading-relaxed" style={{ color: t.muted }}>
                    {b.data.text}
                  </p>
                )
              case 'image': {
                const src = b.data.url
                if (!src) return null
                const img = <img src={src} alt={b.data.alt ?? ''} className="w-full object-cover" style={{ borderRadius: SHAPE_RADIUS[t.buttonShape] === '999px' ? '22px' : SHAPE_RADIUS[t.buttonShape] }} />
                const href = safeUrl(b.data.href)
                return href ? (
                  <a key={b.id} href={preview ? undefined : href} rel="noopener" onClick={(e) => open(e, b, href)} data-block={b.id} className="block w-full">
                    {img}
                  </a>
                ) : (
                  <div key={b.id}>{img}</div>
                )
              }
              case 'video': {
                const v = b.data.url ? videoEmbed(b.data.url) : null
                if (!v) return null
                return v.kind === 'iframe' ? (
                  <div key={b.id} className="aspect-video w-full overflow-hidden rounded-xl bg-black/40">
                    <iframe
                      src={v.src}
                      title="Vídeo"
                      className="h-full w-full"
                      loading="lazy"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <video key={b.id} src={v.src} controls playsInline className="w-full rounded-xl" />
                )
              }
              case 'embed': {
                const src = b.data.url ? embedSrc(b.data.url) : null
                if (!src) return null
                return (
                  <iframe
                    key={b.id}
                    src={src}
                    title="Conteúdo incorporado"
                    loading="lazy"
                    className="w-full rounded-xl border-0"
                    style={{ height: Math.min(800, Math.max(80, b.data.height ?? 152)) }}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                  />
                )
              }
              case 'divider':
                return <hr key={b.id} className="my-2 border-0 border-t" style={{ borderColor: `${t.text}22` }} />
              default:
                return null
            }
          })}
        </main>

        {page.showFooter ? (
          <footer className="mt-auto pt-12 text-center text-xs" style={{ color: t.muted }}>
            {preview ? <span>Feito com {BRAND}</span> : <a href="/">Feito com {BRAND}</a>}
          </footer>
        ) : (
          <div className="mt-auto" />
        )}
      </div>
    </div>
  )
}
