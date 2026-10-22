import { expect, test, type Page } from '@playwright/test'

const PASS = 'senha-teste-123'

async function signUp(page: Page, type: 'agência' | 'criadora', name: string, email: string) {
  await page.goto('/cadastro')
  await page.getByRole('button', { name: type === 'agência' ? /Agência/ : /Criadora/ }).first().click()
  await page.getByLabel(type === 'agência' ? 'Nome da agência' : 'Seu nome artístico').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(PASS)
  await page.getByRole('button', { name: `Criar conta de ${type}` }).click()
  await expect(page).toHaveURL(/\/app\/paginas$/)
}

async function signOut(page: Page) {
  await page.goto('/app/conta')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
}

async function signIn(page: Page, email: string) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(PASS)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/app$/)
}

async function createPage(page: Page, title: string, slug: string, theme?: string, newModel?: string) {
  await page.goto('/app/paginas')
  await page.getByRole('button', { name: /Nova página|Criar primeira página/ }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nova página' })
  if (newModel) {
    await dialog.getByLabel('Modelo do elenco').selectOption('new')
    await dialog.getByLabel('Nome da nova modelo').fill(newModel)
  }
  await dialog.getByLabel('Nome na página').fill(title)
  await dialog.getByLabel('@ do Instagram').fill(slug.replace(/-/g, '.'))
  await dialog.getByLabel('Endereço').fill(slug)
  if (theme) await dialog.getByRole('button', { name: theme }).click()
  await dialog.getByRole('button', { name: 'Criar página' }).click()
  await expect(page).toHaveURL(/\/app\/paginas\/[0-9a-f-]{36}$/)
}

test.beforeEach(async ({ page }) => {
  // destino externo dos links de teste
  await page.route('https://destino.exemplo.com/**', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<h1>Destino externo</h1>' }),
  )
})

test('agência cria página, edita, troca tema, publica e vê o clique nas métricas', async ({ page }) => {
  await signUp(page, 'agência', 'Agência Teste', 'agencia@teste.dev')
  await expect(page.getByText('sem limite na conta de agência')).toBeVisible()

  await createPage(page, 'Ana Teste', 'ana-teste', 'Vinho e creme', 'Ana')
  // edita o primeiro link do modelo
  await page.getByRole('button', { name: 'Abrir opções do bloco' }).first().click()
  await page.getByLabel('Endereço (URL)').fill('https://destino.exemplo.com/assinatura')
  // adiciona um texto
  await page.getByRole('button', { name: 'Texto', exact: true }).click()
  await page.getByLabel('Texto', { exact: true }).fill('Bem-vindo à minha página')
  // troca o tema
  await page.getByRole('tab', { name: 'Design' }).click()
  await page.getByRole('button', { name: 'Clássicos' }).click()
  await page.getByRole('button', { name: 'Ônix dourado' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Alterações salvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvo' })).toBeDisabled()

  // página pública
  await page.goto('/ana-teste')
  await expect(page.getByRole('heading', { name: 'Ana Teste' })).toBeVisible()
  await expect(page.getByText('@ana.teste')).toBeVisible()
  // o botão é um link de verdade para o destino (sem redirecionamento escondido)
  await expect(page.getByRole('link', { name: /Conteúdo exclusivo/ })).toHaveAttribute('href', 'https://destino.exemplo.com/assinatura')
  await expect(page.getByText('Bem-vindo à minha página')).toBeVisible()
  await page.getByRole('link', { name: /Conteúdo exclusivo/ }).click()
  await expect(page).toHaveURL('https://destino.exemplo.com/assinatura')

  // métricas
  await page.goto('/app/paginas')
  await page.getByRole('link', { name: 'Métricas' }).first().click()
  const kpis = page.locator('dl')
  await expect(kpis.getByText('Visualizações').locator('..')).toContainText('1')
  await expect(kpis.getByText('Cliques').locator('..')).toContainText('1')
  await expect(kpis.getByText('Taxa de clique (CTR)').locator('..')).toContainText('100%')
  await expect(page.getByRole('cell', { name: /Conteúdo exclusivo/ })).toBeVisible()
})

test('criadora só cria 2 páginas e a agência passa a gerenciar depois do código', async ({ page }) => {
  await signUp(page, 'agência', 'Agência Código', 'ag2@teste.dev')
  await page.goto('/app/equipe')
  const code = (await page.getByTestId('invite-code').textContent())!.trim()
  expect(code).toMatch(/^[A-F0-9]{10}$/)
  await signOut(page)

  await signUp(page, 'criadora', 'Bia Teste', 'bia@teste.dev')
  await expect(page.getByText('0 de 2 páginas usadas')).toBeVisible()
  await createPage(page, 'Bia Um', 'bia-um')
  await createPage(page, 'Bia Dois', 'bia-dois')
  await page.goto('/app/paginas')
  await expect(page.getByText('2 de 2 páginas usadas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nova página' })).toBeDisabled()
  await expect(page.getByText(/chegou ao limite de 2 páginas/)).toBeVisible()

  // vincula com o código
  await page.goto('/app/equipe')
  await page.getByLabel('Código da agência').fill(code.toLowerCase())
  await page.getByRole('button', { name: 'Vincular à agência' }).click()
  await expect(page.getByText('Vinculada a')).toBeVisible()
  await expect(page.getByText('Agência Código')).toBeVisible()
  await signOut(page)

  await signIn(page, 'ag2@teste.dev')
  await page.goto('/app/equipe')
  await expect(page.getByText('Bia Teste')).toBeVisible()
  await expect(page.getByText('2 de 2 páginas na conta dela')).toBeVisible()
  await page.goto('/app/paginas')
  await expect(page.getByText('/bia-um')).toBeVisible()
  await expect(page.getByText('/bia-dois')).toBeVisible()
})

test('link +18 pede confirmação antes de abrir e a página não tem pop-up', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByRole('button', { name: 'Agência demo' }).click()
  await expect(page).toHaveURL(/\/app$/)

  await page.goto('/valentina')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: /OnlyFans/ }).click()
  await expect(page.getByText('Este link tem conteúdo para maiores de 18 anos.')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByText('Este link tem conteúdo para maiores de 18 anos.')).toBeHidden()
})

