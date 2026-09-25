#Requires -Version 5.1
<#
.SYNOPSIS
  Install AI Coding System (local MCP server) at C:\AI-Coding-System
#>
param(
  [switch]$SkipCursorMcpMerge
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Root) { $Root = "C:\AI-Coding-System" }

Write-Host "== AI Coding System installer ==" -ForegroundColor Cyan
Write-Host "Root: $Root"

function Ensure-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# Refresh PATH for current session after possible winget installs
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Ensure-Command "node")) {
  Write-Host "Node.js not found. Installing OpenJS.NodeJS.LTS via winget..." -ForegroundColor Yellow
  winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")
}

if (-not (Ensure-Command "node")) {
  throw "Node.js is required but was not found after install. Restart the terminal and re-run install.ps1"
}

if (-not (Ensure-Command "git")) {
  Write-Host "Git not found. Installing Git.Git via winget..." -ForegroundColor Yellow
  winget install Git.Git --accept-package-agreements --accept-source-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Write-Host "Node: $(node -v)"
Write-Host "npm:  $(npm -v)"
if (Ensure-Command "git") { Write-Host "Git:  $(git --version)" } else { Write-Host "Git:  MISSING (optional for identity via remote)" -ForegroundColor Yellow }

Set-Location $Root
Write-Host "Installing npm dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "Building TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

$Entry = Join-Path $Root "dist\index.js"
if (-not (Test-Path $Entry)) { throw "Build output missing: $Entry" }

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
Write-Host "== Add this MCP config to your editor ==" -ForegroundColor Green
Write-Host $McpSnippet

$SnippetPath = Join-Path $Root "config\mcp-snippet.json"
$McpSnippet | Set-Content -Path $SnippetPath -Encoding UTF8
Write-Host "Wrote $SnippetPath"

if (-not $SkipCursorMcpMerge) {
  $CursorMcp = Join-Path $env:USERPROFILE ".cursor\mcp.json"
  $CursorDir = Split-Path $CursorMcp -Parent
  if (-not (Test-Path $CursorDir)) { New-Item -ItemType Directory -Path $CursorDir | Out-Null }

  $serverEntry = @{
    command = $NodeExe
    args = @($Entry)
    env = @{
      PATH = "C:\Program Files\nodejs;C:\Windows\System32;C:\Program Files\Git\cmd"
    }
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
      if (-not $json.mcpServers) {
        $json | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{}) -Force
      }
      $json.mcpServers | Add-Member -NotePropertyName "ai-coding-system" -NotePropertyValue ([pscustomobject]$serverEntry) -Force
      ($json | ConvertTo-Json -Depth 10) | Set-Content $CursorMcp -Encoding UTF8
      Write-Host "Merged ai-coding-system into $CursorMcp" -ForegroundColor Green
    }
  } else {
    $newJson = @{
      mcpServers = @{
        "ai-coding-system" = $serverEntry
      }
    }
    ($newJson | ConvertTo-Json -Depth 10) | Set-Content $CursorMcp -Encoding UTF8
    Write-Host "Created $CursorMcp" -ForegroundColor Green
  }

  # Ship the same always-apply ACS Cursor rule to the user-global rules folder.
  $RuleSrc = Join-Path $Root ".cursor\rules\ai-coding-system-mcp.mdc"
  $RulesDir = Join-Path $env:USERPROFILE ".cursor\rules"
  $RuleDest = Join-Path $RulesDir "ai-coding-system-mcp.mdc"
  if (Test-Path $RuleSrc) {
    if (-not (Test-Path $RulesDir)) { New-Item -ItemType Directory -Path $RulesDir | Out-Null }
    Copy-Item -Force $RuleSrc $RuleDest
    Write-Host "Installed Cursor rule: $RuleDest" -ForegroundColor Green
  } else {
    Write-Host "Cursor rule missing at $RuleSrc (skip)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Running doctor..."
node (Join-Path $Root "dist\cli\doctor.js")

Write-Host ""
Write-Host "Install complete." -ForegroundColor Cyan
Write-Host "1. Restart Cursor (or reload MCP servers)."
Write-Host "2. Open a project on D: and ask the agent to call get_project_context."
Write-Host "3. Project rules also live in .cursor\rules\ (same prompts for every clone)."
Write-Host "See docs\CONNECT-EDITORS.md for other editors."
