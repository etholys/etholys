param(
    [string]$Tag,
    [string]$Repo = "etholys/etholys",
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [switch]$SkipHealth,
    [switch]$RequireCleanTree
)

$ErrorActionPreference = "Stop"

function Write-Check {
    param(
        [string]$Name,
        [bool]$Ok,
        [string]$Details
    )

    $status = if ($Ok) { "PASS" } else { "FAIL" }
    Write-Host ("[{0}] {1} - {2}" -f $status, $Name, $Details)
    if (-not $Ok) {
        $script:HasFailure = $true
    }
}

$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot

try {
    $script:HasFailure = $false

    $dirtyCount = (git status --porcelain | Measure-Object).Count
    if ($RequireCleanTree) {
        Write-Check -Name "Working tree" -Ok ($dirtyCount -eq 0) -Details ("dirty_entries={0}" -f $dirtyCount)
    }
    else {
        Write-Check -Name "Working tree" -Ok $true -Details ("dirty_entries={0} (informational)" -f $dirtyCount)
    }

    $releases = Invoke-RestMethod -UseBasicParsing -Uri ("https://api.github.com/repos/{0}/releases?per_page=30" -f $Repo)
    $apiReleases = @($releases | Where-Object { $_.tag_name -like "api-v*" })

    if (-not $Tag) {
        if ($apiReleases.Count -gt 0) {
            $Tag = $apiReleases[0].tag_name
        }
    }

    if (-not $Tag) {
        Write-Check -Name "Release tag" -Ok $false -Details "no api-v* release found"
    }
    else {
        Write-Check -Name "Release tag" -Ok $true -Details $Tag

        $release = Invoke-RestMethod -UseBasicParsing -Uri ("https://api.github.com/repos/{0}/releases/tags/{1}" -f $Repo, $Tag)
        $releaseOk = (-not $release.draft) -and (-not $release.prerelease)
        Write-Check -Name "GitHub release object" -Ok $releaseOk -Details ("draft={0}; prerelease={1}; url={2}" -f $release.draft, $release.prerelease, $release.html_url)

        $ls = git ls-remote --tags origin $Tag
        $tagDetails = "missing"
        if ($ls) {
            $tagDetails = "found"
        }
        Write-Check -Name "Remote tag exists" -Ok ([bool]$ls) -Details $tagDetails
    }

    $runs = Invoke-RestMethod -UseBasicParsing -Uri ("https://api.github.com/repos/{0}/actions/runs?per_page=50" -f $Repo)
    $publishRun = @($runs.workflow_runs | Where-Object { $_.path -eq ".github/workflows/backend-publish.yml" } | Select-Object -First 1)
    $smokeRun = @($runs.workflow_runs | Where-Object { $_.path -eq ".github/workflows/backend-smoke.yml" } | Select-Object -First 1)

    if ($publishRun.Count -eq 0) {
        Write-Check -Name "Publish workflow" -Ok $false -Details "no runs found"
    }
    else {
        $ok = ($publishRun[0].status -eq "completed") -and ($publishRun[0].conclusion -eq "success")
        Write-Check -Name "Publish workflow" -Ok $ok -Details ("status={0}; conclusion={1}; run={2}" -f $publishRun[0].status, $publishRun[0].conclusion, $publishRun[0].html_url)
    }

    if ($smokeRun.Count -eq 0) {
        Write-Check -Name "Smoke workflow" -Ok $false -Details "no runs found"
    }
    else {
        $ok = ($smokeRun[0].status -eq "completed") -and ($smokeRun[0].conclusion -eq "success")
        Write-Check -Name "Smoke workflow" -Ok $ok -Details ("status={0}; conclusion={1}; run={2}" -f $smokeRun[0].status, $smokeRun[0].conclusion, $smokeRun[0].html_url)
    }

    if (-not $SkipHealth) {
        try {
            $health = Invoke-RestMethod -UseBasicParsing -Uri ("{0}/health" -f $BaseUrl)
            $healthOk = ($health.status -eq "ok")
            Write-Check -Name "Local /health" -Ok $healthOk -Details ("status={0}" -f $health.status)
        }
        catch {
            Write-Check -Name "Local /health" -Ok $false -Details $_.Exception.Message
        }

        try {
            $ready = Invoke-RestMethod -UseBasicParsing -Uri ("{0}/health/ready" -f $BaseUrl)
            $readyOk = ($ready.status -eq "ready")
            Write-Check -Name "Local /health/ready" -Ok $readyOk -Details ("status={0}" -f $ready.status)
        }
        catch {
            Write-Check -Name "Local /health/ready" -Ok $false -Details $_.Exception.Message
        }
    }
    else {
        Write-Check -Name "Local health checks" -Ok $true -Details "skipped by parameter"
    }

    if ($script:HasFailure) {
        Write-Host ""
        Write-Host "Go/No-Go: NO-GO"
        exit 1
    }

    Write-Host ""
    Write-Host "Go/No-Go: GO"
    exit 0
}
finally {
    Pop-Location
}
