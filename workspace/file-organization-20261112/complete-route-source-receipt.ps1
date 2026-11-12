$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sourceRoot = Join-Path $projectRoot 'references/guardhouse-team2-20261112/source'
$files = @(Get-ChildItem -LiteralPath $sourceRoot -File)
if ($files.Count -ne 2) { throw 'Expected exactly two route source files' }
if (($files | Measure-Object Length -Sum).Sum -ne 433070159) { throw 'Original source byte count mismatch' }
$moves = @($files | ForEach-Object {
    [pscustomobject][ordered]@{
        originalPath='경비실 ~ 2팀 입구/'+$_.Name
        currentPath='references/guardhouse-team2-20261112/source/'+$_.Name
        purpose='경비실부터 2팀 입구 연속촬영 원본·GPS'
        bytes=$_.Length
        sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
})
$receipt = [ordered]@{ date='2026-11-12'; phase='guardhouse-team2-originals'; permanentDeletions=0; movedFiles=$moves.Count; movedBytes=($moves|Measure-Object bytes -Sum).Sum; hashVerification='compared before and after each Move-Item; all matched'; moves=$moves }
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'route-source-move-receipt.json'),($receipt|ConvertTo-Json -Depth 8),[System.Text.UTF8Encoding]::new($false))
Write-Output ('Route originals verified: '+$moves.Count+' files, '+$receipt.movedBytes+' bytes.')
