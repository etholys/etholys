#Requires -Version 5.1
<#
  Backup lógico do Postgres (Docker etholys-postgres).
  Na raiz do repositório Etholys:
    powershell -ExecutionPolicy Bypass -File scripts/backup-postgres.ps1

  Gera: backups/etholys-YYYYMMDD-HHMMSS.sql
  Copie os .sql para outro disco / nuvem periodicamente.
#>
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$BackupDir = Join-Path $RepoRoot "backups"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$running = docker ps --filter "name=etholys-postgres" --format "{{.Names}}" 2>$null
if (-not $running) {
  Write-Error "Contentor 'etholys-postgres' não está a correr. Arranque: docker compose -f infra/docker-compose.yml up -d postgres"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $BackupDir "etholys-$stamp.sql"

Write-Host "A fazer dump para $out ..."
docker exec etholys-postgres pg_dump -U etholys etholys --no-owner | Out-File -FilePath $out -Encoding utf8
if (-not (Test-Path $out) -or ((Get-Item $out).Length -lt 100)) {
  Write-Error "Dump falhou ou ficou vazio. Verifique o contentor e a base 'etholys'."
}
Write-Host "OK ($( [math]::Round((Get-Item $out).Length / 1KB, 1) ) KB). Guarde uma cópia fora deste PC."
