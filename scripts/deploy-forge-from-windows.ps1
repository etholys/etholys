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
  SshHost    = '178.105.80.131'
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

function Invoke-Remote([string]$RemoteCommand) {
  $target = $cfg.SshUser + '@' + $cfg.SshHost
  $sshArgs = @(Get-SshBaseArgs) + $target, $RemoteCommand
  Write-Host ('ssh ' + $target + ' ...')
  & ssh @sshArgs
  if ($LASTEXITCODE -ne 0) { throw ('SSH falhou (codigo ' + $LASTEXITCODE + ')') }
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
$dirty = (& git status --porcelain)
if ($dirty -and -not $SkipCommit) {
  if (-not $Message) {
    $defaultMsg = 'chore(forge): atualizacao ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
    $Message = Read-Host ('Mensagem do commit [' + $defaultMsg + ']')
    if ([string]::IsNullOrWhiteSpace($Message)) { $Message = $defaultMsg }
  }
  Write-Step 'Commit'
  Invoke-Git @('add', '-A')
  Test-SecretStaged | Out-Null
  $still = & git status --porcelain
  if ($still) {
    Invoke-Git @('commit', '-m', $Message)
  } else {
    Write-Host 'Nada para commitar apos filtrar ficheiros sensiveis.' -ForegroundColor Yellow
  }
} elseif (-not $dirty) {
  Write-Host 'Working tree limpo - sem novo commit.' -ForegroundColor DarkGray
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
  Write-Host 'Servidor:' -ForegroundColor White
  Write-Host '  [1] Deploy completo (git pull + docker build) - 10-20 min'
  Write-Host '  [2] Rapido (git pull + restart, sem rebuild) - ~1 min'
  Write-Host '  [3] So git (ja feito push)'
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
  Write-Host 'Faca manualmente na consola Hetzner:' -ForegroundColor Yellow
  Write-Host ('  ' + $remoteScript)
  Write-Host ''
  Write-Host 'Ou tente modo [2] Rapido se o build esgotar a RAM.' -ForegroundColor Yellow
  exit 1
}

Write-Host ''
Write-Host 'Concluido. Verifique: https://forge.etholys.com' -ForegroundColor Green
exit 0
