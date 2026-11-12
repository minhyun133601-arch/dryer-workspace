param([string]$PlanPath = (Join-Path $PSScriptRoot 'move-plan.json'))
$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceRoot = [IO.Path]::GetFullPath([string]$plan.sourceRoot).TrimEnd('\')
$targetRoot = [IO.Path]::GetFullPath([string]$plan.targetRoot).TrimEnd('\')
$expectedSource = [IO.Path]::GetFullPath('C:\Users\user\Desktop\프로젝트').TrimEnd('\')
$pendingRoot = [IO.Path]::GetFullPath('C:\Users\user\Desktop\삭제 예정').TrimEnd('\')
if ($sourceRoot -ne $expectedSource -or -not $targetRoot.StartsWith($pendingRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'The resolved move roots are outside the authorized project and 삭제 예정 folder.'
}
function Resolve-Child([string]$root, [string]$relative) {
  if ([IO.Path]::IsPathRooted($relative)) { throw "Expected a relative path: $relative" }
  $resolved = [IO.Path]::GetFullPath((Join-Path $root $relative))
  if (-not $resolved.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes the verified root: $relative" }
  return $resolved
}
$entries = @($plan.entries)
$protected = @('근거 자료/건물3D 후보도면', '근거 자료/도면검토앱/cache', '근거 자료/도면검토앱/public', '근거 자료/도면검토앱/tools', 'references/team3-liquid-20261110', 'references/team3-outdoor-cards-20261110', 'references/설비이력카드/3팀', 'Image_20261110_0001.pdf')
if ((Get-FileHash -LiteralPath (Join-Path $sourceRoot $plan.policy.file) -Algorithm SHA256).Hash -ne $plan.policy.sha256) { throw 'The retained-asset policy changed after planning.' }
$seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($entry in $entries) {
  $source = Resolve-Child $sourceRoot ([string]$entry.relativePath)
  $target = Resolve-Child $targetRoot ([string]$entry.destinationRelativePath)
  foreach ($retained in $protected) {
    $retainedPath = Resolve-Child $sourceRoot $retained
    if ($source -eq $retainedPath -or $source.StartsWith($retainedPath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Protected drawing or Team 3 material: $source" }
  }
  if (-not $seen.Add($source)) { throw "Duplicate source: $source" }
  if (Test-Path -LiteralPath $target) { throw "Archive destination already exists; refusing to overwrite: $target" }
  $item = Get-Item -LiteralPath $source -Force
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Expected an ordinary file: $source" }
  if ($item.Length -ne [long]$entry.bytes) { throw "Source changed since planning: $source" }
}
$whole = @($plan.wholeDirectories)
$wholePaths = @()
foreach ($directory in $whole) {
  $relative = if ($directory -is [string]) { $directory } else { [string]$directory.relativePath }
  $source = Resolve-Child $sourceRoot $relative
  $target = Resolve-Child $targetRoot $relative
  foreach ($previous in $wholePaths) {
    if ($source.StartsWith($previous + '\', [StringComparison]::OrdinalIgnoreCase) -or $previous.StartsWith($source + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Whole-directory move paths overlap.' }
  }
  $wholePaths += $source
  $item = Get-Item -LiteralPath $source -Force
  if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Expected an ordinary directory: $source" }
  if (Test-Path -LiteralPath $target) { throw "Archive directory already exists: $target" }
  if (@(Get-ChildItem -LiteralPath $source -Directory -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw "Directory contains a reparse point: $source" }
  foreach ($file in Get-ChildItem -LiteralPath $source -File -Recurse -Force) {
    if (-not $seen.Contains($file.FullName)) { throw "Whole-folder move contains an unplanned file: $($file.FullName)" }
  }
}
[IO.Directory]::CreateDirectory($targetRoot) | Out-Null
$receiptPath = Join-Path $targetRoot '이동목록.json'
if (Test-Path -LiteralPath $receiptPath) { throw 'A receipt already exists; use a fresh archive directory.' }
[IO.File]::Copy([IO.Path]::GetFullPath($PlanPath), $receiptPath)
$journalPath = Join-Path $targetRoot '이동진행.jsonl'
$encoding = [Text.UTF8Encoding]::new($false)
Write-Output "Verified source: $sourceRoot"
Write-Output "Verified archive: $targetRoot"
foreach ($directory in $whole) {
  $relative = if ($directory -is [string]) { $directory } else { [string]$directory.relativePath }
  $source = Resolve-Child $sourceRoot $relative
  $target = Resolve-Child $targetRoot $relative
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
  [IO.Directory]::Move($source, $target)
  [IO.File]::AppendAllText($journalPath, ((@{ type='directory'; path=$relative } | ConvertTo-Json -Compress) + "`n"), $encoding)
}
$count = 0; $bytes = [long]0
foreach ($entry in $entries) {
  $source = Resolve-Child $sourceRoot ([string]$entry.relativePath)
  $target = Resolve-Child $targetRoot ([string]$entry.destinationRelativePath)
  if (Test-Path -LiteralPath $source) {
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    [IO.File]::Move($source, $target)
    [IO.File]::AppendAllText($journalPath, ((@{ type='file'; path=$entry.relativePath } | ConvertTo-Json -Compress) + "`n"), $encoding)
  }
  if ((Test-Path -LiteralPath $source) -or -not (Test-Path -LiteralPath $target)) { throw "Move verification failed: $source" }
  if ((Get-Item -LiteralPath $target -Force).Length -ne [long]$entry.bytes) { throw "Archive size mismatch: $target" }
  $count++; $bytes += [long]$entry.bytes
  if (($count % 1000) -eq 0) { Write-Output "Verified $count files" }
}
$summary = [ordered]@{ sourceRoot=$sourceRoot; targetRoot=$targetRoot; movedFiles=$count; movedBytes=$bytes; verified=$true; permanentDeletion=$false }
$summary | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $targetRoot '이동완료.json') -Encoding UTF8
$summary | ConvertTo-Json -Compress
