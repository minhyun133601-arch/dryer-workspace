$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'action_plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$rootPath = [IO.Path]::GetFullPath([string]$plan.workspace).TrimEnd('\')
$rootPrefix = $rootPath + '\'
function Guard([string]$path) {
    $full = [IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith($rootPrefix,[StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $full" }
    return $full
}
function Merge-MoveDirectory([string]$source,[string]$target) {
    $source=Guard $source; $target=Guard $target
    if (-not (Test-Path -LiteralPath $target)) { [IO.Directory]::Move($source,$target); return }
    foreach ($entry in @(Get-ChildItem -LiteralPath $source -Force)) {
        $destination=Guard (Join-Path $target $entry.Name)
        if ($entry.PSIsContainer) {
            if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                if (Test-Path -LiteralPath $destination) { throw "Unexpected duplicate junction: $destination" }
                [IO.Directory]::Move($entry.FullName,$destination)
            } elseif (-not (Test-Path -LiteralPath $destination)) {
                [IO.Directory]::Move($entry.FullName,$destination)
            } elseif (@(Get-ChildItem -LiteralPath $destination -Force).Count -eq 0) {
                Remove-Item -LiteralPath $destination -Force
                [IO.Directory]::Move($entry.FullName,$destination)
            } else { Merge-MoveDirectory $entry.FullName $destination }
        } elseif (Test-Path -LiteralPath $destination) {
            $left=Get-FileHash -LiteralPath $entry.FullName -Algorithm SHA256
            $right=Get-FileHash -LiteralPath $destination -Algorithm SHA256
            if ($left.Hash -ne $right.Hash) { throw "Conflicting file: $destination" }
            Remove-Item -LiteralPath $entry.FullName -Force
        } else { Move-Item -LiteralPath $entry.FullName -Destination $destination -Force }
    }
    if (@(Get-ChildItem -LiteralPath $source -Force).Count -eq 0) { Remove-Item -LiteralPath $source -Force }
}
$completed=0
foreach ($move in $plan.moves) {
    $source=Guard (Join-Path $rootPath $move.source)
    $target=Guard (Join-Path $rootPath $move.target)
    $sourceExists=Test-Path -LiteralPath $source
    $targetExists=Test-Path -LiteralPath $target
    if (-not $sourceExists -and $targetExists) { $completed++; continue }
    if (-not $sourceExists) { throw "Missing both source and target: $source" }
    [void][IO.Directory]::CreateDirectory((Split-Path -Parent $target))
    if ((Get-Item -LiteralPath $source -Force).PSIsContainer) { Merge-MoveDirectory $source $target }
    elseif (-not $targetExists) { Move-Item -LiteralPath $source -Destination $target -Force }
    else { throw "Unexpected existing file: $target" }
    $completed++
}
[pscustomobject]@{CompletedMoves=$completed;DeletedFiles=$plan.stats.deleteFiles;DeletedBytes=$plan.stats.deleteBytes} | ConvertTo-Json
