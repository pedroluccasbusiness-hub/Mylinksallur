import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { MiniPage } from '../components/MiniPage'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { DEMO_AGENCY, seedDemo } from '../lib/demoSeed'
import type { LocalBackend } from '../lib/localBackend'
import { samplePage } from '../lib/samples'

const STACK = [
  samplePage('vinho-creme', 'Valentina', 'Bastidores e conteúdo exclusivo.', ['#8E2C4A', '#E7C9A1']),
  samplePage('noir-violeta', 'Mel Noir', 'Ensaios novos toda semana.', ['#5b2a9e', '#1a0b2b']),
  samplePage('onix-dourado', 'Bia', 'Assinatura com desconto hoje.', ['#C9A46A', '#2b2418']),
]

export default function Landing() {
  const { profile, refresh } = useAuth()
  const nav = useNavigate()

  async function openDemo() {
    const local = api as LocalBackend
    await seedDemo(local)
    await local.signIn(DEMO_AGENCY.email, DEMO_AGENCY.password)
    await refresh()
    nav('/app')
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          {profile ? (
            <Link to="/app" className="btn-primary">
              Abrir painel
            </Link>
          ) : (
            <>
              <Link to="/entrar" className="btn text-haze hover:text-bone">
                Entrar
              </Link>
              <Link to="/cadastro" className="btn-primary">
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.6rem)] font-medium leading-[1.02] tracking-tight">
            Cada criadora com a sua página. Todas no mesmo painel.
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-haze">
            Crie páginas de links para quantas criadoras a agência tiver, cada uma com o próprio visual, e acompanhe
            visitas e cliques de todas juntas ou uma por uma.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/cadastro?tipo=agency" className="btn-primary px-5 py-3">
              Criar conta de agência
            </Link>
            <Link to="/cadastro?tipo=creator" className="btn-ghost px-5 py-3">
              Sou criadora
            </Link>
            {isDemo && (
              <button onClick={openDemo} className="btn px-5 py-3 text-champagne underline-offset-4 hover:underline">
                Ver demonstração
              </button>
            )}
          </div>
        </div>

        <div className="relative mx-auto h-[440px] w-full max-w-[420px]" aria-hidden>
          {STACK.map((s, i) => (
            <div
              key={s.page.id}
              className="absolute left-1/2 top-4 overflow-hidden rounded-[28px] border border-white/10 shadow-2xl shadow-black/60"
              style={{
                transform: `translateX(-50%) translateX(${(i - 1) * 118}px) rotate(${(i - 1) * 7}deg) translateY(${Math.abs(i - 1) * 22}px)`,
                zIndex: i === 1 ? 3 : 1,
              }}
            >
              <MiniPage page={s.page} blocks={s.blocks} width={200} height={400} />
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-seam bg-plum/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl">Conta de agência</h2>
            <ul className="mt-5 space-y-3 text-haze">
              <li>Páginas sem limite, uma ou mais por criadora.</li>
              <li>Tema e personalização diferentes em cada página.</li>
              <li>Métricas de todas as páginas juntas e de cada uma.</li>
              <li>Código de convite para vincular criadoras que já têm conta.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl">Conta de criadora</h2>
            <ul className="mt-5 space-y-3 text-haze">
              <li>Até 2 páginas próprias.</li>
              <li>Os mesmos temas, blocos e métricas.</li>
              <li>Pode se vincular a uma agência e sair quando quiser.</li>
              <li>Aviso de +18 na página ou em links específicos.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-haze">
        <Logo />
        <span>Feito para agências de criadoras de conteúdo.</span>
      </footer>
    </div>
  )
}
