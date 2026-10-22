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

async function createPage(page: Page, title: string, slug: string, theme?: string) {
  await page.goto('/app/paginas')
  await page.getByRole('button', { name: /Nova página|Criar primeira página/ }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nova página' })
  await dialog.getByLabel('Nome na página').fill(title)
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

  await createPage(page, 'Ana Teste', 'ana-teste', 'Vinho e creme')
  // edita o primeiro link do modelo
  await page.getByRole('button', { name: /Conteúdo exclusivo/ }).first().click()
  await page.getByLabel('Endereço (URL)').fill('https://destino.exemplo.com/assinatura')
  // adiciona um texto
  await page.getByRole('button', { name: 'Texto', exact: true }).click()
  await page.getByLabel('Texto', { exact: true }).fill('Bem-vindo à minha página')
  // troca o tema
  await page.getByRole('tab', { name: 'Design' }).click()
  await page.getByRole('button', { name: 'Ônix dourado' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Alterações salvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvo' })).toBeDisabled()

  // página pública
  await page.goto('/ana-teste')
  await expect(page.getByRole('heading', { name: 'Ana Teste' })).toBeVisible()
  await expect(page.getByText('Bem-vindo à minha página')).toBeVisible()
  await page.getByRole('button', { name: /Conteúdo exclusivo/ }).click()
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
  expect(code).toMatch(/^[A-F0-9]{8}$/)
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

test('link +18 pede confirmação e página com aviso de idade bloqueia até confirmar', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByRole('button', { name: 'Agência demo' }).click()
  await expect(page).toHaveURL(/\/app$/)

  await page.goto('/valentina.rs')
  await expect(page.getByRole('dialog', { name: 'Aviso de idade' })).toBeVisible()
  await page.getByRole('button', { name: 'Tenho 18 anos ou mais' }).click()
  await page.getByRole('button', { name: /OnlyFans/ }).click()
  await expect(page.getByText('Este link tem conteúdo para maiores de 18 anos.')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByText('Este link tem conteúdo para maiores de 18 anos.')).toBeHidden()
})

test('endereço inexistente mostra 404 e slug duplicado é recusado', async ({ page }) => {
  await page.goto('/nao-existe-essa')
  await expect(page.getByText('Não existe página publicada em /nao-existe-essa.')).toBeVisible()

  await signUp(page, 'agência', 'Agência Slug', 'slug@teste.dev')
  await createPage(page, 'Primeira', 'mesmo-nome')
  await page.goto('/app/paginas')
  await page.getByRole('button', { name: 'Nova página' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova página' })
  await dialog.getByLabel('Nome na página').fill('Segunda')
  await dialog.getByLabel('Endereço').fill('mesmo-nome')
  await dialog.getByRole('button', { name: 'Criar página' }).click()
  await expect(dialog.getByRole('alert')).toHaveText(/já está em uso/)
})
