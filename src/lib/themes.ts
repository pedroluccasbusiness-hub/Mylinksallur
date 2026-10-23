import { safeImageUrl } from './slug'
import type { AvatarShape, BgDirection, BgFilter, ButtonShadow, ButtonShape, ButtonStyle, HeaderLayout, Motion, Page, ThemeOverrides } from './types'

export interface FontOption {
  id: string
  name: string
  /** estilo, para agrupar no editor */
  kind: 'moderna' | 'elegante' | 'impacto' | 'manuscrita'
  body: string
  heading: string
  /** famílias no formato da API do Google Fonts (css2) */
  families: string[]
}

const G = {
  manrope: 'Manrope:wght@400;500;600;700;800',
  montserrat: 'Montserrat:wght@400;500;600;700;800',
  poppins: 'Poppins:wght@400;500;600;700',
  raleway: 'Raleway:wght@400;500;600;700',
}
const sans = (name: string) => `"${name}", system-ui, sans-serif`
const serif = (name: string) => `"${name}", Georgia, serif`
const script = (name: string) => `"${name}", cursive`

export const FONTS: FontOption[] = [
  // modernas
  { id: 'manrope', name: 'Manrope', kind: 'moderna', body: sans('Manrope'), heading: sans('Manrope'), families: [G.manrope] },
  { id: 'montserrat', name: 'Montserrat', kind: 'moderna', body: sans('Montserrat'), heading: sans('Montserrat'), families: [G.montserrat] },
  { id: 'poppins', name: 'Poppins', kind: 'moderna', body: sans('Poppins'), heading: sans('Poppins'), families: [G.poppins] },
  { id: 'raleway', name: 'Raleway', kind: 'moderna', body: sans('Raleway'), heading: sans('Raleway'), families: [G.raleway] },
  { id: 'outfit', name: 'Outfit', kind: 'moderna', body: sans('Outfit'), heading: sans('Outfit'), families: ['Outfit:wght@400;500;600;700'] },
  { id: 'grotesk', name: 'Space Grotesk', kind: 'moderna', body: sans('Space Grotesk'), heading: sans('Space Grotesk'), families: ['Space+Grotesk:wght@400;500;600;700'] },
  { id: 'quicksand', name: 'Quicksand', kind: 'moderna', body: sans('Quicksand'), heading: sans('Quicksand'), families: ['Quicksand:wght@400;500;600;700'] },
  { id: 'josefin', name: 'Josefin Sans', kind: 'moderna', body: sans('Josefin Sans'), heading: sans('Josefin Sans'), families: ['Josefin+Sans:wght@400;500;600;700'] },
  // elegantes
  { id: 'bodoni', name: 'Bodoni Moda', kind: 'elegante', body: sans('Manrope'), heading: serif('Bodoni Moda'), families: ['Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..800', G.manrope] },
  { id: 'playfair', name: 'Playfair Display', kind: 'elegante', body: sans('Montserrat'), heading: serif('Playfair Display'), families: ['Playfair+Display:wght@500;600;700', G.montserrat] },
  { id: 'cormorant', name: 'Cormorant', kind: 'elegante', body: serif('Cormorant Garamond'), heading: serif('Cormorant Garamond'), families: ['Cormorant+Garamond:wght@500;600;700'] },
  { id: 'dmserif', name: 'DM Serif', kind: 'elegante', body: sans('Manrope'), heading: serif('DM Serif Display'), families: ['DM+Serif+Display', G.manrope] },
  { id: 'lora', name: 'Lora', kind: 'elegante', body: serif('Lora'), heading: serif('Lora'), families: ['Lora:wght@400;500;600;700'] },
  { id: 'cinzel', name: 'Cinzel', kind: 'elegante', body: sans('Montserrat'), heading: serif('Cinzel'), families: ['Cinzel:wght@500;600;700', G.montserrat] },
  // impacto
  { id: 'bebas', name: 'Bebas Neue', kind: 'impacto', body: sans('Montserrat'), heading: sans('Bebas Neue'), families: ['Bebas+Neue', G.montserrat] },
  { id: 'oswald', name: 'Oswald', kind: 'impacto', body: sans('Oswald'), heading: sans('Oswald'), families: ['Oswald:wght@400;500;600'] },
  { id: 'abril', name: 'Abril Fatface', kind: 'impacto', body: sans('Poppins'), heading: serif('Abril Fatface'), families: ['Abril+Fatface', G.poppins] },
  // manuscritas
  { id: 'dancing', name: 'Dancing Script', kind: 'manuscrita', body: sans('Montserrat'), heading: script('Dancing Script'), families: ['Dancing+Script:wght@500;600;700', G.montserrat] },
  { id: 'greatvibes', name: 'Great Vibes', kind: 'manuscrita', body: sans('Raleway'), heading: script('Great Vibes'), families: ['Great+Vibes', G.raleway] },
  { id: 'pacifico', name: 'Pacifico', kind: 'manuscrita', body: sans('Poppins'), heading: script('Pacifico'), families: ['Pacifico', G.poppins] },
]

