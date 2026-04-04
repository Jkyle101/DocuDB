param(
  [string]$BaseUrl = "http://localhost:3001"
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "seed-test-cases-data.js"
if (-not (Test-Path $scriptPath)) {
  throw "Missing seed script: $scriptPath"
}

& node $scriptPath --base-url $BaseUrl
exit $LASTEXITCODE
