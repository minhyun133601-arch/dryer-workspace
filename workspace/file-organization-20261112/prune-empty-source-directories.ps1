$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$tmpRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'tmp'))
$reviewRoots = @('boiler-review-20261111','campus-rear-video-placement-20261111','drawing-review-qa','fence-review-20261109','preparation-review-20261111','rear-stair-review-20261111','stick-first-half','stick-second-half','stick3f-drawing-review','team3-liquid-20261110','tower-proof-review','wastewater-reference-review','yusan-2019-selected-review','yusan-evidence-review')
$removed = [System.Collections.Generic.List[string]]::new()
foreach ($name in $reviewRoots) {
    $root = [System.IO.Path]::GetFullPath((Join-Path $tmpRoot $name))
    if (-not $root.StartsWith($tmpRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe root' }
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
    $directories = @(Get-ChildItem -LiteralPath $root -Directory -Recurse -Force | Sort-Object { $_.FullName.Length } -Descending) + @(Get-Item -LiteralPath $root)
    foreach ($directory in $directories) {
        $absolute = [System.IO.Path]::GetFullPath($directory.FullName)
        if (-not $absolute.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe child path' }
        if (($directory.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Refusing link directory' }
        if (@(Get-ChildItem -LiteralPath $absolute -Force).Count -eq 0) {
            Remove-Item -LiteralPath $absolute -Force
            $removed.Add($absolute.Substring($projectRoot.Length + 1).Replace('\','/'))
        }
    }
}
$drawingRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '6. 폐수처리계통도'))
if (-not $drawingRoot.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe drawing root' }
if ((Test-Path -LiteralPath $drawingRoot -PathType Container) -and @(Get-ChildItem -LiteralPath $drawingRoot -Force).Count -eq 0) {
    Remove-Item -LiteralPath $drawingRoot -Force
    $removed.Add($drawingRoot.Substring($projectRoot.Length + 1).Replace('\','/'))
}
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'empty-directory-receipt.json'), ($removed | ConvertTo-Json -Depth 4), [System.Text.UTF8Encoding]::new($false))
Write-Output ('Removed ' + $removed.Count + ' verified empty directories; no files deleted.')
