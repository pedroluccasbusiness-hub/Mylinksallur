import type { Backend } from './backend'
import { LocalBackend } from './localBackend'
import { SupabaseBackend } from './supabaseBackend'

/** Limpa erros comuns ao colar no .env: aspas, espaços e o final /rest/v1/ que o painel do Supabase mostra. */
function clean(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
}

const env = import.meta.env
const rawUrl = clean(env.VITE_SUPABASE_URL) || clean(env.NEXT_PUBLIC_SUPABASE_URL)
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
// o painel novo do Supabase chama a chave pública de "publishable"; aceitamos os dois nomes
// (e os nomes NEXT_PUBLIC_ que a integração do bolt grava)
const key =
  clean(env.VITE_SUPABASE_ANON_KEY) ||
  clean(env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  clean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)
// a chave secreta nunca pode ir para o site: nesse caso nem conecta
const keyIsSecret = /^sb_secret_/.test(key)
const keyOk = key.length > 20 && !keyIsSecret

/** O que falta para sair do modo demonstração (mostrado na faixa amarela do painel). */
export const setupProblem: string | null =
  urlOk && keyOk
    ? null
    : [
        !rawUrl && 'falta a linha VITE_SUPABASE_URL no .env',
        rawUrl && !urlOk && 'o VITE_SUPABASE_URL não parece um endereço do Supabase (https://xxxx.supabase.co)',
        !key && 'falta a linha VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) no .env',
        keyIsSecret && 'a chave colada é a secreta (sb_secret_); use a publishable',
        key && !keyIsSecret && !keyOk && 'a chave do Supabase parece incompleta',
      ]
        .filter(Boolean)
        .join('; ')

/** Com as variáveis do Supabase usa o banco real; sem elas, o modo demonstração. */
export const api: Backend = setupProblem === null ? new SupabaseBackend(url, key) : new LocalBackend(window.localStorage)

export const isDemo = api.mode === 'demo'
