$ErrorActionPreference='Stop'
$plan=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'finish_cleanup.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$root=[IO.Path]::GetFullPath([string]$plan.workspace).TrimEnd('\')
function SafePath([string]$relative) {
    $target=[IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $target.StartsWith(($root+'\'),[StringComparison]::OrdinalIgnoreCase)) {throw "Outside workspace: $target"}
    return $target
}
foreach($x in $plan.deleteFiles){
    $p=SafePath $x.source
    if ((Get-Item -LiteralPath $p -Force).Length -ne $x.size -or (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $x.sha256){throw "Changed cleanup file: $p"}
}
foreach($x in $plan.deleteFiles){Remove-Item -LiteralPath (SafePath $x.source) -Force}
foreach($relative in $plan.emptyCandidates){
    $p=SafePath $relative
    if(Test-Path -LiteralPath $p -PathType Container){
        $item=Get-Item -LiteralPath $p -Force
        if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -and @(Get-ChildItem -LiteralPath $p -Force).Count -eq 0){Remove-Item -LiteralPath $p -Force}
    }
}
[pscustomobject]@{AdditionalDeletedFiles=$plan.deleteFiles.Count;AdditionalDeletedBytes=($plan.deleteFiles | Measure-Object -Property size -Sum).Sum} | ConvertTo-Json
