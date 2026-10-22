import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // NEXT_PUBLIC_ também: é o nome que a integração Supabase do bolt.new grava no .env.
  // Só variáveis com esses prefixos (públicas por natureza) vão para o navegador.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: { port: 5173, host: true },
})
