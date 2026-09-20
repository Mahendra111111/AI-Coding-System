#Requires -Version 5.1
param(
  [switch]$RemoveCursorMcpEntry
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "AI Coding System uninstall helper" -ForegroundColor Cyan
Write-Host "This does NOT delete project brains under projects\ by default."

if ($RemoveCursorMcpEntry) {
  $CursorMcp = Join-Path $env:USERPROFILE ".cursor\mcp.json"
  if (Test-Path $CursorMcp) {
    $backup = "$CursorMcp.bak-uninstall-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $CursorMcp $backup
    $json = Get-Content $CursorMcp -Raw | ConvertFrom-Json
    if ($json.mcpServers -and $json.mcpServers."ai-coding-system") {
      $json.mcpServers.PSObject.Properties.Remove("ai-coding-system")
      ($json | ConvertTo-Json -Depth 10) | Set-Content $CursorMcp -Encoding UTF8
      Write-Host "Removed ai-coding-system from $CursorMcp (backup: $backup)"
    }
  }
}

Write-Host "To fully remove the system, delete: $Root"
Write-Host "Project brains (if any): $(Join-Path $Root 'projects')"
