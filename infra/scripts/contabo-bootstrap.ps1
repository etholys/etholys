# Bootstrap Contabo VPS for Etholys (run once from Windows PowerShell)
# Usage: .\infra\scripts\contabo-bootstrap.ps1
# Requires: OpenSSH client (ssh) — built into Windows 10/11

param(
  [string]$ServerIp = '84.247.187.155',
  [string]$ServerUser = 'root'
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) {
  Write-Host "`n==> $msg" -ForegroundColor Cyan
}

$pubKeyPath = Join-Path $env:USERPROFILE '.ssh\id_ed25519.pub'
if (-not (Test-Path $pubKeyPath)) {
  Write-Step 'Gerando chave SSH...'
  ssh-keygen -t ed25519 -C 'etholys-contabo' -f (Join-Path $env:USERPROFILE '.ssh\id_ed25519') -N '""'
}

$pubKey = (Get-Content $pubKeyPath -Raw).Trim()

Write-Host @"

Bootstrap Etholys — Contabo VPS
Servidor: ${ServerUser}@${ServerIp}

"@ -ForegroundColor Yellow

$plainPassword = Read-Host 'Senha root da Contabo (nao sera salva)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($plainPassword)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr).Trim()
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($password)) {
  throw 'Senha vazia. Cole a senha do e-mail da Contabo ou redefina no painel.'
}

# Install Posh-SSH for password-based automation
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
  Write-Step 'Instalando modulo Posh-SSH (uma vez)...'
  if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) {
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
  }
  Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
  Install-Module -Name Posh-SSH -Force -Scope CurrentUser -AllowClobber -AcceptLicense
}

Import-Module Posh-SSH -ErrorAction Stop

$secPassword = ConvertTo-SecureString $password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($ServerUser, $secPassword)

Write-Step 'Conectando via SSH...'
$session = New-SSHSession -ComputerName $ServerIp -Credential $cred -AcceptKey -ConnectionTimeout 30
if (-not $session) { throw 'Falha ao conectar SSH. Verifique senha e firewall (porta 22).' }

function Invoke-Remote([string]$script) {
  $r = Invoke-SSHCommand -SessionId $session.SessionId -Command $script -TimeOut 600
  if ($r.Output) { $r.Output | ForEach-Object { Write-Host $_ } }
  if ($r.Error -and $r.ExitStatus -ne 0) {
    Write-Host $r.Error -ForegroundColor Red
    throw "Comando remoto falhou (exit $($r.ExitStatus))"
  }
  return $r
}

try {
  Write-Step '1/7 — Chave SSH + pacotes base'
  $escapedKey = $pubKey.Replace("'", "'\''")
  Invoke-Remote @"
set -e
mkdir -p ~/.ssh && chmod 700 ~/.ssh
grep -qF '$escapedKey' ~/.ssh/authorized_keys 2>/dev/null || echo '$escapedKey' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git nano ufw fail2ban ca-certificates gnupg apt-transport-https
timedatectl set-timezone America/Sao_Paulo || true
echo OK_PACOTES
"@ | Out-Null

  Write-Step '2/7 — Firewall UFW (22, 80, 443)'
  Invoke-Remote @"
set -e
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo y | ufw enable
ufw status numbered
"@ | Out-Null

  Write-Step '3/7 — Docker + Compose'
  Invoke-Remote @"
set -e
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
apt-get install -y -qq docker-compose-plugin
docker --version
docker compose version
docker run --rm hello-world | tail -3
"@ | Out-Null

  Write-Step '4/7 — Swap 4 GB (build Next.js)'
  Invoke-Remote @"
set -e
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | head -3
"@ | Out-Null

  Write-Step '5/7 — Fail2ban SSH'
  Invoke-Remote @"
set -e
systemctl enable fail2ban
systemctl restart fail2ban
systemctl is-active fail2ban
"@ | Out-Null

  Write-Step '6/7 — Pasta /opt/etholys'
  Invoke-Remote @"
set -e
mkdir -p /opt/etholys
chmod 755 /opt/etholys
ls -la /opt
"@ | Out-Null

  Write-Step '7/7 — Teste login com chave SSH'
  Remove-SSHSession -SessionId $session.SessionId | Out-Null
  $session = $null

  Start-Sleep -Seconds 2
  $test = ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=no "${ServerUser}@${ServerIp}" "echo CHAVE_SSH_OK && docker --version"
  Write-Host $test

  Write-Host @"

Bootstrap concluido.

Proximo passo (deploy Etholys):
  1. DNS Cloudflare: app -> $ServerIp
  2. Criar apps/web/.env e infra/.env no PC
  3. Subir codigo para o servidor e rodar docker compose

"@ -ForegroundColor Green

} finally {
  if ($session) {
    Remove-SSHSession -SessionId $session.SessionId -ErrorAction SilentlyContinue | Out-Null
  }
}
