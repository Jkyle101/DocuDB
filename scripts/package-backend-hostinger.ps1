param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$serverDir = Join-Path $ProjectRoot "server"
if (-not (Test-Path $serverDir)) {
  throw "Server directory not found: $serverDir"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stageDir = Join-Path $ProjectRoot "backend-deploy-staging-$timestamp"
$zipPath = Join-Path $ProjectRoot "docudb-backend-hostinger-$timestamp.zip"
$uploadsSource = Join-Path $serverDir "uploads"
$uploadsDest = Join-Path $stageDir "uploads"

if (Test-Path $stageDir) {
  Remove-Item -LiteralPath $stageDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

$copyTargets = @(
  ".env.example",
  "controllers",
  "emailService.js",
  "index.js",
  "models",
  "package-lock.json",
  "package.json",
  "public",
  "routes"
)

foreach ($target in $copyTargets) {
  $sourcePath = Join-Path $serverDir $target
  if (Test-Path $sourcePath) {
    Copy-Item -LiteralPath $sourcePath -Destination $stageDir -Recurse -Force
  }
}

New-Item -ItemType Directory -Path $uploadsDest -Force | Out-Null
$uploadedFileCount = 0

if (Test-Path $uploadsSource) {
  Get-ChildItem -LiteralPath $uploadsSource -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $uploadsDest -Recurse -Force
    if (-not $_.PSIsContainer -and $_.Name -ne ".gitkeep") {
      $uploadedFileCount += 1
    }
  }
}

$manifest = [ordered]@{
  createdAt = (Get-Date).ToString("o")
  stageDirectory = $stageDir
  packagePath = $zipPath
  uploadsSource = $uploadsSource
  uploadFileCount = $uploadedFileCount
  note = if ($uploadedFileCount -gt 0) {
    "Uploaded files were included in this backend package."
  } else {
    "No uploaded files were packaged. Deploying this zip without restoring uploads separately will break preview/download for files stored only in MongoDB metadata."
  }
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $stageDir "storage-manifest.json")

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

function New-ZipFromDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDirectory,
    [Parameter(Mandatory = $true)]
    [string]$DestinationZipPath,
    [int]$MaxAttempts = 4,
    [int]$RetryDelaySeconds = 3
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      if (Test-Path $DestinationZipPath) {
        Remove-Item -LiteralPath $DestinationZipPath -Force
      }

      [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $SourceDirectory,
        $DestinationZipPath,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
      )
      return
    } catch {
      if ($attempt -ge $MaxAttempts) {
        throw
      }
      Write-Warning "Zip creation attempt $attempt failed: $($_.Exception.Message). Retrying in $RetryDelaySeconds second(s)..."
      Start-Sleep -Seconds $RetryDelaySeconds
    }
  }
}

New-ZipFromDirectory -SourceDirectory $stageDir -DestinationZipPath $zipPath

Write-Output "Created backend package: $zipPath"
Write-Output "Upload files included: $uploadedFileCount"

if ($uploadedFileCount -eq 0) {
  Write-Warning "This package only contains an empty uploads directory. Restore or copy server/uploads separately before deploying."
}
