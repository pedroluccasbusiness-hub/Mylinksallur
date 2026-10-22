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
import { useState, type CSSProperties } from 'react'
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
  onLinkClick?: (block: Block, url: string) => void
}

export function PublicPageView({ page, blocks, preview, onLinkClick }: Props) {
  const t = resolveTheme(page)
  const [gateOpen, setGateOpen] = useState(() => {
    if (preview || !page.ageGate) return false
    try {
      return sessionStorage.getItem(`lh-age-${page.id}`) !== 'ok'
    } catch {
      return true
    }
  })
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

  function open(block: Block, raw?: string) {
    const url = safeUrl(raw)
    if (!url || preview) return
    if (block.sensitive && confirming !== block.id) {
      setConfirming(block.id)
      return
    }
    setConfirming(null)
    onLinkClick?.(block, url)
  }

  return (
    <div style={root} className="relative min-h-full w-full">
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-5 pb-10 pt-12">
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
                      className="flex h-10 w-10 items-center justify-center rounded-full transition hover:opacity-80"
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
                return (
                  <div key={b.id}>
                    <button
                      type="button"
                      onClick={() => open(b, b.data.url)}
                      data-block={b.id}
                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:brightness-110 active:scale-[.99] ${fx}`}
                      style={btn}
                    >
                      {b.data.thumb ? (
                        <img src={b.data.thumb} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="h-10 w-1 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 text-center">
                        <span className="block truncate text-[15px] font-semibold">{b.data.title || 'Link'}</span>
                        {b.data.subtitle && <span className="block truncate text-xs opacity-75">{b.data.subtitle}</span>}
                      </span>
                      <span className="flex w-10 shrink-0 justify-end text-[11px] font-bold opacity-80">{b.sensitive ? '+18' : ''}</span>
                    </button>
                    {confirming === b.id && (
                      <div className="mt-2 flex items-center justify-between gap-3 px-1 text-sm" style={{ color: t.muted }}>
                        <span>Este link tem conteúdo para maiores de 18 anos.</span>
                        <span className="flex shrink-0 gap-2">
                          <button className="underline" onClick={() => setConfirming(null)}>
                            Voltar
                          </button>
                          <button className="font-semibold" style={{ color: t.text }} onClick={() => open(b, b.data.url)}>
                            Continuar
                          </button>
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
                return b.data.href ? (
                  <button key={b.id} type="button" onClick={() => open(b, b.data.href)} data-block={b.id} className="block w-full">
                    {img}
                  </button>
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

        <footer className="mt-auto pt-12 text-center text-xs" style={{ color: t.muted }}>
          {preview ? <span>Feito com {BRAND}</span> : <a href="/">Feito com {BRAND}</a>}
        </footer>
      </div>

      {gateOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Aviso de idade">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#120a14] p-7 text-center text-[#f4eaf0]">
            <p className="font-display text-3xl">+18</p>
            <p className="mt-3 text-sm leading-relaxed text-[#cdb8c8]">
              Esta página tem conteúdo para maiores de 18 anos. Confirme sua idade para continuar.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                className="rounded-lg bg-[#f4eaf0] px-4 py-3 text-sm font-semibold text-[#140b16]"
                onClick={() => {
                  try {
                    sessionStorage.setItem(`lh-age-${page.id}`, 'ok')
                  } catch {
                    /* sem storage */
                  }
                  setGateOpen(false)
                }}
              >
                Tenho 18 anos ou mais
              </button>
              <button className="rounded-lg px-4 py-3 text-sm text-[#cdb8c8]" onClick={() => window.history.back()}>
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
