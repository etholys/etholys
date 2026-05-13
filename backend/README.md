# Etholys API - Instalacao Portavel

Este backend pode ser instalado em qualquer sistema com duas opcoes:

- Docker (recomendado para ambiente padrao)
- Python local (venv)

## Requisitos

- Docker 24+ e Docker Compose v2 (opcao Docker)
- OU Python 3.12+ e pip (opcao local)

## 1) Configuracao

No diretorio `backend/`:

1. Copie `.env.example` para `.env`
2. Preencha ao menos:
   - `AI_PROVIDER`
   - credencial do provider escolhido (`GEMINI_API_KEY` ou `OPENAI_API_KEY`)
   - `API_ADMIN_TOKEN`

Os scripts de instalacao/upgrade executam `preflight_check.py` automaticamente antes de subir a stack.

## 2) Rodar com Docker (Linux/Windows/macOS)

No diretorio `backend/`:

### One-shot (recomendado)

Windows PowerShell:

```powershell
./install-docker.ps1
```

Linux/macOS:

```bash
chmod +x ./install-docker.sh
./install-docker.sh
```

### Comando manual

```bash
docker compose up -d --build
```

Endpoints:

- API docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- Readiness: `http://localhost:8000/health/ready`

Parar:

```bash
docker compose down
```

## 3) Rodar local com Python

### Windows (PowerShell)

```powershell
./start-api.ps1
```

### Linux/macOS

```bash
chmod +x ./start-api.sh
./start-api.sh
```

## 4) Teste rapido de produto (API para venda)

1. Criar cliente (admin):

```bash
curl -X POST "http://localhost:8000/api-product/clients" \
  -H "X-Admin-Token: SEU_API_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cliente Demo","plan":"starter","rpm_limit":120}'
```

2. Usar chave retornada em `X-API-Key` para chamar `/ai/chat`.

Observacao: um cliente pode ter multiplas chaves ativas (por ambiente/integracao) via endpoints admin em `/api-product/clients/{client_id}/keys`.

## 5) Smoke test automatizado

Com a API no ar:

```bash
python smoke_test.py
```

Variaveis opcionais para o smoke:

- `ETHOLYS_API_URL` (default: `http://127.0.0.1:8000`)
- `API_ADMIN_TOKEN` (se definido, valida tambem o fluxo comercial)

CI:

- Workflow GitHub Actions: `.github/workflows/backend-smoke.yml`

## 5.1) Preflight manual (opcional)

Docker:

```bash
python preflight_check.py docker
```

Local:

```bash
python preflight_check.py local
```

## 6) Upgrade seguro (Docker)

Windows PowerShell:

```powershell
./upgrade-docker.ps1
```

Linux/macOS:

```bash
chmod +x ./upgrade-docker.sh
./upgrade-docker.sh
```

O fluxo faz:

- backup logico do banco
- rebuild/restart da stack
- smoke test automatico

## 7) Pacote offline para cliente

Windows PowerShell:

```powershell
./package-offline.ps1
```

Linux/macOS:

```bash
chmod +x ./package-offline.sh
./package-offline.sh
```

Saida:

- Windows: `backend/dist/etholys-api-offline-<timestamp>.zip`
- Linux/macOS: `backend/dist/etholys-api-offline-<timestamp>.tar.gz`
- Checksum: arquivo `.sha256` ao lado do pacote

Verificacao de integridade:

Windows PowerShell:

```powershell
./verify-offline.ps1 -ArchivePath .\dist\seu-arquivo.zip
```

Linux/macOS:

```bash
chmod +x ./verify-offline.sh
./verify-offline.sh ./dist/seu-arquivo.tar.gz
```

## 8) Restore de backup

Windows PowerShell:

```powershell
./restore-backup.ps1 -BackupFile .\backups\api-upgrade-YYYYMMDD-HHMMSS.sql
```

Linux/macOS:

```bash
chmod +x ./restore-backup.sh
./restore-backup.sh ./backups/api-upgrade-YYYYMMDD-HHMMSS.sql
```

## 9) Variaveis importantes

- `DATABASE_URL`: conexao Postgres
- `APP_HOST`, `APP_PORT`: bind da API
- `CORS_ALLOW_ORIGINS`: lista separada por virgula ou `*`
- `DB_CONNECT_MAX_RETRIES`, `DB_CONNECT_RETRY_DELAY_SECONDS`: robustez no startup
- `API_ADMIN_TOKEN`: autorizacao endpoints admin de produto
- `API_DEFAULT_RPM_LIMIT`: limite default por cliente
- `API_KEY_EXPIRY_WARNING_DAYS`: janela (dias) para header de alerta de expiracao de chave
- `API_USAGE_ALERT_THRESHOLDS`: limiares percentuais de alerta mensal (ex.: `80,90,100`)
- `API_USAGE_WEBHOOK_TIMEOUT_SECONDS`: timeout de entrega do webhook de alerta
- `API_USAGE_WEBHOOK_RETRY_BASE_MINUTES`: base do backoff exponencial para retries automaticos
- `API_USAGE_WEBHOOK_MAX_RETRIES`: maximo de tentativas por alerta
- `API_USAGE_WEBHOOK_AUTO_RETRY_PER_REQUEST`: quantidade de retries vencidos processados por requisicao autenticada

## 10) Observacoes de portabilidade

- O container da API agora inclui o codigo dentro da imagem (nao depende de bind mount).
- O startup tem retry de conexao com banco para ambientes lentos.
- Migracoes versionadas sao aplicadas automaticamente no startup (`backend/migrations/*.sql`).
- O endpoint `/health/ready` mostra checks criticos de instalacao.

## 11) Release

Checklist de release/distribuicao: `backend/RELEASE_CHECKLIST.md`.

Publicacao de imagem versionada (GHCR):

- Workflow: `.github/workflows/backend-publish.yml`
- Disparo por tag Git: `api-v*` (exemplo: `api-v0.4.0`)
- O workflow gera release notes automaticamente no GitHub

## 12) Operacao e Incidentes

Runbook unificado: `backend/RUNBOOK.md`.
