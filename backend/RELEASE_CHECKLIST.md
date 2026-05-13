# Etholys API - Release Checklist

Use esta lista antes de publicar uma nova versao para clientes.

## 1) Preparacao

- Atualizar versao da API em `main.py`.
- Revisar mudancas da release e impacto em clientes.
- Confirmar que `backend/.env.example` contem todas as variaveis necessarias.

## 2) Validacao tecnica

- Subir stack limpa: `cd backend && docker compose up -d --build`.
- Verificar `GET /health` retorna `status=ok`.
- Verificar `GET /health/ready` com todos os checks em `ok=true`.
- Confirmar que nao ha alteracao retroativa em migracoes ja aplicadas (`backend/migrations/*.sql`).
- Se houver mudanca de schema, criar nova migration incremental.
- Rodar smoke test: `python smoke_test.py`.
- Conferir que `/docs` carrega sem erro.
- Validar observabilidade sem erro:
	- `GET /api-product/clients/{id}/usage-alerts/metrics?days=30` retorna 200 e inclui `slo_success_rate_percent`.
	- `GET /api-product/usage-alerts/metrics?days=30&client_id=<id>` retorna 200 (sem 500 por filtro nulo/opcional).
	- `GET /api-product/usage-alerts/trend?days=30&client_id=<id>` retorna 200 e payload de lista.

## 2.1) Validacao de limites (go/no-go)

- Criar cliente de teste com `rpm_limit` baixo (ex.: 10).
- Executar rajada curta (ex.: 30 chamadas em `/api-product/me`).
- Confirmar mistura de respostas `200` e `429` (enforcement de RPM).
- Criar cliente de teste com `monthly_request_limit` baixo (ex.: 5) e `rpm_limit` alto.
- Executar chamadas acima da cota mensal.
- Confirmar mistura de respostas `200` e `402` (hard cap mensal).
- Registrar evidencias no changelog interno da release (comando, timestamp e agregados de status).

## 3) Fluxo comercial minimo

- Criar cliente: `POST /api-product/clients` com `X-Admin-Token`.
- Validar chave nova em `GET /api-product/me`.
- Validar limite em `GET /api-product/usage/current`.
- Testar rotacao: `POST /api-product/clients/{id}/rotate-key`.
- Confirmar chave antiga invalida e nova chave valida.

## 4) Entrega

- Registrar changelog da release.
- Versionar imagem/container publicada.
- Compartilhar guia de instalacao: `backend/README.md`.
- Compartilhar guia de operacao comercial: `backend/API_PRODUCT.md`.
- Criar tag de release no formato `api-vX.Y.Z` para publicar imagem no GHCR.
- Validar workflow `.github/workflows/backend-publish.yml` verde.
- Validar release notes geradas automaticamente no GitHub.

## 5) Pos-release

- Monitorar logs das primeiras instalacoes.
- Validar alertas de indisponibilidade da API.
- Monitorar taxa de erro dos webhooks de uso (`failed`, `pending`) nas primeiras 24h.
- Monitorar `slo_success_rate_percent` e p95/p99 de entrega de webhook nas primeiras 24h.
- Registrar feedback dos primeiros clientes para proxima iteracao.
- Testar fluxo de upgrade com `upgrade-docker.ps1`/`upgrade-docker.sh`.
- Gerar pacote offline com `package-offline.ps1`/`package-offline.sh` para distribuicao.
- Verificar checksum do pacote com `verify-offline.ps1`/`verify-offline.sh`.
- Executar teste de restore com `restore-backup.ps1`/`restore-backup.sh`.
- Confirmar equipa com acesso ao runbook: `backend/RUNBOOK.md`.

## 6) Evidencia da ultima validacao

Preencher este bloco no dia da release para aprovar go/no-go.

- Data: 2026-05-12
- Smoke test: PASS
- Health/readiness: PASS
- Observabilidade:
	- `/api-product/clients/{id}/usage-alerts/metrics`: PASS
	- `/api-product/usage-alerts/metrics`: PASS
	- `/api-product/usage-alerts/trend`: PASS
- Enforcement de limites:
	- RPM burst (30 requests, `rpm_limit=10`): `200=10`, `429=20`
	- Latencia burst: `avg=28.57ms`, `p95=60.73ms`
	- Monthly cap (12 requests, `monthly_request_limit=5`): `200=5`, `402=7`
- Decisao: GO
