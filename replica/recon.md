# Recon (clean-room) — link na bio para agências

Fonte: só páginas públicas do Beacons (marketing, preços, help center), lidas em 2026-10-22.
Nada de código, textos, logos ou marca deles foi copiado. **Termos do Beacons (beacons.ai/i/terms, §2.3)
proíbem usar o serviço para construir concorrente, engenharia reversa e scraping** — por isso não foi criada
conta lá; o produto aqui é escrito do zero a partir de padrões comuns de "link na bio".

## Fontes
| fonte | url |
| --- | --- |
| blocos / editor | https://help.beacons.ai/en/categories/1086529 |
| aparência | https://help.beacons.ai/en/articles/4698881 |
| analytics | https://help.beacons.ai/en/articles/4698753 |
| domínio próprio | https://help.beacons.ai/en/articles/4698945 |
| preços | https://beacons.ai/i/pricing |
| gestão de criadores | https://home.beacons.ai/for-managers |

## O que o mercado oferece (resumo)
- Editor por blocos: links/botões, vídeo, música/embed, texto, espaçador, formulário de contato, loja/produtos.
- Por link: título, layout, animação/destaque, agendamento, analytics individual.
- Aparência: fonte, fundo (imagem/gradiente), cor e formato dos botões.
- Analytics: views, cliques, CTR, cliques por link, origem do tráfego; 7d/30d/total.
- Planos limitam nº de páginas; produto separado para gestores com roster de criadores.

## Nosso recorte (núcleo)
Agência gerencia várias páginas (uma ou mais por criadora), cada uma com design próprio, e vê métricas
consolidadas. Criadora tem conta própria com **no máximo 2 páginas** e pode se vincular a uma agência.

## Telas
| ID | tela | rota | estados |
| --- | --- | --- | --- |
| S01 | landing | / | — |
| S02 | entrar | /entrar | erro de senha |
| S03 | criar conta (agência ou criadora) | /cadastro | e-mail em uso, senha curta |
| S04 | painel (visão geral + métricas consolidadas) | /app | vazio, com dados |
| S05 | páginas (lista, criar, duplicar, excluir) | /app/paginas | vazio, limite atingido (criadora) |
| S06 | editor (blocos, perfil, design, config + prévia celular) | /app/paginas/:id | sem blocos |
| S07 | métricas da página | /app/paginas/:id/metricas | sem dados |
| S08 | criadoras vinculadas (agência) / vincular a agência (criadora) | /app/equipe | vazio |
| S09 | conta | /app/conta | — |
| S10 | página pública | /:slug | não encontrada, aviso +18 |

## Fluxos
- F01 Agência cria conta → S04 → cria página (tema + modelo) → S06 adiciona links → publica → abre S10. (≈6 cliques)
- F02 Visitante abre S10 → (aviso +18) → clica link → conta clique → redireciona.
- F03 Agência vê métricas consolidadas (S04) e por página (S07): views, cliques, CTR, únicos, origem, dispositivo, país.
- F04 Criadora cria conta → cria 2 páginas → 3ª é bloqueada (UI + banco).
- F05 Criadora digita código da agência (S08) → agência passa a ver/editar as páginas dela.

## Modelo de dados (inferido → ver supabase/migrations)
profiles(id, account_type agency|creator, display_name, agency_id, invite_code)
pages(id, owner_id, slug, title, bio, avatar_url, creator_label, theme_id, theme_overrides, socials, is_published, age_gate, seo_*)
blocks(id, page_id, type, position, data, is_active, highlight, sensitive, starts_at, ends_at)
events(id, page_id, block_id, kind view|click, created_at, visitor_hash, referrer_host, device, country)

## Fora do escopo (skip)
Loja/produtos, cursos, pagamentos, e-mail marketing, IA, CRM de marcas, cartão NFC, domínio próprio
automático (fica documentado como passo manual), rede/usuários do Beacons.

## Tamanho
M. Partes difíceis: limite garantido no banco (trigger + RLS), contagem de eventos anônima segura (RPC
com hash de IP), métricas agregadas no Postgres.
