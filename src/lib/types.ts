export type AccountType = 'agency' | 'creator'

export interface Profile {
  id: string
  email: string
  accountType: AccountType
  displayName: string
  agencyId: string | null
  inviteCode: string | null
  /** plano atual (null = ainda sem plano) e situação da mensalidade */
  plan: string | null
  planStatus: 'active' | 'pending' | 'overdue' | 'canceled'
  /** plano pedido e ainda não pago */
  requestedPlan: string | null
}

export type SocialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'youtube'
  | 'telegram'
  | 'whatsapp'
  | 'onlyfans'
  | 'privacy'
  | 'fansly'
  | 'fatalfans'
  | 'email'
  | 'site'

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export type ButtonShape = 'pill' | 'rounded' | 'square'
export type ButtonStyle = 'solid' | 'outline' | 'glass' | 'soft'

export type HeaderLayout = 'minimal' | 'banner' | 'portrait' | 'shape'
export type AvatarShape = 'arch' | 'square' | 'circle' | 'blob'
export type BgType = 'theme' | 'solid' | 'gradient' | 'image'
export type BgFilter = 'dark' | 'light' | 'none'
export type BgDirection = 'vertical' | 'diagonal' | 'horizontal' | 'radial'
export type ButtonShadow = 'none' | 'soft' | 'hard'

export interface ThemeOverrides {
  accent?: string
  buttonShape?: ButtonShape
  buttonStyle?: ButtonStyle
  fontId?: string
  // cabeçalho e foto (não mudam ao trocar de tema)
  headerLayout?: HeaderLayout
  avatarShape?: AvatarShape
  /** ponto de foco da foto, em % (0 = esquerda/topo, 100 = direita/base) */
  avatarX?: number
  avatarY?: number
  /** zoom da foto, 1 a 3 */
  avatarZoom?: number
  /** Retrato/Faixa: tamanho da transição da foto para o fundo, 10 (curta) a 90 (bem suave) */
  photoFade?: number
  /** Retrato: altura da foto em % da altura da tela, 40 a 80 */
  photoHeight?: number
  // fundo
  bgType?: BgType
  bgColor?: string
  bgColor2?: string
  bgDirection?: BgDirection
  bgImage?: string
  bgFilter?: BgFilter
  bgDim?: number // intensidade do filtro, 0..0.9
  // cores próprias
  textColor?: string
  buttonBg?: string
  buttonText?: string
  buttonShadow?: ButtonShadow
}

export interface Page {
  id: string
  ownerId: string
  slug: string
  title: string
  bio: string
  avatarUrl: string | null
  /** @ do Instagram mostrado na página */
  handle: string
  /** modelo do elenco (contas de agência) */
  modelId: string | null
  themeId: string
  themeOverrides: ThemeOverrides
  socials: SocialLink[]
  isPublished: boolean
  showFooter: boolean
  seoTitle: string
  seoDescription: string
  createdAt: string
  updatedAt: string
}

export type BlockType = 'link' | 'header' | 'text' | 'image' | 'video' | 'embed' | 'divider'
export type Highlight = 'none' | 'pulse' | 'shine' | 'glow'

export interface BlockData {
  title?: string
  url?: string
  subtitle?: string
  thumb?: string
  /** ícone ao lado do nome: 'auto' (pelo endereço), 'none' ou uma plataforma */
  icon?: SocialPlatform | 'auto' | 'none'
  text?: string
  alt?: string
  href?: string
  height?: number
}

export interface Block {
  id: string
  pageId: string
  type: BlockType
  position: number
  data: BlockData
  isActive: boolean
  highlight: Highlight
  sensitive: boolean
  startsAt: string | null
  endsAt: string | null
}

export interface Model {
  id: string
  ownerId: string
  name: string
  instagram: string
  createdAt: string
}

export interface PageWithOwner extends Page {
  ownerName: string
  ownerType: AccountType
  /** nome da modelo: do elenco, ou o nome da criadora quando a página é da conta dela */
  modelName: string
  blocks: Block[]
}

export type Device = 'mobile' | 'tablet' | 'desktop' | 'other'

export interface TrackInput {
  pageId: string
  kind: 'view' | 'click'
  blockId?: string | null
  source?: string | null
  tag?: string | null
  device?: Device
  country?: string | null
  visitor?: string | null
}

export interface Count {
  key: string
  count: number
}

export interface Stats {
  totals: { views: number; clicks: number; uniques: number; ctr: number }
  series: { day: string; views: number; clicks: number }[]
  pages: { page_id: string; views: number; clicks: number }[]
  blocks: { block_id: string; page_id: string; title?: string; clicks: number }[]
  tags: { key: string; views: number; clicks: number }[]
  sources: Count[]
  devices: Count[]
  countries: Count[]
}

export interface SignUpInput {
  email: string
  password: string
  displayName: string
  accountType: AccountType
  /** plano escolhido no cadastro (agência: obrigatório; modelo: opcional, começa no grátis) */
  plan?: string
}

export class AppError extends Error {
  code: string
  constructor(message: string, code = 'error') {
    super(message)
    this.code = code
  }
}

