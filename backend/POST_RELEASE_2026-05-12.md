# Post-Release Verification - 2026-05-12

## Resultado

- Status geral: concluido com sucesso.
- Release/tag validada: api-v0.4.1.
- Pipeline de publicacao: sucesso.

## Evidencias objetivas

- Tag remota existente: refs/tags/api-v0.4.1.
- Workflow run: 25774856611.
- Workflow status: completed.
- Workflow conclusion: success.
- Workflow URL: https://github.com/etholys/etholys/actions/runs/25774856611
- Release URL: https://github.com/etholys/etholys/releases/tag/api-v0.4.1
- Release draft: false.
- Release prerelease: false.

## Checkpoint tecnico

- Smoke test: PASS (validado na etapa de release).
- Health/readiness: PASS (validado na etapa de release).
- Observabilidade (/metrics e /trend): PASS apos ajuste de casts SQL para filtros opcionais.
- Enforcement de limites: PASS com evidencias 200/429 e 200/402 na validacao anterior.

## Revalidacao local adicional

- Data/hora: 2026-05-12.
- Smoke inicial sem token no ambiente: PASS parcial (saude OK, fluxo comercial pulado).
- Smoke com API_ADMIN_TOKEN carregado de `.env`: PASS completo.
- Endpoints comerciais/observabilidade revalidados no smoke:
	- `/api-product/clients`
	- `/api-product/me`
	- `/api-product/usage/current`
	- `/api-product/clients/{id}/usage-alerts/metrics`
	- `/api-product/usage-alerts/metrics`
	- `/api-product/usage-alerts/trend`
- Rotacao/revogacao de chave: PASS (criar chave adicional, autenticar, revogar, bloquear chave revogada).

## Monitoramento recomendado (primeiras 24h)

- Acompanhar taxa de webhook com status failed/pending.
- Acompanhar slo_success_rate_percent por cliente e global.
- Acompanhar p95/p99 de entrega de webhook.
- Confirmar ausencia de 500 em /api-product/usage-alerts/metrics e /api-product/usage-alerts/trend.
- Registrar qualquer incidente com timestamp, X-Request-ID e impacto.

## Risco residual atual

- Workspace com muitas alteracoes nao relacionadas fora do backend; evitar commit amplo sem curadoria.
