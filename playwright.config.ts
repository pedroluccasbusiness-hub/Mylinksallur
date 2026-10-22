import { defineConfig, devices } from '@playwright/test'

// Usa o Chrome já instalado (PW_CHANNEL=msedge para o Edge), sem baixar navegadores.
const channel = process.env.PW_CHANNEL ?? 'chrome'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    channel,
    trace: 'retain-on-failure',
  },
  webServer: {
    // sem variáveis do Supabase: roda no modo demonstração
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 860 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel } },
  ],
})
