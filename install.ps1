#Requires -Version 5.1
<#
.SYNOPSIS
  One-command install: ACS build + CLI on PATH + full-potential providers + Cursor MCP/rules.
#>
param(
  [switch]$SkipCursorMcpMerge,
  [switch]$SkipProviders,
  [switch]$SkipHeavy,
  [switch]$SkipVon
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Root) { $Root = "C:\AI-Coding-System" }

Write-Host "== AI Coding System installer (full potential) ==" -ForegroundColor Cyan
Write-Host "Root: $Root"

function Ensure-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Refresh-InstallPath {
  $candidates = @(
    "C:\Program Files\nodejs",
    "C:\Program Files\Git\cmd",
    "C:\Program Files\Git\bin",
    (Join-Path $env:APPDATA "npm"),
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313"),
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\Scripts"),
    (Join-Path $env:USERPROFILE ".local\bin"),
    (Join-Path $env:USERPROFILE ".cargo\bin"),
    (Join-Path $Root "tools\codeql")
  ) | Where-Object { Test-Path $_ }
  $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = (($candidates + @($machine, $user)) -join ";")
}

function Merge-CursorMcpServer {
  param(
    [Parameter(Mandatory = $true)]$Json,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)]$Entry
  )
  if (-not $Json.mcpServers) {
    $Json | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{}) -Force
  }
  $Json.mcpServers | Add-Member -NotePropertyName $Name -NotePropertyValue ([pscustomobject]$Entry) -Force
  return $Json
}

Refresh-InstallPath

if (-not (Ensure-Command "node")) {
  Write-Host "Node.js not found. Installing OpenJS.NodeJS.LTS via winget..." -ForegroundColor Yellow
  winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  Refresh-InstallPath
}

if (-not (Ensure-Command "node")) {
  throw "Node.js is required but was not found after install. Restart the terminal and re-run install.ps1"
}

if (-not (Ensure-Command "git")) {
  Write-Host "Git not found. Installing Git.Git via winget..." -ForegroundColor Yellow
  winget install Git.Git --accept-package-agreements --accept-source-agreements
  Refresh-InstallPath
}

if (-not (Ensure-Command "python")) {
  Write-Host "Python not found. Installing Python.Python.3.13 via winget..." -ForegroundColor Yellow
  winget install Python.Python.3.13 --accept-package-agreements --accept-source-agreements
  Refresh-InstallPath
}

Write-Host "Node: $(node -v)"
Write-Host "npm:  $(npm -v)"
if (Ensure-Command "git") { Write-Host "Git:  $(git --version)" } else { Write-Host "Git:  MISSING (optional for identity via remote)" -ForegroundColor Yellow }
if (Ensure-Command "python") { Write-Host "Python: $(python --version 2>&1)" } else { Write-Host "Python: MISSING (needed for Von/Graphify/Semgrep)" -ForegroundColor Yellow }

Set-Location $Root
Write-Host "Installing npm dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "Building TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

$Entry = Join-Path $Root "dist\index.js"
$DoctorEntry = Join-Path $Root "dist\cli\doctor.js"
if (-not (Test-Path $Entry)) { throw "Build output missing: $Entry" }
if (-not (Test-Path $DoctorEntry)) { throw "Build output missing: $DoctorEntry" }

Write-Host "Linking ACS CLI (ai-coding-mcp, acs-doctor) onto PATH..."
npm link
if ($LASTEXITCODE -ne 0) {
  Write-Host "npm link failed; trying npm install -g ." -ForegroundColor Yellow
  npm install -g .
  if ($LASTEXITCODE -ne 0) {
    Write-Host "WARN: ACS CLI global install failed — MCP still works via dist\index.js. Re-run install.ps1 to retry." -ForegroundColor Yellow
  } else {
    Write-Host "ACS CLI installed globally via npm install -g ." -ForegroundColor Green
  }
} else {
  Write-Host "ACS CLI linked (ai-coding-mcp, acs-doctor)" -ForegroundColor Green
}
Refresh-InstallPath
if (Ensure-Command "ai-coding-mcp") {
  Write-Host "Verified: ai-coding-mcp on PATH" -ForegroundColor Green
} else {
  Write-Host "WARN: ai-coding-mcp not visible on PATH yet (restart shell if needed)" -ForegroundColor Yellow
}

$NodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $NodeExe)) {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) { $NodeExe = $nodeCmd.Source } else { $NodeExe = "node" }
}

$McpSnippet = @"
{
  "mcpServers": {
    "ai-coding-system": {
      "command": "$($NodeExe.Replace('\','\\'))",
      "args": ["$($Entry.Replace('\','\\'))"],
      "env": {
        "PATH": "C:\\Program Files\\nodejs;C:\\Windows\\System32;C:\\Program Files\\Git\\cmd"
      }
    }
  }
}
"@

