$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic
$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$plan = Get-Content -LiteralPath (Join-Path $taskRoot 'heat-only-recycle-plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$businessRoot = [IO.Path]::GetFullPath($plan.business)
$keepPath = [IO.Path]::GetFullPath($plan.keep)
$receipt = @()
foreach ($path in $plan.targets) {
    $target = [IO.Path]::GetFullPath($path)
    if ([IO.Path]::GetDirectoryName($target) -ne $businessRoot -or $target -eq $keepPath) { throw 'Target escaped the exact business folder.' }
    $item = Get-Item -LiteralPath $target -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse target preserved.' }
    $nestedLinks = Get-ChildItem -LiteralPath $target -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }
    if ($nestedLinks) { throw 'A nested reparse point was preserved.' }
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($target, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)
    $receipt += [PSCustomObject]@{ Path=$target; Status='recycled' }
    $receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskRoot 'heat-only-recycle-receipt.json') -Encoding UTF8
}
Write-Output ($receipt | Group-Object Status | Select-Object Name, Count | ConvertTo-Json)
