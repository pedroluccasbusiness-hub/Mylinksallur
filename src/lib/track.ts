import type { Device } from './types'

export function detectDevice(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): Device {
  if (!ua) return 'other'
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile'
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop'
  return 'other'
}

export type Source = 'instagram' | 'facebook' | 'tiktok' | 'x' | 'youtube' | 'whatsapp' | 'telegram' | 'google' | 'outro' | 'direto'

export const SOURCE_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  google: 'Google',
  outro: 'Outros sites',
  direto: 'Direto ou desconhecido',
}

const BY_NAME: [RegExp, Source][] = [
  [/^(ig|insta|instagram)/, 'instagram'],
  [/^(fb|facebook)/, 'facebook'],
  [/^(tt|tiktok)/, 'tiktok'],
  [/^(x|twitter|tw)$/, 'x'],
  [/^(yt|youtube)/, 'youtube'],
  [/^(wa|whats)/, 'whatsapp'],
  [/^(tg|telegram)/, 'telegram'],
  [/^google/, 'google'],
]

const BY_HOST: [RegExp, Source][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'telegram'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
]

/**
 * De onde veio a visita. Ordem: navegador interno do app (o Instagram quase nunca manda referrer),
 * utm_source, e por fim o domínio do referrer.
 */
export function detectSource(
  ua = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  search = typeof location !== 'undefined' ? location.search : '',
  ref = typeof document !== 'undefined' ? document.referrer : '',
  selfHost = typeof location !== 'undefined' ? location.hostname : '',
): Source {
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'tiktok'

  const utm = new URLSearchParams(search).get('utm_source')?.toLowerCase()
  if (utm) return BY_NAME.find(([re]) => re.test(utm))?.[1] ?? 'outro'

  if (!ref) return 'direto'
  try {
    const host = new URL(ref).hostname.toLowerCase()
    if (host === selfHost) return 'direto'
    return BY_HOST.find(([re]) => re.test(host))?.[1] ?? 'outro'
  } catch {
    return 'direto'
  }
}

/** Etiqueta do link divulgado (?src=ig-perfil1), para comparar perfis que apontam para a mesma árvore. */
export function detectTag(search = typeof location !== 'undefined' ? location.search : ''): string | null {
  const q = new URLSearchParams(search)
  const raw = q.get('src') ?? q.get('utm_campaign') ?? ''
  const tag = raw.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40)
  return tag || null
}

/** País aproximado pela região do idioma do navegador; o servidor usa o cabeçalho cf-ipcountry quando existir. */
export function countryHint(lang = typeof navigator !== 'undefined' ? navigator.language : ''): string | null {
  const m = /-([A-Za-z]{2})$/.exec(lang)
  return m ? m[1].toUpperCase() : null
}

/** Identificador aleatório do navegador (não pessoal), usado só quando o servidor não vê o IP. */
export function visitorId(): string {
  try {
    const k = 'lh-visitor'
    let v = localStorage.getItem(k)
    if (!v) {
      v = crypto.randomUUID()
      localStorage.setItem(k, v)
    }
    return v
  } catch {
    return 'anon'
  }
}
