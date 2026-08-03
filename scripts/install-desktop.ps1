$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
  throw "This installer is for Windows. On Linux, run scripts/install-desktop.sh."
}

if (-not [Environment]::Is64BitOperatingSystem) {
  throw "PromptDe currently publishes desktop builds for 64-bit Windows only."
}

# Windows PowerShell 5.1 may otherwise negotiate an obsolete TLS version with
# GitHub. This remains compatible with modern PowerShell.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$repository = if ($env:PROMPTDE_REPOSITORY) { $env:PROMPTDE_REPOSITORY } else { "ITISH7/PromptDe" }
$headers = @{
  Accept = "application/vnd.github+json"
  "User-Agent" = "PromptDe-Installer"
}
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repository/releases/latest" -Headers $headers
$asset = $release.assets |
  Where-Object { $_.name -match "^PromptDe-Setup-.*\.exe$" } |
  Select-Object -First 1
if (-not $asset) {
  $asset = $release.assets |
    Where-Object { $_.name -match "\.exe$" } |
    Select-Object -First 1
}

if (-not $asset) {
  throw "The latest GitHub release does not contain a Windows installer."
}

$installer = Join-Path $env:TEMP $asset.name
Write-Host "Downloading PromptDe $($release.tag_name)..."
Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $installer -Headers $headers

try {
  Write-Host "Starting the PromptDe installer..."
  $process = Start-Process -FilePath $installer -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "The PromptDe installer exited with code $($process.ExitCode)."
  }
  Write-Host "PromptDe was installed successfully."
}
finally {
  Remove-Item $installer -Force -ErrorAction SilentlyContinue
}
