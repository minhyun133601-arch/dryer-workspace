$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sourceRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '경비실 ~ 2팀 입구'))
$targetRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'references/guardhouse-team2-20261112/source'))
foreach ($path in @($sourceRoot,$targetRoot)) {
    if (-not $path.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar,[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Path outside project' }
}
New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
$moves = [System.Collections.Generic.List[object]]::new()
foreach ($file in (Get-ChildItem -LiteralPath $sourceRoot -File -Force)) {
    $target = Join-Path $targetRoot $file.Name
    if (Test-Path -LiteralPath $target) { throw 'Target already exists' }
    $before = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    Move-Item -LiteralPath $file.FullName -Destination $target
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $before) { throw 'Hash changed' }
    $moves.Add([pscustomobject][ordered]@{ originalPath='경비실 ~ 2팀 입구/'+$file.Name; currentPath='references/guardhouse-team2-20261112/source/'+$file.Name; purpose='경비실부터 2팀 입구 연속촬영 원본·GPS'; bytes=$file.Length; sha256=$before })
}
if (@(Get-ChildItem -LiteralPath $sourceRoot -Force).Count -eq 0) { Remove-Item -LiteralPath $sourceRoot -Force }
$receipt = [ordered]@{ date='2026-11-12'; phase='guardhouse-team2-originals'; permanentDeletions=0; movedFiles=$moves.Count; movedBytes=($moves|Measure-Object bytes -Sum).Sum; moves=$moves }
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'route-source-move-receipt.json'),($receipt|ConvertTo-Json -Depth 8),[System.Text.UTF8Encoding]::new($false))
Write-Output ('Moved route originals: '+$moves.Count+' files, '+$receipt.movedBytes+' bytes; verified SHA256.')
