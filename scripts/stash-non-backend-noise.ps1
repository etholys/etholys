param(
    [switch]$Apply,
    [string]$Message = "wip: stash non-backend workspace changes"
)

$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot

try {
    $dirty = git status --porcelain
    if (-not $dirty) {
        Write-Host "Working tree is clean."
        exit 0
    }

    $pathspec = @(
        ".",
        ":(exclude)backend/**",
        ":(exclude).github/workflows/backend-smoke.yml",
        ":(exclude).github/workflows/backend-publish.yml",
        ":(exclude)scripts/safe-backend-release.ps1",
        ":(exclude)scripts/stash-non-backend-noise.ps1"
    )

    $preview = @("git", "stash", "push", "-u", "-m", $Message, "--") + $pathspec
    Write-Host "Command preview:"
    Write-Host ($preview -join " ")

    if (-not $Apply) {
        Write-Host "Preview only. Re-run with -Apply to execute selective stash."
        exit 0
    }

    git stash push -u -m $Message -- @pathspec
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host "Selective stash applied. Backend scope kept in working tree."
    git stash list -n 3
}
finally {
    Pop-Location
}
