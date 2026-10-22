import type { ButtonShape, ButtonStyle, Page, ThemeOverrides } from './types'

export interface FontOption {
  id: string
  name: string
  body: string
  heading: string
}

export const FONTS: FontOption[] = [
  { id: 'manrope', name: 'Manrope', body: 'Manrope, system-ui, sans-serif', heading: 'Manrope, system-ui, sans-serif' },
  { id: 'bodoni', name: 'Bodoni Moda', body: 'Manrope, system-ui, sans-serif', heading: '"Bodoni Moda", Didot, Georgia, serif' },
  { id: 'cormorant', name: 'Cormorant', body: '"Cormorant Garamond", Georgia, serif', heading: '"Cormorant Garamond", Georgia, serif' },
  { id: 'dmserif', name: 'DM Serif', body: 'Manrope, system-ui, sans-serif', heading: '"DM Serif Display", Georgia, serif' },
  { id: 'grotesk', name: 'Space Grotesk', body: '"Space Grotesk", system-ui, sans-serif', heading: '"Space Grotesk", system-ui, sans-serif' },
  { id: 'outfit', name: 'Outfit', body: 'Outfit, system-ui, sans-serif', heading: 'Outfit, system-ui, sans-serif' },
]

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
}

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
  },
]

export const DEFAULT_THEME_ID = THEMES[0].id

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export interface ResolvedTheme extends Theme {
  font: FontOption
  bgImage?: string
  bgDim: number
}

export function resolveTheme(page: Pick<Page, 'themeId' | 'themeOverrides'>): ResolvedTheme {
  const base = getTheme(page.themeId)
  const o: ThemeOverrides = page.themeOverrides ?? {}
  const fontId = o.fontId ?? base.fontId
  return {
    ...base,
    accent: isHex(o.accent) ? o.accent! : base.accent,
    buttonShape: o.buttonShape ?? base.buttonShape,
    buttonStyle: o.buttonStyle ?? base.buttonStyle,
    fontId,
    font: FONTS.find((f) => f.id === fontId) ?? FONTS[0],
    bgImage: o.bgImage || undefined,
    bgDim: clamp(o.bgDim ?? 0.45, 0, 0.9),
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
