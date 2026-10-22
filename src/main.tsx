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
