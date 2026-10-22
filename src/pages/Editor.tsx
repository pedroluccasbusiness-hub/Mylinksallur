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
import { FONTS, THEMES, resolveTheme } from '../lib/themes'
import type { Block, BlockType, ButtonShape, ButtonStyle, Highlight, Model, Page, SocialPlatform } from '../lib/types'

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
            draggable
            onDragStart={() => (drag.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag.current !== null && drag.current !== i) move(drag.current, i)
              drag.current = null
            }}
            className={`rounded-xl border bg-plum ${b.isActive ? 'border-seam' : 'border-seam/60 opacity-60'}`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <GripVertical size={16} className="shrink-0 cursor-grab text-haze" aria-hidden />
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}>
                <span className="shrink-0 rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-haze">{BLOCK_LABELS[b.type]}</span>
                <span className="truncate text-sm font-medium">{summary(b)}</span>
                {b.sensitive && <span className="shrink-0 text-[11px] font-bold text-champagne">+18</span>}
                {(b.startsAt || b.endsAt) && <span className="shrink-0 text-[11px] text-orchid">agendado</span>}
              </button>
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
                <ChevronDown size={16} className={`ml-1 transition ${open === b.id ? 'rotate-180' : ''}`} aria-hidden />
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
          <Field label="Título">
            <input className="field" value={b.data.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Endereço (URL)" hint={urlBad(b.data.url) ? 'Endereço inválido.' : undefined}>
            <input className="field" value={b.data.url ?? ''} placeholder="https://" onChange={(e) => set({ url: e.target.value })} />
          </Field>
          <Field label="Subtítulo (opcional)">
            <input className="field" value={b.data.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value })} />
          </Field>
          <ImageInput label="Miniatura (opcional)" value={b.data.thumb} onChange={(thumb) => set({ thumb })} max={160} />
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
      <ImageInput label="Foto de perfil" value={page.avatarUrl} onChange={(avatarUrl) => edit({ avatarUrl: avatarUrl || null })} max={400} />
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
function DesignTab({ page, edit }: { page: Page; edit: (p: Partial<Page>) => void }) {
  const t = resolveTheme(page)
  const o = page.themeOverrides
  const setO = (patch: Partial<Page['themeOverrides']>) => edit({ themeOverrides: { ...o, ...patch } })
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
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="label">Tema</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEMES.map((th) => (
            <button
              key={th.id}
              onClick={() => edit({ themeId: th.id, themeOverrides: {} })}
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
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Cor de destaque">
          <div className="flex gap-2">
            <input type="color" className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-seam bg-transparent" value={t.accent} onChange={(e) => setO({ accent: e.target.value })} aria-label="Escolher cor" />
            <input className="field" aria-label="Cor de destaque em hexadecimal" value={o.accent ?? t.accent} onChange={(e) => setO({ accent: e.target.value })} />
          </div>
        </Field>
        <Field label="Fonte">
          <select className="field" value={t.fontId} onChange={(e) => setO({ fontId: e.target.value })}>
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Segment label="Formato dos botões" value={t.buttonShape} options={shapes} onChange={(v) => setO({ buttonShape: v })} />
      <Segment label="Estilo dos botões" value={t.buttonStyle} options={styles} onChange={(v) => setO({ buttonStyle: v })} />

      <div className="grid gap-5 sm:grid-cols-2">
        <ImageInput label="Imagem de fundo (opcional)" value={o.bgImage} onChange={(bgImage) => setO({ bgImage })} max={1280} />
        <Field label={`Escurecer o fundo: ${Math.round(t.bgDim * 100)}%`}>
          <input type="range" min={0} max={0.9} step={0.05} value={t.bgDim} onChange={(e) => setO({ bgDim: Number(e.target.value) })} className="w-full accent-[#B98AFF]" disabled={!o.bgImage} />
        </Field>
      </div>

      {Object.keys(o).length > 0 && (
        <button className="text-sm text-haze underline underline-offset-4 hover:text-bone" onClick={() => edit({ themeOverrides: {} })}>
          Voltar ao padrão do tema
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
