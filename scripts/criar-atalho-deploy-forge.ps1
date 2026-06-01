# Cria atalho .lnk na pasta do projeto (e opcionalmente no Ambiente de trabalho).
param([switch]$Desktop)

$Root = Split-Path -Parent $PSScriptRoot
$Bat = Join-Path $Root 'DEPLOY-FORGE.bat'
if (-not (Test-Path $Bat)) { throw "Nao encontrado: $Bat" }

$Wsh = New-Object -ComObject WScript.Shell
$targets = @(
  (Join-Path $Root 'Deploy FORGE (git + servidor).lnk')
)
if ($Desktop) {
  $targets += Join-Path ([Environment]::GetFolderPath('Desktop')) 'Deploy FORGE (Etholys).lnk'
}

foreach ($lnkPath in $targets) {
  $sc = $Wsh.CreateShortcut($lnkPath)
  $sc.TargetPath = $Bat
  $sc.WorkingDirectory = $Root
  $sc.Description = 'Commit git, push e atualizar forge.etholys.com no servidor'
  $sc.WindowStyle = 1
  $sc.Save()
  Write-Host "Atalho: $lnkPath"
}

Write-Host 'Duplo clique no atalho ou em DEPLOY-FORGE.bat'
