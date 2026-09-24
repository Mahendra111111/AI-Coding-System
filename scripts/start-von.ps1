# Start Von System One server for ACS decide_tools / decide_gate.
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\start-von.ps1
# Optional: -Port 8000 -Model von-1.1

param(
  [string]$Port = "8000",
  [string]$Model = "von-1.1",
  [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$scripts = Join-Path $env:APPDATA "Python\Python314\Scripts"
$vonExe = Join-Path $scripts "von.exe"

# Prefer Python 3.14 user Scripts; fall back to any von on PATH / other Python Scripts.
if (-not (Test-Path $vonExe)) {
  $fromPath = Get-Command von -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
  $fromSearch = Get-ChildItem -Path (Join-Path $env:APPDATA "Python") -Filter "von.exe" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  if ($fromPath) {
    $vonExe = $fromPath
    $scripts = Split-Path $vonExe -Parent
  } elseif ($fromSearch) {
    $vonExe = $fromSearch
    $scripts = Split-Path $vonExe -Parent
  }
}

if (-not (Test-Path $vonExe)) {
  Write-Host "von.exe not found. Install with:"
  Write-Host "  pip install git+https://github.com/wfzyx/von.git"
  exit 1
}

# Ensure this session (and User PATH) can resolve von without a full path.
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not (($userPath -split ";") -contains $scripts)) {
  [Environment]::SetEnvironmentVariable(
    "Path",
    ($userPath.TrimEnd(";") + ";" + $scripts),
    "User"
  )
  Write-Host "Added to User PATH: $scripts"
}
if (-not (($env:Path -split ";") -contains $scripts)) {
  $env:Path = "$env:Path;$scripts"
}

$url = "http://${HostAddress}:${Port}/"

# If something already answers on the port, do not start a second copy.
try {
  $probe = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
  if ($probe.StatusCode -ge 200) {
    Write-Host "Von already running at $url (status $($probe.StatusCode))."
    exit 0
  }
} catch {
  # not running - continue
}

Write-Host "Starting Von [$Model] at $url"
Write-Host "ACS decide_tools expects: http://127.0.0.1:$Port"
Write-Host "First request may download model weights (~1.5GB+). Keep this window open."
Write-Host "Press Ctrl+C to stop."

$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"
& $vonExe serve --model $Model --port $Port --host $HostAddress