test('endereço inexistente mostra 404 e slug duplicado é recusado', async ({ page }) => {
  await page.goto('/nao-existe-essa')
  await expect(page.getByText('Não existe página publicada em /nao-existe-essa.')).toBeVisible()

  await signUp(page, 'agência', 'Agência Slug', 'slug@teste.dev')
  await createPage(page, 'Primeira', 'mesmo-nome', undefined, 'Primeira')
  await page.goto('/app/paginas')
  await page.getByRole('button', { name: 'Nova página' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova página' })
  await dialog.getByLabel('Nome na página').fill('Segunda')
  await dialog.getByLabel('Endereço').fill('mesmo-nome')
  await dialog.getByRole('button', { name: 'Criar página' }).click()
  await expect(dialog.getByRole('alert')).toHaveText(/já está em uso/)
})

test.describe('navegador interno do Instagram', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,2; iOS 17_5; pt_BR)',
  })

  test('abre sem pop-up, botões grandes, e as métricas separam Instagram e ?src=', async ({ page }) => {
    await page.route('https://privacy.com.br/**', (r) => r.fulfill({ contentType: 'text/html', body: '<h1>Privacy</h1>' }))
    await page.goto('/entrar')
    await page.getByRole('button', { name: 'Agência demo' }).click()
    await expect(page).toHaveURL(/\/app$/)

    // filtro por modelo: Valentina tem duas árvores
    await page.getByLabel('Filtrar por modelo').selectOption('Valentina')
    await expect(page.getByRole('link', { name: 'Valentina Rosé' })).toHaveCount(2)

    await page.goto('/mel?src=ig-teste')
    await expect(page.getByRole('heading', { name: 'Mel Noir' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('Feito com')).toHaveCount(0) // rodapé desligado: só a modelo aparece
    const btn = page.getByRole('link', { name: /Meu Privacy/ })
    const box = (await btn.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(56)
    expect(box.width).toBeGreaterThanOrEqual(320)
    await btn.click()
    await expect(page).toHaveURL(/privacy\.com\.br/)

    await page.goto('/app/paginas')
    await page.getByRole('link', { name: 'Editar Mel Noir' }).click()
    await expect(page).toHaveURL(/\/app\/paginas\/[0-9a-f-]{36}$/)
    await page.goto(`${page.url()}/metricas`)
    const row = page.getByRole('row', { name: /ig-teste/ })
    await expect(row).toContainText('1')
    await expect(page.getByText('Instagram', { exact: true })).toBeVisible()
  })
})

test('design: cabeçalho, corte da foto, logo do link, nome editável e Fatal Fans', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByRole('button', { name: 'Agência demo' }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page.goto('/app/paginas')
  await page.getByRole('link', { name: 'Editar Nina Neon' }).click()
  await expect(page.getByRole('tab', { name: 'Blocos' })).toBeVisible()

  // nome do link direto na lista
  await page.getByRole('textbox', { name: 'Nome do link' }).first().fill('Meu Privacy VIP')
  // logo: Fatal Fans no segundo link
  await page.getByRole('button', { name: 'Abrir opções do bloco' }).nth(1).click()
  await page.getByLabel('Logo ao lado do nome').selectOption('fatalfans')

  // foto nova, gerada no navegador
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 400
    c.height = 600
    const g = c.getContext('2d')!
    g.fillStyle = '#8E2C4A'
    g.fillRect(0, 0, 400, 600)
    g.fillStyle = '#E7C9A1'
    g.fillRect(150, 100, 100, 100)
    return c.toDataURL('image/png').split(',')[1]
  })
  await page.getByRole('tab', { name: 'Perfil' }).click()
  await page.locator('input[type=file]').first().setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByTestId('crop-frame')).toBeVisible()
  await page.getByLabel(/^Horizontal/).fill('20')
  await page.getByLabel(/^Vertical/).fill('30')

  await page.getByRole('tab', { name: 'Design' }).click()
  await page.getByRole('button', { name: /Formas/ }).click()
  await page.getByRole('button', { name: 'Círculo' }).click()
  await page.getByRole('button', { name: 'Marcada' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Alterações salvas')).toBeVisible()

  await page.goto('/nina')
  await expect(page.locator('[data-layout="shape"]')).toBeVisible()
  await expect(page.getByRole('link', { name: /Meu Privacy VIP/ })).toBeVisible()
  const pos = await page.locator('[data-layout] img').first().evaluate((el) => (el as HTMLImageElement).style.objectPosition)
  expect(pos).toBe('20% 30%')
})

