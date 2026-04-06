# Aplica db/migrations/001_initial.sql no Postgres do docker-compose (infra/).
# Uso: na raiz do repositório Etholys/, defina $env:DATABASE_URL ou edite a linha abaixo.
param(
  [string] $DatabaseUrl = $env:DATABASE_URL
)
$ErrorActionPreference = "Stop"
if (-not $DatabaseUrl) {
  $DatabaseUrl = "postgresql://etholys:etholys_dev_change_me@localhost:5433/etholys"
}
$etholysRoot = Split-Path -Parent $PSScriptRoot
$sql = Join-Path $etholysRoot "db\migrations\001_initial.sql"
if (-not (Test-Path $sql)) { throw "Arquivo nao encontrado: $sql" }
# Requer psql no PATH (cliente PostgreSQL) ou use: docker exec -i etholys-postgres psql -U etholys -d etholys < arquivo.sql
& psql $DatabaseUrl -f $sql
