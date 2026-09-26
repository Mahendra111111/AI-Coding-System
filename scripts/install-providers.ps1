[CmdletBinding()]
param(
    [switch]$SkipHeavy,
    [switch]$SkipVon
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Git = "C:\Program Files\Git\bin\git.exe"
$Npm = "C:\Program Files\nodejs\npm.cmd"
$Results = [System.Collections.Generic.List[string]]::new()
$PathCandidates = @(
    "C:\Program Files\nodejs",
    "C:\Program Files\Git\bin",
    (Join-Path $env:APPDATA "npm"),
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313"),
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\Scripts"),
    (Join-Path $env:USERPROFILE ".local\bin"),
    (Join-Path $env:USERPROFILE ".cargo\bin"),
    (Join-Path $env:USERPROFILE "AppData\Roaming\Python\Python313\Scripts"),
    (Join-Path $Root "tools\codeql")
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

function Refresh-SessionPath {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $extra = $PathCandidates | Where-Object { Test-Path $_ }
    $env:PATH = (($extra + @($machine, $user, $env:PATH)) -join ";")
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

function Ensure-Python {
    $python = Find-Executable "python" @(
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    )
    if ($python) { return $python }

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Python not found. Installing Python.Python.3.13 via winget..." -ForegroundColor Yellow
        winget install Python.Python.3.13 --accept-package-agreements --accept-source-agreements
        Refresh-SessionPath
        $python = Find-Executable "python" @(
            "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
        )
    }
    return $python
}

function Ensure-Uv {
    $uv = Find-Executable "uv"
    if ($uv) { return $uv }

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "uv not found. Installing astral-sh.uv via winget..." -ForegroundColor Yellow
        winget install astral-sh.uv --accept-package-agreements --accept-source-agreements
        Refresh-SessionPath
        $uv = Find-Executable "uv" @(
            (Join-Path $env:USERPROFILE ".local\bin\uv.exe"),
            (Join-Path $env:USERPROFILE ".cargo\bin\uv.exe")
        )
    }
    return $uv
}

Write-Host "Installing optional AI Coding System providers under $Root"
Write-Host "Failures are non-fatal; rerun this script (or install.ps1) to retry."

$Git = Find-Executable "git" @($Git)
$Npm = Find-Executable "npm" @($Npm)
$python = Ensure-Python
$uv = Ensure-Uv
Refresh-SessionPath

if (Find-Executable "graphify") {
    Add-Result "Graphify" "present" "graphify is on PATH"
} else {
    $pipx = Find-Executable "pipx"

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

# Claude-Mem host install (no forced cloud sign-in)
if ($Npm) {
    Write-Host "Attempting Claude-Mem host install..."
    & $Npm exec --yes -- claude-mem install --provider host
    if ($LASTEXITCODE -eq 0) {
        Add-Result "Claude-Mem" "installed" "npx claude-mem install --provider host"
    } else {
        Add-Result "Claude-Mem" "soft-failed" "npx claude-mem install failed (exit $LASTEXITCODE); rerun install.ps1"
    }
} else {
    Add-Result "Claude-Mem" "soft-failed" "npm was not found"
}

# Von decision routing CLI
if ($SkipVon) {
    Add-Result "Von" "skipped" "-SkipVon was specified"
} elseif (Find-Executable "von") {
    Add-Result "Von" "present" "von is on PATH"
} elseif ($python) {
    & $python -m pip install --user "git+https://github.com/wfzyx/von.git"
    Refresh-SessionPath
    if ($LASTEXITCODE -eq 0 -or (Find-Executable "von")) {
        Add-Result "Von" "installed" "pip install von (HF weights download on first serve / decide_tools)"
    } else {
        Add-Result "Von" "soft-failed" "pip install von failed (exit $LASTEXITCODE)"
    }
} else {
    Add-Result "Von" "soft-failed" "python was not found"
}

# Reticle peer MCP
if ($Npm) {
    Install-GlobalNpmPackage "Reticle" "@reticlehq/server" -Cli $null
    Write-Host "Attempting Reticle MCP setup..."
    & $Npm exec --yes -- @reticlehq/server setup mcp
    if ($LASTEXITCODE -eq 0) {
        Add-Result "Reticle-MCP" "installed" "npx @reticlehq/server setup mcp"
    } else {
        Add-Result "Reticle-MCP" "soft-failed" "setup mcp failed (exit $LASTEXITCODE); rerun install.ps1"
    }
} else {
    Add-Result "Reticle" "soft-failed" "npm was not found"
}

Add-Result "Next-SEO" "app-local" "Install next-seo inside each Next.js app; ACS: seo_guidance + skills/next-seo"

if ($SkipHeavy) {
    Add-Result "Semgrep" "skipped" "-SkipHeavy was specified"
    Add-Result "CodeQL" "skipped" "-SkipHeavy was specified"
} else {
    if (Find-Executable "semgrep") {
        Add-Result "Semgrep" "present" "semgrep is on PATH"
    } elseif ($python) {
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

    $codeqlDir = Join-Path $Root "tools\codeql"
    $codeqlExe = Join-Path $codeqlDir "codeql.exe"
    if ((Find-Executable "codeql") -or (Test-Path $codeqlExe)) {
        Add-Result "CodeQL" "present" "codeql CLI available"
    } else {
        try {
            New-Item -ItemType Directory -Force -Path (Join-Path $Root "tools") | Out-Null
            $zipPath = Join-Path $env:TEMP "codeql-win64.zip"
            $url = "https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-win64.zip"
            Write-Host "Downloading CodeQL CLI (soft)..."
            Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 600
            if (Test-Path $codeqlDir) {
                Remove-Item -Recurse -Force $codeqlDir -ErrorAction SilentlyContinue
            }
            Expand-Archive -Path $zipPath -DestinationPath (Join-Path $Root "tools") -Force
            # Archive usually extracts to tools/codeql/
            if (-not (Test-Path $codeqlExe)) {
                $found = Get-ChildItem -Path (Join-Path $Root "tools") -Filter "codeql.exe" -Recurse -ErrorAction SilentlyContinue |
                    Select-Object -First 1
                if ($found) {
                    $parent = Split-Path -Parent $found.FullName
                    if ($parent -ne $codeqlDir) {
                        if (Test-Path $codeqlDir) { Remove-Item -Recurse -Force $codeqlDir -ErrorAction SilentlyContinue }
                        Move-Item -Force $parent $codeqlDir
                    }
                }
            }
            if (Test-Path $codeqlExe) {
                Add-Result "CodeQL" "installed" "tools\codeql"
            } else {
                Add-Result "CodeQL" "soft-failed" "download extracted but codeql.exe not found"
            }
        } catch {
            Add-Result "CodeQL" "soft-failed" "download failed: $($_.Exception.Message)"
        }
    }
}

Refresh-SessionPath

Write-Host ""
Write-Host "Provider summary"
$Results | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "If anything soft-failed: re-run powershell -ExecutionPolicy Bypass -File .\install.ps1"
Write-Host "Cursor: ACS is primary MCP; peers (Context Mode / Reticle) may also be merged by install.ps1."
exit 0
