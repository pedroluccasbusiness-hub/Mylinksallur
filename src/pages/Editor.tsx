import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BRAND, PublicPageView, SOCIAL_META } from '../components/PublicPageView'
import { ErrorNote, errMsg, Field, Spinner, Toggle, useToast } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { shrinkImage, visibleBlocks } from '../lib/backend'
import { BLOCK_LABELS, newBlock } from '../lib/blocks'
import { safeUrl, slugError } from '../lib/slug'
import { avatarImgStyle, FONTS, KEEP_ON_THEME_CHANGE, resolveTheme, THEME_CATEGORIES, THEMES, type ThemeCategory } from '../lib/themes'
import type {
  AvatarShape,
  BgFilter,
  BgType,
  Block,
  BlockType,
  ButtonShadow,
  ButtonShape,
  ButtonStyle,
  HeaderLayout,
  Highlight,
  Model,
  Page,
  SocialPlatform,
  ThemeOverrides,
} from '../lib/types'

type Tab = 'blocos' | 'perfil' | 'design' | 'config'
const TABS: { id: Tab; label: string }[] = [
  { id: 'blocos', label: 'Blocos' },
  { id: 'perfil', label: 'Perfil' },
  { id: 'design', label: 'Design' },
  { id: 'config', label: 'Configurações' },
]

export default function Editor() {
  const { id = '' } = useParams()
  const [page, setPage] = useState<Page | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('blocos')
  const [mobilePreview, setMobilePreview] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api
      .getPage(id)
      .then(({ page, blocks }) => {
        setPage(page)
        setBlocks(blocks)
      })
      .catch((e) => setError(errMsg(e)))
  }, [id])

  const editPage = useCallback((patch: Partial<Page>) => {
    setPage((p) => (p ? { ...p, ...patch } : p))
    setDirty(true)
  }, [])
  const editBlocks = useCallback((fn: (b: Block[]) => Block[]) => {
    setBlocks((b) => fn(b).map((x, i) => ({ ...x, position: i })))
    setDirty(true)
  }, [])

  const save = useCallback(async () => {
    if (!page) return
    const err = slugError(page.slug)
    if (err) {
      setTab('config')
      return setError(err)
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await api.updatePage(page.id, page)
      await api.saveBlocks(page.id, blocks)
      setPage(saved)
      setDirty(false)
      toast('Alterações salvas')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }, [page, blocks, toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [save, dirty])

  if (error && !page) return <ErrorNote error={error} />
  if (!page) return <Spinner />

  const preview = (
    <div className="mx-auto h-[min(760px,calc(100vh-140px))] w-[360px] max-w-full overflow-hidden rounded-[36px] border-[6px] border-[#2a1d2e] bg-black shadow-2xl shadow-black/60">
      <div className="scroll-thin h-full overflow-y-auto">
        <PublicPageView page={page} blocks={visibleBlocks(blocks)} preview />
      </div>
    </div>
  )

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-seam bg-ink/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="min-w-0 flex-1">
          <Link to="/app/paginas" className="text-xs text-haze hover:text-bone">
            Páginas
          </Link>
          <h1 className="truncate font-display text-2xl leading-tight">{page.title || page.slug}</h1>
        </div>
        <a href={`/${page.slug}`} target="_blank" rel="noreferrer" className="btn-ghost hidden sm:inline-flex" title="Abrir página publicada">
          <ExternalLink size={15} /> Abrir
        </a>
        <Link to={`/app/paginas/${page.id}/metricas`} className="btn-ghost hidden sm:inline-flex">
          <BarChart3 size={15} /> Métricas
        </Link>
        <button className="btn-ghost lg:hidden" onClick={() => setMobilePreview(true)}>
          <Smartphone size={15} /> Prévia
        </button>
        <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Salvando…' : dirty ? 'Salvar' : 'Salvo'}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-seam" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'border-orchid text-bone' : 'border-transparent text-haze hover:text-bone'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mb-4">
            <ErrorNote error={error} />
          </div>
          {tab === 'blocos' && <BlocksTab pageId={page.id} blocks={blocks} edit={editBlocks} />}
          {tab === 'perfil' && <ProfileTab page={page} edit={editPage} />}
          {tab === 'design' && <DesignTab page={page} edit={editPage} />}
          {tab === 'config' && <SettingsTab page={page} edit={editPage} />}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-24">{preview}</div>
        </aside>
      </div>

      {mobilePreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 lg:hidden" role="dialog" aria-label="Prévia">
          <button className="mb-3 self-end rounded-full bg-plum p-2" onClick={() => setMobilePreview(false)} aria-label="Fechar prévia">
            <X size={18} />
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl">
            <PublicPageView page={page} blocks={visibleBlocks(blocks)} preview />
          </div>
        </div>
      )}
    </div>
  )
}

