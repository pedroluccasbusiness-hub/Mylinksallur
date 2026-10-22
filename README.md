# LinkHub Agência (nome provisório)

Link na bio para agências de modelos. As árvores de links vão na **bio do Instagram das modelos**: a página pública
leva o nome, a foto e o @ da modelo, nunca a marca da agência. A agência cria quantas árvores quiser, cada uma ligada
a uma modelo do elenco (uma modelo pode ter várias, por exemplo uma por perfil de Instagram), e acompanha visitas e
cliques por página, por modelo e por perfil. A modelo também pode ter conta própria de criadora, com até **2 páginas**,
e se vincular a uma agência por código.

Stack: Vite + React 18 + TypeScript + Tailwind + Supabase (login, banco e fotos). Compatível com o bolt.new.

## O que tem

- **Contas**: agência (páginas ilimitadas) e criadora (máximo 2). O limite vale na tela **e no banco** (trigger no
  Postgres), então não dá para burlar pela API. O tipo de conta não muda depois de criado.
- **Elenco**: a agência cadastra as modelos (nome e @). Cada árvore fica ligada a uma modelo; painel e lista de
  páginas filtram por modelo.
- **Vínculo**: a agência tem um código de convite; a criadora digita o código e a agência passa a editar as páginas
  dela e ver as métricas. A criadora pode sair; a agência pode desvincular ou gerar código novo.
- **Editor** com prévia de celular ao vivo: blocos de link, título de seção, texto, imagem (com link), vídeo
  (YouTube/Vimeo/mp4), incorporar (Spotify etc.) e divisor. Reordenar (arrastar ou setas), ocultar, duplicar,
  agendar início/fim, destaque animado (brilho, pulsar, aura) e marcação **+18** que pede confirmação.
- **Perfil**: foto, nome, @ do Instagram, bio e ícones de redes (Instagram, TikTok, X, YouTube, Telegram, WhatsApp, OnlyFans,
  Privacy, Fansly, e-mail, site).
- **8 temas** prontos (Noir violeta, Vinho e creme, Creme e vinho, Ônix dourado, Neon noite, Rosé nude, Aurora
  vidro, Marfim minimal) + cor de destaque, fonte, formato e estilo dos botões, imagem de fundo com escurecimento.
- **Página pública** em `/endereco` curto, feita primeiro para o navegador interno do Instagram (iOS e Android):
  carrega só o necessário (o painel é carregado à parte), sem pop-up nem aviso de cookies, botões de 58 px de altura,
  respeita a área segura do iPhone. Rodapé "Feito com…" opcional (a agência pode desligar). Título/descrição para
  Google, QR code, publicar/rascunho.
- **Sem truques com o Instagram**: cada botão é um link de verdade com o destino real no `href` (nada de
  redirecionamento escondido ou cloaking). Links +18 só levam à plataforma (Privacy, OnlyFans, Telegram…); a página
  não deve ter conteúdo explícito. Aviso de +18 opcional por link.
- **Métricas** (7/30/90 dias): visualizações, visitantes únicos, cliques, CTR, gráfico por dia, cliques e CTR por
  link, dispositivo e país. **Origem**: Instagram é reconhecido pelo navegador do app (que quase nunca envia
  referrer), por `utm_source` ou pelo referrer. **Por link divulgado**: cada perfil usa o link com um final
  `?src=ig-perfil1`, `?src=ig-perfil2`… (gerador em Configurações da página) e as métricas comparam visitas, cliques
  e CTR de cada um. Visão consolidada da agência com tabela por página e filtro por modelo. **O IP nunca é gravado**: vira um hash diário com sal secreto; repetições em sequência não contam.
- **Modo demonstração**: sem as chaves do Supabase o app roda inteiro com os dados no navegador, com contas de
  exemplo (botões "Agência demo" e "Criadora demo" na tela de entrar).

## Rodar no PC

