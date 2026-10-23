// Páginas fictícias usadas só para ilustrar a landing e as telas de acesso (nenhuma pessoa real).
import { newBlock } from './blocks'
import { initialsAvatar } from './demoSeed'
import type { Block, Page, ThemeOverrides } from './types'

export function samplePage(
  themeId: string,
  title: string,
  bio: string,
  colors: [string, string],
  overrides: ThemeOverrides = {},
): { page: Page; blocks: Block[] } {
  const id = `sample-${themeId}-${title}`
  const ts = new Date(0).toISOString()
  const handle = title.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '.')
  const page: Page = {
    id,
    ownerId: 'sample',
    slug: handle,
    title,
    bio,
    avatarUrl: initialsAvatar(title, colors[0], colors[1]),
    handle,
    modelId: null,
    themeId,
    themeOverrides: overrides,
    socials: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'tiktok', url: 'https://tiktok.com' },
      { platform: 'telegram', url: 'https://t.me' },
    ],
    isPublished: true,
    showFooter: false,
    seoTitle: '',
    seoDescription: '',
    createdAt: ts,
    updatedAt: ts,
  }
  // endereços reais das plataformas só para o logo automático aparecer; na prévia nada é clicável
  const blocks = [
    newBlock(id, 'link', { title: 'Meu Privacy', subtitle: 'Conteúdo completo', url: 'https://privacy.com.br' }),
    newBlock(id, 'link', { title: 'Fatal Fans', url: 'https://fatalfans.com' }),
    newBlock(id, 'link', { title: 'Grupo VIP', url: 'https://t.me/exemplo' }),
    newBlock(id, 'link', { title: 'Fale comigo', url: 'https://wa.me/550000000000' }),
  ]
  blocks[0].highlight = 'shine'
  blocks[1].sensitive = true
  blocks.forEach((b, i) => (b.position = i))
  return { page, blocks }
}

/** Galeria de exemplos da landing: temas e cabeçalhos diferentes. */
export const EXAMPLES = [
  samplePage('noir-violeta', 'Mel Noir', 'Ensaios novos toda semana.', ['#5b2a9e', '#1a0b2b'], { headerLayout: 'shape', avatarShape: 'arch' }),
  samplePage('vinho-creme', 'Valentina', 'Bastidores e conteúdo exclusivo.', ['#8E2C4A', '#E7C9A1']),
  samplePage('onix-dourado', 'Bia Dourada', 'Assinatura com desconto hoje.', ['#C9A46A', '#2b2418'], { headerLayout: 'banner' }),
  samplePage('neon-noite', 'Nina Neon', 'Lives às quintas, 22h.', ['#FF3DCB', '#00E5FF'], { fontId: 'bebas' }),
  samplePage('rose-nude', 'Luna', 'Fotos, vídeos e bastidores.', ['#B5675A', '#F4E1DA'], { headerLayout: 'shape', avatarShape: 'circle', fontId: 'greatvibes' }),
  samplePage('cereja', 'Sofia Rubi', 'Respondo todo mundo no VIP.', ['#b3122e', '#22030a'], { headerLayout: 'shape', avatarShape: 'blob', fontId: 'playfair' }),
  samplePage('cafe-caramelo', 'Ana Caramelo', 'Novidades toda segunda.', ['#C99B72', '#3b2c23'], { fontId: 'montserrat' }),
  samplePage('aurora-vidro', 'Lara Sol', 'Conteúdo leve e divertido.', ['#a2456f', '#f0a07a'], { headerLayout: 'banner', fontId: 'poppins' }),
]
