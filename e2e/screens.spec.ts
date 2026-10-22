// Gera os prints de PC e celular em docs/prints (rodar: npm run screens)
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test('prints das telas principais', async ({ page }, info) => {
  const dir = `docs/prints/${info.project.name}`
  const shot = (name: string) => page.screenshot({ path: `${dir}/${name}.png` })

  await page.goto('/')
  await page.waitForTimeout(600) // fontes
  await shot('01-landing')

  await page.goto('/entrar')
  await page.getByRole('button', { name: 'Agência demo' }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText('Visitantes únicos')).toBeVisible()
  await shot('02-visao-geral-agencia')

  await page.goto('/app/paginas')
  await expect(page.getByRole('link', { name: 'Editar Mel Noir' })).toBeVisible()
  await shot('03-paginas')

  await page.getByRole('link', { name: 'Editar Mel Noir' }).click()
  await expect(page.getByRole('tab', { name: 'Blocos' })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir opções do bloco' }).first().click()
  await shot('04-editor-blocos')
  await page.getByRole('tab', { name: 'Design' }).click()
  await shot('05-editor-design')
  await page.getByRole('tab', { name: 'Configurações' }).click()
  await page.getByText('Links para divulgar').scrollIntoViewIfNeeded()
  await shot('05b-editor-links-divulgar')

  await page.goto('/app')
  await page.getByRole('link', { name: 'Mel Noir' }).click()
  await expect(page.getByText('Por link divulgado')).toBeVisible()
  await page.screenshot({ path: `${dir}/06-metricas-pagina.png`, fullPage: true })

  for (const slug of ['mel', 'valentina', 'bia', 'nina', 'luna']) {
    await page.goto(`/${slug}?src=ig-print`)
    await page.waitForTimeout(400)
    await shot(`07-publica-${slug}`)
  }

  await page.goto('/app/equipe')
  await expect(page.getByText('@valentina.rs')).toBeVisible()
  await shot('08-elenco')

  await page.goto('/app/conta')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.getByRole('button', { name: 'Criadora demo' }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page.goto('/app/paginas')
  await expect(page.getByText('1 de 2 páginas usadas')).toBeVisible()
  await shot('09-criadora-paginas')
})
