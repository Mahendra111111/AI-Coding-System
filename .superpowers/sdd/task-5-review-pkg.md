# Review Task 5
BASE: 4b55ae91a716120f06be63b746ad15f284822ff7
HEAD: 5b1207519ec44bd1e95599c6208fa14c5d46e88f

## Commits
5b12075 feat: add provider install script and PROVIDERS docs

## Stat
 .gitignore                    |   2 +
 docs/PROVIDERS.md             |  37 ++++++++
 scripts/install-providers.ps1 | 216 ++++++++++++++++++++++++++++++++++++++++++
 3 files changed, 255 insertions(+)

## Diff
diff --git a/.gitignore b/.gitignore
index 278249e..0f30c64 100644
--- a/.gitignore
+++ b/.gitignore
@@ -2,10 +2,12 @@ node_modules/
 dist/
 projects/*/temp/
 projects/*/cache/
 temp-smoke-workspace/
 tools/venvs/
+providers/skills/
+providers/refs/
 *.log
 .DS_Store
 Thumbs.db
 .env
 .env.*
diff --git a/docs/PROVIDERS.md b/docs/PROVIDERS.md
new file mode 100644
index 0000000..c3531a6
--- /dev/null
+++ b/docs/PROVIDERS.md
@@ -0,0 +1,37 @@
+# Optional providers
+
+AI Coding System (ACS) is the single MCP entry used by Cursor. Keep one Cursor
+MCP server named `ai-coding-system`; installing providers does not add more
+Cursor MCP entries.
+
+Run the idempotent installer from the repository root:
+
+```powershell
+powershell -ExecutionPolicy Bypass -File .\scripts\install-providers.ps1
+```
+
+Use `-SkipHeavy` to skip the Semgrep installation. Network and package failures
+are reported but do not fail the script, so it is safe to rerun.
+
+## Provider catalog
+
+| Provider | Purpose | Installation and behavior |
+| --- | --- | --- |
+| Graphify | Code-structure indexing | Installs `graphifyy` with `uv tool`, then falls back to `pipx` or user-scoped `pip`. |
+| Context Mode | Tool-context control | Installs global npm package `context-mode` only when it exists in the npm registry. If unavailable, use Context Mode as a peer MCP server according to its upstream README; ACS does not currently proxy it. |
+| OpenCodeReview | Code review | Installs global npm package `@alibaba-group/open-code-review`; its expected CLI is `ocr`. |
+| Ponytail | Implementation discipline | Shallow-cloned to `providers/skills/ponytail`. An existing checkout is left unchanged. |
+| Caveman | Output compression | Shallow-cloned to `providers/skills/caveman`. It is installed but config-disabled by default because ACS compression modes are mutually exclusive. |
+| OWASP Secure Coding Practices | Security reference | Shallow-cloned to `providers/refs/owasp-scp`. |
+| OWASP Top 10 | Security reference | Shallow-cloned to `providers/refs/owasp-top10`. |
+| Claude-Mem | Historical memory | Not installed automatically. Run `npx claude-mem install --provider host` when ready; the installer does not force cloud sign-in. |
+| Semgrep | Fast security scanning | Installed with user-scoped `pip` unless already available or `-SkipHeavy` is set. Failure is non-fatal. |
+| CodeQL | Deep security analysis | Detection only. Install the [CodeQL CLI](https://docs.github.com/en/code-security/codeql-cli) manually when needed. |
+| Bearer | Data-flow security analysis | Detection only. Install the [Bearer CLI](https://docs.bearer.com/guides/installation/) manually when needed. |
+| Prettier | Formatting | Detected in each target project; no source repository is cloned. |
+| ESLint | JavaScript quality | Detected in each target project; no source repository is cloned. |
+| Biome | Unified formatting and linting | Detected in each target project; no source repository is cloned. |
+
+The generated checkouts under `providers/skills/` and `providers/refs/` are
+local, ignored dependencies. `providers/registry.json` remains tracked as the
+provider manifest.
diff --git a/scripts/install-providers.ps1 b/scripts/install-providers.ps1
new file mode 100644
index 0000000..d54ea00
--- /dev/null
+++ b/scripts/install-providers.ps1
@@ -0,0 +1,216 @@
+[CmdletBinding()]
+param(
+    [switch]$SkipHeavy
+)
+
+$ErrorActionPreference = "Continue"
+$Root = Split-Path -Parent $PSScriptRoot
+$Git = "C:\Program Files\Git\bin\git.exe"
+$Npm = "C:\Program Files\nodejs\npm.cmd"
+$Results = [System.Collections.Generic.List[string]]::new()
+$PathCandidates = @(
+    "C:\Program Files\nodejs",
+    "C:\Program Files\Git\bin",
+    (Join-Path $env:APPDATA "npm")
+)
+$ExistingPathCandidates = $PathCandidates | Where-Object { Test-Path $_ }
+$env:PATH = (($ExistingPathCandidates + @($env:PATH)) -join ";")
+
+function Add-Result {
+    param(
+        [string]$Provider,
+        [string]$Status,
+        [string]$Detail
+    )
+
+    $line = "{0,-18} {1,-12} {2}" -f $Provider, $Status, $Detail
+    $Results.Add($line)
+    Write-Host $line
+}
+
+function Find-Executable {
+    param(
+        [string]$Name,
+        [string[]]$Candidates = @()
+    )
+
+    $command = Get-Command $Name -ErrorAction SilentlyContinue
+    if ($command) {
+        return $command.Source
+    }
+
+    foreach ($candidate in $Candidates) {
+        if ($candidate -and (Test-Path $candidate)) {
+            return $candidate
+        }
+    }
+
+    return $null
+}
+
+function Test-GlobalNpmPackage {
+    param(
+        [string]$Package
+    )
+
+    & $script:Npm list --global $Package --depth=0 *> $null
+    return $LASTEXITCODE -eq 0
+}
+
+function Install-GlobalNpmPackage {
+    param(
+        [string]$Provider,
+        [string]$Package,
+        [switch]$CheckRegistry,
+        [string]$AllowedScripts,
+        [string]$Cli
+    )
+
+    if (-not $script:Npm) {
+        Add-Result $Provider "soft-failed" "npm was not found"
+        return
+    }
+
+    $packagePresent = Test-GlobalNpmPackage $Package
+    $cliReady = -not $Cli -or (Find-Executable $Cli)
+    if ($packagePresent -and $cliReady) {
+        Add-Result $Provider "present" "$Package is already installed globally"
+        return
+    }
+
+    if ($CheckRegistry) {
+        & $script:Npm view $Package version *> $null
+        if ($LASTEXITCODE -ne 0) {
+            Add-Result $Provider "peer-only" "$Package is unavailable; configure its peer MCP separately"
+            return
+        }
+    }
+
+    $npmArguments = @("install", "--global")
+    if ($AllowedScripts) {
+        $npmArguments += "--allow-scripts=$AllowedScripts"
+    }
+    $npmArguments += $Package
+    & $script:Npm @npmArguments
+    if ($LASTEXITCODE -eq 0) {
+        Add-Result $Provider "installed" "$Package"
+    } else {
+        Add-Result $Provider "soft-failed" "npm install failed (exit $LASTEXITCODE)"
+    }
+}
+
+function Install-ShallowClone {
+    param(
+        [string]$Provider,
+        [string]$Url,
+        [string]$Destination
+    )
+
+    if (Test-Path $Destination) {
+        Add-Result $Provider "present" "checkout already exists at $Destination"
+        return
+    }
+
+    if (-not $script:Git) {
+        Add-Result $Provider "soft-failed" "git was not found"
+        return
+    }
+
+    $parent = Split-Path -Parent $Destination
+    New-Item -ItemType Directory -Force -Path $parent | Out-Null
+    & $script:Git clone --depth 1 $Url $Destination
+    if ($LASTEXITCODE -eq 0) {
+        Add-Result $Provider "installed" "shallow checkout at $Destination"
+    } else {
+        if (Test-Path $Destination) {
+            Remove-Item -Recurse -Force $Destination -ErrorAction SilentlyContinue
+        }
+        Add-Result $Provider "soft-failed" "git clone failed (exit $LASTEXITCODE)"
+    }
+}
+
+Write-Host "Installing optional AI Coding System providers under $Root"
+Write-Host "Failures are non-fatal; rerun this script to retry."
+
+$Git = Find-Executable "git" @($Git)
+$Npm = Find-Executable "npm" @($Npm)
+
+if (Find-Executable "graphify") {
+    Add-Result "Graphify" "present" "graphify is on PATH"
+} else {
+    $uv = Find-Executable "uv"
+    $pipx = Find-Executable "pipx"
+    $python = Find-Executable "python" @("$env:LOCALAPPDATA\Programs\Python\Python313\python.exe")
+
+    if ($uv) {
+        & $uv tool install graphifyy
+        $graphifyExit = $LASTEXITCODE
+        if ($graphifyExit -eq 0) {
+            Add-Result "Graphify" "installed" "uv tool install graphifyy"
+        } else {
+            Add-Result "Graphify" "soft-failed" "uv install failed (exit $graphifyExit)"
+        }
+    } elseif ($pipx) {
+        & $pipx install graphifyy
+        $graphifyExit = $LASTEXITCODE
+        if ($graphifyExit -eq 0) {
+            Add-Result "Graphify" "installed" "pipx install graphifyy"
+        } else {
+            Add-Result "Graphify" "soft-failed" "pipx install failed (exit $graphifyExit)"
+        }
+    } elseif ($python) {
+        & $python -m pip install --user graphifyy
+        $graphifyExit = $LASTEXITCODE
+        if ($graphifyExit -eq 0) {
+            Add-Result "Graphify" "installed" "python -m pip install --user graphifyy"
+        } else {
+            Add-Result "Graphify" "soft-failed" "pip install failed (exit $graphifyExit)"
+        }
+    } else {
+        Add-Result "Graphify" "soft-failed" "uv, pipx, and python were not found"
+    }
+}
+
+Install-GlobalNpmPackage "Context Mode" "context-mode" -CheckRegistry -AllowedScripts "context-mode,better-sqlite3" -Cli "context-mode"
+Install-GlobalNpmPackage "OpenCodeReview" "@alibaba-group/open-code-review" -AllowedScripts "@alibaba-group/open-code-review" -Cli "ocr"
+
+Install-ShallowClone "Ponytail" "https://github.com/DietrichGebert/ponytail.git" (Join-Path $Root "providers\skills\ponytail")
+Install-ShallowClone "Caveman" "https://github.com/JuliusBrussee/caveman.git" (Join-Path $Root "providers\skills\caveman")
+Install-ShallowClone "OWASP SCP" "https://github.com/OWASP/secure-coding-practices-quick-reference-guide.git" (Join-Path $Root "providers\refs\owasp-scp")
+Install-ShallowClone "OWASP Top 10" "https://github.com/OWASP/Top10.git" (Join-Path $Root "providers\refs\owasp-top10")
+
+Add-Result "Claude-Mem" "manual" "Run: npx claude-mem install --provider host"
+
+if ($SkipHeavy) {
+    Add-Result "Semgrep" "skipped" "-SkipHeavy was specified"
+} elseif (Find-Executable "semgrep") {
+    Add-Result "Semgrep" "present" "semgrep is on PATH"
+} else {
+    $python = Find-Executable "python"
+    if ($python) {
+        & $python -m pip install --user semgrep
+        $semgrepExit = $LASTEXITCODE
+        if ($semgrepExit -eq 0) {
+            Add-Result "Semgrep" "installed" "python -m pip install --user semgrep"
+        } else {
+            Add-Result "Semgrep" "soft-failed" "pip install failed (exit $semgrepExit)"
+        }
+    } else {
+        Add-Result "Semgrep" "soft-failed" "python was not found"
+    }
+}
+
+foreach ($tool in @("codeql", "bearer")) {
+    if (Find-Executable $tool) {
+        Add-Result $tool "detected" "$tool is on PATH"
+    } else {
+        Add-Result $tool "manual" "not installed; see docs\PROVIDERS.md"
+    }
+}
+
+Write-Host ""
+Write-Host "Provider summary"
+$Results | ForEach-Object { Write-Host $_ }
+Write-Host ""
+Write-Host "Cursor configuration is unchanged: keep one MCP entry named ai-coding-system."
+exit 0
