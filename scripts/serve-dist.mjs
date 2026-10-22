// Serve a pasta dist com os mesmos cabeçalhos de segurança do deploy (public/_headers),
// para conferir localmente que a CSP não quebra nada. Uso: node scripts/serve-dist.mjs [porta]
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const root = join(import.meta.dirname, '..', 'dist')
const port = Number(process.argv[2] ?? 5198)

const headers = Object.fromEntries(
  readFileSync(join(import.meta.dirname, '..', 'public', '_headers'), 'utf8')
    .split('\n')
    .filter((l) => /^\s+[\w-]+:/.test(l))
    .map((l) => {
      const i = l.indexOf(':')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
headers['Strict-Transport-Security'] = undefined // localhost é http
headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(' upgrade-insecure-requests', '')

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '')
  let file = join(root, path)
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  for (const [k, v] of Object.entries(headers)) if (v) res.setHeader(k, v)
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}).listen(port, () => console.log(`dist em http://localhost:${port}`))
