$ErrorActionPreference = 'Stop'
$planPath = Join-Path $PSScriptRoot 'action_plan.json'
$plan = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8 | ConvertFrom-Json
$workspacePath = [IO.Path]::GetFullPath([string]$plan.workspace).TrimEnd('\')
$workspacePrefix = $workspacePath + '\'

function Resolve-WorkspaceTarget([string]$relativePath) {
    $absolutePath = [IO.Path]::GetFullPath((Join-Path $workspacePath $relativePath))
    if (-not $absolutePath.StartsWith($workspacePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $absolutePath" }
    return $absolutePath
}

# Check the complete deletion allowlist before removing the first file.
foreach ($entry in $plan.deleteFiles) {
    $sourcePath = Resolve-WorkspaceTarget $entry.source
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { throw "Missing planned file: $sourcePath" }
    if ((Get-Item -LiteralPath $sourcePath -Force).Length -ne $entry.size) { throw "Changed file size: $sourcePath" }
    if ($entry.canonical) {
        $canonicalPath = Resolve-WorkspaceTarget $entry.canonical
        if (-not (Test-Path -LiteralPath $canonicalPath -PathType Leaf)) { throw "Missing preserved original: $canonicalPath" }
        if ((Get-FileHash -LiteralPath $canonicalPath -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Original hash changed: $canonicalPath" }
    }
    if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Changed planned file: $sourcePath" }
}
foreach ($entry in $plan.moves) {
    $sourcePath = Resolve-WorkspaceTarget $entry.source
    $targetPath = Resolve-WorkspaceTarget $entry.target
    if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Missing move source: $sourcePath" }
    if (Test-Path -LiteralPath $targetPath) { throw "Destination already exists: $targetPath" }
    if ($targetPath.StartsWith(($sourcePath+'\'),[StringComparison]::OrdinalIgnoreCase)) { throw "Recursive self move: $sourcePath" }
}

$deleted = 0
foreach ($entry in $plan.deleteFiles) {
    Remove-Item -LiteralPath (Resolve-WorkspaceTarget $entry.source) -Force
    $deleted++
}
# Remove only empty folders; never recurse through a junction or remove unexpected contents.
foreach ($relativePath in $plan.cleanupDirectories) {
    $folderPath = Resolve-WorkspaceTarget $relativePath
    if (-not (Test-Path -LiteralPath $folderPath -PathType Container)) { continue }
    $item = Get-Item -LiteralPath $folderPath -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
    $directories = @(Get-ChildItem -LiteralPath $folderPath -Directory -Recurse -Force | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 } | Sort-Object { $_.FullName.Length } -Descending)
    foreach ($directory in $directories) {
        if (@(Get-ChildItem -LiteralPath $directory.FullName -Force).Count -eq 0) { Remove-Item -LiteralPath $directory.FullName -Force }
    }
    if (@(Get-ChildItem -LiteralPath $folderPath -Force).Count -eq 0) { Remove-Item -LiteralPath $folderPath -Force }
}
foreach ($entry in $plan.moves) {
    $sourcePath = Resolve-WorkspaceTarget $entry.source
    $targetPath = Resolve-WorkspaceTarget $entry.target
    [void](New-Item -ItemType Directory -Path (Split-Path -Parent $targetPath) -Force)
    Move-Item -LiteralPath $sourcePath -Destination $targetPath
}
[pscustomobject]@{DeletedFiles=$deleted;DeletedBytes=$plan.stats.deleteBytes;MovedItems=$plan.moves.Count;Workspace=$workspacePath} | ConvertTo-Json
