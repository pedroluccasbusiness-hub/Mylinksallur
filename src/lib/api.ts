import type { Backend } from './backend'
import { LocalBackend } from './localBackend'
import { SupabaseBackend } from './supabaseBackend'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// o painel novo do Supabase chama a chave pública de "publishable"; aceitamos os dois nomes
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined

/** Com as variáveis do Supabase usa o banco real; sem elas, o modo demonstração. */
export const api: Backend =
  url && key ? new SupabaseBackend(url, key) : new LocalBackend(window.localStorage)

export const isDemo = api.mode === 'demo'
