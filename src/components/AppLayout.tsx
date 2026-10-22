import { BarChart3, Layers, LogOut, Settings, Users } from 'lucide-react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Logo } from './Logo'
import { Spinner } from './ui'

const NAV = [
  { to: '/app', label: 'Visão geral', icon: BarChart3, end: true },
  { to: '/app/paginas', label: 'Páginas', icon: Layers },
  { to: '/app/equipe', label: 'Criadoras', agencyLabel: 'Criadoras', creatorLabel: 'Agência', icon: Users },
  { to: '/app/conta', label: 'Conta', icon: Settings },
]

export function AppLayout() {
  const { profile, loading } = useAuth()
  const nav = useNavigate()

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  if (!profile) return <Navigate to="/entrar" replace />

  const label = (n: (typeof NAV)[number]) =>
    profile.accountType === 'agency' ? (n.agencyLabel ?? n.label) : (n.creatorLabel ?? n.label)

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-seam bg-ink px-4 py-6 md:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Principal">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-plum text-bone' : 'text-haze hover:text-bone'}`
              }
            >
              <n.icon size={17} />
              {label(n)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-seam pt-4">
          <p className="truncate text-sm font-semibold">{profile.displayName}</p>
          <p className="text-xs text-haze">{profile.accountType === 'agency' ? 'Conta de agência' : 'Conta de criadora'}</p>
          <button
            className="mt-3 flex items-center gap-2 text-sm text-haze hover:text-bone"
            onClick={async () => {
              await api.signOut()
              nav('/entrar')
            }}
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        {isDemo && (
          <div className="border-b border-champagne/20 bg-champagne/10 px-4 py-2 text-center text-xs text-champagne">
            Modo demonstração: os dados ficam só neste navegador. Para usar de verdade, configure o Supabase (veja o README).
          </div>
        )}
        <header className="flex items-center justify-between border-b border-seam px-4 py-3 md:hidden">
          <Logo />
          <span className="text-xs text-haze">{profile.accountType === 'agency' ? 'Agência' : 'Criadora'}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-seam bg-ink/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Principal"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? 'text-bone' : 'text-haze'}`}
          >
            <n.icon size={19} />
            {label(n)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
