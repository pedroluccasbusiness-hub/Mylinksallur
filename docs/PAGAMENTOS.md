# Mensalidade por Pix (Jungle Pagamentos)

A API da Jungle só cria **cobranças Pix avulsas** (não tem assinatura automática nem cartão).
Por isso a mensalidade funciona assim:

1. Na tela **Conta**, a pessoa escolhe o plano, informa nome e CPF/CNPJ e toca em **Gerar Pix**.
2. A função `pagamentos` (Supabase) pega o preço no banco (`plan_price`) e cria o Pix na Jungle.
3. Quando o Pix é pago, a Jungle avisa em `.../functions/v1/pagamentos/webhook` (assinado em `X-Signature`).
   A função confere a assinatura **e** consulta a transação na Jungle antes de liberar.
4. O plano fica ativo por **30 dias** (`plan_expires_at`). Renovar antes de vencer soma mais 30 dias.
5. Vencido há mais de **3 dias**, a conta volta ao limite de 1 árvore. As árvores já criadas continuam no ar.
   O painel mostra o aviso "Pagar por Pix" e, 7 dias antes de vencer, o botão "Renovar".

Planos dados à mão no SQL Editor (`select admin_set_plan('email', 'king', 'active');`) não vencem.

## Instalar (uma vez)

1. **Banco**: Supabase → SQL Editor → cole e rode `supabase/migrations/20261024000006_billing.sql`.
2. **Função**: Supabase → Edge Functions → *Deploy a new function* → *Via Editor* → nome `pagamentos`
   → cole `supabase/functions/pagamentos/index.ts` → Deploy. Depois, em *Details*, **desligue**
   "Enforce JWT verification" (o aviso da Jungle chega sem login; a função confere a assinatura).
3. **Chaves** (só você, nunca em arquivo): Supabase → Edge Functions → **Secrets** → adicione
   - `JUNGLE_API_KEY` = a chave `gw_...` da loja (Jungle → Integrações → API e chaves)
   - `JUNGLE_WEBHOOK_SECRET` = o segredo `whsec_...` da mesma tela (botão "Mostrar")
4. **Site**: gerar o pacote e publicar (veja DOMINIO-PROPRIO.md).

Não é preciso cadastrar nada na tela Webhooks da Jungle: cada Pix já leva o endereço do aviso.
Não coloque IPs em "IPs autorizados" na Jungle: as funções do Supabase não têm IP fixo.

## Testes

- Banco: `npx vitest run tests/sql`
- Função (Supabase e Jungle de mentira, nada é cobrado):
  `npx deno@2.9.6 test --allow-net --allow-env supabase/functions/pagamentos/pagamentos_test.ts`