test('copia o link da árvore e a prévia do cartão cabe inteira', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/entrar')
  await page.getByRole('button', { name: 'Agência demo' }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page.goto('/app/paginas')
  await page.getByRole('button', { name: 'Copiar link de Mel Noir' }).click()
  await expect(page.getByText(/Link copiado: .*\/mel$/)).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/mel$/)

  // a prévia ocupa exatamente a largura do cartão (nada cortado à direita)
  const card = page.getByRole('link', { name: 'Editar Mel Noir' })
  const inner = card.locator('[aria-hidden]').first()
  const [cw, iw] = await Promise.all([card.evaluate((e) => e.clientWidth), inner.evaluate((e) => e.getBoundingClientRect().width)])
  expect(Math.abs(cw - iw)).toBeLessThanOrEqual(2)
})

test('fundo degradê, transição da foto no Retrato e fonte Montserrat', async ({ page }) => {
  // a prévia lateral do editor só existe na tela larga; no celular o fluxo é o mesmo
  test.skip(test.info().project.name === 'mobile', 'prévia lateral só no desktop')
  await page.goto('/entrar')
  await page.getByRole('button', { name: 'Agência demo' }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page.goto('/app/paginas')
  await page.getByRole('link', { name: 'Editar Mel Noir' }).click()
  await page.getByRole('tab', { name: 'Design' }).click()

  // degradê aparece na hora, sem precisar escolher as duas cores
  await page.getByRole('button', { name: 'Degradê' }).click()
  const preview = page.locator('aside [data-layout]')
  await expect(preview).toHaveAttribute('style', /linear-gradient\(rgb\(91, 26, 58\) 0%, rgb\(11, 7, 16\) 100%\)/)
  await page.getByRole('button', { name: 'Diagonal' }).click()
  await expect(preview).toHaveAttribute('style', /linear-gradient\(135deg/)
  await page.getByLabel('Segunda cor').fill('#123456')
  await expect(preview).toHaveAttribute('style', /rgb\(18, 52, 86\)/)

  // Retrato: transição da foto ajustável
  await page.getByRole('button', { name: /Retrato/ }).click()
  await page.getByLabel(/^Transição da foto para o fundo/).fill('80')
  await page.getByLabel(/^Altura da foto/).fill('70')
  const photo = preview.locator('div.overflow-hidden.w-full').first()
  const mask = await photo.evaluate((el) => (el as HTMLElement).style.maskImage || (el as HTMLElement).style.webkitMaskImage)
  expect(mask).toMatch(/(#000|rgb\(0, 0, 0\)) 20%/) // transição começa em 20% (80% de suavidade)
  expect(await photo.evaluate((el) => el.clientHeight)).toBe(490) // altura 70

  await page.getByRole('button', { name: 'Fonte Montserrat' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Alterações salvas')).toBeVisible()
  await page.screenshot({ path: `docs/prints/${test.info().project.name}/05c-editor-fundo-fonte.png` })

  await page.goto('/mel')
  await expect(page.getByRole('heading', { name: 'Mel Noir' })).toHaveCSS('font-family', /Montserrat/)
  await expect(page.locator('[data-layout="portrait"]')).toHaveAttribute('style', /rgb\(18, 52, 86\)/)
})