export const FONT_KINDS: { id: FontOption['kind']; label: string }[] = [
  { id: 'moderna', label: 'Modernas' },
  { id: 'elegante', label: 'Elegantes' },
  { id: 'impacto', label: 'De impacto' },
  { id: 'manuscrita', label: 'Manuscritas' },
]

const loadedFamilies = new Set<string>()

/** Carrega do Google Fonts só as famílias pedidas (cada página baixa apenas a fonte que usa). */
export function loadFonts(fonts: FontOption[]) {
  if (typeof document === 'undefined') return
  const missing = [...new Set(fonts.flatMap((f) => f.families))].filter((f) => !loadedFamilies.has(f))
  if (!missing.length) return
  missing.forEach((f) => loadedFamilies.add(f))
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${missing.map((f) => `family=${f}`).join('&')}&display=swap`
  document.head.appendChild(link)
}

export interface Theme {
  id: string
  name: string
  /** CSS background do fundo da página */
  background: string
  text: string
  muted: string
  /** cor da superfície dos botões (estilo solid/soft) */
  surface: string
  surfaceText: string
  accent: string
  buttonShape: ButtonShape
  buttonStyle: ButtonStyle
  fontId: string
  dark: boolean
  category: ThemeCategory
}

export type ThemeCategory = 'classico' | 'vibrante' | 'aconchegante' | 'ousado'

export const THEME_CATEGORIES: { id: ThemeCategory; label: string }[] = [
  { id: 'classico', label: 'Clássicos' },
  { id: 'vibrante', label: 'Vibrantes' },
  { id: 'aconchegante', label: 'Aconchegantes' },
  { id: 'ousado', label: 'Ousados' },
]

export const THEMES: Theme[] = [
  {
    id: 'noir-violeta',
    name: 'Noir violeta',
    background: 'radial-gradient(120% 70% at 50% 0%, #3a1663 0%, #170a26 45%, #07040c 100%)',
    text: '#F5EEFF',
    muted: '#BFA9D9',
    surface: '#1d1030',
    surfaceText: '#F5EEFF',
    accent: '#A970FF',
    buttonShape: 'rounded',
    buttonStyle: 'glass',
    fontId: 'bodoni',
    dark: true,
    category: 'ousado',
  },
  {
    id: 'vinho-creme',
    name: 'Vinho e creme',
    background: 'linear-gradient(180deg, #651d31 0%, #4a1323 100%)',
    text: '#F6EADB',
    muted: '#E3C9B4',
    surface: '#F6EADB',
    surfaceText: '#4a1323',
    accent: '#F6EADB',
    buttonShape: 'pill',
    buttonStyle: 'solid',
    fontId: 'cormorant',
    dark: true,
    category: 'aconchegante',
  },
  {
    id: 'creme-vinho',
    name: 'Creme e vinho',
    background: '#F3E7D7',
    text: '#4A1424',
    muted: '#7d5560',
    surface: '#6E1F33',
    surfaceText: '#F6EADB',
    accent: '#6E1F33',
    buttonShape: 'rounded',
    buttonStyle: 'solid',
    fontId: 'dmserif',
    dark: false,
    category: 'aconchegante',
  },
  {
    id: 'onix-dourado',
    name: 'Ônix dourado',
    background: 'linear-gradient(160deg, #18150f 0%, #0b0b0d 60%)',
    text: '#EFE6D2',
    muted: '#B9A887',
    surface: '#15130f',
    surfaceText: '#EFE6D2',
    accent: '#C9A46A',
    buttonShape: 'square',
    buttonStyle: 'outline',
    fontId: 'dmserif',
    dark: true,
    category: 'classico',
  },
  {
    id: 'neon-noite',
    name: 'Neon noite',
    background:
      'radial-gradient(60% 40% at 15% 10%, rgba(255,61,203,.35), transparent 70%), radial-gradient(60% 40% at 90% 85%, rgba(0,229,255,.25), transparent 70%), #07040f',
    text: '#FFFFFF',
    muted: '#C9B8E8',
    surface: '#120a22',
    surfaceText: '#FFFFFF',
    accent: '#FF3DCB',
    buttonShape: 'pill',
    buttonStyle: 'outline',
    fontId: 'grotesk',
    dark: true,
    category: 'vibrante',
  },
  {
    id: 'rose-nude',
    name: 'Rosé nude',
    background: 'linear-gradient(180deg, #F4E1DA 0%, #E6C3B8 100%)',
    text: '#3B2523',
    muted: '#7a5a55',
    surface: '#FFF7F3',
    surfaceText: '#3B2523',
    accent: '#B5675A',
    buttonShape: 'pill',
    buttonStyle: 'soft',
    fontId: 'cormorant',
    dark: false,
    category: 'aconchegante',
  },
  {
    id: 'aurora-vidro',
    name: 'Aurora vidro',
    background: 'linear-gradient(155deg, #3a1c71 0%, #a2456f 55%, #f0a07a 100%)',
    text: '#FFFFFF',
    muted: '#FBE3EE',
    surface: '#ffffff',
    surfaceText: '#3a1c71',
    accent: '#FFFFFF',
    buttonShape: 'rounded',
    buttonStyle: 'glass',
    fontId: 'outfit',
    dark: true,
    category: 'vibrante',
  },
  {
    id: 'marfim-minimal',
    name: 'Marfim minimal',
    background: '#FAF8F4',
    text: '#1B1A19',
    muted: '#6b6763',
    surface: '#1B1A19',
    surfaceText: '#FAF8F4',
    accent: '#1B1A19',
    buttonShape: 'square',
    buttonStyle: 'outline',
    fontId: 'grotesk',
    dark: false,
    category: 'classico',
  },
  {
    id: 'preto-branco',
    name: 'Preto e branco',
    background: '#0E0E0E',
    text: '#FFFFFF',
    muted: '#B5B5B5',
    surface: '#FFFFFF',
    surfaceText: '#0E0E0E',
    accent: '#FFFFFF',
    buttonShape: 'rounded',
    buttonStyle: 'solid',
    fontId: 'grotesk',
    dark: true,
    category: 'classico',
  },
  {
    id: 'oceano',
    name: 'Oceano',
    background: 'linear-gradient(170deg, #0b3a4a 0%, #0f6b78 55%, #3fb8af 100%)',
    text: '#F2FFFD',
    muted: '#BDE7E2',
    surface: '#F2FFFD',
    surfaceText: '#0b3a4a',
    accent: '#7FF0E3',
    buttonShape: 'pill',
    buttonStyle: 'glass',
    fontId: 'outfit',
    dark: true,
    category: 'vibrante',
  },
  {
    id: 'cafe-caramelo',
    name: 'Café e caramelo',
    background: 'linear-gradient(180deg, #5a4436 0%, #3b2c23 100%)',
    text: '#F3E6D8',
    muted: '#D2BBA6',
    surface: '#D8C2AE',
    surfaceText: '#3b2c23',
    accent: '#C99B72',
    buttonShape: 'rounded',
    buttonStyle: 'solid',
    fontId: 'dmserif',
    dark: true,
    category: 'aconchegante',
  },
  {
    id: 'cereja',
    name: 'Cereja',
    background: 'radial-gradient(110% 70% at 50% 0%, #b3122e 0%, #5c0716 55%, #22030a 100%)',
    text: '#FFF1F3',
    muted: '#F3B7C2',
    surface: '#22030a',
    surfaceText: '#FFF1F3',
    accent: '#FF4D6D',
    buttonShape: 'pill',
    buttonStyle: 'outline',
    fontId: 'bodoni',
    dark: true,
    category: 'ousado',
  },
]

export const DEFAULT_THEME_ID = THEMES[0].id

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export interface ResolvedTheme extends Theme {
  font: FontOption
  /** CSS final do fundo (tema, cor, degradê ou imagem com filtro) */
  pageBackground: string
  headerLayout: HeaderLayout
  avatarShape: AvatarShape
  avatarX: number
  avatarY: number
  avatarZoom: number
  bgFilter: BgFilter
  bgDim: number
  bgColor: string
  bgColor2: string
  bgDirection: BgDirection
  photoFade: number
  photoHeight: number
  buttonBg?: string
  buttonText?: string
  buttonShadow: ButtonShadow
  motion: Motion
}

/** Chaves que pertencem à página (foto e cabeçalho) e sobrevivem à troca de tema. */
export const KEEP_ON_THEME_CHANGE = ['headerLayout', 'avatarShape', 'avatarX', 'avatarY', 'avatarZoom', 'photoFade', 'photoHeight', 'motion'] as const

/** Cores usadas quando o fundo é cor/degradê e a pessoa ainda não escolheu (assim o degradê aparece na hora). */
export const BG_DEFAULTS = { solid: '#1E1222', top: '#5B1A3A', bottom: '#0B0710' }

const GRADIENT_CSS: Record<BgDirection, (a: string, b: string) => string> = {
  vertical: (a, b) => `linear-gradient(180deg, ${a} 0%, ${b} 100%)`,
  diagonal: (a, b) => `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
  horizontal: (a, b) => `linear-gradient(90deg, ${a} 0%, ${b} 100%)`,
  radial: (a, b) => `radial-gradient(120% 80% at 50% 0%, ${a} 0%, ${b} 100%)`,
}

