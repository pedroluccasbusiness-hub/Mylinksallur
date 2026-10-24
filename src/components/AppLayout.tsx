import { BarChart3, Layers, LogOut, Settings, Users } from 'lucide-react'
import { Suspense } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, isDemo, setupProblem } from '../lib/api'
import { useAuth } from '../lib/auth'
import { effectiveStatus, findPlan } from '../lib/plans'
import { InstallApp } from './InstallApp'
import { Logo } from './Logo'
import { Spinner } from './ui'

const NAV = [
  { to: '/app', label: 'Visão geral', icon: BarChart3, end: true },
  { to: '/app/paginas', label: 'Páginas', icon: Layers },
  { to: '/app/equipe', label: 'Elenco', agencyLabel: 'Elenco', creatorLabel: 'Agência', icon: Users },
  { to: '/app/conta', label: 'Conta', icon: Settings },
]

export function AppLayout() {
  const { profile, loading } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()

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
          <div className="mb-4">
            <InstallApp compact />
          </div>
          <p className="truncate text-sm font-semibold">{profile.displayName}</p>
          <p className="text-xs text-haze">{profile.accountType === 'agency' ? 'Conta de agência' : 'Conta de modelo'}</p>
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
            {setupProblem && <span className="mt-0.5 block font-semibold">O que falta: {setupProblem}.</span>}
          </div>
        )}
        <header
          className="flex items-center justify-between border-b border-seam px-4 pb-3 md:hidden"
          // no app instalado (tela cheia) o topo fica embaixo do relógio/entalhe do iPhone
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <Logo />
          <div className="flex items-center gap-4">
            <InstallApp compact />
            <span className="text-xs text-haze">{profile.accountType === 'agency' ? 'Agência' : 'Modelo'}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
          {profile && <PlanNotice status={effectiveStatus(profile)} planName={findPlan(profile.accountType, profile.plan)?.name} paid={(findPlan(profile.accountType, profile.plan)?.price ?? 0) > 0} hidden={pathname === '/app/conta'} />}
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
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

/** aviso no topo do painel quando o plano pago ainda não foi pago ou venceu */
function PlanNotice({ status, planName, paid, hidden }: { status: string; planName?: string; paid: boolean; hidden: boolean }) {
  if (hidden || !paid || status === 'active') return null
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-champagne/30 bg-champagne/10 px-4 py-3 text-sm text-champagne">
      <span>
        {status === 'overdue'
          ? `A mensalidade do plano ${planName} venceu. A conta está no limite de 1 árvore.`
          : `Falta pagar o plano ${planName}. Até lá a conta fica no limite de 1 árvore.`}
      </span>
      <Link to="/app/conta#plano" className="btn-primary px-3 py-1.5 text-xs">
        Pagar por Pix
      </Link>
    </div>
  )
}
