// Mesmas regras do banco (constraints slug_format e slug_not_reserved)
export const RESERVED_SLUGS = new Set([
  'app', 'api', 'admin', 'entrar', 'cadastro', 'login', 'signup', 'sair', 'auth',
  'assets', 'static', 'public', 'termos', 'privacidade', 'ajuda', 'suporte', 'r',
])

const SLUG_RE = /^[a-z0-9](?:[a-z0-9._-]{1,38}[a-z0-9])$/

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 40)
}

/** Retorna a mensagem de erro, ou null se o endereço é válido. */
export function slugError(slug: string): string | null {
  if (slug.length < 3) return 'Use pelo menos 3 caracteres.'
  if (slug.length > 40) return 'Use no máximo 40 caracteres.'
  if (!SLUG_RE.test(slug)) return 'Use só letras minúsculas, números, ponto, hífen ou sublinhado, começando e terminando com letra ou número.'
  if (RESERVED_SLUGS.has(slug)) return 'Esse endereço é reservado pelo sistema.'
  return null
}

/** Imagens: só https, blob (prévia local) ou data:image (modo demonstração). Nada de javascript: ou http. */
export function safeImageUrl(raw: string | undefined | null): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/i.test(v)) return v
  if (/^blob:/i.test(v)) return v
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Garante http(s)/mailto/tel e bloqueia esquemas perigosos (javascript:, data:...). */
export function safeUrl(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  if (/^(mailto:|tel:)/i.test(value)) return value
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.toString()
  } catch {
    return null
  }
}
