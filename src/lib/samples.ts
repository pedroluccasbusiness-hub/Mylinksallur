// Páginas fictícias usadas só para ilustrar a landing e os modelos de tema.
import { newBlock } from './blocks'
import { initialsAvatar } from './demoSeed'
import type { Block, Page } from './types'

export function samplePage(themeId: string, title: string, bio: string, colors: [string, string]): { page: Page; blocks: Block[] } {
  const id = `sample-${themeId}`
  const ts = new Date(0).toISOString()
  const page: Page = {
    id,
    ownerId: 'sample',
    slug: title.toLowerCase().replace(/\s+/g, '.'),
    title,
    bio,
    avatarUrl: initialsAvatar(title, colors[0], colors[1]),
    creatorLabel: title,
    themeId,
    themeOverrides: {},
    socials: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'tiktok', url: 'https://tiktok.com' },
      { platform: 'telegram', url: 'https://t.me' },
    ],
    isPublished: true,
    ageGate: false,
    seoTitle: '',
    seoDescription: '',
    createdAt: ts,
    updatedAt: ts,
  }
  const blocks = [
    newBlock(id, 'link', { title: 'Conteúdo exclusivo', subtitle: 'Assinatura mensal' }),
    newBlock(id, 'link', { title: 'Grupo VIP' }),
    newBlock(id, 'link', { title: 'Fale comigo' }),
    newBlock(id, 'link', { title: 'Instagram' }),
  ]
  blocks.forEach((b, i) => (b.position = i))
  return { page, blocks }
}
