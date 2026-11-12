$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$organizationRoot = Join-Path $projectRoot 'workspace/file-organization-20261112'
$encoding = [System.Text.UTF8Encoding]::new($false)
if (Test-Path -LiteralPath (Join-Path $organizationRoot 'move-receipt.json')) { throw 'This one-time organization has already completed; see move-receipt.json.' }
$plan = [System.Collections.Generic.List[object]]::new()

function Get-ProjectPath([string]$relative) {
    $absolute = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
    if (-not $absolute.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Project path escaped: $relative"
    }
    return $absolute
}
function Add-Move([string]$source, [string]$target, [string]$purpose) {
    $absoluteSource = Get-ProjectPath $source
    $absoluteTarget = Get-ProjectPath $target
    if (-not (Test-Path -LiteralPath $absoluteSource -PathType Leaf)) { return }
    if (Test-Path -LiteralPath $absoluteTarget) { throw "Target already exists: $target" }
    $file = Get-Item -LiteralPath $absoluteSource
    $plan.Add([ordered]@{
        originalPath = $source.Replace('\','/')
        currentPath = $target.Replace('\','/')
        purpose = $purpose
        bytes = $file.Length
        sha256 = (Get-FileHash -LiteralPath $absoluteSource -Algorithm SHA256).Hash.ToLowerInvariant()
    })
}

# The original drawing bytes and names are preserved inside their topic.
foreach ($file in (Get-ChildItem -LiteralPath (Get-ProjectPath '6. 폐수처리계통도') -File)) {
    Add-Move ('6. 폐수처리계통도/' + $file.Name) ('references/wastewater-20261112/source/' + $file.Name) '원본 도면'
}

# Snapshot completed reviews only. Current entrance-route work and runtime
# server state stay where their running processes expect them.
$cutoff = [datetime]'2026-11-12T14:27:51'
$reviewDirectories = @(
    'boiler-review-20261111', 'campus-rear-video-placement-20261111', 'drawing-review-qa',
    'fence-review-20261109', 'preparation-review-20261111', 'rear-stair-review-20261111',
    'stick-first-half', 'stick-second-half', 'stick3f-drawing-review', 'team3-liquid-20261110',
    'tower-proof-review', 'wastewater-reference-review', 'yusan-2019-selected-review', 'yusan-evidence-review'
)
foreach ($directory in $reviewDirectories) {
    $sourceDirectory = Get-ProjectPath ('tmp/' + $directory)
    if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) { continue }
    foreach ($file in (Get-ChildItem -LiteralPath $sourceDirectory -File -Recurse -Force)) {
        $suffix = $file.FullName.Substring($sourceDirectory.Length + 1).Replace('\','/')
        Add-Move ('tmp/' + $directory + '/' + $suffix) ('workspace/reviews/' + $directory + '/' + $suffix) '완료된 판독·검토 자료'
    }
}

foreach ($file in (Get-ChildItem -LiteralPath (Get-ProjectPath 'tmp') -File -Force)) {
    if ($file.Name -eq 'workspace-server.json' -or $file.Name -like 'workspace-server.json.*.tmp' -or $file.LastWriteTime -gt $cutoff) { continue }
    $source = 'tmp/' + $file.Name
    if ($file.Extension -eq '.log') {
        $topic = switch -Regex ($file.Name) {
            '^boiler' { 'boiler'; break }
            '^grid' { 'layout'; break }
            '^interior' { 'interior'; break }
            '^office|^valve|^tank-parking' { 'campus-rear'; break }
            '^outdoor' { 'outdoor'; break }
            '^person' { 'person-navigation'; break }
            '^preparation' { 'preparation'; break }
            '^rear|^sanitation' { 'rear-stair'; break }
            '^tank-opening|^walking-tank' { 'walking-tanks'; break }
            '^wastewater' { 'wastewater'; break }
            default { 'project-checks' }
        }
        $date = $file.LastWriteTime.ToString('yyyyMMdd')
        Add-Move $source ('workspace/verification-archive/' + $date + '/' + $topic + '/' + $file.Name) '과거 검사·내보내기 로그'
    } elseif ($file.Name -eq 'wastewater-full-export-check.html') {
        Add-Move $source ('workspace/reviews/wastewater-20261112/export-check/' + $file.Name) '검증용 공유본 사본'
    } elseif ($file.Name -eq 'wastewater-ui-edit.mjs') {
        Add-Move $source ('workspace/reviews/wastewater-20261112/one-time-scripts/' + $file.Name) '완료된 일회 수정 스크립트'
    } elseif ($file.Name -eq 'finalize-boiler-evidence.py') {
        Add-Move $source ('workspace/reviews/boiler-review-20261111/scripts/' + $file.Name) '과거 판독 재현 도구'
    } elseif ($file.Name -eq 'render-burner-maintenance.py') {
        Add-Move $source ('workspace/reviews/dryer-burner-maintenance-20261112/scripts/' + $file.Name) '정비자료 렌더 도구'
    } elseif ($file.Extension -in @('.png','.jpg','.jpeg')) {
        $topic = if ($file.Name -like 'wastewater-*') { 'wastewater-20261112' } elseif ($file.Name -like 'tank-parking-*') { 'tank-parking-20261111' } else { 'rear-stair-20261111' }
        Add-Move $source ('workspace/reviews/' + $topic + '/screenshots/' + $file.Name) '과거 화면 검증 캡처'
    }
}
Add-Move 'wastewater-initial.png' 'workspace/reviews/wastewater-20261112/screenshots/wastewater-initial.png' '루트에 흩어진 검증 캡처'

$planPath = Join-Path $organizationRoot 'move-plan.json'
[System.IO.File]::WriteAllText($planPath, ($plan | ConvertTo-Json -Depth 6), $encoding)
$moved = [System.Collections.Generic.List[object]]::new()
foreach ($entry in $plan) {
    $source = Get-ProjectPath $entry.originalPath
    $target = Get-ProjectPath $entry.currentPath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Move-Item -LiteralPath $source -Destination $target
    $hash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne $entry.sha256) { throw "Moved bytes changed: $($entry.currentPath)" }
    $moved.Add($entry)
}

# Remove only empty source directories inside the explicitly selected source
# roots. No recursive deletion, and no active/new review directories touched.
$sourceRoots = @('6. 폐수처리계통도') + ($reviewDirectories | ForEach-Object { 'tmp/' + $_ })
$removedEmptyDirectories = [System.Collections.Generic.List[string]]::new()
foreach ($relative in $sourceRoots) {
    $directory = Get-ProjectPath $relative
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) { continue }
    $directories = @((Get-ChildItem -LiteralPath $directory -Directory -Recurse -Force | Sort-Object { $_.FullName.Length } -Descending).FullName) + @($directory)
    foreach ($empty in $directories) {
        if ([string]::IsNullOrEmpty($empty)) { continue }
        $resolved = [System.IO.Path]::GetFullPath($empty)
        if (-not $resolved.StartsWith($projectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe empty directory path' }
        if (@(Get-ChildItem -LiteralPath $resolved -Force).Count -eq 0) {
            Remove-Item -LiteralPath $resolved
            $removedEmptyDirectories.Add($resolved.Substring($projectRoot.Length + 1).Replace('\','/'))
        }
    }
}
$receipt = [ordered]@{
    date = '2026-11-12'; phase = 'completed-reviews-and-drawings'; permanentDeletions = 0
    movedFiles = $moved.Count; movedBytes = ($moved | Measure-Object bytes -Sum).Sum
    removedEmptyDirectories = $removedEmptyDirectories
    retained = @('apps','tests','tooling','docs','exports','sites','.backups','.playwright-mcp','근거 자료','tmp/workspace-server.json','workspace/entrance-route-20261112')
    moves = $moved
}
[System.IO.File]::WriteAllText((Join-Path $organizationRoot 'move-receipt.json'), ($receipt | ConvertTo-Json -Depth 8), $encoding)
Write-Output ('Moved ' + $moved.Count + ' files; SHA256 verified; no permanent deletions.')
