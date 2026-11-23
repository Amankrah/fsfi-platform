# Headless screenshot + console capture of a route on the dev server.
# Usage: ./scripts/snap.ps1 -Path /countries/aurelia -Name overview [-Height 2400] [-Dark]
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [Parameter(Mandatory = $true)][string]$Name,
  [int]$Width = 1440,
  [int]$Height = 2200,
  [int]$Wait = 9000,
  [string]$Base = "http://localhost:3010",
  [string]$Out = "$env:TEMP\cursor\screenshots",
  [string]$Prefix = "fsfi"
)
$browser = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
New-Item -ItemType Directory -Force $Out | Out-Null
$profileDir = Join-Path $env:TEMP "fsfi-snap-profile"
$png = Join-Path $Out "$Prefix-$Name.png"
$log = Join-Path $Out "$Prefix-$Name.log"
$args = @(
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--user-data-dir=$profileDir", "--force-prefers-reduced-motion",
  "--window-size=$Width,$Height", "--virtual-time-budget=$Wait", "--run-all-compositor-stages-before-draw",
  "--enable-logging=stderr", "--v=0", "--screenshot=$png", "$Base$Path"
)
$p = Start-Process -FilePath $browser -ArgumentList $args -NoNewWindow -PassThru -RedirectStandardError $log -Wait
$console = Select-String -Path $log -Pattern "CONSOLE|Uncaught|Error" -ErrorAction SilentlyContinue | ForEach-Object { $_.Line }
Write-Output "screenshot: $png"
if ($console) { Write-Output "console:"; $console | Select-Object -First 30 } else { Write-Output "console: (no messages)" }
