import { BarChart3, Building2, Check, Link2, Palette, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { MiniPage } from '../components/MiniPage'
import { PlanCards } from '../components/PlanCards'
import { api, isDemo } from '../lib/api'
import { useAuth } from '../lib/auth'
import { DEMO_AGENCY, seedDemo } from '../lib/demoSeed'
import type { LocalBackend } from '../lib/localBackend'
import { brl } from '../lib/plans'
import { EXAMPLES } from '../lib/samples'
import type { AccountType } from '../lib/types'

// ---------------------------------------------------------------------------
// Textos por público. A landing inteira muda com o seletor do topo.
// ---------------------------------------------------------------------------
const COPY = {
  agency: {
    eyebrow: 'Para agências de modelos +18',
    title: 'Todas as suas modelos num painel só. Cada clique contado.',
    sub: 'Crie uma árvore de links para cada modelo e para cada perfil de Instagram dela, com o nome, a foto e o @ dela. Depois veja qual perfil traz visita e qual link vira clique.',
    cta: 'Ver planos para agência',
    ctaNote: `A partir de ${brl(49.9)}/mês. Monte a primeira árvore já no cadastro.`,
    pains: [
      'Um Linktree por modelo, cada um com e-mail e senha diferente',
      'Trocar o link do Privacy de 10 modelos, uma conta de cada vez',
      'Não saber se o perfil reserva traz mais clique que o principal',
      'Página de link com a marca de outra empresa no rodapé',
    ],
    gains: [
      'Todas as árvores no mesmo login, separadas por modelo',
      'Editar, duplicar e trocar o design de qualquer árvore em segundos',
      'Visitas, cliques e taxa de clique por modelo, por link e por perfil (?src=)',
      'Só a modelo aparece: nome, foto e @ dela, sem marca no rodapé',
    ],
    features: [
      { icon: Users, title: 'Elenco organizado', text: 'Cadastre cada modelo uma vez e ligue quantas árvores quiser a ela: uma por perfil de Instagram, uma para o TikTok, uma para campanha.' },
      { icon: BarChart3, title: 'Métricas que respondem perguntas', text: 'Qual modelo mais converte? Qual perfil traz assinante? Filtre por modelo, por período e por link divulgado, sem planilha.' },
      { icon: Palette, title: 'Um visual para cada modelo', text: '12 temas, 20 fontes, 4 estilos de cabeçalho, corte da foto e logo das plataformas ao lado de cada link.' },
      { icon: ShieldCheck, title: 'Feito para o Instagram', text: 'Abre rápido no navegador do app, sem pop-up, com links diretos para a plataforma. Aviso +18 opcional em cada link.' },
    ],
  },
  creator: {
    eyebrow: 'Para modelos que se gerenciam sozinhas',
    title: 'Seu link na bio, com a sua cara. E você sabe quem clicou.',
    sub: 'Monte sua árvore de links em minutos, com o seu nome, sua foto e o visual que combina com você. Veja quantas pessoas visitaram e em qual link clicaram.',
    cta: 'Criar meu link grátis',
    ctaNote: 'Grátis para sempre com 1 árvore. Sem cartão.',
    pains: [
      'Link na bio genérico, igual ao de todo mundo',
      'Não saber se as pessoas clicam no Privacy ou só olham',
      'Perfil reserva sem link próprio quando o principal cai',
      'Logo de outra empresa aparecendo na sua página',
    ],
    gains: [
      'Seu nome, sua foto e seu @, com tema e fonte que você escolhe',
      'Visitas e cliques de cada link, e de onde as pessoas vieram',
      'No Basic, 2 árvores: uma para o perfil principal e outra para o reserva',
      'Nenhuma marca no rodapé: a página é só sua',
    ],
    features: [
      { icon: Sparkles, title: 'Pronta em minutos', text: 'Escolha um tema, envie sua foto, ajuste o corte e cole os links. O logo do Privacy, OnlyFans, Fatal Fans e Telegram aparece sozinho.' },
      { icon: BarChart3, title: 'Saiba o que funciona', text: 'Veja quantas pessoas abriram sua página, em qual link clicaram e se vieram do Instagram, do TikTok ou de outro lugar.' },
      { icon: Link2, title: 'Mais de uma árvore', text: 'No Basic você tem 2 árvores: use uma para cada perfil e compare qual traz mais clique.' },
      { icon: ShieldCheck, title: 'Discreta e segura', text: 'Sem pop-up, aviso +18 só onde você quiser, e links diretos para a plataforma. Seu visitante nunca tem o IP guardado.' },
    ],
  },
} as const

const FAQ: Record<AccountType, { q: string; a: string }[]> = {
  agency: [
    { q: 'Preciso cadastrar as modelos com e-mail e senha?', a: 'Não. Você cadastra o elenco no seu painel e cria as árvores pela conta da agência. Se a modelo já tiver conta própria, ela se vincula com o código de convite da agência e você passa a editar e ver as métricas dela também.' },
    { q: 'O que conta como "árvore"?', a: 'Cada página de links com endereço próprio (ex.: /valentina). Uma modelo pode ter várias: uma por perfil de Instagram, por exemplo. Os planos limitam o número total de árvores da agência.' },
    { q: 'Como sei qual perfil de Instagram traz mais clique?', a: 'Em cada árvore você gera links com um final diferente (?src=ig-perfil1, ?src=ig-perfil2). As métricas mostram visitas, cliques e taxa de clique de cada um.' },
    { q: 'O Instagram pode derrubar o link?', a: 'Não fazemos nenhum truque para esconder o destino: os botões levam direto para a plataforma (Privacy, OnlyFans, Fatal Fans, Telegram). A página não tem conteúdo explícito. Isso reduz o risco, mas quem define as regras é o Instagram: siga as diretrizes dele.' },
    { q: 'Como pago e como cancelo?', a: 'A mensalidade é paga por Pix, pelo painel, a cada 30 dias, e o plano é liberado na hora. Não há cobrança automática nem fidelidade: se não renovar, a conta volta ao limite de 1 árvore e as árvores que já existem continuam no ar.' },
    { q: 'E se eu passar do limite do plano?', a: 'As árvores que você já tem continuam funcionando. Para criar mais, é só subir de plano na tela Conta.' },
  ],
  creator: [
    { q: 'O plano grátis é grátis mesmo?', a: 'Sim. Uma árvore, com temas, métricas e logos, sem cartão e sem prazo. O Basic custa R$ 9,90/mês e libera a segunda árvore.' },
    { q: 'Trabalho com uma agência. Posso usar mesmo assim?', a: 'Pode. Você cria sua conta e, se quiser, digita o código da sua agência: ela passa a editar e ver as métricas das suas páginas. Você pode sair quando quiser.' },
    { q: 'Funciona com Privacy, OnlyFans e Fatal Fans?', a: 'Funciona com qualquer link. Para essas plataformas, Telegram, WhatsApp, Instagram, TikTok e outras, o logo aparece sozinho ao lado do botão.' },
    { q: 'O Instagram pode derrubar o link?', a: 'A página não tem conteúdo explícito e os botões levam direto para a plataforma, sem truques. Isso ajuda, mas as regras são do Instagram: siga as diretrizes dele.' },
    { q: 'Meus visitantes são rastreados?', a: 'Contamos visitas e cliques de forma anônima. O IP de quem visita nunca é guardado, só um código embaralhado que muda todo dia.' },
  ],
}

export default function Landing() {
  const { profile, refresh } = useAuth()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [who, setWho] = useState<AccountType>(params.get('para') === 'modelo' ? 'creator' : 'agency')
  const c = COPY[who]

  useEffect(() => {
    document.title = 'My Link Hub | Link na bio para agências de modelos e modelos +18'
  }, [])

  function choose(t: AccountType) {
    setWho(t)
    setParams(t === 'creator' ? { para: 'modelo' } : {}, { replace: true })
  }

  async function openDemo() {
    const local = api as LocalBackend
    await seedDemo(local)
    await local.signIn(DEMO_AGENCY.email, DEMO_AGENCY.password)
    await refresh()
    nav('/app')
  }

  const stack = who === 'agency' ? [EXAMPLES[1], EXAMPLES[0], EXAMPLES[2]] : [EXAMPLES[6], EXAMPLES[4], EXAMPLES[5]]

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* topo */}
      <header className="sticky top-0 z-30 border-b border-seam/60 bg-ink/85 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-haze md:flex" aria-label="Seções">
            <a href="#exemplos" className="hover:text-bone">Exemplos</a>
            <a href="#como-funciona" className="hover:text-bone">Como funciona</a>
            <a href="#planos" className="hover:text-bone">Planos</a>
            <a href="#duvidas" className="hover:text-bone">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2 text-sm">
            {profile ? (
              <Link to="/app" className="btn-primary">
                Abrir painel
              </Link>
            ) : (
              <>
                <Link to={`/entrar?tipo=${who}`} className="btn px-3 text-haze hover:text-bone">
                  Entrar
                </Link>
                <a href="#planos" className="btn-primary">
                  {who === 'agency' ? 'Assinar' : 'Começar grátis'}
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 lg:pt-12">
        <div className="mx-auto mb-10 flex w-full max-w-sm rounded-full border border-seam bg-plum/60 p-1" role="tablist" aria-label="Para quem é">
          {(
            [
              { id: 'agency', label: 'Sou agência', icon: Building2 },
              { id: 'creator', label: 'Sou modelo', icon: Sparkles },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={who === o.id}
              onClick={() => choose(o.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition ${who === o.id ? 'bg-bone text-ink' : 'text-haze hover:text-bone'}`}
            >
              <o.icon size={16} /> {o.label}
            </button>
          ))}
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-champagne">{c.eyebrow}</p>
            <h1 className="mt-3 font-display text-[clamp(2.4rem,5.6vw,4.4rem)] font-medium leading-[1.03] tracking-tight">{c.title}</h1>
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-haze">{c.sub}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#planos" className="btn-primary px-6 py-3.5 text-base">
                {c.cta}
              </a>
              <a href="#exemplos" className="btn-ghost px-6 py-3.5 text-base">
                Ver exemplos
              </a>
            </div>
            <p className="mt-3 text-sm text-haze">{c.ctaNote}</p>
            {isDemo && (
              <button onClick={openDemo} className="mt-4 text-sm text-champagne underline underline-offset-4">
                Abrir o painel de demonstração
              </button>
            )}
          </div>

          <div className="relative mx-auto h-[460px] w-full max-w-[440px]" aria-hidden>
            {stack.map((s, i) => (
              <div
                key={s.page.id + who}
                className="absolute left-1/2 top-2 w-[205px] overflow-hidden rounded-[28px] border border-white/10 shadow-2xl shadow-black/60"
                style={{
                  transform: `translateX(-50%) translateX(${(i - 1) * 122}px) rotate(${(i - 1) * 7}deg) translateY(${Math.abs(i - 1) * 24}px)`,
                  zIndex: i === 1 ? 3 : 1,
                }}
              >
                <MiniPage page={s.page} blocks={s.blocks} height={420} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* antes e depois */}
      <section className="border-y border-seam bg-plum/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-2">
          <div className="rounded-2xl border border-seam p-6">
            <h2 className="font-display text-2xl text-haze">Sem o My Link Hub</h2>
            <ul className="mt-5 space-y-3">
              {c.pains.map((p) => (
                <li key={p} className="flex gap-3 text-haze">
                  <X size={18} className="mt-0.5 shrink-0 text-wine" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-orchid/50 bg-orchid/[0.06] p-6">
            <h2 className="font-display text-2xl">Com o My Link Hub</h2>
            <ul className="mt-5 space-y-3">
              {c.gains.map((g) => (
                <li key={g} className="flex gap-3">
                  <Check size={18} className="mt-0.5 shrink-0 text-orchid" /> {g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* benefícios + painel ilustrativo */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-2xl font-display text-[clamp(2rem,4vw,3rem)] leading-tight">
          {who === 'agency' ? 'Pensado para quem cuida de muitas modelos ao mesmo tempo.' : 'Tudo o que o seu link na bio precisa, e nada que atrapalhe.'}
        </h2>
        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          <ul className="grid gap-8 sm:grid-cols-2">
            {c.features.map((f) => (
              <li key={f.title}>
                <f.icon size={22} className="text-orchid" />
                <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 leading-relaxed text-haze">{f.text}</p>
              </li>
            ))}
          </ul>
          <MetricsPreview who={who} />
        </div>
      </section>

      {/* exemplos */}
      <section id="exemplos" className="scroll-mt-20 border-t border-seam bg-plum/30 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight">Uma árvore diferente para cada modelo.</h2>
          <p className="mt-3 max-w-[60ch] text-haze">
            Exemplos montados no próprio editor, com temas, fontes e cabeçalhos diferentes. Modelos e nomes fictícios.
          </p>
        </div>
        <div className="scroll-thin mt-10 flex snap-x gap-5 overflow-x-auto px-5 pb-4 lg:mx-auto lg:max-w-6xl lg:flex-wrap lg:justify-between lg:overflow-visible">
          {EXAMPLES.map((s) => (
            <figure key={s.page.id} className="w-[220px] shrink-0 snap-start">
              <div className="overflow-hidden rounded-[24px] border border-white/10 shadow-xl shadow-black/40">
                <MiniPage page={s.page} blocks={s.blocks} height={400} />
              </div>
              <figcaption className="mt-2 text-xs text-haze">/{s.page.slug}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* como funciona */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight">Do cadastro ao link na bio em três passos.</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {(who === 'agency'
            ? [
                ['Crie a conta da agência', 'Escolha o plano pelo número de árvores que o seu elenco precisa.'],
                ['Monte uma árvore por perfil', 'Cadastre a modelo, escolha o tema, envie a foto e cole os links das plataformas.'],
                ['Cole na bio e acompanhe', 'Use um ?src= diferente em cada perfil e veja no painel qual traz mais clique.'],
              ]
            : [
                ['Crie sua conta grátis', 'Só nome, e-mail e senha. Sem cartão.'],
                ['Monte sua árvore', 'Escolha o tema, envie a foto, ajuste o corte e cole seus links.'],
                ['Cole na bio do Instagram', 'Pronto. Veja visitas e cliques no painel quando quiser.'],
              ]
          ).map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-seam p-6">
              <span className="font-display text-4xl text-orchid">{i + 1}</span>
              <h3 className="mt-3 text-lg font-semibold">{t}</h3>
              <p className="mt-1.5 text-haze">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* planos */}
      <section id="planos" className="scroll-mt-20 border-t border-seam bg-plum/30 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight">
                {who === 'agency' ? 'Pague pelo tamanho do seu elenco.' : 'Comece grátis. Cresça quando quiser.'}
              </h2>
              <p className="mt-3 max-w-[60ch] text-haze">
                {who === 'agency'
                  ? 'Todos os planos têm todas as funções. Muda só quantas árvores de links você pode ter. Mensal, por Pix, liberado na hora.'
                  : 'O grátis já tem temas, métricas e logos. O Basic libera a segunda árvore.'}
              </p>
            </div>
            <button onClick={() => choose(who === 'agency' ? 'creator' : 'agency')} className="text-sm text-champagne underline underline-offset-4">
              {who === 'agency' ? 'Sou modelo: ver planos para modelo' : 'Sou agência: ver planos para agência'}
            </button>
          </div>
          <div className="mt-12">
            <PlanCards audience={who} />
          </div>
        </div>
      </section>

      {/* dúvidas */}
      <section id="duvidas" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-20">
        <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight">Dúvidas comuns</h2>
        <div className="mt-8 divide-y divide-seam border-y border-seam">
          {FAQ[who].map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {f.q}
                <span className="shrink-0 text-2xl leading-none text-orchid transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-haze">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* chamada final */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-5xl rounded-3xl border border-orchid/40 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(185,138,255,.18),transparent_60%)] px-6 py-14 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-[clamp(2rem,4.5vw,3.2rem)] leading-tight">
            {who === 'agency' ? 'Seu elenco inteiro organizado ainda hoje.' : 'Seu novo link na bio fica pronto em minutos.'}
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#planos" className="btn-primary px-6 py-3.5 text-base">
              {c.cta}
            </a>
          </div>
          <p className="mt-3 text-sm text-haze">{c.ctaNote}</p>
        </div>
      </section>

      <footer className="border-t border-seam">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-haze">
          <Logo />
          <p className="max-w-md">
            Ferramenta para maiores de 18 anos. As páginas não hospedam conteúdo explícito: os links levam às plataformas de cada modelo.
          </p>
          <Link to={`/entrar?tipo=${who}`} className="hover:text-bone">
            Entrar
          </Link>
        </div>
      </footer>
    </div>
  )
}

/** Painel de métricas ilustrativo (números de exemplo, sinalizados como tal). */
function MetricsPreview({ who }: { who: AccountType }) {
  const rows =
    who === 'agency'
      ? [
          ['Valentina', 'ig-principal', '1.240', '43%'],
          ['Valentina', 'ig-reserva', '610', '38%'],
          ['Mel', 'ig-principal', '980', '47%'],
          ['Bia', 'tiktok', '420', '29%'],
        ]
      : [
          ['Meu Privacy', '', '512', '41%'],
          ['Fatal Fans', '', '233', '19%'],
          ['Grupo VIP', '', '180', '14%'],
        ]
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{who === 'agency' ? 'Por modelo e perfil' : 'Seus links'}</p>
        <p className="text-xs text-haze">últimos 30 dias</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-seam bg-seam text-center">
        {[
          ['Visitas', who === 'agency' ? '3.250' : '1.250'],
          ['Cliques', who === 'agency' ? '1.381' : '925'],
          ['CTR', who === 'agency' ? '42,5%' : '74%'],
        ].map(([k, v]) => (
          <div key={k} className="bg-plum px-3 py-3">
            <p className="text-[11px] text-haze">{k}</p>
            <p className="font-display text-2xl tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs text-haze">
          <tr>
            <th className="pb-2 font-medium">{who === 'agency' ? 'Modelo' : 'Link'}</th>
            {who === 'agency' && <th className="pb-2 font-medium">src</th>}
            <th className="pb-2 text-right font-medium">{who === 'agency' ? 'Visitas' : 'Cliques'}</th>
            <th className="pb-2 text-right font-medium">CTR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.join()} className="border-t border-seam/70">
              <td className="py-2">{r[0]}</td>
              {who === 'agency' && <td className="py-2 text-haze">{r[1]}</td>}
              <td className="py-2 text-right tabular-nums">{r[2]}</td>
              <td className="py-2 text-right tabular-nums">{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-haze/80">Números ilustrativos, para mostrar como o painel organiza os dados.</p>
    </Frame>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-seam bg-plum p-5 shadow-2xl shadow-black/40">{children}</div>
}
