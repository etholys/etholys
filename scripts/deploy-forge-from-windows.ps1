#Requires -Version 5.1
<#
  Git commit + push + deploy FORGE no servidor Hetzner.
  Uso: duplo clique em DEPLOY-FORGE.bat (raiz do repo)
#>
param(
  [string]$Message = '',
  [ValidateSet('auto', 'full', 'quick', 'git-only')]
  [string]$DeployMode = 'auto',
  [switch]$SkipCommit
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$configPath = Join-Path $PSScriptRoot 'deploy-forge.config.ps1'
$cfg = @{
  SshHost    = '84.247.187.155'
  SshUser    = 'root'
  RemoteRepo = '/opt/etholys'
  SshKeyPath = ''
  GitBranch  = 'main'
}
if (Test-Path $configPath) {
  . $configPath
  if ($DeployForge) {
    foreach ($key in $DeployForge.Keys) { $cfg[$key] = $DeployForge[$key] }
  }
}

function Write-Step([string]$Text) {
  Write-Host ''
  Write-Host ('=== ' + $Text + ' ===') -ForegroundColor Cyan
}

function Test-Command([string]$Name) {
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Git([string[]]$GitArgs) {
  & git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    throw ('git ' + ($GitArgs -join ' ') + ' falhou (codigo ' + $LASTEXITCODE + ')')
  }
}

function Get-SshBaseArgs() {
  $sshOpts = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=45', '-o', 'ServerAliveInterval=15')
  if ($cfg.SshKeyPath -and (Test-Path $cfg.SshKeyPath)) {
    $sshOpts += @('-i', $cfg.SshKeyPath)
  }
  return $sshOpts
}

function Test-SshReachable() {
  $target = $cfg.SshUser + '@' + $cfg.SshHost
  Write-Host ('Teste SSH a ' + $target + ' (ate 30s)...') -ForegroundColor DarkGray
  $pingArgs = @(Get-SshBaseArgs) + @('-o', 'ConnectTimeout=30') + $target, 'echo etholys-ssh-ok'
  & ssh @pingArgs 2>&1 | Out-Host
  return ($LASTEXITCODE -eq 0)
}

function Invoke-Remote([string]$RemoteCommand) {
  $target = $cfg.SshUser + '@' + $cfg.SshHost
  if (-not (Test-SshReachable)) {
    throw 'SSH inacessivel (timeout ou chave nao configurada).'
  }
  Write-Host ''
  Write-Host ('A executar no servidor: ' + $RemoteCommand) -ForegroundColor Cyan
  if ($RemoteCommand -match 'deploy-forge-web') {
    Write-Host 'Deploy completo pode demorar 10-20 minutos. Nao feche esta janela.' -ForegroundColor DarkGray
  }
  $sshArgs = @(Get-SshBaseArgs) + $target, $RemoteCommand
  & ssh @sshArgs
  if ($LASTEXITCODE -ne 0) { throw ('Comando remoto falhou (codigo ' + $LASTEXITCODE + ')') }
}

function Get-PorcelainPath([string]$Line) {
  if ($Line.Length -lt 4) { return '' }
  return $Line.Substring(3).Trim().Trim('"')
}

function Test-DeployExcludePath([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return $true }
  return $Path -match '\.lnk$|forge-deploy\.tar$|forge-ui\.tar$|^Deploy FORGE'
}

function Test-HasDeployableChanges() {
  $lines = & git status --porcelain
  foreach ($line in $lines) {
    $path = Get-PorcelainPath $line
    if (-not (Test-DeployExcludePath $path)) { return $true }
  }
  return $false
}

function Add-DeployableFiles() {
  $paths = @('apps/web', 'scripts', 'infra', 'DEPLOY-FORGE.bat', 'SETUP.bat', 'open-etholys-local.bat', 'open-etholys-dev-local.bat')
  foreach ($p in $paths) {
    if (Test-Path (Join-Path $Root $p)) {
      Invoke-Git @('add', '-A', '--', $p)
    }
  }
}

function Test-SecretStaged() {
  $staged = & git diff --cached --name-only 2>$null
  if (-not $staged) { return $false }
  $bad = $staged | Where-Object { $_ -match '(^|/)\.env(\.|$)|credentials|secret' }
  if ($bad) {
    Write-Host '[AVISO] Ficheiros sensiveis em staging - removidos do commit:' -ForegroundColor Yellow
    $bad | ForEach-Object { Write-Host ('  ' + $_); & git reset HEAD -- $_ 2>$null }
    return $true
  }
  return $false
}

Write-Host ''
Write-Host '  ETHOLYS - Deploy FORGE (git + servidor)' -ForegroundColor Green
Write-Host ('  Repo: ' + $Root)
Write-Host ''

if (-not (Test-Command git)) { throw 'Git nao encontrado no PATH.' }
if (-not (Test-Command ssh)) {
  throw 'OpenSSH nao encontrado. Ative o Cliente OpenSSH nas Funcionalidades do Windows.'
}

Write-Step 'Git status'
& git status -sb
$hasCodeChanges = Test-HasDeployableChanges
if (-not $hasCodeChanges) {
  Write-Host ''
  Write-Host 'Sem alteracoes de codigo para commitar (.lnk e .tar sao ignorados).' -ForegroundColor DarkGray
  Write-Host 'A seguir: push (se houver commits locais) e menu do servidor.' -ForegroundColor DarkGray
} elseif (-not $SkipCommit) {
  if (-not $Message) {
    $defaultMsg = 'chore(forge): atualizacao ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
    Write-Host ''
    Write-Host '>>> DIGITE a mensagem do commit e prima ENTER <<<' -ForegroundColor Yellow
    Write-Host ('    (ENTER vazio = usar: ' + $defaultMsg + ')') -ForegroundColor Yellow
    Write-Host ''
    $Message = Read-Host 'Mensagem do commit'
    if ([string]::IsNullOrWhiteSpace($Message)) { $Message = $defaultMsg }
  }
  Write-Step 'Commit'
  Add-DeployableFiles
  Test-SecretStaged | Out-Null
  $staged = & git diff --cached --name-only
  if ($staged) {
    Invoke-Git @('commit', '-m', $Message)
  } else {
    Write-Host 'Nada em staging para commitar.' -ForegroundColor Yellow
  }
} else {
  Write-Host 'SkipCommit: a saltar commit.' -ForegroundColor DarkGray
}

Write-Step ('Push origin/' + $cfg.GitBranch)
Invoke-Git @('push', 'origin', $cfg.GitBranch)

if ($DeployMode -eq 'git-only') {
  Write-Host ''
  Write-Host 'Concluido (so git, sem servidor).' -ForegroundColor Green
  exit 0
}

if ($DeployMode -eq 'auto') {
  Write-Host ''
  Write-Host '>>> SERVIDOR: digite 1, 2 ou 3 e prima ENTER <<<' -ForegroundColor Yellow
  Write-Host 'Servidor:' -ForegroundColor White
  Write-Host '  [1] Deploy completo (git pull + docker build) - 10-20 min'
  Write-Host '  [2] Rapido (git pull + restart, sem rebuild) - ~1 min'
  Write-Host '  [3] So git (ja feito push)'
  Write-Host ''
  $choice = Read-Host 'Escolha [1]'
  if ([string]::IsNullOrWhiteSpace($choice)) { $choice = '1' }
  switch ($choice) {
    '2' { $DeployMode = 'quick' }
    '3' { Write-Host 'Concluido.' -ForegroundColor Green; exit 0 }
    default { $DeployMode = 'full' }
  }
}

if ($DeployMode -eq 'quick') {
  $remoteScript = 'bash /opt/etholys/scripts/restore-forge-web.sh'
} else {
  $remoteScript = 'bash /opt/etholys/scripts/deploy-forge-web.sh'
}

Write-Step ('Servidor ' + $cfg.SshHost + ' - ' + $DeployMode)
try {
  Invoke-Remote $remoteScript
} catch {
  Write-Host ''
  Write-Host '[ERRO] Nao foi possivel ligar ao servidor ou o deploy falhou.' -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host ''
  Write-Host 'SSH nao responde. Use a consola web Hetzner (nao depende do SSH do PC).' -ForegroundColor Yellow
  Write-Host ''
  Write-Host '1) https://console.hetzner.cloud -> servidor -> Console' -ForegroundColor Yellow
  Write-Host '2) Cole:' -ForegroundColor Yellow
  Write-Host '     cd /opt/etholys && git fetch origin && git reset --hard origin/main'
  Write-Host '     bash /opt/etholys/scripts/recuperar-servidor-ssh.sh'
  Write-Host '3) Build completo (opcional):' -ForegroundColor Yellow
  Write-Host ('     ' + $remoteScript)
  Write-Host ''
  Write-Host ('Guia: ' + (Join-Path $Root 'docs\FORGE-DEPLOY-SEM-SSH.md')) -ForegroundColor DarkGray
  Write-Host 'Atalho: DEPLOY-FORGE-CONSOLE.bat' -ForegroundColor DarkGray
  exit 1
}

Write-Host ''
Write-Host 'Concluido. Verifique: https://forge.etholys.com' -ForegroundColor Green
exit 0
