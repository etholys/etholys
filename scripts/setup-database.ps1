# Etholys: sobe o Postgres e cria todas as tabelas. Precisa do Docker Desktop rodando.
# Clique com botao direito -> "Executar com PowerShell" OU na raiz Etholys: .\scripts\setup-database.ps1

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Find-Docker {
  if (Get-Command docker -ErrorAction SilentlyContinue) { return "docker" }
  $candidates = @(
    "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\resources\bin\docker.exe"
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

$docker = Find-Docker
if (-not $docker) {
  Write-Host ""
  Write-Host "Docker nao encontrado. Faca o seguinte:" -ForegroundColor Yellow
  Write-Host "  1) Instale o Docker Desktop para Windows"
  Write-Host "  2) Abra o Docker Desktop e espere ficar verde (Running)"
  Write-Host "  3) Feche e abra o PowerShell de novo (ou reinicie o PC)"
  Write-Host "  4) Execute este script outra vez"
  Write-Host ""
  Read-Host "Pressione Enter para fechar"
  exit 1
}

$etholysRoot = Split-Path -Parent $PSScriptRoot
$infraDir = Join-Path $etholysRoot "infra"
$sqlFile = Join-Path $etholysRoot "db\migrations\001_initial.sql"

if (-not (Test-Path $sqlFile)) {
  Write-Host "Arquivo nao encontrado: $sqlFile" -ForegroundColor Red
  Read-Host "Pressione Enter para fechar"
  exit 1
}

Write-Host "Usando Docker: $docker" -ForegroundColor Cyan
Write-Host "Subindo apenas PostgreSQL (pode demorar na primeira vez)..." -ForegroundColor Cyan
Push-Location $infraDir
try {
  & $docker compose up -d postgres
  if ($LASTEXITCODE -ne 0) { throw "docker compose falhou" }
} finally {
  Pop-Location
}

Write-Host "Aguardando o banco aceitar conexoes..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  $out = & $docker exec etholys-postgres pg_isready -U etholys -d etholys 2>&1
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) {
  Write-Host "O Postgres nao respondeu a tempo. Veja se o container 'etholys-postgres' esta rodando no Docker Desktop." -ForegroundColor Red
  Read-Host "Pressione Enter para fechar"
  exit 1
}

$checkSql = "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User' LIMIT 1;"
$already = & $docker exec etholys-postgres psql -U etholys -d etholys -tAc $checkSql 2>$null
if ($already -match "1") {
  Write-Host "O banco ja tem as tabelas (tabela User encontrada). Nada a fazer no SQL." -ForegroundColor Green
  $envExample = Join-Path $etholysRoot ".env.example"
  $envTarget = Join-Path $etholysRoot ".env"
  if (-not (Test-Path $envTarget) -and (Test-Path $envExample)) {
    Copy-Item -LiteralPath $envExample -Destination $envTarget
    Write-Host "Arquivo .env criado a partir de .env.example" -ForegroundColor Green
  }
  Write-Host ""
  Write-Host "Conexao: localhost:5433  |  banco: etholys  |  usuario: etholys" -ForegroundColor Cyan
  Read-Host "Pressione Enter para fechar"
  exit 0
}

Write-Host "Criando tabelas (aplicando SQL)..." -ForegroundColor Cyan
Get-Content -LiteralPath $sqlFile -Raw -Encoding UTF8 | & $docker exec -i etholys-postgres psql -U etholys -d etholys -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Erro ao aplicar o SQL. Se voce ja tinha rodado este script antes, o banco pode ja existir; nesse caso, apague o volume no Docker ou use outro nome de banco." -ForegroundColor Red
  Read-Host "Pressione Enter para fechar"
  exit 1
}

# .env para ferramentas / Prisma depois
$envExample = Join-Path $etholysRoot ".env.example"
$envTarget = Join-Path $etholysRoot ".env"
if (-not (Test-Path $envTarget) -and (Test-Path $envExample)) {
  Copy-Item -LiteralPath $envExample -Destination $envTarget
  Write-Host "Arquivo .env criado a partir de .env.example" -ForegroundColor Green
}

Write-Host ""
Write-Host "Pronto. O banco esta em:" -ForegroundColor Green
Write-Host "  Host: localhost   Porta: 5433   Banco: etholys   Usuario: etholys" -ForegroundColor White
Write-Host "  Senha: etholys_dev_change_me  (troque em producao)" -ForegroundColor DarkGray
Write-Host ""
Read-Host "Pressione Enter para fechar"
