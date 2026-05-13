$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Arquivo .env criado a partir de .env.example"
}

python preflight_check.py docker
if ($LASTEXITCODE -ne 0) {
  throw "Preflight check failed"
}

$backupDir = Join-Path $PSScriptRoot "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupDir "api-upgrade-$stamp.sql"

Write-Host "[upgrade] backup do banco em $backupFile"
docker compose exec -T postgres pg_dump -U etholys etholys --no-owner | Out-File -FilePath $backupFile -Encoding utf8
if (-not (Test-Path $backupFile) -or ((Get-Item $backupFile).Length -lt 100)) {
  throw "Backup vazio ou falhou"
}

Write-Host "[upgrade] rebuild e restart"
docker compose up -d --build

$adminTokenLine = Get-Content .env | Where-Object { $_ -match '^API_ADMIN_TOKEN=' } | Select-Object -First 1
$adminToken = ""
if ($adminTokenLine) {
  $adminToken = ($adminTokenLine -replace '^API_ADMIN_TOKEN=', '').Trim()
}

Write-Host "[upgrade] smoke test"
$env:ETHOLYS_API_URL = "http://127.0.0.1:8000"
if ($adminToken) { $env:API_ADMIN_TOKEN = $adminToken }
python smoke_test.py

Write-Host "[upgrade] concluido com sucesso"