Write-Host ""
Write-Host "== ACS MCP snippet ==" -ForegroundColor Green
Write-Host $McpSnippet

$SnippetPath = Join-Path $Root "config\mcp-snippet.json"
$McpSnippet | Set-Content -Path $SnippetPath -Encoding UTF8
Write-Host "Wrote $SnippetPath"

if (-not $SkipCursorMcpMerge) {
  $CursorMcp = Join-Path $env:USERPROFILE ".cursor\mcp.json"
  $CursorDir = Split-Path $CursorMcp -Parent
  if (-not (Test-Path $CursorDir)) { New-Item -ItemType Directory -Path $CursorDir | Out-Null }

  $acsEntry = @{
    command = $NodeExe
    args = @($Entry)
    env = @{
      PATH = "C:\Program Files\nodejs;C:\Windows\System32;C:\Program Files\Git\cmd"
    }
  }

  $contextModeCmd = Get-Command context-mode -ErrorAction SilentlyContinue
  $contextModeEntry = if ($contextModeCmd) {
    @{ command = $contextModeCmd.Source; args = @() }
  } else {
    @{ command = "npx"; args = @("-y", "context-mode") }
  }

  $reticleEntry = @{
    command = "npx"
    args = @("-y", "@reticlehq/server", "mcp")
  }

  if (Test-Path $CursorMcp) {
    $backup = "$CursorMcp.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $CursorMcp $backup
    Write-Host "Backed up existing Cursor MCP config to $backup"
    try {
      $json = Get-Content $CursorMcp -Raw | ConvertFrom-Json
    } catch {
      Write-Host "Could not parse existing mcp.json; leaving it unchanged. Merge manually from config\mcp-snippet.json" -ForegroundColor Yellow
      $json = $null
    }
    if ($null -ne $json) {
      $json = Merge-CursorMcpServer -Json $json -Name "ai-coding-system" -Entry $acsEntry
      $json = Merge-CursorMcpServer -Json $json -Name "context-mode" -Entry $contextModeEntry
      $json = Merge-CursorMcpServer -Json $json -Name "reticle" -Entry $reticleEntry
      ($json | ConvertTo-Json -Depth 10) | Set-Content $CursorMcp -Encoding UTF8
      Write-Host "Merged ai-coding-system + context-mode + reticle into $CursorMcp" -ForegroundColor Green
    }
  } else {
    $newJson = [pscustomobject]@{
      mcpServers = [pscustomobject]@{
        "ai-coding-system" = [pscustomobject]$acsEntry
        "context-mode" = [pscustomobject]$contextModeEntry
        "reticle" = [pscustomobject]$reticleEntry
      }
    }
    ($newJson | ConvertTo-Json -Depth 10) | Set-Content $CursorMcp -Encoding UTF8
    Write-Host "Created $CursorMcp with ACS + peer MCPs" -ForegroundColor Green
  }

  # Ship ACS Cursor rules to the user-global rules folder.
  $RulesDir = Join-Path $env:USERPROFILE ".cursor\rules"
  if (-not (Test-Path $RulesDir)) { New-Item -ItemType Directory -Path $RulesDir | Out-Null }
  foreach ($ruleName in @("ai-coding-system-mcp.mdc", "seo-engine.mdc")) {
    $RuleSrc = Join-Path $Root ".cursor\rules\$ruleName"
    $RuleDest = Join-Path $RulesDir $ruleName
    if (Test-Path $RuleSrc) {
      Copy-Item -Force $RuleSrc $RuleDest
      Write-Host "Installed Cursor rule: $RuleDest" -ForegroundColor Green
    } else {
      Write-Host "Cursor rule missing at $RuleSrc (skip)" -ForegroundColor Yellow
    }
  }
}

if (-not $SkipProviders) {
  Write-Host ""
  Write-Host "== Installing full-potential providers / CLIs ==" -ForegroundColor Cyan
  $providerArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $Root "scripts\install-providers.ps1"))
  if ($SkipHeavy) { $providerArgs += "-SkipHeavy" }
  if ($SkipVon) { $providerArgs += "-SkipVon" }
  & powershell @providerArgs
  Refresh-InstallPath
} else {
  Write-Host "Skipping providers (-SkipProviders)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Running doctor..."
Refresh-InstallPath
node $DoctorEntry

Write-Host ""
Write-Host "Install complete." -ForegroundColor Cyan
Write-Host "1. Restart Cursor (or reload MCP servers)."
Write-Host "2. CLI: ai-coding-mcp / acs-doctor (restart shell if not on PATH)."
Write-Host "3. Open a product workspace and ask the agent to call get_project_context."
Write-Host "4. If anything missing: re-run this same install.ps1 (one command)."
Write-Host "See docs\CONNECT-EDITORS.md and docs\PROVIDERS.md."
