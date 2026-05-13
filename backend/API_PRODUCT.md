# Etholys API Product - Operacao Comercial

Este backend agora suporta um fluxo minimo para comercializacao:

- Autenticacao por API key (`X-API-Key`)
- Rate limit por cliente (requests por minuto)
- Provisionamento de clientes via endpoint admin
- Endpoints para auto-servico de cliente (perfil e uso)

## 1) Configuracao obrigatoria

Para instalacao portavel em qualquer sistema (Docker e local), veja `backend/README.md`.

Defina no ambiente do backend:

- `API_ADMIN_TOKEN` (necessario para criar/desativar clientes)
- `API_DEFAULT_RPM_LIMIT` (opcional, default: `60`)

Exemplo:

```bash
API_ADMIN_TOKEN=troque-por-um-token-forte
API_DEFAULT_RPM_LIMIT=120
```

## 2) Criar cliente de API (admin)

Endpoint:

- `POST /api-product/clients`

Headers:

- `X-Admin-Token: <API_ADMIN_TOKEN>`

Body exemplo:

```json
{
  "name": "Cliente ACME",
  "plan": "pro",
  "rpm_limit": 300,
  "monthly_request_limit": 50000,
  "usage_webhook_url": "https://cliente.example.com/webhooks/etholys-usage",
  "usage_webhook_secret": "super-secret-signing-key",
  "scopes": "ai:read,ai:write,usage:read",
  "expires_at": "2027-01-01T00:00:00Z"
}
```

Resposta (a chave aparece somente nesta criacao):

```json
{
  "id": "...",
  "name": "Cliente ACME",
  "plan": "pro",
  "rpm_limit": 300,
  "api_key": "eth_..."
}
```

## 3) Consumir endpoints protegidos

Use a chave do cliente no header:

- `X-API-Key: eth_...`

Endpoints protegidos atuais:

- Todos de `/ai/*`
- `GET /api-product/me`
- `GET /api-product/usage/current`

Headers de rate limit retornados em cada resposta autenticada:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (epoch seconds)
- `X-MonthlyLimit`
- `X-MonthlyUsage`
- `X-MonthlyRemaining`
- `X-API-Key-Id`
- `X-API-Key-Name`
- `X-API-Key-Expires-At` (quando a chave tem expiracao)
- `X-API-Key-Expiry-Warning` (quando perto da expiracao)
- `X-API-Client-Id`
- `X-Request-ID`

## 4) Operacao de ciclo de vida

Admin:

- `GET /api-product/clients` lista clientes
- `POST /api-product/clients/{client_id}/deactivate` desativa chave
- `PATCH /api-product/clients/{client_id}` atualiza plano, rpm e status
- `POST /api-product/clients/{client_id}/rotate-key` gira a chave (retorna nova key)
- `GET /api-product/clients/{client_id}/keys` lista chaves do cliente
- `POST /api-product/clients/{client_id}/keys` cria chave adicional (retorna key em texto puro uma unica vez)
- `POST /api-product/clients/{client_id}/keys/{key_id}/revoke` revoga uma chave especifica
- `GET /api-product/clients/{client_id}/usage/summary?days=30` resumo de consumo
- `GET /api-product/clients/{client_id}/usage-alerts?limit=100` historico de entregas de alertas
- `POST /api-product/clients/{client_id}/usage-alerts/retry?limit=50` reprocessa alertas com falha
- `GET /api-product/clients/{client_id}/usage-alerts/metrics?days=30` metricas de entrega (sucesso/falha/pendente/http classes/p50-p95-p99/slo_success_rate_percent)
- `GET /api-product/usage-alerts/metrics?days=30&plan=pro&client_id=<uuid>` metricas globais com filtros opcionais (inclui slo_success_rate_percent, percentis de latencia)
- `GET /api-product/usage-alerts/top-failing-clients?days=30&limit=10` ranking de clientes com mais falhas de webhook
- `GET /api-product/usage-alerts/trend?days=30&plan=pro&client_id=<uuid>` tendencia diaria (total/sent/failed/pending/http_2xx/http_4xx/http_5xx)