// ======================= Blocos =======================
const ADDABLE: BlockType[] = ['link', 'header', 'text', 'image', 'video', 'embed', 'divider']

function BlocksTab({ pageId, blocks, edit }: { pageId: string; blocks: Block[]; edit: (fn: (b: Block[]) => Block[]) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const drag = useRef<number | null>(null)
  // só arrasta pela alça, para o campo do nome continuar selecionável
  const [handleId, setHandleId] = useState<string | null>(null)

  const move = (from: number, to: number) =>
    edit((list) => {
      if (to < 0 || to >= list.length) return list
      const copy = [...list]
      const [it] = copy.splice(from, 1)
      copy.splice(to, 0, it)
      return copy
    })

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ADDABLE.map((t) => (
          <button
            key={t}
            className="btn-ghost px-3 py-2 text-[13px]"
            onClick={() => {
              const b = newBlock(pageId, t)
              edit((list) => [b, ...list])
              setOpen(b.id)
            }}
          >
            <Plus size={14} /> {BLOCK_LABELS[t]}
          </button>
        ))}
      </div>

      {blocks.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-seam px-6 py-10 text-center text-sm text-haze">
          A página ainda não tem blocos. Comece por um link.
        </p>
      )}

      <ul className="mt-5 space-y-2.5">
        {blocks.map((b, i) => (
          <li
            key={b.id}
            draggable={handleId === b.id}
            onDragEnd={() => setHandleId(null)}
            onDragStart={() => (drag.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag.current !== null && drag.current !== i) move(drag.current, i)
              drag.current = null
            }}
            className={`rounded-xl border bg-plum ${b.isActive ? 'border-seam' : 'border-seam/60 opacity-60'}`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span onPointerDown={() => setHandleId(b.id)} onPointerUp={() => setHandleId(null)} className="shrink-0 cursor-grab text-haze" aria-hidden>
                <GripVertical size={16} />
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="shrink-0 rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-haze">{BLOCK_LABELS[b.type]}</span>
                {b.type === 'link' ? (
                  // nome do link editável direto na lista
                  <input
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium text-bone hover:border-seam focus:border-orchid focus:outline-none"
                    value={b.data.title ?? ''}
                    placeholder="Nome do link"
                    aria-label="Nome do link"
                    maxLength={80}
                    onChange={(e) => edit((l) => l.map((x) => (x.id === b.id ? { ...x, data: { ...x.data, title: e.target.value } } : x)))}
                  />
                ) : (
                  <button className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => setOpen(open === b.id ? null : b.id)}>
                    {summary(b)}
                  </button>
                )}
                {b.sensitive && <span className="shrink-0 text-[11px] font-bold text-champagne">+18</span>}
                {(b.startsAt || b.endsAt) && <span className="shrink-0 text-[11px] text-orchid">agendado</span>}
              </div>
              <div className="flex shrink-0 items-center text-haze">
                <IconBtn label="Subir" onClick={() => move(i, i - 1)} disabled={i === 0} icon={ArrowUp} />
                <IconBtn label="Descer" onClick={() => move(i, i + 1)} disabled={i === blocks.length - 1} icon={ArrowDown} />
                <IconBtn
                  label={b.isActive ? 'Ocultar' : 'Mostrar'}
                  onClick={() => edit((l) => l.map((x) => (x.id === b.id ? { ...x, isActive: !x.isActive } : x)))}
                  icon={b.isActive ? Eye : EyeOff}
                />
                <IconBtn label="Duplicar bloco" onClick={() => edit((l) => [...l.slice(0, i + 1), { ...b, id: crypto.randomUUID() }, ...l.slice(i + 1)])} icon={Copy} />
                <IconBtn label="Excluir bloco" onClick={() => edit((l) => l.filter((x) => x.id !== b.id))} icon={Trash2} />
                <button
                  type="button"
                  className="ml-1 rounded-md p-1.5 hover:bg-ink hover:text-bone"
                  onClick={() => setOpen(open === b.id ? null : b.id)}
                  aria-expanded={open === b.id}
                  aria-label={open === b.id ? 'Fechar opções do bloco' : 'Abrir opções do bloco'}
                >
                  <ChevronDown size={16} className={`transition ${open === b.id ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
            {open === b.id && (
              <div className="border-t border-seam px-4 py-4">
                <BlockForm block={b} onChange={(nb) => edit((l) => l.map((x) => (x.id === b.id ? nb : x)))} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function summary(b: Block) {
  switch (b.type) {
    case 'link':
      return b.data.title || 'Link sem título'
    case 'header':
    case 'text':
      return b.data.text || '(vazio)'
    case 'image':
      return b.data.alt || (b.data.url ? 'Imagem' : 'Sem imagem')
    case 'video':
    case 'embed':
      return b.data.url || 'Sem endereço'
    default:
      return 'Linha divisória'
  }
}

function IconBtn({ label, onClick, icon: Icon, disabled }: { label: string; onClick: () => void; icon: typeof Eye; disabled?: boolean }) {
  return (
    <button type="button" className="rounded-md p-1.5 hover:bg-ink hover:text-bone disabled:opacity-30" title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      <Icon size={15} />
    </button>
  )
}

const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)

function BlockForm({ block: b, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const set = (data: Partial<Block['data']>) => onChange({ ...b, data: { ...b.data, ...data } })
  const urlBad = (v?: string) => !!v && !safeUrl(v)

  switch (b.type) {
    case 'link':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do link (o que aparece no botão)">
            <input className="field" maxLength={80} value={b.data.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Endereço (URL)" hint={urlBad(b.data.url) ? 'Endereço inválido.' : undefined}>
            <input className="field" value={b.data.url ?? ''} placeholder="https://" onChange={(e) => set({ url: e.target.value })} />
          </Field>
          <Field label="Subtítulo (opcional)">
            <input className="field" value={b.data.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value })} />
          </Field>
          <Field label="Logo ao lado do nome" hint="Automático detecta pelo endereço (Privacy, OnlyFans, Telegram...).">
            <select className="field" value={b.data.icon ?? 'auto'} onChange={(e) => set({ icon: e.target.value as Block['data']['icon'] })}>
              <option value="auto">Automático</option>
              <option value="none">Sem logo</option>
              {(Object.keys(SOCIAL_META) as SocialPlatform[]).map((k) => (
                <option key={k} value={k}>
                  {SOCIAL_META[k].label}
                </option>
              ))}
            </select>
          </Field>
          <ImageInput label="Ou envie a sua imagem de logo" value={b.data.thumb} onChange={(thumb) => set({ thumb })} max={160} />
          <Field label="Destaque">
            <select className="field" value={b.highlight} onChange={(e) => onChange({ ...b, highlight: e.target.value as Highlight })}>
              <option value="none">Nenhum</option>
              <option value="shine">Brilho passando</option>
              <option value="pulse">Pulsar</option>
              <option value="glow">Aura na cor do tema</option>
            </select>
          </Field>
          <div className="flex items-end pb-1">
            <Toggle checked={b.sensitive} onChange={(sensitive) => onChange({ ...b, sensitive })} label="Conteúdo +18" hint="Pede confirmação antes de abrir." />
          </div>
          <Field label="Mostrar a partir de">
            <input type="datetime-local" className="field" value={toLocal(b.startsAt)} onChange={(e) => onChange({ ...b, startsAt: fromLocal(e.target.value) })} />
          </Field>
          <Field label="Esconder depois de">
            <input type="datetime-local" className="field" value={toLocal(b.endsAt)} onChange={(e) => onChange({ ...b, endsAt: fromLocal(e.target.value) })} />
          </Field>
        </div>
      )
    case 'header':
      return (
        <Field label="Texto do título">
          <input className="field" value={b.data.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        </Field>
      )
    case 'text':
      return (
        <Field label="Texto">
          <textarea className="field min-h-24" value={b.data.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        </Field>
      )
    case 'image':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageInput label="Imagem" value={b.data.url} onChange={(url) => set({ url })} max={1080} />
          <Field label="Descrição da imagem">
            <input className="field" value={b.data.alt ?? ''} onChange={(e) => set({ alt: e.target.value })} />
          </Field>
          <Field label="Link ao tocar (opcional)" hint={urlBad(b.data.href) ? 'Endereço inválido.' : 'Conta como clique nas métricas.'}>
            <input className="field" value={b.data.href ?? ''} placeholder="https://" onChange={(e) => set({ href: e.target.value })} />
          </Field>
        </div>
      )
    case 'video':
      return (
        <Field label="Link do vídeo" hint="YouTube, Vimeo ou arquivo .mp4.">
          <input className="field" value={b.data.url ?? ''} placeholder="https://youtube.com/watch?v=…" onChange={(e) => set({ url: e.target.value })} />
        </Field>
      )
    case 'embed':
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Link para incorporar" hint="Spotify, SoundCloud, Google Maps ou outro endereço https que permita incorporação.">
            <input className="field" value={b.data.url ?? ''} placeholder="https://open.spotify.com/…" onChange={(e) => set({ url: e.target.value })} />
          </Field>
          <Field label="Altura (px)">
            <input type="number" min={80} max={800} className="field" value={b.data.height ?? 152} onChange={(e) => set({ height: Number(e.target.value) })} />
          </Field>
        </div>
      )
    default:
      return <p className="text-sm text-haze">Uma linha fina para separar seções. Não tem opções.</p>
  }
}

function ImageInput({ label, value, onChange, max }: { label: string; value?: string | null; onChange: (v: string) => void; max: number }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        {value && <img src={value} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />}
        <label className="btn-ghost cursor-pointer px-3 py-2 text-[13px]">
          <Upload size={14} /> {busy ? 'Enviando…' : 'Enviar'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setBusy(true)
              setError(null)
              try {
                onChange(await api.uploadImage(await shrinkImage(f, max)))
              } catch (err) {
                setError(errMsg(err))
              } finally {
                setBusy(false)
              }
            }}
          />
        </label>
        <input className="field min-w-0 flex-1" placeholder="ou cole um link https" value={value?.startsWith('data:') ? '' : (value ?? '')} onChange={(e) => onChange(e.target.value)} />
        {value && (
          <button type="button" className="rounded-md p-2 text-haze hover:text-bone" onClick={() => onChange('')} aria-label="Remover imagem">
            <X size={15} />
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-[#f1a7bd]">{error}</p>}
    </div>
  )
}

// ======================= Perfil =======================
function ProfileTab({ page, edit }: { page: Page; edit: (p: Partial<Page>) => void }) {
  const platforms = Object.keys(SOCIAL_META) as SocialPlatform[]
  return (
    <div className="space-y-5">
      <ImageInput label="Foto de perfil" value={page.avatarUrl} onChange={(avatarUrl) => edit({ avatarUrl: avatarUrl || null })} max={1080} />
      {page.avatarUrl && <CropEditor page={page} edit={edit} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <input className="field" value={page.title} onChange={(e) => edit({ title: e.target.value })} />
        </Field>
        <Field label="@ do Instagram" hint="Aparece embaixo do nome.">
          <input className="field" value={page.handle} placeholder="perfil" onChange={(e) => edit({ handle: e.target.value.replace(/^@+/, '') })} />
        </Field>
      </div>
      <Field label="Bio" hint={`${page.bio.length}/160`}>
        <textarea className="field min-h-20" maxLength={160} value={page.bio} onChange={(e) => edit({ bio: e.target.value })} />
      </Field>
      <div>
        <span className="label">Redes sociais (ícones no topo)</span>
        <ul className="space-y-2">
          {page.socials.map((s, i) => (
            <li key={i} className="flex gap-2">
              <select
                className="field w-36 shrink-0"
                value={s.platform}
                onChange={(e) => edit({ socials: page.socials.map((x, j) => (j === i ? { ...x, platform: e.target.value as SocialPlatform } : x)) })}
                aria-label="Rede"
              >
                {platforms.map((p) => (
                  <option key={p} value={p}>
                    {SOCIAL_META[p].label}
                  </option>
                ))}
              </select>
              <input
                className="field min-w-0 flex-1"
                placeholder={s.platform === 'email' ? 'voce@email.com' : 'https://'}
                value={s.url}
                onChange={(e) => edit({ socials: page.socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                aria-label="Endereço"
              />
              <button className="rounded-md p-2 text-haze hover:text-bone" onClick={() => edit({ socials: page.socials.filter((_, j) => j !== i) })} aria-label="Remover rede">
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        <button
          className="btn-ghost mt-3 px-3 py-2 text-[13px]"
          onClick={() => edit({ socials: [...page.socials, { platform: platforms[page.socials.length % platforms.length], url: '' }] })}
          disabled={page.socials.length >= 8}
        >
          <Plus size={14} /> Adicionar rede
        </button>
      </div>
    </div>
  )
}

// ======================= Design =======================
/** Ajuste do corte da foto: arrastar a imagem move o ponto de foco; zoom aproxima. */
function CropEditor({ page, edit }: { page: Page; edit: (p: Partial<Page>) => void }) {
  const t = resolveTheme(page)
  const o = page.themeOverrides
  const setO = (patch: Partial<ThemeOverrides>) => edit({ themeOverrides: { ...o, ...patch } })
  const drag = useRef<{ x: number; y: number; ax: number; ay: number; w: number; h: number } | null>(null)
  const frame: Record<HeaderLayout, { w: number; h: number; radius: string; label: string }> = {
    minimal: { w: 180, h: 180, radius: '999px', label: 'círculo' },
    banner: { w: 300, h: 130, radius: '12px', label: 'faixa' },
    portrait: { w: 210, h: 260, radius: '12px', label: 'retrato' },
    shape: { w: 180, h: 220, radius: '999px 999px 16px 16px', label: 'forma' },
  }
  const f = frame[t.headerLayout]

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ax: t.avatarX, ay: t.avatarY, w: f.w, h: f.h }
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    // arrastar para a direita mostra mais do lado esquerdo da foto
    const nx = Math.round(Math.min(100, Math.max(0, d.ax - ((e.clientX - d.x) / d.w) * 100)))
    const ny = Math.round(Math.min(100, Math.max(0, d.ay - ((e.clientY - d.y) / d.h) * 100)))
    setO({ avatarX: nx, avatarY: ny })
  }

  return (
    <div className="rounded-xl border border-seam p-4">
      <span className="label">Ajustar o corte da foto ({f.label})</span>
      <div className="flex flex-wrap items-start gap-5">
        <div
          role="img"
          aria-label="Arraste para ajustar o corte da foto"
          data-testid="crop-frame"
          className="relative shrink-0 cursor-grab touch-none overflow-hidden bg-ink active:cursor-grabbing"
          style={{ width: f.w, height: f.h, borderRadius: f.radius }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <img src={page.avatarUrl!} alt="" className="pointer-events-none h-full w-full select-none" style={avatarImgStyle(t)} draggable={false} />
        </div>
        <div className="min-w-[200px] flex-1 space-y-3">
          <p className="text-xs text-haze">Arraste a foto para escolher o que aparece, ou use os controles.</p>
          <Range label="Horizontal" value={t.avatarX} min={0} max={100} onChange={(v) => setO({ avatarX: v })} />
          <Range label="Vertical" value={t.avatarY} min={0} max={100} onChange={(v) => setO({ avatarY: v })} />
          <Range label="Zoom" value={t.avatarZoom} min={1} max={3} step={0.05} onChange={(v) => setO({ avatarZoom: v })} format={(v) => `${v.toFixed(1)}x`} />
          <button type="button" className="text-sm text-haze underline underline-offset-4 hover:text-bone" onClick={() => setO({ avatarX: 50, avatarY: 50, avatarZoom: 1 })}>
            Centralizar
          </button>
        </div>
      </div>
    </div>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v: number) => `${Math.round(v)}%`,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  disabled?: boolean
}) {
  return (
    <Field label={`${label}: ${format(value)}`}>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#B98AFF]" />
    </Field>
  )
}

function ColorField({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (v: string | undefined) => void }) {
  const shown = value ?? fallback
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-seam bg-transparent"
          value={/^#[0-9a-fA-F]{6}$/.test(shown) ? shown : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <span className="text-sm text-haze">{value ? value.toUpperCase() : 'Do tema'}</span>
        {value && (
          <button type="button" className="ml-auto text-xs text-haze underline underline-offset-4 hover:text-bone" onClick={() => onChange(undefined)}>
            Usar a do tema
          </button>
        )}
      </div>
    </div>
  )
}

const LAYOUTS: { id: HeaderLayout; label: string; text: string }[] = [
  { id: 'minimal', label: 'Mínimo', text: 'Foto redonda pequena' },
  { id: 'banner', label: 'Faixa', text: 'Foto no topo e redonda' },
  { id: 'portrait', label: 'Retrato', text: 'Foto grande que some no fundo' },
  { id: 'shape', label: 'Formas', text: 'Foto grande recortada' },
]

const SHAPES: { id: AvatarShape; label: string; radius: string }[] = [
  { id: 'arch', label: 'Arco', radius: '999px 999px 6px 6px' },
  { id: 'square', label: 'Quadrado', radius: '8px' },
  { id: 'circle', label: 'Círculo', radius: '999px' },
  { id: 'blob', label: 'Orgânico', radius: '58% 42% 49% 51% / 44% 52% 48% 56%' },
]

/** Miniatura do cabeçalho para os cartões de escolha. */
function LayoutThumb({ id }: { id: HeaderLayout }) {
  const bar = <i className="block h-1.5 w-full rounded-sm bg-bone/35" />
  return (
    <span className="flex h-24 flex-col items-center gap-1 overflow-hidden rounded-md bg-ink/70 p-2">
      {id === 'minimal' && <i className="mt-1 block h-6 w-6 rounded-full bg-orchid/70" />}
      {id === 'banner' && (
        <>
          <i className="-mx-2 -mt-2 block h-7 w-[calc(100%+1rem)] bg-orchid/50" />
          <i className="-mt-4 block h-6 w-6 rounded-full border-2 border-ink bg-orchid/80" />
        </>
      )}
      {id === 'portrait' && <i className="-mx-2 -mt-2 block h-12 w-[calc(100%+1rem)] bg-gradient-to-b from-orchid/80 to-transparent" />}
      {id === 'shape' && <i className="mt-1 block h-10 w-8 bg-orchid/70" style={{ borderRadius: '999px 999px 3px 3px' }} />}
      <i className="block h-1.5 w-10 rounded-sm bg-bone/70" />
      {bar}
      {bar}
    </span>
  )
}

function DesignTab({ page, edit }: { page: Page; edit: (p: Partial<Page>) => void }) {
  const t = resolveTheme(page)
  const o = page.themeOverrides
  const setO = (patch: Partial<ThemeOverrides>) => edit({ themeOverrides: { ...o, ...patch } })
  const [cat, setCat] = useState<ThemeCategory>(() => THEMES.find((x) => x.id === page.themeId)?.category ?? 'classico')
  const bgType: BgType = o.bgType ?? (o.bgImage ? 'image' : 'theme')
  // ao trocar de tema, a foto e o cabeçalho continuam como estavam
  const kept = () => Object.fromEntries(KEEP_ON_THEME_CHANGE.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))

  const shapes: { id: ButtonShape; label: string }[] = [
    { id: 'pill', label: 'Pílula' },
    { id: 'rounded', label: 'Arredondado' },
    { id: 'square', label: 'Reto' },
  ]
  const styles: { id: ButtonStyle; label: string }[] = [
    { id: 'solid', label: 'Sólido' },
    { id: 'outline', label: 'Contorno' },
    { id: 'glass', label: 'Vidro' },
    { id: 'soft', label: 'Suave' },
  ]
  const shadows: { id: ButtonShadow; label: string }[] = [
    { id: 'none', label: 'Sem sombra' },
    { id: 'soft', label: 'Suave' },
    { id: 'hard', label: 'Marcada' },
  ]
  const bgTypes: { id: BgType; label: string }[] = [
    { id: 'theme', label: 'Do tema' },
    { id: 'solid', label: 'Cor' },
    { id: 'gradient', label: 'Degradê' },
    { id: 'image', label: 'Imagem' },
  ]
  const filters: { id: BgFilter; label: string; swatch: string }[] = [
    { id: 'dark', label: 'Escuro', swatch: 'linear-gradient(135deg,#000,#2b1f2e)' },
    { id: 'light', label: 'Claro', swatch: 'linear-gradient(135deg,#fff,#cfc6cc)' },
    { id: 'none', label: 'Nenhum', swatch: 'linear-gradient(135deg,#3a2740,#140b16)' },
  ]

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 font-semibold">Tema</h3>
        <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Categoria de tema">
          {THEME_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              aria-pressed={cat === c.id}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${cat === c.id ? 'bg-bone text-ink' : 'text-haze hover:text-bone'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.filter((th) => th.category === cat).map((th) => (
            <button
              key={th.id}
              onClick={() => edit({ themeId: th.id, themeOverrides: kept() })}
              aria-pressed={page.themeId === th.id}
              className={`overflow-hidden rounded-xl border text-left transition ${page.themeId === th.id ? 'border-orchid ring-1 ring-orchid' : 'border-seam hover:border-haze/50'}`}
            >
              <span className="flex h-20 flex-col items-center justify-center gap-1.5 px-4" style={{ background: th.background }}>
                {[0, 1].map((k) => (
                  <i
                    key={k}
                    className="block h-2.5 w-full"
                    style={{
                      background: th.buttonStyle === 'outline' ? 'transparent' : th.buttonStyle === 'glass' ? 'rgba(255,255,255,.25)' : th.surface,
                      border: `1px solid ${th.accent}`,
                      borderRadius: th.buttonShape === 'pill' ? 99 : th.buttonShape === 'rounded' ? 4 : 1,
                    }}
                  />
                ))}
              </span>
              <span className="block truncate px-2.5 py-2 text-xs font-medium">{th.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-semibold">Cabeçalho</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Estilo do cabeçalho">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setO({ headerLayout: l.id })}
              aria-pressed={t.headerLayout === l.id}
              className={`rounded-xl border p-2 text-left transition ${t.headerLayout === l.id ? 'border-orchid ring-1 ring-orchid' : 'border-seam hover:border-haze/50'}`}
            >
              <LayoutThumb id={l.id} />
              <span className="mt-2 block text-sm font-semibold">{l.label}</span>
              <span className="block text-[11px] text-haze">{l.text}</span>
            </button>
          ))}
        </div>
        {t.headerLayout === 'shape' && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Forma da foto">
            {SHAPES.map((sh) => (
              <button
                key={sh.id}
                onClick={() => setO({ avatarShape: sh.id })}
                aria-pressed={t.avatarShape === sh.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${t.avatarShape === sh.id ? 'border-orchid bg-orchid/10' : 'border-seam'}`}
              >
                <i className="block h-5 w-4 bg-orchid/70" style={{ borderRadius: sh.radius }} />
                {sh.label}
              </button>
            ))}
          </div>
        )}
        {page.avatarUrl ? (
          <div className="mt-4">
            <CropEditor page={page} edit={edit} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-haze">Envie a foto na aba Perfil para ajustar o corte.</p>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-semibold">Fundo</h3>
        <Segment label="Tipo de fundo" value={bgType} options={bgTypes} onChange={(v) => setO({ bgType: v })} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(bgType === 'solid' || bgType === 'gradient') && (
            <ColorField label={bgType === 'gradient' ? 'Cor de cima' : 'Cor do fundo'} value={o.bgColor} fallback="#1e1222" onChange={(v) => setO({ bgColor: v ?? '#1e1222' })} />
          )}
          {bgType === 'gradient' && <ColorField label="Cor de baixo" value={o.bgColor2} fallback="#000000" onChange={(v) => setO({ bgColor2: v ?? '#000000' })} />}
          {bgType === 'image' && <ImageInput label="Imagem de fundo" value={o.bgImage} onChange={(bgImage) => setO({ bgImage })} max={1280} />}
        </div>
        <fieldset className="mt-5">
          <legend className="label">Filtro sobre o fundo</legend>
          <div className="flex flex-wrap gap-3">
            {filters.map((fl) => (
              <button
                key={fl.id}
                onClick={() => setO({ bgFilter: fl.id })}
                aria-pressed={t.bgFilter === fl.id}
                className={`w-24 rounded-xl border p-1.5 text-center text-xs ${t.bgFilter === fl.id ? 'border-orchid ring-1 ring-orchid' : 'border-seam'}`}
              >
                <span className="mb-1 block h-10 rounded-lg" style={{ background: fl.swatch }} />
                {fl.label}
              </button>
            ))}
          </div>
        </fieldset>
        {t.bgFilter !== 'none' && (
          <div className="mt-3 max-w-sm">
            <Range label="Intensidade do filtro" value={t.bgDim * 100} min={0} max={90} step={5} onChange={(v) => setO({ bgDim: v / 100 })} />
          </div>
        )}
      </section>

      <section className="space-y-5">
        <h3 className="font-semibold">Cores e botões</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <ColorField label="Texto e ícones da página" value={o.textColor} fallback={t.text} onChange={(v) => setO({ textColor: v })} />
          <ColorField label="Cor de destaque" value={o.accent} fallback={t.accent} onChange={(v) => setO({ accent: v })} />
          <ColorField label="Fundo dos botões" value={o.buttonBg} fallback={t.surface} onChange={(v) => setO({ buttonBg: v })} />
          <ColorField label="Texto dos botões" value={o.buttonText} fallback={t.surfaceText} onChange={(v) => setO({ buttonText: v })} />
        </div>
        <Field label="Fonte">
          <select className="field max-w-sm" value={t.fontId} onChange={(e) => setO({ fontId: e.target.value })}>
            {FONTS.map((fo) => (
              <option key={fo.id} value={fo.id}>
                {fo.name}
              </option>
            ))}
          </select>
        </Field>
        <Segment label="Formato dos botões" value={t.buttonShape} options={shapes} onChange={(v) => setO({ buttonShape: v })} />
        <Segment label="Estilo dos botões" value={t.buttonStyle} options={styles} onChange={(v) => setO({ buttonStyle: v })} />
        <Segment label="Sombra dos botões" value={t.buttonShadow} options={shadows} onChange={(v) => setO({ buttonShadow: v })} />
      </section>

      {Object.keys(o).some((k) => !(KEEP_ON_THEME_CHANGE as readonly string[]).includes(k)) && (
        <button className="text-sm text-haze underline underline-offset-4 hover:text-bone" onClick={() => edit({ themeOverrides: kept() })}>
          Voltar às cores e ao fundo do tema
        </button>
      )}
    </div>
  )
}

