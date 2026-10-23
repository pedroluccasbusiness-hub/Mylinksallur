// Gera o pacote para a hospedagem comum da Hostinger: hostinger/linkhub-site.zip
// Uso: node scripts/gerar-hostinger.mjs   (ou dois cliques em gerar-hostinger.bat)
// Precisa do arquivo .env na raiz com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou ANON_KEY).
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const envFile = join(root, '.env')

function fail(msg) {
  console.error(`\nERRO: ${msg}\n`)
  process.exit(1)
}

// as chaves vêm do .env ou das variáveis de ambiente (assim dá para gerar sem gravar a chave em arquivo)
const fromFile = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : {}
const env = { ...fromFile, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /SUPABASE/.test(k))) }
if (!Object.keys(env).length) {
  fail('não achei as chaves do Supabase. Copie o .env.example para .env e cole o endereço e a chave pública (as mesmas do bolt).')
}
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url) fail('falta a linha VITE_SUPABASE_URL=https://xxxx.supabase.co no .env')
if (!key) fail('falta a linha VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... no .env')
if (/^sb_secret_/.test(key)) fail('a chave no .env é a SECRETA. Use a publishable (sb_publishable_...) ou a anon.')
if (key.length < 30) fail('a chave publishable parece incompleta (curta demais). Copie a chave inteira do Supabase.')

console.log('1/3 Instalando dependências (só na primeira vez demora)...')
execSync('npm install --no-audit --no-fund', { cwd: root, stdio: 'inherit' })
console.log('2/3 Gerando o site...')
execSync('npm run build', { cwd: root, stdio: 'inherit' })

if (!existsSync(join(root, 'dist', '.htaccess'))) fail('o .htaccess não saiu no build (deveria vir de public/.htaccess).')
const bundle = execSync('dir /b dist\\assets\\index-*.js', { cwd: root, shell: 'cmd.exe' }).toString().trim().split(/\r?\n/)[0]
if (!readFileSync(join(root, 'dist', 'assets', bundle), 'utf8').includes('.supabase.')) {
  fail('o site foi gerado sem o Supabase (ficaria em modo demonstração). Confira o .env.')
}

console.log('3/3 Compactando...')
const out = join(root, 'hostinger')
mkdirSync(out, { recursive: true })
const zip = join(out, 'linkhub-site.zip')
rmSync(zip, { force: true })
// tar do próprio Windows 10+ (o do Git Bash não gera .zip); inclui arquivos com ponto, como o .htaccess
const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
execSync(`"${tar}" -a -c -f "${zip}" -C dist .`, { cwd: root, stdio: 'inherit' })
console.log(`\nPronto: ${zip}\nEnvie o CONTEÚDO desse zip para a pasta public_html (veja docs/DOMINIO-PROPRIO.md).\n`)