Limites de chaves ativas por plano:

- `starter`: 2
- `pro`: 5
- `enterprise`: 20
- Outros planos: 3

Cliente:

- `GET /api-product/me` dados do plano
- `GET /api-product/usage/current` consumo da janela atual
- `GET /api-product/usage/summary?days=30` consumo agregado por periodo
- `GET /api-product/request-logs?limit=100` auditoria recente por requisicao

Admin adicional:

- `GET /api-product/clients/{client_id}/request-logs?limit=100` auditoria por cliente
- `DELETE /api-product/admin/request-logs/purge?older_than_days=90` purga logs antigos

Exemplo `PATCH /api-product/clients/{client_id}`:

```json
{
  "plan": "enterprise",
  "rpm_limit": 1200,
  "monthly_request_limit": 300000,
  "usage_webhook_url": "https://cliente.example.com/webhooks/etholys-usage",
  "usage_webhook_secret": "novo-secret",
  "clear_usage_webhook_secret": false,
  "is_active": true,
  "scopes": "ai:read,usage:read",
  "expires_at": "2027-12-31T23:59:59Z",
  "clear_expires_at": false
}
```

Escopos atuais:

- `ai:read` (listar conversas/mensagens)
- `ai:write` (enviar mensagem em `/ai/chat`)
- `usage:read` (uso, perfil e logs)
- `*` (todos os escopos)

Exemplo resposta `usage/summary`:

```json
{
  "days": 30,
  "total_period": 12650,
  "total_last_24h": 830,
  "total_current_month": 10980,
  "by_day": [
    { "day": "2026-05-01", "requests": 321 },
    { "day": "2026-05-02", "requests": 507 }
  ]
}
```

## 5) Observacoes para venda

- O limitador atual e por minuto (RPM) e por chave.
- Limite mensal opcional pode bloquear consumo com status `402` quando excedido.
- Alertas de consumo mensal sao enviados por webhook ao atingir limiares configurados (default: `80,90,100`).
- Assinatura HMAC SHA-256 e enviada em `X-Etholys-Signature` quando `usage_webhook_secret` estiver configurado.
- Entregas falhas entram em retry automatico com backoff exponencial, respeitando limite maximo de tentativas.
- Metricas por cliente permitem acompanhar taxa de sucesso de entrega por periodo.
- Metricas incluem breakdown de HTTP por classe (`2xx`, `4xx`, `5xx` e outros).
- Metricas globais permitem filtro por plano e cliente para analise segmentada.
- Metricas agregadas incluem percentis de latencia de entrega (`p50`, `p95`, `p99`).
- Uso e salvo em buckets por minuto na tabela `api_usage_minute`.
- A chave nunca e salva em texto puro, somente hash SHA-256 em `api_client.api_key_hash`.
- Rotacao de chave invalida imediatamente a chave anterior do cliente.
- Cliente pode ter multiplas chaves ativas para separacao por integracao/ambiente.
- Chaves individuais podem ser revogadas sem interromper outras integracoes do mesmo cliente.
- Criacao de chave adicional acima do limite do plano retorna `409`.
- Requisicoes autenticadas recebem `X-Request-ID` para rastreio em suporte e auditoria.
- Chave pode ser limitada por escopos e data de expiracao (`expires_at`).

## 6) Kit de integracao para terceiros

Artefatos prontos para consumo por outros sistemas:

- Contrato OpenAPI: `backend/integrations/openapi/etholys-openapi.json`
- Guia de integracao: `backend/INTEGRATION_GUIDE.md`
- Exemplos executaveis: `backend/integrations/examples/`

Atualizacao do contrato OpenAPI:

```bash
python export_openapi.py
```
