import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/ui'
import './index.css'
import { AuthProvider } from './lib/auth'
import { FONTS, loadFonts } from './lib/themes'

// Fontes da interface do painel. As fontes de cada página da modelo são carregadas sob demanda
// (loadFonts), sem bloquear a primeira pintura e sem script inline (a CSP proíbe).
loadFonts(FONTS.filter((f) => f.id === 'bodoni'))

// Web app: o service worker deixa o app instalável e rápido. Só no site publicado (não no bolt nem no dev).
// o Safari do iPhone ignora user-scalable=no; estes eventos bloqueiam o zoom de pinça lá
const noZoom = (e: Event) => e.preventDefault()
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, noZoom, { passive: false })
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })

if (import.meta.env.PROD && 'serviceWorker' in navigator && window.top === window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sem service worker o site funciona igual, só sem instalação */
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
