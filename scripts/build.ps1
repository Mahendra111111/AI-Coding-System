#Requires -Version 5.1
<#
.SYNOPSIS
  Build AI Coding System using full Node/npm paths (works when PATH is broken).
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "package.json"))) {
  $Root = "C:\AI-Coding-System"
}

$NodeDir = "C:\Program Files\nodejs"
$Node = Join-Path $NodeDir "node.exe"
$Npm = Join-Path $NodeDir "npm.cmd"
$GitCmd = "C:\Program Files\Git\cmd"
$GitBin = "C:\Program Files\Git\bin"

if (-not (Test-Path $Node)) {
  throw "Node.js not found at $Node. Install from https://nodejs.org or: winget install OpenJS.NodeJS.LTS"
}

$env:Path = "$NodeDir;$GitCmd;$GitBin;" + $env:Path
Set-Location $Root

Write-Host "Node: $(& $Node -v)"
Write-Host "Building in $Root ..."
& $Npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

$Entry = Join-Path $Root "dist\index.js"
if (-not (Test-Path $Entry)) { throw "Missing $Entry" }

& $Node -e "import { createServer } from './dist/mcp/tools.js'; const s = createServer(); const n = Object.keys(s._registeredTools || {}).length; console.log('MCP tools registered:', n); if (n < 20) process.exit(2);"
if ($LASTEXITCODE -ne 0) { throw "Tool registration check failed" }

Write-Host "Build OK. Reload Cursor MCP (Settings → MCP → refresh) to see all tools." -ForegroundColor Green
