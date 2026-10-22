param(
  [Parameter(Mandatory=$true)][string]$InputPdf,
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $InputPdf).Path
$destination = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $destination) { throw 'Output directory must be new' }
New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
$scriptPath = Join-Path $PSScriptRoot 'benchmark.mjs'
$arguments = @('--expose-gc', ('"' + $scriptPath + '"'), 'run', ('"' + $source + '"'), ('"' + $destination + '"'))
$process = Start-Process -FilePath (Get-Command node).Source -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput ($destination + '.stdout.log') -RedirectStandardError ($destination + '.stderr.log')
$processHandle = $process.Handle # Retain handle so ExitCode remains available after polling.
$samples = @()
while (-not $process.HasExited) {
  $all = Get-CimInstance Win32_Process
  $ids = @($process.Id)
  do {
    $next = @($all | Where-Object { $_.ParentProcessId -in $ids -and $_.ProcessId -notin $ids } | ForEach-Object { $_.ProcessId })
    $ids += $next
  } while ($next.Count -gt 0)
  $live = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)
  $samples += [pscustomobject]@{ elapsedSeconds = ((Get-Date) - $process.StartTime).TotalSeconds; processes = $live.Count; workingSetBytes = ($live | Measure-Object WorkingSet64 -Sum).Sum }
  Start-Sleep -Milliseconds 250
  $process.Refresh()
}
$process.WaitForExit()
$result = @{ method='Recursive CIM tree + sum WorkingSet64; sampled, shared pages may be counted twice; monitor excluded'; peakMiB=($samples | Measure-Object workingSetBytes -Maximum).Maximum / 1MB; samples=$samples; exitCode=$process.ExitCode }
$result | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath ($destination + '.memory.json')
Write-Output ([pscustomobject]@{peakMiB=$result.peakMiB;exitCode=$result.exitCode} | ConvertTo-Json -Compress)
if ($process.ExitCode -ne 0) { throw 'Benchmark failed; inspect stderr log' }
