import type { Device } from './types'

export function detectDevice(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): Device {
  if (!ua) return 'other'
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile'
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop'
  return 'other'
}

/** Só o domínio de origem (ex.: instagram.com). Nada de caminho ou parâmetros. */
export function referrerHost(ref = typeof document !== 'undefined' ? document.referrer : '', self?: string): string | null {
  const utm = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('utm_source') : null
  if (utm) return utm.toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 60) || null
  if (!ref) return null
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '').replace(/^(l|lm|m)\./, '')
    const own = self ?? (typeof location !== 'undefined' ? location.hostname : '')
    if (host === own) return null
    return host
  } catch {
    return null
  }
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
