import { BarChart3, Copy, ExternalLink, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MiniPage } from '../components/MiniPage'
import { ErrorNote, errMsg, Field, Modal, Spinner, useToast } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { newBlock } from '../lib/blocks'
import { slugError, slugify } from '../lib/slug'
import { THEMES } from '../lib/themes'
import { CREATOR_PAGE_LIMIT, type Model, type PageWithOwner } from '../lib/types'

export default function PagesList() {
  const { profile } = useAuth()
  const [pages, setPages] = useState<PageWithOwner[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [dupOf, setDupOf] = useState<PageWithOwner | null>(null)
  const [removing, setRemoving] = useState<PageWithOwner | null>(null)
  const [filter, setFilter] = useState('')
  const [model, setModel] = useState('')
  const toast = useToast()

  const load = useCallback(() => {
    api
      .listManagedPages()
      .then(setPages)
      .catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(load, [load])

  async function copyLink(slug: string) {
    const url = `${location.origin}/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      toast(`Link copiado: ${url.replace(/^https?:\/\//, '')}`)
    } catch {
      // navegador sem permissão de área de transferência: mostra o link para copiar à mão
      window.prompt('Copie o link da página:', url)
    }
  }

  const isCreator = profile?.accountType === 'creator'
  const ownCount = pages?.filter((p) => p.ownerId === profile?.id).length ?? 0
  const atLimit = isCreator && ownCount >= CREATOR_PAGE_LIMIT

  const modelNames = useMemo(() => [...new Set((pages ?? []).map((p) => p.modelName))].sort(), [pages])
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (pages ?? []).filter(
      (p) =>
        (!model || p.modelName === model) &&
        (!q || [p.title, p.slug, p.handle, p.modelName].some((v) => v.toLowerCase().includes(q))),
    )
  }, [pages, filter, model])

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Páginas</h1>
          <p className="mt-1 text-sm text-haze">
            {isCreator
              ? `${ownCount} de ${CREATOR_PAGE_LIMIT} páginas usadas na sua conta de criadora.`
              : `${pages?.length ?? 0} páginas, sem limite na conta de agência.`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)} disabled={atLimit}>
          <Plus size={16} /> Nova página
        </button>
      </div>
      {atLimit && (
        <p className="mt-4 rounded-lg border border-champagne/30 bg-champagne/10 px-4 py-3 text-sm text-champagne">
          Você chegou ao limite de {CREATOR_PAGE_LIMIT} páginas da conta de criadora. Para ter mais, peça à sua agência para
          criar as páginas pela conta dela, ou exclua uma página.
        </p>
      )}

      {pages && pages.length > 3 && (
        <div className="mt-6 flex flex-wrap gap-2">
          <input
            className="field max-w-xs"
            placeholder="Buscar por nome, @ ou endereço"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Buscar páginas"
          />
          <select className="field w-auto" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Filtrar por modelo">
            <option value="">Todas as modelos</option>
            {modelNames.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6">
        <ErrorNote error={error} />
        {!pages && !error && <Spinner />}
        {pages && pages.length === 0 && (
          <div className="panel flex flex-col items-center px-6 py-14 text-center">
            <p className="font-display text-2xl">Nenhuma página ainda</p>
            <p className="mt-2 max-w-sm text-sm text-haze">Crie a primeira página, escolha um tema e adicione os links da criadora.</p>
            <button className="btn-primary mt-6" onClick={() => setCreating(true)}>
              <Plus size={16} /> Criar primeira página
            </button>
          </div>
        )}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
          {shown.map((p) => (
            <li key={p.id} className="group flex flex-col">
              <Link
                to={`/app/paginas/${p.id}`}
                className="relative block overflow-hidden rounded-2xl border border-seam transition hover:border-haze/60"
                aria-label={`Editar ${p.title || p.slug}`}
              >
                <div className="bg-ink">
                  <MiniPage page={p} blocks={p.blocks.filter((b) => b.isActive)} height={300} />
                </div>
                {!p.isPublished && (
                  <span className="absolute left-3 top-3 rounded-full bg-ink/90 px-2.5 py-1 text-[11px] font-semibold text-champagne">
                    Rascunho
                  </span>
                )}
              </Link>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.title || p.slug}</p>
                  <p className="truncate text-xs text-haze">
                    /{p.slug}
                    {p.handle && ` | @${p.handle.replace(/^@/, '')}`}
                  </p>
                  {!isCreator && (
                    <p className="truncate text-xs text-champagne/90">
                      {p.ownerId !== profile?.id ? `Conta própria de ${p.ownerName}` : `Modelo: ${p.modelName}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex gap-1 text-haze">
                <IconLink to={`/app/paginas/${p.id}`} label="Editar" icon={Pencil} />
                <IconLink to={`/app/paginas/${p.id}/metricas`} label="Métricas" icon={BarChart3} />
                <button
                  className="rounded-md p-2 hover:bg-plum hover:text-bone"
                  title="Copiar link da página"
                  aria-label={`Copiar link de ${p.title || p.slug}`}
                  onClick={() => copyLink(p.slug)}
                >
                  <Link2 size={16} />
                </button>
                <a href={`/${p.slug}`} target="_blank" rel="noreferrer" className="rounded-md p-2 hover:bg-plum hover:text-bone" title="Abrir página" aria-label="Abrir página">
                  <ExternalLink size={16} />
                </a>
                <button className="rounded-md p-2 hover:bg-plum hover:text-bone disabled:opacity-40" title="Duplicar" aria-label="Duplicar" disabled={atLimit} onClick={() => setDupOf(p)}>
                  <Copy size={16} />
                </button>
                <button className="ml-auto rounded-md p-2 hover:bg-wine/20 hover:text-[#f1a7bd]" title="Excluir" aria-label="Excluir" onClick={() => setRemoving(p)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <CreatePageModal open={creating} onClose={() => setCreating(false)} isAgency={!isCreator} />
      <DuplicateModal page={dupOf} onClose={() => setDupOf(null)} onDone={load} />
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Excluir página">
        <p className="text-sm text-haze">
          A página <strong className="text-bone">/{removing?.slug}</strong>, os links e as métricas dela serão apagados. Isso não pode ser desfeito.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setRemoving(null)}>
            Cancelar
          </button>
          <button
            className="btn-danger"
            onClick={async () => {
              try {
                await api.deletePage(removing!.id)
                toast('Página excluída')
                setRemoving(null)
                load()
              } catch (e) {
                toast(errMsg(e))
              }
            }}
          >
            Excluir página
          </button>
        </div>
      </Modal>
    </div>
  )
}

function IconLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Pencil }) {
  return (
    <Link to={to} className="rounded-md p-2 hover:bg-plum hover:text-bone" title={label} aria-label={label}>
      <Icon size={16} />
    </Link>
  )
}

const STARTERS = [
  { id: 'creator', label: 'Modelo', text: 'Assinatura, grupo VIP, WhatsApp e TikTok' },
  { id: 'blank', label: 'Em branco', text: 'Comece do zero' },
]

function CreatePageModal({ open, onClose, isAgency }: { open: boolean; onClose: () => void; isAgency: boolean }) {
  const [models, setModels] = useState<Model[]>([])
  const [modelId, setModelId] = useState('')
  const [newModel, setNewModel] = useState('')
  const [title, setTitle] = useState('')
  const [handle, setHandle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [themeId, setThemeId] = useState(THEMES[0].id)
  const [starter, setStarter] = useState('creator')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (open && isAgency)
      api.listModels().then((list) => {
        setModels(list)
        setModelId((cur) => cur || list[0]?.id || 'new')
      })
  }, [open, isAgency])

  // ao escolher a modelo, preenche nome e @ (dá para editar)
  useEffect(() => {
    const m = models.find((x) => x.id === modelId)
    if (m) {
      setTitle(m.name)
      setHandle(m.instagram.replace(/^@/, ''))
    }
  }, [modelId, models])

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(handle.split('.')[0] || title).slice(0, 20))
  }, [title, handle, slugTouched])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const err = slugError(slug)
    if (err) return setError(err)
    setBusy(true)
    setError(null)
    try {
      let mId: string | null = null
      if (isAgency) {
        if (modelId === 'new') {
          if (!newModel.trim()) throw new Error('Digite o nome da modelo.')
          mId = (await api.createModel({ name: newModel, instagram: handle ? `@${handle}` : '' })).id
        } else mId = modelId || null
      }
      const page = await api.createPage({ slug, title, handle: handle.replace(/^@/, ''), modelId: mId, themeId })
      if (starter === 'creator') {
        const blocks = [
          newBlock(page.id, 'link', { title: 'Conteúdo exclusivo', subtitle: 'Assinatura', url: '' }),
          newBlock(page.id, 'link', { title: 'Grupo VIP no Telegram', url: '' }),
          newBlock(page.id, 'link', { title: 'Fale comigo no WhatsApp', url: '' }),
          newBlock(page.id, 'link', { title: 'TikTok', url: '' }),
        ]
        blocks[0].highlight = 'shine'
        await api.saveBlocks(page.id, blocks)
      }
      onClose()
      nav(`/app/paginas/${page.id}`)
    } catch (e2) {
      setError(errMsg(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova página" wide>
      <form onSubmit={submit} className="space-y-5">
        {isAgency && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Modelo do elenco" hint="A página leva o nome e o @ dela, não o da agência.">
              <select className="field" value={modelId} onChange={(e) => setModelId(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.instagram ? ` (${m.instagram})` : ''}
                  </option>
                ))}
                <option value="new">+ Nova modelo</option>
              </select>
            </Field>
            {modelId === 'new' && (
              <Field label="Nome da nova modelo">
                <input className="field" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Ex.: Valentina" />
              </Field>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome na página">
            <input className="field" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Valentina Rosé" />
          </Field>
          <Field label="@ do Instagram" hint="O perfil onde esta árvore vai ficar na bio.">
            <input className="field" value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ''))} placeholder="valentina.rs" />
          </Field>
        </div>
        <Field label="Endereço" hint={`${location.host}/${slug || 'endereco'} (curto e fácil de digitar)`}>
          <input
            className="field"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
          />
        </Field>
        <fieldset>
          <legend className="label">Tema</legend>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setThemeId(t.id)}
                aria-pressed={themeId === t.id}
                className={`overflow-hidden rounded-xl border text-left transition ${themeId === t.id ? 'border-orchid ring-1 ring-orchid' : 'border-seam'}`}
              >
                <span className="flex h-14 flex-col justify-end gap-1 p-2" style={{ background: t.background }}>
                  <i className="block h-2 rounded-full" style={{ background: t.buttonStyle === 'outline' ? 'transparent' : t.surface, border: `1px solid ${t.accent}` }} />
                  <i className="block h-2 rounded-full opacity-70" style={{ background: t.buttonStyle === 'outline' ? 'transparent' : t.surface, border: `1px solid ${t.accent}` }} />
                </span>
                <span className="block truncate px-2 py-1.5 text-[11px] text-haze">{t.name}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Começar com</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setStarter(s.id)}
                aria-pressed={starter === s.id}
                className={`rounded-xl border p-3 text-left ${starter === s.id ? 'border-orchid bg-orchid/10' : 'border-seam'}`}
              >
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className="block text-xs text-haze">{s.text}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Criando…' : 'Criar página'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DuplicateModal({ page, onClose, onDone }: { page: PageWithOwner | null; onClose: () => void; onDone: () => void }) {
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  useEffect(() => {
    if (page) {
      setSlug(slugify(`${page.slug}-2`))
      setError(null)
    }
  }, [page])
  return (
    <Modal open={!!page} onClose={onClose} title="Duplicar página">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await api.duplicatePage(page!.id, slug)
            toast('Página duplicada')
            onClose()
            onDone()
          } catch (e2) {
            setError(errMsg(e2))
          }
        }}
      >
        <p className="text-sm text-haze">Copia o tema, o perfil e todos os blocos. As métricas começam do zero.</p>
        <Field label="Endereço da cópia">
          <input className="field" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </Field>
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary">Duplicar</button>
        </div>
      </form>
    </Modal>
  )
}