export function resolveTheme(page: Pick<Page, 'themeId' | 'themeOverrides'>): ResolvedTheme {
  const base = getTheme(page.themeId)
  const o: ThemeOverrides = page.themeOverrides ?? {}
  const fontId = o.fontId ?? base.fontId
  const bgType = o.bgType ?? (o.bgImage ? 'image' : 'theme')
  const bgFilter: BgFilter = o.bgFilter ?? (bgType === 'image' ? 'dark' : 'none')
  const bgDim = clamp(o.bgDim ?? 0.45, 0, 0.9)

  let bg = base.background
  const bgColor = isHex(o.bgColor) ? o.bgColor : bgType === 'gradient' ? BG_DEFAULTS.top : BG_DEFAULTS.solid
  const bgColor2 = isHex(o.bgColor2) ? o.bgColor2 : BG_DEFAULTS.bottom
  const bgDirection: BgDirection = o.bgDirection && o.bgDirection in GRADIENT_CSS ? o.bgDirection : 'vertical'
  if (bgType === 'solid') bg = bgColor
  if (bgType === 'gradient') bg = GRADIENT_CSS[bgDirection](bgColor, bgColor2)
  const bgImg = bgType === 'image' ? safeImageUrl(o.bgImage) : null
  // aspas, barra invertida e quebras de linha são codificadas para não escapar do url("...")
  if (bgImg) bg = `url("${bgImg.replace(/["\\\n\r]/g, encodeURIComponent)}") center / cover no-repeat`
  const tint = bgFilter === 'dark' ? `rgba(0,0,0,${bgDim})` : bgFilter === 'light' ? `rgba(255,255,255,${bgDim})` : null
  const pageBackground = tint ? `linear-gradient(${tint}, ${tint}), ${bg}` : bg

  const text = isHex(o.textColor) ? o.textColor : base.text
  return {
    ...base,
    text,
    muted: isHex(o.textColor) ? `${o.textColor}bf` : base.muted,
    accent: isHex(o.accent) ? o.accent : base.accent,
    buttonShape: o.buttonShape ?? base.buttonShape,
    buttonStyle: o.buttonStyle ?? base.buttonStyle,
    fontId,
    font: FONTS.find((f) => f.id === fontId) ?? FONTS[0],
    pageBackground,
    headerLayout: o.headerLayout ?? 'minimal',
    avatarShape: o.avatarShape ?? 'arch',
    avatarX: clamp(o.avatarX ?? 50, 0, 100),
    avatarY: clamp(o.avatarY ?? 50, 0, 100),
    avatarZoom: clamp(o.avatarZoom ?? 1, 1, 3),
    bgFilter,
    bgDim,
    bgColor,
    bgColor2,
    bgDirection,
    photoFade: clamp(o.photoFade ?? 45, 10, 90),
    photoHeight: clamp(o.photoHeight ?? 62, 40, 80),
    buttonBg: isHex(o.buttonBg) ? o.buttonBg : undefined,
    buttonText: isHex(o.buttonText) ? o.buttonText : undefined,
    buttonShadow: o.buttonShadow ?? 'none',
    // páginas sem escolha ficam no "Vivo": a página parada parecia sem vida
    motion: o.motion === 'none' || o.motion === 'subtle' ? o.motion : 'lively',
  }
}

