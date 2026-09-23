# Etholys Billing — licenças, assinaturas, add-ons e comissões

**Versão:** 0.2  
**Data:** 2026-08-30  
**Status:** Motor comercial + Stripe (Checkout + Invoicing com transferência USD). Conta Stripe liga-se depois via env.

## Princípio

Há **duas camadas** distintas:

1. **Contrato da empresa** (o que foi comprado) — `CompanySubscription` + `CompanyEntitlement`
2. **Grant do utilizador** (quem pode usar) — `IntegratedWorkspaceAccess`

Não misturar com `Invoice` do ATLAS (facturas dos *clientes* da empresa). As faturas Etholys → cliente são `PlatformInvoice`. O Stripe é processador; a fonte de verdade continua a ser `PlatformInvoice`.

Sem subscrição registada, o comportamento legado mantém-se: todos os sistemas abertos ao nível empresa (`billingEnforced: false`).

Sem `STRIPE_SECRET_KEY`, a loja e as faturas funcionam; só existe **marcar paga (manual)**.

## Produtos

Catálogo em código: `apps/web/lib/billing/catalog.ts`

| Tipo | Exemplos | Cobrança |
|------|----------|----------|
| Pacote | MIPYME, Institucional, Técnico, Governamental | Assinatura mensal/anual (anual = 10× mês) |
| Sistema à la carte | ATLAS, SIEP, FUNDHUB, NEXUS, FORGE, PRISM | Assinatura |
| Add-on | Smart Import, governação, marketplace, carteira, Studio | Assinatura (exige sistema-pai) |
| Licença | Anual B2B; White label (sob consulta) | Período anual, auto-renovação |
| Comissão | FUNDHUB success fee 2–5%; FORGE/NEXUS marketplace | Evento → acumulado → fatura |

Advisor e Chorus continuam isentos no Hub. Studio (`addon.tool.studio`) e Work (`addon.tool.work`) só aparecem no Hub quando a empresa os contratou (faturação activa). Sem atalhos flutuantes nas páginas dos sistemas.

## Fluxos

- **Contratar:** admin da empresa em `/hub/billing` → `POST /api/billing/subscription` → activa entitlement + emite `PlatformInvoice` ISSUED. Não cria fatura Stripe automaticamente.
- **Renovar:** `POST /api/billing/renew` (cron `ETHOLYS_BILLING_CRON_SECRET` ou system admin) gera a fatura do novo período.
- **Comissões:** activar a regra → `scan` (propostas FUNDHUB `approved`/`awarded`/`won`) ou `accrue` manual → `invoice` junta ACCRUED numa fatura.
- **Pagar** (`POST /api/billing/invoices`, `action`):
  - `checkout` — Stripe Checkout (cartão; Adaptive Pricing ligado).
  - `bank_transfer` — Stripe Invoice `send_invoice` com cartão **e** `customer_balance` / `us_bank_transfer` (conta virtual USD + reconciliação automática).
  - `mark_paid` — reconciliação manual (SWIFT directo à LLC). Sempre disponível.

Webhook (sem sessão): `POST /api/billing/stripe/webhook`  
Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_succeeded`.

## Stripe — ligar a conta

1. Aplicar SQL `apps/web/prisma/migrations/manual_billing_stripe.sql` (colunas Stripe em `PlatformInvoice`).
2. Dashboard Stripe (conta da LLC EUA):
   - Invoices → payment methods → **Bank transfers (US)** + cartão.
   - Webhook endpoint: `{NEXTAUTH_URL}/api/billing/stripe/webhook` com os eventos acima.
3. Env (não commitar): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, opcional `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Redeploy só `etholys-web` quando as chaves existirem.

## Custos Stripe (indicativos, conta EUA, 2026)

Estimativas em `lib/billing/stripe-fees.ts` — confirmar no Dashboard.

| Canal | Taxa típica | Quando usar |
|-------|-------------|-------------|
| Cartão EUA | 2,9% + $0,30 | Cliente paga já |
| Cartão internacional | ~4,4% + $0,30; Adaptive Pricing põe o FX 2–4% no preço do cliente | LATAM com cartão |
| **Invoicing Starter + bank transfer US** | **0,4% por fatura paga (tecto $2) + ACH ~0,8% (tecto $5) ≈ tecto ~$7** | Facturas B2B em USD; vale a pena vs cartão a partir de dezenas de dólares |
| SWIFT / ACH directo à conta da LLC | **0% Stripe** + taxas do banco correspondente (o valor pode chegar **curto**) | Cliente recusa conta virtual Stripe; só consegue pagar em moeda local para um banco que a LLC ainda não tem; mismatch SWIFT esperado |

**O manual continua a valer a pena** nesses três casos. Para ACH/wire USD grande, a reconciliação Stripe (~$2+$5) é quase sempre mais barata que cartão e mais fiável que casar extractos à mão.

PIX cross-border (vendedor EUA) e outros métodos locais activam-se no Dashboard depois; não estão no código no dia 1.

## Código

| Peça | Ficheiro |
|------|----------|
| Catálogo | `lib/billing/catalog.ts` |
| Entitlements | `lib/billing/company-entitlements.ts` |
| Checkout interno | `lib/billing/checkout.ts` |
| Stripe | `lib/billing/stripe-client.ts`, `stripe-ops.ts`, `stripe-fees.ts` |
| Comissões | `lib/billing/commissions.ts` |
| Renovação | `lib/billing/renew.ts` |
| APIs | `/api/billing/subscription`, `/invoices`, `/commissions`, `/renew`, `/stripe/webhook` |
| UI | `/hub/billing` · `components/etholys-admin/BillingConsole.tsx` |
| SQL | `prisma/migrations/manual_billing_commerce.sql`, `manual_billing_stripe.sql` |
