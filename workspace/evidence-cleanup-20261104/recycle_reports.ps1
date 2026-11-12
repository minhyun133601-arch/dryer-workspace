$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic
$auditDirectory = 'C:\Users\user\Desktop\프로젝트\workspace\evidence-cleanup-20261104'
$validated = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $auditDirectory 'validated-recycle-targets.json') | ConvertFrom-Json
$scopeDirectory = (Resolve-Path -LiteralPath 'C:\Users\user\Desktop\근거 자료').Path.TrimEnd('\')
if ($validated.scope -ne $scopeDirectory) { throw 'Unexpected report scope.' }
$receipts = @()
foreach ($target in $validated.targets) {
    $absoluteTarget = [System.IO.Path]::GetFullPath($target.path)
    if ($absoluteTarget -eq $scopeDirectory -or -not $absoluteTarget.StartsWith($scopeDirectory+'\',[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Target outside authorized scope.' }
    foreach ($keepPath in $validated.keep_paths) { if ($keepPath -eq $absoluteTarget -or $keepPath.StartsWith($absoluteTarget+'\',[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Protected dryer source would be affected.' } }
    if (-not (Test-Path -LiteralPath $absoluteTarget)) { $receipts += [pscustomobject]@{Path=$absoluteTarget;Status='already_absent'}; continue }
    try {
        if ($target.is_directory) {
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($absoluteTarget,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
        } else {
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($absoluteTarget,[Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,[Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin,[Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
        }
        if (Test-Path -LiteralPath $absoluteTarget) { throw 'Target remains after recycle operation.' }
        $receipts += [pscustomobject]@{Path=$absoluteTarget;Status='recycled'}
    } catch {
        $receipts += [pscustomobject]@{Path=$absoluteTarget;Status='error';Error=$_.Exception.Message}
    }
    if ($receipts.Count % 20 -eq 0) { Write-Output ('Processed '+$receipts.Count+' / '+$validated.targets.Count) }
}
$receipts | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $auditDirectory 'recycle-receipt.json')
$errors = @($receipts | Where-Object Status -eq 'error')
[pscustomobject]@{Processed=$receipts.Count;Recycled=@($receipts | Where-Object Status -eq 'recycled').Count;Errors=$errors.Count} | ConvertTo-Json -Compress
if ($errors.Count) { exit 1 }
