$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$distDir = Join-Path $PSScriptRoot "dist"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bundleRoot = Join-Path $distDir "etholys-api-offline-$stamp"
New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null

$items = @(
  "Dockerfile",
  "docker-compose.yml",
  ".env.example",
  "requirements.txt",
  "main.py",
  "db.py",
  "config.py",
  "security.py",
  "migrations_runner.py",
  "README.md",
  "API_PRODUCT.md",
  "RELEASE_CHECKLIST.md",
  "smoke_test.py",
  "preflight_check.py",
  "install-docker.ps1",
  "install-docker.sh",
  "upgrade-docker.ps1",
  "upgrade-docker.sh",
  "routers",
  "services",
  "static",
  "migrations"
)

foreach ($item in $items) {
  if (Test-Path $item) {
    Copy-Item $item -Destination $bundleRoot -Recurse -Force
  }
}

$zipPath = "$bundleRoot.zip"
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
Compress-Archive -Path "$bundleRoot\*" -DestinationPath $zipPath

$hash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
$hashFile = "$zipPath.sha256"
"$hash  $(Split-Path $zipPath -Leaf)" | Out-File -FilePath $hashFile -Encoding ascii

Write-Host "Pacote offline criado: $zipPath"
Write-Host "Checksum SHA256: $hashFile"