/**
 * Máscara que faz a foto sumir no fundo. A transição usa vários pontos com curva suave
 * (em vez de uma rampa reta), para não formar uma "linha" marcada embaixo da foto.
 */
export function photoFadeMask(fade: number): string {
  const start = 100 - fade
  const at = (f: number) => `${(start + fade * f).toFixed(1)}%`
  return `linear-gradient(to bottom, #000 ${start}%, rgba(0,0,0,.92) ${at(0.15)}, rgba(0,0,0,.75) ${at(0.32)}, rgba(0,0,0,.5) ${at(0.5)}, rgba(0,0,0,.27) ${at(0.68)}, rgba(0,0,0,.1) ${at(0.85)}, transparent 100%)`
}

/** Estilo de corte da foto: ponto de foco + zoom (usado no editor e na página). */
export function avatarImgStyle(t: Pick<ResolvedTheme, 'avatarX' | 'avatarY' | 'avatarZoom'>) {
  return {
    objectFit: 'cover' as const,
    objectPosition: `${t.avatarX}% ${t.avatarY}%`,
    transform: t.avatarZoom > 1 ? `scale(${t.avatarZoom})` : undefined,
    transformOrigin: `${t.avatarX}% ${t.avatarY}%`,
  }
}

export function isHex(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

export const SHAPE_RADIUS: Record<ButtonShape, string> = {
  pill: '999px',
  rounded: '14px',
  square: '2px',
}
