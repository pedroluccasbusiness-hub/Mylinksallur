import type { Block, BlockType } from './types'

export const BLOCK_LABELS: Record<BlockType, string> = {
  link: 'Link',
  header: 'Título de seção',
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  embed: 'Incorporar',
  divider: 'Divisor',
}

export function newBlock(pageId: string, type: BlockType, data: Block['data'] = {}): Block {
  const defaults: Record<BlockType, Block['data']> = {
    link: { title: 'Novo link', url: '' },
    header: { text: 'Nova seção' },
    text: { text: 'Escreva algo sobre você.' },
    image: { url: '', alt: '' },
    video: { url: '' },
    embed: { url: '', height: 152 },
    divider: {},
  }
  return {
    id: crypto.randomUUID(),
    pageId,
    type,
    position: 0,
    data: { ...defaults[type], ...data },
    isActive: true,
    highlight: 'none',
    sensitive: false,
    startsAt: null,
    endsAt: null,
  }
}

/** YouTube/Vimeo viram embed; outros links de vídeo tocam direto. */
export function videoEmbed(url: string): { kind: 'iframe' | 'video'; src: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` }
    if (host === 'youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.split('/').filter(Boolean).pop()
      if (id) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` }
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (id) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` }
    }
    if (u.protocol === 'https:' && /\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: 'video', src: u.toString() }
  } catch {
    /* url inválida */
  }
  return null
}

/** Spotify/SoundCloud/etc.: transforma link comum em endereço de embed quando possível. */
export function embedSrc(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    if (u.hostname === 'open.spotify.com' && !u.pathname.startsWith('/embed'))
      return `https://open.spotify.com/embed${u.pathname}`
    return u.toString()
  } catch {
    return null
  }
}
