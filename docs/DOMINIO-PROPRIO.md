# Colocar o app num domínio próprio (Hostinger)

## Como está hoje (out/2026)

- **https://mylinkhub.pro** publicado na **Netlify** (projeto `melodic-sopapillas-5fc4de`), com HTTPS.
- DNS na Hostinger: `A @ -> 75.2.60.5` e `CNAME www -> melodic-sopapillas-5fc4de.netlify.app`.
- Variáveis na Netlify: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (só usadas se um dia o deploy
  automático pelo GitHub for ligado).
- **Atualização manual**: gerar o pacote (`gerar-hostinger.bat`, ou o script com as variáveis) e enviar o
  `linkhub-site.zip` em Netlify → projeto → **Deploys** (área "drag and drop"). O deploy automático pelo GitHub
  não foi ligado porque a autorização do GitHub na Netlify não funcionou.
- Supabase Auth: Site URL `https://mylinkhub.pro`; redirects para o domínio, o `www` e o endereço da Netlify.


O app é só "site estático": o banco, o login e as fotos ficam no Supabase. Então **não precisa de VPS**. Há três
caminhos; o recomendado é o 1.

## Caminho 1 (recomendado): Netlify grátis + domínio da Hostinger

Vantagens: grátis, HTTPS automático, e o site **se atualiza sozinho** a cada envio para o GitHub. O
`netlify.toml`, o `_redirects` e o `_headers` do projeto já cuidam das rotas `/nome` e da segurança.

1. Crie uma conta em https://netlify.com (pode entrar com o GitHub).
2. **Add new project → Import an existing project → GitHub** e escolha o repositório **Mylinksallur**.
   A Netlify lê o `netlify.toml` sozinha (build `npm run build`, pasta `dist`).
3. Antes de clicar em Deploy, em **Environment variables**, adicione (os mesmos valores do `.env` do bolt):
   - `VITE_SUPABASE_URL` = `https://SEU-PROJETO.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = a chave `sb_publishable_...`
4. **Deploy**. Abra o endereço `xxxx.netlify.app` e confira que o painel **não** mostra a faixa amarela.
5. Em **Domain management → Add a domain**, digite o seu domínio (ex.: `seudominio.com.br`).
6. Na Hostinger: **hPanel → Domínios → seu domínio → DNS / Nameservers → Gerenciar registros DNS**:
   - apague os registros **A**, **AAAA** e **CNAME** que já existam para `@` e `www`;
   - crie **A** · nome `@` · aponta para `75.2.60.5`;
   - crie **CNAME** · nome `www` · aponta para `xxxx.netlify.app` (o endereço do passo 4).
   Confira os valores que a própria Netlify mostrar na tela de domínio; se forem diferentes, use os dela.
7. Espere o DNS propagar (minutos a algumas horas). A Netlify ativa o HTTPS sozinha.

## Caminho 2: hospedagem comum da Hostinger (planos Premium/Business)

Funciona, mas **a cada mudança** você precisa gerar o site de novo e reenviar os arquivos.

1. Na pasta do projeto no PC (`C:\Projetos\linkhub-agencia`), copie o `.env.example` para `.env` e cole as
   duas linhas do Supabase (as mesmas do `.env` do bolt). Esse arquivo nunca vai para o GitHub.
2. Dê dois cliques em **`gerar-hostinger.bat`**. Ele confere as chaves, gera o site e cria
   `hostinger\linkhub-site.zip` (com o `.htaccess` dentro). Se faltar algo, ele diz o quê.
3. hPanel → **Sites → Gerenciador de arquivos** → abra `public_html` → apague o conteúdo padrão →
   envie o `linkhub-site.zip` e use **Extrair** ali mesmo (o conteúdo tem que ficar direto em `public_html`).
4. O `.htaccess` já força HTTPS, faz as rotas `/nome` funcionarem e aplica os cabeçalhos de segurança.
5. Em **Segurança → SSL**, ative o SSL grátis do domínio.

## Caminho 3: domínio direto no bolt

O bolt só permite domínio próprio no plano **Bolt Pro**. Se assinar, use **Project Settings → Domains & Hosting**.

## Em qualquer caminho, no Supabase

**Authentication → URL Configuration**:
- **Site URL**: `https://seudominio.com.br`
- **Redirect URLs**: adicione `https://seudominio.com.br/**` (e o endereço antigo, se ainda for usar).

Sem isso, o link de confirmação de e-mail leva para o endereço antigo.

Depois, os links das modelos ficam `https://seudominio.com.br/japathai`. Atualize a bio do Instagram.
