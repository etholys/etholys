# Etholys API - Runbook Operacional

Este runbook centraliza procedimentos de operacao, incidente e recuperacao.

## 1) Dados basicos do servico

- Stack: Docker Compose no diretorio `backend/`
- API: http://localhost:8000
- Health: `/health`
- Readiness: `/health/ready`
- Docs: `/docs`

## 2) Comandos essenciais

No diretorio `backend/`.

Subir/atualizar stack:

```bash
docker compose up -d --build
```

Ver status:

```bash
docker compose ps
```

Ver logs API:

```bash
docker compose logs -f api
```

Parar stack:

```bash
docker compose down
```

## 3) Checklist de saude rapida (5 min)

1. `GET /health` retorna `status=ok`.
2. `GET /health/ready` com:
   - `checks.database.ok=true`
   - `checks.ai_provider.ok=true`
   - `checks.api_admin.ok=true`
3. `python smoke_test.py` conclui sem erro.
4. `python preflight_check.py docker` retorna OK.
5. `GET /api-product/usage-alerts/metrics?days=30` retorna 200.
6. `GET /api-product/usage-alerts/trend?days=30` retorna 200.

## 3.1) Validacao de limites (10 min)

Objetivo: confirmar enforcement de contrato comercial antes de go-live.

1. Criar cliente de teste com `rpm_limit` baixo (ex.: 10).
2. Fazer rajada curta (ex.: 30 chamadas em `/api-product/me`).
3. Confirmar respostas com `429` apos estourar o RPM.
4. Criar cliente de teste com `monthly_request_limit` baixo (ex.: 5) e `rpm_limit` alto.
5. Fazer chamadas acima da cota mensal.
6. Confirmar respostas com `402` apos estourar limite mensal.
7. Guardar evidencia (timestamp + agregacao de status) no registro operacional.

## 4) Procedimento de upgrade seguro

Windows:

```powershell
./upgrade-docker.ps1
```

Linux/macOS:

```bash
./upgrade-docker.sh
```

Fluxo executado:

1. Gera backup SQL em `backend/backups/`.
2. Rebuild/restart da stack.
3. Roda smoke test.

## 5) Procedimento de backup manual

Backup manual (compose backend):

```bash
docker compose exec -T postgres pg_dump -U etholys etholys --no-owner > backups/manual-YYYYMMDD-HHMMSS.sql
```

Validar se arquivo nao esta vazio antes de guardar externamente.

## 6) Procedimento de restore

Windows:

```powershell
./restore-backup.ps1 -BackupFile .\backups\api-upgrade-YYYYMMDD-HHMMSS.sql
```

Linux/macOS:

```bash
./restore-backup.sh ./backups/api-upgrade-YYYYMMDD-HHMMSS.sql
```

Apos restore:

1. Verificar `/health`.
2. Verificar `/health/ready`.
3. Rodar `python smoke_test.py`.

## 7) Rollback rapido

Use quando upgrade falhar ou regressao for confirmada.

1. Identificar ultimo backup valido em `backups/`.
2. Recriar stack com versao anterior da imagem/codigo.
3. Executar restore do backup valido.
4. Rodar checklist de saude rapida.

## 8) Incidentes comuns e resposta

### API indisponivel

1. `docker compose ps`
2. `docker compose logs -f api`
3. Validar porta 8000 livre no host
4. Reiniciar stack: `docker compose up -d --build`

### Banco indisponivel

1. `docker compose logs -f postgres`
2. Validar volume e espaco em disco
3. Validar credenciais em `.env`
4. Se necessario, restore do backup

### Readiness falhando em AI provider

1. Confirmar `AI_PROVIDER`
2. Confirmar chave/token correspondente no `.env`
3. Recriar stack: `docker compose up -d --build`

### Erro de schema/migracao

1. Verificar logs da API
2. Confirmar arquivos em `backend/migrations/`
3. Nao editar migration antiga aplicada
4. Criar nova migration incremental

## 9) Integridade de pacote offline

Gerar pacote:

- Windows: `./package-offline.ps1`
- Linux/macOS: `./package-offline.sh`

Verificar checksum:

- Windows: `./verify-offline.ps1 -ArchivePath <arquivo>`
- Linux/macOS: `./verify-offline.sh <arquivo>`

## 10) Escalonamento

Escalar para engenharia quando houver:

1. Falha recorrente apos restore/rollback.
2. Corrupcao de dados suspeita.
3. Inconsistencia entre `health` e `health/ready` persistente.
4. Falha de migracao com checksum mismatch.

## 11) Evidencias minimas para suporte

Coletar e anexar:

1. Saida de `docker compose ps`.
2. Ultimas 200 linhas de `docker compose logs api` e `postgres`.
3. Resultado de `/health/ready`.
4. Resultado de `/api-product/usage-alerts/metrics?days=30` (quando incidente for de alerta/observabilidade).
5. Timestamp da ocorrencia e acao executada.
6. `X-Request-ID` da requisicao afetada, quando disponivel.

## 12) Auditoria por cliente

Cliente autenticado:

- `GET /api-product/request-logs?limit=100`

Admin:

- `GET /api-product/clients/{client_id}/request-logs?limit=100`