```bash
cd C:\Projetos\linkhub-agencia
npm install
npm run dev
```

Abra http://localhost:5173. Sem `.env` ele abre no modo demonstração.

## Testes

```bash
npm test            # 24 testes: regras do app, origem da visita e migrações SQL num Postgres real (PGlite)
npm run test:e2e    # 12 testes no navegador (PC, celular e navegador do Instagram simulado), usando o Chrome instalado
npm run screens     # gera os prints em docs/prints/desktop e docs/prints/mobile
```

Os testes de navegador usam o Chrome do Windows (`PW_CHANNEL=msedge` para usar o Edge).

## Ligar o Supabase (banco de verdade)

1. Crie um projeto em https://supabase.com (plano grátis serve).
2. Em **SQL Editor**, rode os arquivos de `supabase/migrations` na ordem do nome: `..._schema.sql`,
   `..._functions.sql` e `..._tracking.sql`.
3. Em **Authentication > Sign In / Providers > Email**: para testar rápido, desligue "Confirm email". Em produção,
   deixe ligado e configure **Authentication > URL Configuration > Site URL** com o endereço publicado.
4. Em **Project Settings > API**, copie a *Project URL* e a chave *anon public*.
5. Copie `.env.example` para `.env` e cole os dois valores. **Nunca** use a chave `service_role` no app e nunca
   suba o `.env` para o Git (ele já está no `.gitignore`).

Ajustes opcionais (tabela `app_config`, no SQL Editor):

```sql
update app_config set value = 'false' where key = 'allow_agency_signup';  -- novas contas viram criadora
update app_config set value = '3'     where key = 'creator_page_limit';   -- mudar o limite da criadora
```

Para tornar uma conta agência manualmente (quando o cadastro de agência estiver fechado):

```sql
select set_config('app.bypass_profile_guard', 'on', false);
update profiles set account_type = 'agency', invite_code = gen_invite_code() where id = '<id do usuário>';
```

## Abrir no bolt.new

1. Com o repositório no GitHub, entre em https://bolt.new com a sua conta.
2. Use **Import from GitHub** (ou abra direto `https://bolt.new/~/github.com/pedroluccasbusiness-hub/linkhub-agencia`).
3. O bolt instala as dependências e roda `npm run dev`. Sem chaves, abre no modo demonstração.
4. Para usar o banco: no bolt, conecte o Supabase pela integração dele (botão **Supabase**) ou crie o arquivo `.env`
   com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. As migrações estão em `supabase/migrations`.
5. Ao publicar (Netlify pelo bolt), o arquivo `public/_redirects` já faz as rotas `/endereco` funcionarem. Para
   Vercel, existe `vercel.json`.

## Estrutura

```
src/lib/backend.ts          contrato da camada de dados
src/lib/supabaseBackend.ts  implementação Supabase
src/lib/localBackend.ts     implementação do modo demonstração (mesmas regras)
src/lib/themes.ts           temas e personalização
src/components/PublicPageView.tsx  a página pública (usada também na prévia)
src/pages/                  telas
supabase/migrations/        banco, RLS, limite, eventos e métricas
tests/                      testes unitários e de SQL
e2e/                        testes no navegador e geração de prints
replica/                    mapa de recon e matriz de funcionalidades
```

## Limitações conhecidas

- Página pública é renderizada no navegador (SPA): o título e a descrição aparecem para o Google, mas prévias de
  link no WhatsApp/Instagram podem mostrar o título genérico. Resolver isso pede renderização no servidor.
- País vem do cabeçalho de rede quando o provedor envia; senão, da região do idioma do navegador (aproximado).
- Domínio próprio por criadora não é automático; dá para apontar um domínio inteiro para o app no provedor de
  hospedagem.
- Referências do Beacons foram só páginas públicas (os termos deles proíbem usar o serviço para construir
  concorrente). Nenhum código, texto, logo ou marca deles foi copiado.
