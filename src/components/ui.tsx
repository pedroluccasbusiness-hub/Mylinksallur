import { X } from 'lucide-react'
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'

/** Rótulo ligado ao controle por id (o nome acessível não mistura o valor digitado). */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  const autoId = useId()
  const single = isValidElement<{ id?: string }>(children) && typeof children.type === 'string'
  const id = single ? (children.props.id ?? autoId) : undefined
  return (
    <div className="block">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {single ? cloneElement(children, { id }) : children}
      {hint && <span className="mt-1 block text-xs text-haze/80">{hint}</span>}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition ${checked ? 'bg-orchid' : 'bg-seam'}`}
      >
        <span className={`block h-4 w-4 rounded-full bg-bone transition ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span>
        <span className="block text-sm font-medium text-bone">{label}</span>
        {hint && <span className="block text-xs text-haze">{hint}</span>}
      </span>
    </label>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`panel max-h-[92vh] w-full overflow-y-auto rounded-b-none p-6 sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-haze hover:text-bone" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-haze" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-seam border-t-orchid" />
      {label}
    </div>
  )
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg border border-wine/60 bg-wine/15 px-3 py-2 text-sm text-[#f6c3d2]">
      {error}
    </p>
  )
}

// ---------- toasts ----------
type Toast = { id: number; text: string }
const ToastCtx = createContext<(text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random()
    setList((l) => [...l, { id, text }])
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="rounded-full border border-seam bg-ink px-4 py-2 text-sm text-bone shadow-lg shadow-black/40">
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Algo deu errado. Tente de novo.'
}
