[CmdletBinding()]
param(
    [switch]$SkipHeavy
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Git = "C:\Program Files\Git\bin\git.exe"
$Npm = "C:\Program Files\nodejs\npm.cmd"
$Results = [System.Collections.Generic.List[string]]::new()
$PathCandidates = @(
    "C:\Program Files\nodejs",
    "C:\Program Files\Git\bin",
    (Join-Path $env:APPDATA "npm")
)
$ExistingPathCandidates = $PathCandidates | Where-Object { Test-Path $_ }
$env:PATH = (($ExistingPathCandidates + @($env:PATH)) -join ";")

function Add-Result {
    param(
        [string]$Provider,
        [string]$Status,
        [string]$Detail
    )

    $line = "{0,-18} {1,-12} {2}" -f $Provider, $Status, $Detail
    $Results.Add($line)
    Write-Host $line
}

function Find-Executable {
    param(
        [string]$Name,
        [string[]]$Candidates = @()
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Test-GlobalNpmPackage {
    param(
        [string]$Package
    )

    & $script:Npm list --global $Package --depth=0 *> $null
    return $LASTEXITCODE -eq 0
}

function Install-GlobalNpmPackage {
    param(
        [string]$Provider,
        [string]$Package,
        [switch]$CheckRegistry,
        [string]$AllowedScripts,
        [string]$Cli
    )

    if (-not $script:Npm) {
        Add-Result $Provider "soft-failed" "npm was not found"
        return
    }

    $packagePresent = Test-GlobalNpmPackage $Package
    $cliReady = -not $Cli -or (Find-Executable $Cli)
    if ($packagePresent -and $cliReady) {
        Add-Result $Provider "present" "$Package is already installed globally"
        return
    }

    if ($CheckRegistry) {
        & $script:Npm view $Package version *> $null
        if ($LASTEXITCODE -ne 0) {
            Add-Result $Provider "peer-only" "$Package is unavailable; configure its peer MCP separately"
            return
        }
    }

    $npmArguments = @("install", "--global")
    if ($AllowedScripts) {
        $npmArguments += "--allow-scripts=$AllowedScripts"
    }
    $npmArguments += $Package
    & $script:Npm @npmArguments
    if ($LASTEXITCODE -eq 0) {
        Add-Result $Provider "installed" "$Package"
    } else {
        Add-Result $Provider "soft-failed" "npm install failed (exit $LASTEXITCODE)"
    }
}

function Install-ShallowClone {
    param(
        [string]$Provider,
        [string]$Url,
        [string]$Destination
    )

    if (Test-Path $Destination) {
        Add-Result $Provider "present" "checkout already exists at $Destination"
        return
    }

    if (-not $script:Git) {
        Add-Result $Provider "soft-failed" "git was not found"
        return
    }

    $parent = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    & $script:Git clone --depth 1 $Url $Destination
    if ($LASTEXITCODE -eq 0) {
        Add-Result $Provider "installed" "shallow checkout at $Destination"
    } else {
        if (Test-Path $Destination) {
            Remove-Item -Recurse -Force $Destination -ErrorAction SilentlyContinue
        }
        Add-Result $Provider "soft-failed" "git clone failed (exit $LASTEXITCODE)"
    }
}

Write-Host "Installing optional AI Coding System providers under $Root"
Write-Host "Failures are non-fatal; rerun this script to retry."

$Git = Find-Executable "git" @($Git)
$Npm = Find-Executable "npm" @($Npm)

if (Find-Executable "graphify") {
    Add-Result "Graphify" "present" "graphify is on PATH"
} else {
    $uv = Find-Executable "uv"
    $pipx = Find-Executable "pipx"
    $python = Find-Executable "python" @("$env:LOCALAPPDATA\Programs\Python\Python313\python.exe")

    if ($uv) {
        & $uv tool install graphifyy
        $graphifyExit = $LASTEXITCODE
        if ($graphifyExit -eq 0) {
            Add-Result "Graphify" "installed" "uv tool install graphifyy"
        } else {
            Add-Result "Graphify" "soft-failed" "uv install failed (exit $graphifyExit)"
        }
    } elseif ($pipx) {
        & $pipx install graphifyy
        $graphifyExit = $LASTEXITCODE
        if ($graphifyExit -eq 0) {
            Add-Result "Graphify" "installed" "pipx install graphifyy"
        } else {
            Add-Result "Graphify" "soft-failed" "pipx install failed (exit $graphifyExit)"
        }
    } elseif ($python) {
        & $python -m pip install --user graphifyy
        $graphifyExit = $LASTEXITCODE
        if ($graphifyExit -eq 0) {
            Add-Result "Graphify" "installed" "python -m pip install --user graphifyy"
        } else {
            Add-Result "Graphify" "soft-failed" "pip install failed (exit $graphifyExit)"
        }
    } else {
        Add-Result "Graphify" "soft-failed" "uv, pipx, and python were not found"
    }
}

Install-GlobalNpmPackage "Context Mode" "context-mode" -CheckRegistry -AllowedScripts "context-mode,better-sqlite3" -Cli "context-mode"
Install-GlobalNpmPackage "OpenCodeReview" "@alibaba-group/open-code-review" -AllowedScripts "@alibaba-group/open-code-review" -Cli "ocr"

Install-ShallowClone "Ponytail" "https://github.com/DietrichGebert/ponytail.git" (Join-Path $Root "providers\skills\ponytail")
Install-ShallowClone "Caveman" "https://github.com/JuliusBrussee/caveman.git" (Join-Path $Root "providers\skills\caveman")
Install-ShallowClone "OWASP SCP" "https://github.com/OWASP/secure-coding-practices-quick-reference-guide.git" (Join-Path $Root "providers\refs\owasp-scp")
Install-ShallowClone "OWASP Top 10" "https://github.com/OWASP/Top10.git" (Join-Path $Root "providers\refs\owasp-top10")

Add-Result "Claude-Mem" "manual" "Run: npx claude-mem install --provider host"

if ($SkipHeavy) {
    Add-Result "Semgrep" "skipped" "-SkipHeavy was specified"
} elseif (Find-Executable "semgrep") {
    Add-Result "Semgrep" "present" "semgrep is on PATH"
} else {
    $python = Find-Executable "python"
    if ($python) {
        & $python -m pip install --user semgrep
        $semgrepExit = $LASTEXITCODE
        if ($semgrepExit -eq 0) {
            Add-Result "Semgrep" "installed" "python -m pip install --user semgrep"
        } else {
            Add-Result "Semgrep" "soft-failed" "pip install failed (exit $semgrepExit)"
        }
    } else {
        Add-Result "Semgrep" "soft-failed" "python was not found"
    }
}

foreach ($tool in @("codeql")) {
    if (Find-Executable $tool) {
        Add-Result $tool "detected" "$tool is on PATH"
    } else {
        Add-Result $tool "manual" "not installed; see docs\PROVIDERS.md"
    }
}

Write-Host ""
Write-Host "Provider summary"
$Results | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "Cursor configuration is unchanged: keep one MCP entry named ai-coding-system."
exit 0
