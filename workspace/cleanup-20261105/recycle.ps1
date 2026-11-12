$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic
$auditRoot = $PSScriptRoot
$plan = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $auditRoot 'plan.json') | ConvertFrom-Json
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $auditRoot '..\..')).Path.TrimEnd('\')
if ($plan.root -ne $taskRoot -or $plan.mode -ne 'recycle_bin_only') { throw 'Unexpected cleanup scope.' }

function Assert-ProjectPath([string]$targetPath) {
    $absolute = [System.IO.Path]::GetFullPath($targetPath)
    if ($absolute -eq $taskRoot -or -not $absolute.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target outside project.' }
    $ancestor = $absolute
    while ($ancestor -and $ancestor -ne $taskRoot) {
        if (Test-Path -LiteralPath $ancestor) {
            $entry = Get-Item -Force -LiteralPath $ancestor
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point must be preserved.' }
        }
        $ancestor = Split-Path -Parent $ancestor
    }
    return $absolute
}

$receipts = @()
foreach ($target in $plan.targets) {
    $absolute = Assert-ProjectPath $target.path
    foreach ($keep in $plan.protected) {
        if ($keep.path -eq $absolute -or $keep.path.StartsWith($absolute + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Protected file overlaps cleanup target.' }
    }
    if (-not (Test-Path -LiteralPath $absolute)) { throw "Frozen cleanup target is absent: $absolute" }
    if ($target.evidence) {
        $retainedHash = (Get-FileHash -LiteralPath $target.evidence.retained -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($retainedHash -ne $target.evidence.sha256) { throw 'Retained original hash changed.' }
    }
    if ($target.is_directory) {
        $children = @(Get-ChildItem -Force -Recurse -LiteralPath $absolute)
        if (@($children | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Directory contains a reparse point.' }
        $files = @($children | Where-Object { -not $_.PSIsContainer })
        $bytes = [int64](($files | Measure-Object -Property Length -Sum).Sum)
        if ($files.Count -ne $target.files -or $bytes -ne $target.bytes) { throw 'Directory changed since inventory.' }
    } else {
        if ((Get-Item -LiteralPath $absolute).Length -ne $target.bytes) { throw 'File changed since inventory.' }
    }
    try {
        if ($target.is_directory) {
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($absolute, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
        } else {
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($absolute, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
        }
        if (Test-Path -LiteralPath $absolute) { throw 'Target remains after recycle operation.' }
        $receipts += [pscustomobject]@{path=$absolute;status='recycled';files=$target.files;bytes=$target.bytes}
    } catch {
        $receipts += [pscustomobject]@{path=$absolute;status='error';error=$_.Exception.Message;files=0;bytes=0}
    }
    $receipts | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $auditRoot 'recycle-receipt.json')
}

$moved = @()
foreach ($move in $plan.moves) {
    $source = Assert-ProjectPath $move.source
    $destination = Assert-ProjectPath $move.destination
    if (Test-Path -LiteralPath $destination) { throw 'Audit destination already exists.' }
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $move.sha256) { throw 'Audit source changed.' }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Move-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $move.sha256) { throw 'Moved audit checksum mismatch.' }
    $moved += [pscustomobject]@{source=$source;destination=$destination;sha256=$move.sha256}
}
$moved | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $auditRoot 'moved-audits.json')

$mismatches = @()
foreach ($keep in $plan.protected) {
    if (-not (Test-Path -LiteralPath $keep.path)) { $mismatches += $keep.path; continue }
    if ((Get-FileHash -LiteralPath $keep.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $keep.sha256) { $mismatches += $keep.path }
}
$errors = @($receipts | Where-Object status -eq 'error')
$successful = @($receipts | Where-Object status -eq 'recycled')
$verification = [pscustomobject]@{
    recycled_targets=$successful.Count
    recycled_files=[int](($successful | Measure-Object -Property files -Sum).Sum)
    recycled_bytes=[int64](($successful | Measure-Object -Property bytes -Sum).Sum)
    audit_files_moved=$moved.Count
    protected_files_verified=$plan.protected.Count
    mismatches=$mismatches
    recycle_errors=$errors
    recycle_bin_emptied=$false
}
$verification | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $auditRoot 'verification.json')
$verification | ConvertTo-Json -Depth 6 -Compress
if ($errors.Count -or $mismatches.Count) { exit 1 }
