import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { brl, plansFor, type Plan } from '../lib/plans'
import type { AccountType } from '../lib/types'

const COMMON: Record<AccountType, string[]> = {
  agency: [
    'Elenco: cada árvore ligada a uma modelo',
    'Métricas por modelo, por link e por perfil de Instagram',
    '20 fontes, 12 temas e 4 estilos de cabeçalho',
    'Modelos com conta própria se vinculam por código',
  ],
  creator: [
    'Seu nome, foto e @ (sem marca de ninguém)',
    'Visitas, cliques e de onde vêm, por link',
    'Temas, fontes e logos das plataformas',
    'Aviso +18 por link e endereço curto',
  ],
}

function perTree(p: Plan) {
  if (!p.price || !p.limit) return null
  return brl(p.price / p.limit)
}

/**
 * Cartões de preço. Com `onChoose` vira escolha dentro do app; sem ele, cada botão leva ao cadastro já com o plano.
 */
export function PlanCards({
  audience,
  current,
  onChoose,
  busy,
}: {
  audience: AccountType
  current?: string | null
  onChoose?: (plan: Plan) => void
  busy?: string | null
}) {
  const plans = plansFor(audience)
  return (
    <div>
      <ul className={`grid gap-4 ${audience === 'agency' ? 'sm:grid-cols-2 xl:grid-cols-5' : 'mx-auto max-w-3xl sm:grid-cols-2'}`}>
        {plans.map((p) => {
          const isCurrent = current === p.id
          const cta = p.price === 0 ? 'Criar meu link grátis' : audience === 'agency' ? `Assinar ${p.name}` : 'Assinar o Basic'
          return (
            <li
              key={p.id}
              className={`relative flex flex-col rounded-2xl border p-5 ${p.highlight ? 'border-orchid bg-orchid/[0.07]' : 'border-seam bg-plum/60'}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-5 rounded-full bg-orchid px-2.5 py-0.5 text-[11px] font-bold text-ink">
                  Recomendado
                </span>
              )}
              <h3 className="font-display text-2xl">{p.name}</h3>
              <p className="mt-1 min-h-[2.5rem] text-sm text-haze">{p.pitch}</p>
              <p className="mt-4">
                <span className="font-display text-[2rem] leading-none tabular-nums">{p.price ? brl(p.price) : 'R$ 0'}</span>
                <span className="block text-sm text-haze">{p.price ? 'por mês' : 'para sempre'}</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-bone">
                {p.limit === null ? 'Árvores de links ilimitadas' : `${p.limit} ${p.limit === 1 ? 'árvore' : 'árvores'} de links`}
              </p>
              {perTree(p) && <p className="text-xs text-haze">{perTree(p)} por árvore por mês</p>}
              <div className="mt-auto pt-5">
                {onChoose ? (
                  <button
                    className={isCurrent ? 'btn-ghost w-full' : p.highlight ? 'btn-primary w-full' : 'btn-ghost w-full'}
                    disabled={isCurrent || p.price === 0 || busy === p.id}
                    onClick={() => onChoose(p)}
                  >
                    {isCurrent ? 'Seu plano' : busy === p.id ? 'Enviando…' : `Quero o ${p.name}`}
                  </button>
                ) : (
                  <Link
                    to={`/cadastro?tipo=${audience}${p.price ? `&plano=${p.id}` : ''}`}
                    className={p.highlight ? 'btn-primary w-full' : 'btn-ghost w-full'}
                  >
                    {cta}
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mx-auto mt-8 max-w-4xl text-sm font-semibold text-bone">Em todos os planos:</p>
      <ul className="mx-auto mt-3 grid max-w-4xl gap-2 text-sm text-haze sm:grid-cols-2">
        {COMMON[audience].map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-orchid" /> {f}
          </li>
        ))}
      </ul>
    </div>
  )
}
