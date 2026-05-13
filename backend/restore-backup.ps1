Param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path $BackupFile)) {
  throw "Backup não encontrado: $BackupFile"
}

$running = docker compose ps --services --filter status=running | Where-Object { $_ -eq "postgres" }
if (-not $running) {
  throw "Serviço postgres não está em execução. Rode: docker compose up -d postgres"
}

Write-Host "[restore] restaurando backup: $BackupFile"
Get-Content -Path $BackupFile -Raw | docker compose exec -T postgres psql -U etholys -d etholys

Write-Host "[restore] concluído"
