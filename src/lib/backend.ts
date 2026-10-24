import type { Block, Model, Page, PageWithOwner, PaymentInfo, Profile, SignUpInput, Stats, TrackInput } from './types'

export type NewPage = Partial<Omit<Page, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>> & { slug: string }

export interface Backend {
  mode: 'supabase' | 'demo'

  currentProfile(): Promise<Profile | null>
  onAuthChange(cb: () => void): () => void
  /** Retorna o perfil, ou null quando o Supabase pede confirmação por e-mail. */
  signUp(input: SignUpInput): Promise<Profile | null>
  signIn(email: string, password: string): Promise<Profile>
  signOut(): Promise<void>
  updateProfile(patch: { displayName: string }): Promise<void>

  /** Páginas próprias + das criadoras vinculadas (para agência). */
  listManagedPages(): Promise<PageWithOwner[]>
  getPage(id: string): Promise<{ page: Page; blocks: Block[] }>
  createPage(input: NewPage): Promise<Page>
  updatePage(id: string, patch: Partial<Page>): Promise<Page>
  deletePage(id: string): Promise<void>
  duplicatePage(id: string, slug: string): Promise<Page>
  saveBlocks(pageId: string, blocks: Block[]): Promise<void>
  slugAvailable(slug: string, pageId?: string): Promise<boolean>
  uploadImage(file: Blob): Promise<string>

  getPublicPage(slug: string): Promise<{ page: Page; blocks: Block[] } | null>
  track(ev: TrackInput): Promise<void>
  /** pageIds nulo = todas as páginas gerenciadas */
  getStats(from: Date, to: Date, pageIds?: string[] | null): Promise<Stats>

  /** elenco da agência (modelos sem conta própria) */
  listModels(): Promise<Model[]>
  createModel(input: { name: string; instagram?: string }): Promise<Model>
  updateModel(id: string, patch: { name?: string; instagram?: string }): Promise<void>
  deleteModel(id: string): Promise<void>

  listCreators(): Promise<(Profile & { pageCount: number })[]>
  getAgency(): Promise<Profile | null>
  joinAgency(code: string): Promise<void>
  leaveAgency(): Promise<void>
  removeCreator(creatorId: string): Promise<void>
  rotateInviteCode(): Promise<string>

  /** registra o plano que a conta quer assinar (a ativação vem do pagamento) */
  requestPlan(plan: string): Promise<void>
  /** gera (ou reaproveita) o Pix da mensalidade do plano */
  startPayment(plan: string, payer: { name: string; doc: string }): Promise<PaymentInfo>
  /** confere se o Pix já foi pago; quando pago, o plano já vem ativado */
  checkPayment(paymentId: string): Promise<PaymentInfo>
}

/** Blocos visíveis ao público agora (ativos e dentro do agendamento). */
export function visibleBlocks(blocks: Block[], now = new Date()): Block[] {
  return blocks
    .filter(
      (b) =>
        b.isActive &&
        (!b.startsAt || new Date(b.startsAt) <= now) &&
        (!b.endsAt || new Date(b.endsAt) > now),
    )
    .sort((a, b) => a.position - b.position)
}

/** Reduz uma imagem para no máx. `max` px e devolve um Blob webp/jpeg. */
export async function shrinkImage(file: Blob, max = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível ler a imagem'))), 'image/webp', 0.86),
  )
}
