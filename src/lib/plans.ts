// Planos e limites. Os mesmos números estão no banco (plan_page_limit), que é quem garante de verdade.
import type { AccountType, Profile } from './types'

export type PlanId = 'free' | 'basic' | 'plus' | 'diamond' | 'platinum' | 'king'
export type PlanStatus = 'active' | 'pending' | 'overdue' | 'canceled'

export interface Plan {
  id: PlanId
  audience: AccountType
  name: string
  /** em reais por mês; 0 = grátis */
  price: number
  /** árvores de links; null = sem limite */
  limit: number | null
  pitch: string
  highlight?: boolean
}

export const PLANS: Plan[] = [
  { id: 'free', audience: 'creator', name: 'Grátis', price: 0, limit: 1, pitch: 'Para começar hoje, sem cartão.' },
  { id: 'basic', audience: 'creator', name: 'Basic', price: 9.9, limit: 2, pitch: 'Duas árvores: perfil principal e reserva.', highlight: true },
  { id: 'basic', audience: 'agency', name: 'Basic', price: 49.9, limit: 2, pitch: 'Para testar com as duas primeiras modelos.' },
  { id: 'plus', audience: 'agency', name: 'Plus', price: 97.9, limit: 5, pitch: 'Para a agência que está montando o elenco.', highlight: true },
  { id: 'diamond', audience: 'agency', name: 'Diamond', price: 249.7, limit: 10, pitch: 'Dez árvores para um elenco em crescimento.' },
  { id: 'platinum', audience: 'agency', name: 'Platinum', price: 497, limit: 30, pitch: 'Trinta árvores: várias por modelo, por perfil.' },
  { id: 'king', audience: 'agency', name: 'King OFM', price: 997, limit: null, pitch: 'Sem limite de árvores. Para operação grande.' },
]

/** limite enquanto a mensalidade não está ativa */
export const TRIAL_LIMIT = 1

export function plansFor(audience: AccountType) {
  return PLANS.filter((p) => p.audience === audience)
}

export function findPlan(audience: AccountType, id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.audience === audience && p.id === id)
}

/** Igual a plan_page_limit() no banco. null = sem limite. */
export function pageLimit(p: Pick<Profile, 'accountType' | 'plan' | 'planStatus'>): number | null {
  if (p.accountType === 'creator') return p.planStatus === 'active' && p.plan === 'basic' ? 2 : 1
  if (p.planStatus !== 'active') return TRIAL_LIMIT
  const plan = findPlan('agency', p.plan)
  // atenção: limit null quer dizer ilimitado (King), então não dá para usar "??" aqui
  return plan ? plan.limit : TRIAL_LIMIT
}

export function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const STATUS_LABEL: Record<PlanStatus, string> = {
  active: 'Ativo',
  pending: 'Aguardando pagamento',
  overdue: 'Pagamento atrasado',
  canceled: 'Cancelado',
}