function Segment<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="inline-flex flex-wrap rounded-lg border border-seam p-0.5">
        {options.map((op) => (
          <button
            key={op.id}
            onClick={() => onChange(op.id)}
            aria-pressed={value === op.id}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${value === op.id ? 'bg-bone text-ink' : 'text-haze hover:text-bone'}`}
          >
            {op.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// ======================= Configurações =======================
function SettingsTab({ page, edit }: { page: Page; edit: (p: Partial<Page>) => void }) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [tag, setTag] = useState('ig-perfil1')
  const { profile } = useAuth()
  const toast = useToast()
  const url = `${location.origin}/${page.slug}`
  const err = slugError(page.slug)
  const ownsPage = profile?.accountType === 'agency' && page.ownerId === profile.id
  const cleanTag = tag.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40)
  const tagged = cleanTag ? `${url}?src=${cleanTag}` : url

  useEffect(() => {
    if (ownsPage) api.listModels().then(setModels).catch(() => setModels([]))
  }, [ownsPage])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast('Link copiado')
    } catch {
      toast('Não foi possível copiar. Selecione o link e copie.')
    }
  }

  useEffect(() => {
    if (err) return setAvailable(null)
    const t = setTimeout(() => {
      api.slugAvailable(page.slug, page.id).then(setAvailable).catch(() => setAvailable(null))
    }, 350)
    return () => clearTimeout(t)
  }, [page.slug, page.id, err])

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#140B16', light: '#F4EAF0' } }).then(setQr).catch(() => setQr(null))
  }, [url])

  return (
    <div className="space-y-6">
      <Field
        label="Endereço da página"
        hint={err ?? (available === false ? 'Esse endereço já está em uso.' : `${location.host}/${page.slug}`)}
      >
        <input className="field" value={page.slug} onChange={(e) => edit({ slug: e.target.value.toLowerCase() })} />
      </Field>
      {ownsPage && (
        <Field label="Modelo do elenco" hint="Usado para agrupar páginas e filtrar métricas. Não aparece na página.">
          <select className="field" value={page.modelId ?? ''} onChange={(e) => edit({ modelId: e.target.value || null })}>
            <option value="">Sem modelo</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="space-y-4 rounded-xl border border-seam p-4">
        <Toggle checked={page.isPublished} onChange={(isPublished) => edit({ isPublished })} label="Página publicada" hint="Desligada, ninguém de fora consegue abrir o endereço." />
        <Toggle checked={page.showFooter} onChange={(showFooter) => edit({ showFooter })} label={`Mostrar "Feito com ${BRAND}" no rodapé`} hint="Desligado, a página mostra só a modelo." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título para o Google e redes" hint="Se ficar vazio, usa o nome da página.">
          <input className="field" maxLength={70} value={page.seoTitle} onChange={(e) => edit({ seoTitle: e.target.value })} />
        </Field>
        <Field label="Descrição para o Google e redes" hint="Se ficar vazia, usa a bio.">
          <input className="field" maxLength={160} value={page.seoDescription} onChange={(e) => edit({ seoDescription: e.target.value })} />
        </Field>
      </div>
      <div className="rounded-xl border border-seam p-4">
        <h3 className="font-semibold">Links para divulgar</h3>
        <p className="mt-1 text-sm text-haze">
          Use um final ?src= diferente em cada perfil de Instagram que aponta para esta árvore. As métricas mostram
          visitas e cliques de cada um.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
          <Field label="Nome do perfil (src)">
            <input className="field" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ig-perfil1" />
          </Field>
          <div>
            <span className="label">Link para a bio</span>
            <div className="flex gap-2">
              <input className="field min-w-0 flex-1" readOnly value={tagged} aria-label="Link para a bio" onFocus={(e) => e.target.select()} />
              <button className="btn-ghost shrink-0 px-3" onClick={() => copy(tagged)}>
                <Copy size={14} /> Copiar
              </button>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-haze">Salve as alterações antes de divulgar um endereço novo.</p>
      </div>

      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-seam p-4">
        {qr && <img src={qr} alt={`QR code de ${url}`} className="h-32 w-32 rounded-lg" />}
        <div className="min-w-0 space-y-2">
          <p className="break-all text-sm font-semibold">{url}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost px-3 py-2 text-[13px]" onClick={() => copy(url)}>
              <Copy size={14} /> Copiar link
            </button>
            {qr && (
              <a className="btn-ghost px-3 py-2 text-[13px]" href={qr} download={`qr-${page.slug}.png`}>
                Baixar QR code
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
