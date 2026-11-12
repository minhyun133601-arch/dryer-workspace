$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$plan = Get-Content -LiteralPath (Join-Path $taskRoot 'heat-move-plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceRoot = [IO.Path]::GetFullPath($plan.source_root).TrimEnd('\') + '\'
$targetRoot = [IO.Path]::GetFullPath($plan.target_root).TrimEnd('\') + '\'
$receipt = @()
foreach ($entry in $plan.entries) {
    $source = [IO.Path]::GetFullPath($entry.source)
    $target = [IO.Path]::GetFullPath($entry.destination)
    if (-not $source.StartsWith($sourceRoot, [StringComparison]::OrdinalIgnoreCase) -or -not $target.StartsWith($targetRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Move target escaped its verified root.' }
    if (Test-Path -LiteralPath $target) { throw 'An existing destination was preserved.' }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    Move-Item -LiteralPath $source -Destination $target -Force
    $receipt += [PSCustomObject]@{ Source=$source; Destination=$target; Status='moved' }
    $receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskRoot 'heat-move-receipt.json') -Encoding UTF8
}
Write-Output ($receipt | Group-Object Status | Select-Object Name, Count | ConvertTo-Json)
