export type AccountType = 'agency' | 'creator'

export interface Profile {
  id: string
  email: string
  accountType: AccountType
  displayName: string
  agencyId: string | null
  inviteCode: string | null
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
  | 'email'
  | 'site'

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export type ButtonShape = 'pill' | 'rounded' | 'square'
export type ButtonStyle = 'solid' | 'outline' | 'glass' | 'soft'

export interface ThemeOverrides {
  accent?: string
  buttonShape?: ButtonShape
  buttonStyle?: ButtonStyle
  fontId?: string
  bgImage?: string
  bgDim?: number // 0..0.9
}

export interface Page {
  id: string
  ownerId: string
  slug: string
  title: string
  bio: string
  avatarUrl: string | null
  creatorLabel: string
  themeId: string
  themeOverrides: ThemeOverrides
  socials: SocialLink[]
  isPublished: boolean
  ageGate: boolean
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

export interface PageWithOwner extends Page {
  ownerName: string
  ownerType: AccountType
  blocks: Block[]
}

export type Device = 'mobile' | 'tablet' | 'desktop' | 'other'

export interface TrackInput {
  pageId: string
  kind: 'view' | 'click'
  blockId?: string | null
  referrer?: string | null
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
  referrers: Count[]
  devices: Count[]
  countries: Count[]
}

export interface SignUpInput {
  email: string
  password: string
  displayName: string
  accountType: AccountType
}

export class AppError extends Error {
  code: string
  constructor(message: string, code = 'error') {
    super(message)
    this.code = code
  }
}

export const CREATOR_PAGE_LIMIT = 2
