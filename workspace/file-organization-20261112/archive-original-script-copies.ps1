$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$originalRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'original-scripts'))
$receiptPath = Join-Path $PSScriptRoot 'script-path-repairs.json'
$receipt = Get-Content -LiteralPath $receiptPath -Encoding UTF8 -Raw | ConvertFrom-Json
foreach ($entry in $receipt.repairedScripts) {
    $source = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $entry.originalCopyPath))
    $target = $source + '.original'
    foreach ($path in @($source,$target)) {
        if (-not $path.StartsWith($originalRoot + [System.IO.Path]::DirectorySeparatorChar,[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe original-copy path' }
    }
    Move-Item -LiteralPath $source -Destination $target
    $entry.originalCopyPath += '.original'
}
[System.IO.File]::WriteAllText($receiptPath,($receipt|ConvertTo-Json -Depth 8),[System.Text.UTF8Encoding]::new($false))
Write-Output 'Original script copies marked as non-executable archival bytes.'
