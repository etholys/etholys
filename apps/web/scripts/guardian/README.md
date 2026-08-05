# Guardião Etholys

Sentinela de segurança do repositório. Lê o código como um revisor de segurança e escreve um
relatório com o que está exposto, ordenado por gravidade.

O Guardião **avisa e explica**; não corrige nada sozinho. A correção é sempre decidida por uma
pessoa — segurança automática sem supervisão costuma abrir buracos novos em vez de fechar os antigos.

## Como usar

```bash
cd apps/web

npm run guardian            # relatório completo
npm run guardian:new        # apenas achados novos (fora da baseline); falha se houver alto/crítico
npm run guardian:baseline   # aceita o estado atual como dívida conhecida
```

Saída:

- `.guardian/report.md` — relatório legível, agrupado por gravidade
- `.guardian/findings.json` — mesmos dados em JSON (para dashboards ou outro agente)

Opções: `--rule <id>` limita a uma área, `--json` imprime JSON, `--fail-on critical|high|medium|low`
define a partir de que gravidade o processo termina com erro (usado no CI).

## O que verifica

| Área (`--rule`) | Procura |
| --- | --- |
| `secrets` | ficheiros `.env`/chaves versionados no git, credenciais no código, passwords por omissão |
| `api-auth` | rotas em `app/api/**` que não validam sessão nem token |
| `tenant-isolation` | consultas a dados de empresa sem filtro `companyId`, acessos só por `id`, links-capacidade |
| `platform-hardening` | headers de segurança, prazo de sessão, ligação de contas sociais, guardas que falham "abertas" |
| `rate-limit` | login, convites, email, IA e partilhas públicas sem limite de pedidos |
| `dangerous-code` | SQL cru, `eval`, shell interpolado, CORS `*`, TLS desligado, tokens com `Math.random`, hash fraco |
| `data-protection` | uploads sem validação, webhooks sem assinatura, ausência de auditoria, tokens OAuth em claro, dados para o LLM, retenção |

## Baseline

`baseline.json` guarda a lista de achados já conhecidos. Serve para o CI travar **regressões novas**
sem bloquear o desenvolvimento por causa da dívida existente. Ao corrigir achados, voltar a correr
`npm run guardian:baseline` para a baseline refletir o novo (melhor) estado.

## Como acrescentar uma regra

Criar `rules/<id>.mjs` que exporta `{ id, title, run(ctx) }` e registá-la em `index.mjs`.
`run` devolve achados: `{ severity, file, line?, key, message, hint?, details? }`.

- `severity`: `critical` | `high` | `medium` | `low`
- `key`: identificador estável do problema (sem número de linha) — é o que a baseline compara
- `message`: explica o risco em linguagem simples, não só o nome da regra

O contexto (`ctx`) já fornece os ficheiros versionados, as rotas de API, os modelos Prisma com
`companyId` e a lista de guardas de autenticação detetados em `lib/` (incluindo cadeias como
`requireForgeTenant` → `getUserCompanyIds` → `getServerSession`).
