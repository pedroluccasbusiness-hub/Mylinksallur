import { Download, Share } from 'lucide-react'
import { useEffect, useState } from 'react'

// evento do Chrome/Android que permite abrir o "Instalar app" a partir de um botão nosso
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent)

/** Botão "Instalar app": no Android/Chrome abre a instalação; no iPhone explica o caminho pelo Safari. */
export function InstallApp({ compact }: { compact?: boolean }) {
  const [, force] = useState(0)
  const [showIOS, setShowIOS] = useState(false)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])

  if (isStandalone()) return null
  const ios = isIOS()
  if (!deferred && !ios) return null

  async function install() {
    if (deferred) {
      await deferred.prompt()
      await deferred.userChoice
      deferred = null
      force((n) => n + 1)
    } else {
      setShowIOS((v) => !v)
    }
  }

  return (
    <div>
      <button
        onClick={install}
        className={compact ? 'flex items-center gap-2 text-sm text-haze hover:text-bone' : 'btn-ghost w-full'}
      >
        <Download size={15} /> Instalar app
      </button>
      {showIOS && (
        <p className="mt-2 text-xs leading-relaxed text-haze">
          No Safari, toque em <Share size={12} className="inline align-[-2px]" /> <strong>Compartilhar</strong> e depois em{' '}
          <strong>Adicionar à Tela de Início</strong>.
        </p>
      )}
    </div>
  )
}
