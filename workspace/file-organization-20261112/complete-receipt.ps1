$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$moves = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'move-plan.json') -Encoding UTF8 -Raw | ConvertFrom-Json
foreach ($entry in $moves) {
    $target = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $entry.currentPath))
    if (-not $target.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe target path' }
    $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $entry.sha256) { throw ('Hash mismatch: ' + $entry.currentPath) }
    if (Test-Path -LiteralPath (Join-Path $projectRoot $entry.originalPath)) { throw ('Original file remains: ' + $entry.originalPath) }
}
$receipt = [ordered]@{
    date = '2026-11-12'; phase = 'completed-reviews-and-drawings'; permanentDeletions = 0
    movedFiles = $moves.Count; movedBytes = ($moves | Measure-Object bytes -Sum).Sum
    retained = @('apps','tests','tooling','docs','exports','sites','.backups','.playwright-mcp','drawing-review-originals-and-db','tmp/workspace-server.json','workspace/entrance-route-20261112')
    moves = $moves
}
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'move-receipt.json'), ($receipt | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
Write-Output ('Moved and verified ' + $moves.Count + ' files, ' + $receipt.movedBytes + ' bytes.')
