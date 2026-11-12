param([Parameter(Mandatory=$true)][string]$JobPath)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$workerStarted = [DateTime]::UtcNow
$jobDirectory = [IO.Path]::GetFullPath($JobPath)
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
if (([IO.Path]::GetDirectoryName($jobDirectory).TrimEnd('\') -ne $temporaryRoot) -or -not ([IO.Path]::GetFileName($jobDirectory).StartsWith('heechang-office-'))) { exit 2 }
$utf8 = New-Object Text.UTF8Encoding($false)
$job = [IO.File]::ReadAllText((Join-Path $jobDirectory 'job.json')) | ConvertFrom-Json
$sourcePath = Join-Path $jobDirectory ([string]$job.sourceName)
$outputPath = Join-Path $jobDirectory 'output.pdf'
$resultPath = Join-Path $jobDirectory 'result.json'
$ownershipPath = Join-Path $jobDirectory 'ownership.json'
$application = $null
$document = $null
$blank = $null
$owned = $false
$sharedPowerPoint = $false
$collection = $null
$wordOptions = $null
$wordOptionValues = @{}
$applicationOptionValues = @{}
$ownership = @{ ownedProcesses = @(); sharedPowerPoint = $false; sourcePath = $sourcePath; outputPath = $outputPath }
$failureCode = 'office_conversion_failed'
$failureMessage = 'Office could not export this document. Check password, document integrity, and Office activation.'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OfficeWindowOwner {
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
}
'@

function Save-Ownership {
    [IO.File]::WriteAllText($ownershipPath, ($ownership | ConvertTo-Json -Depth 5 -Compress), $utf8)
}
function Register-OwnedProcess([int]$ProcessId, [string]$ExpectedName, [int[]]$BeforeIds) {
    if ($ProcessId -le 0 -or $BeforeIds -contains $ProcessId) { throw 'Cannot own an existing Office process.' }
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    if ($process.ProcessName -ne $ExpectedName -or $process.StartTime.ToUniversalTime() -lt $workerStarted.AddSeconds(-2)) { throw 'Office process identity did not match this conversion.' }
    $ownership.ownedProcesses = @(@{ id=$ProcessId; name=$ExpectedName; startTicks=[string]$process.StartTime.ToUniversalTime().Ticks; allowKill=$true })
    Save-Ownership
    return $true
}
function Process-ForWindow([long]$WindowHandle) {
    [uint32]$ownerId = 0
    [void][OfficeWindowOwner]::GetWindowThreadProcessId([IntPtr]$WindowHandle, [ref]$ownerId)
    return [int]$ownerId
}
function Get-OfficeProperty($Object, [string]$Name, [object[]]$Arguments = @()) {
    return ,$Object.GetType().InvokeMember($Name, [Reflection.BindingFlags]::GetProperty, $null, $Object, $Arguments)
}
function Set-OfficeProperty($Object, [string]$Name, $Value) {
    $rawValue = if ($null -eq $Value) { $null } else { $Value.PSObject.BaseObject }
    [void]$Object.GetType().InvokeMember($Name, [Reflection.BindingFlags]::SetProperty, $null, $Object, @($rawValue))
}
function Invoke-OfficeMethod($Object, [string]$Name, [object[]]$Arguments = @()) {
    $rawArguments = New-Object object[] $Arguments.Length
    for ($argumentIndex = 0; $argumentIndex -lt $Arguments.Length; $argumentIndex++) {
        if ($null -eq $Arguments[$argumentIndex]) { $rawArguments[$argumentIndex] = $null }
        else { $rawArguments[$argumentIndex] = $Arguments[$argumentIndex].PSObject.BaseObject }
    }
    return ,$Object.GetType().InvokeMember($Name, [Reflection.BindingFlags]::InvokeMethod, $null, $Object, $rawArguments)
}
function Configure-OfficeProperty([string]$Name, $Value) {
    if (-not $applicationOptionValues.ContainsKey($Name)) { $applicationOptionValues[$Name] = Get-OfficeProperty $application $Name }
    Set-OfficeProperty $application $Name $Value
}
function Assert-MacroFreePresentation {
    if ([IO.Path]::GetExtension($sourcePath) -ne '.pptx') { throw 'An open PowerPoint session only supports a macro-free PPTX copy.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($sourcePath)
    try {
        $typesEntry = $archive.GetEntry('[Content_Types].xml')
        if (-not $typesEntry) { throw 'Missing presentation content types.' }
        $reader = New-Object IO.StreamReader($typesEntry.Open())
        try { $types = $reader.ReadToEnd() } finally { $reader.Dispose() }
        if ($types -notmatch 'application/vnd\.openxmlformats-officedocument\.presentationml\.presentation\.main\+xml' -or $types -match 'macroEnabled|vbaProject') { throw 'Macro-enabled content cannot share an open PowerPoint session.' }
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -match '(?i)vba|macros') { throw 'VBA content cannot share an open PowerPoint session.' }
        }
    } finally { $archive.Dispose() }
}

try {
    if ([IO.Path]::GetFileName($sourcePath) -ne [string]$job.sourceName -or -not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { throw 'Invalid conversion source.' }
    $password = [Guid]::NewGuid().ToString('N').Substring(0, 12)
    $missing = [Type]::Missing
    switch ([string]$job.format) {
        'word' {
            $beforeIds = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
            $application = New-Object -ComObject Word.Application
            $collection = Get-OfficeProperty $application 'Documents'
            if ((Get-OfficeProperty $collection 'Count') -ne 0) { $failureCode = 'office_busy'; throw 'Word did not create an isolated session.' }
            $newProcesses = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $beforeIds -notcontains $_.Id })
            if ($newProcesses.Count -ne 1) { throw 'Cannot identify the isolated Word session.' }
            $owned = Register-OwnedProcess $newProcesses[0].Id 'WINWORD' $beforeIds
            Configure-OfficeProperty 'AutomationSecurity' 3
            Set-OfficeProperty $application 'Visible' $false
            Configure-OfficeProperty 'DisplayAlerts' 0
            # Word is a single-use COM server; the new, empty process above belongs to this job.
            $wordOptions = Get-OfficeProperty $application 'Options'
            foreach ($option in @('UpdateLinksAtOpen','SaveNormalPrompt')) { $wordOptionValues[$option] = Get-OfficeProperty $wordOptions $option; Set-OfficeProperty $wordOptions $option $false }
            $document = Invoke-OfficeMethod $collection 'Open' @($sourcePath, $false, $true, $false, $password)
            [void](Invoke-OfficeMethod $document 'ExportAsFixedFormat' @($outputPath, 17, $false, 0, 0, 1, 1, 0, $false, $true, 0, $true, $true, $false))
        }
        'excel' {
            $beforeIds = @(Get-Process EXCEL -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
            $application = New-Object -ComObject Excel.Application
            $owned = Register-OwnedProcess (Process-ForWindow (Get-OfficeProperty $application 'Hwnd')) 'EXCEL' $beforeIds
            Set-OfficeProperty $application 'Visible' $false
            Configure-OfficeProperty 'DisplayAlerts' $false
            Configure-OfficeProperty 'EnableEvents' $false
            Configure-OfficeProperty 'AskToUpdateLinks' $false
            Configure-OfficeProperty 'AutomationSecurity' 3
            $collection = Get-OfficeProperty $application 'Workbooks'
            $document = Invoke-OfficeMethod $collection 'Open' @($sourcePath, 0, $true, 1, $password, $password, $true)
            # IgnorePrintAreas=false retains every saved worksheet print area/layout.
            [void](Invoke-OfficeMethod $document 'ExportAsFixedFormat' @(0, $outputPath, 0, $false, $false))
        }
        'powerpoint' {
            $beforeIds = @(Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
            if ($beforeIds.Count) {
                $failureCode = 'office_busy'
                Assert-MacroFreePresentation
                $sharedPowerPoint = $true
                $ownership.sharedPowerPoint = $true
                Save-Ownership
            }
            $application = New-Object -ComObject PowerPoint.Application
            $collection = Get-OfficeProperty $application 'Presentations'
            if (-not $sharedPowerPoint) {
                $newProcesses = @(Get-Process POWERPNT -ErrorAction SilentlyContinue | Where-Object { $beforeIds -notcontains $_.Id })
                if ((Get-OfficeProperty $collection 'Count') -ne 0 -or [int](Get-OfficeProperty $application 'Visible') -ne 0 -or $newProcesses.Count -ne 1) {
                    # A user may have launched PowerPoint while COM was starting.
                    Assert-MacroFreePresentation
                    $sharedPowerPoint = $true; $ownership.sharedPowerPoint = $true; Save-Ownership
                } else {
                    $owned = Register-OwnedProcess $newProcesses[0].Id 'POWERPNT' $beforeIds
                    Configure-OfficeProperty 'DisplayAlerts' 1
                    Configure-OfficeProperty 'AutomationSecurity' 3
                }
            }
            # Shared sessions are never reconfigured or quit. Only this readonly,
            # macro-free copied presentation is opened without a document window.
            $failureCode = 'office_conversion_failed'
            $document = Invoke-OfficeMethod $collection 'Open' @($sourcePath, -1, 0, 0)
            [void](Invoke-OfficeMethod $document 'SaveAs' @($outputPath, 32))
        }
        default { throw 'Unsupported Office application.' }
    }
    if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) { throw 'Office did not produce PDF output.' }
    [IO.File]::WriteAllText($resultPath, (@{ok=$true;warnings=@()} | ConvertTo-Json -Compress), $utf8)
} catch {
    [IO.File]::WriteAllText($resultPath, (@{ok=$false;code=$failureCode;message=$failureMessage;diagnostic=([string]$_.Exception.Message + ' | ' + [string]$_.ScriptStackTrace)} | ConvertTo-Json -Compress), $utf8)
} finally {
    if ($null -ne $document) {
        try {
            switch ([string]$job.format) { 'word' { [void](Invoke-OfficeMethod $document 'Close' @(0)) }; 'excel' { [void](Invoke-OfficeMethod $document 'Close' @($false)) }; 'powerpoint' { [void](Invoke-OfficeMethod $document 'Close') } }
        } catch {}
        try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) } catch {}
    }
    if ($null -ne $wordOptions) {
        foreach ($option in $wordOptionValues.Keys) { try { Set-OfficeProperty $wordOptions $option $wordOptionValues[$option] } catch {} }
        try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordOptions) } catch {}
    }
    if ($null -ne $blank) { try { [void](Invoke-OfficeMethod $blank 'Close' @(0)); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($blank) } catch {} }
    if ($null -ne $application) {
        if ($owned) {
            foreach ($option in $applicationOptionValues.Keys) { try { Set-OfficeProperty $application $option $applicationOptionValues[$option] } catch {} }
            try {
                $remaining = Get-OfficeProperty $collection 'Count'
                if ($remaining -eq 0) {
                    if ([string]$job.format -eq 'word') { [void](Invoke-OfficeMethod $application 'Quit' @(0)) } else { [void](Invoke-OfficeMethod $application 'Quit') }
                } else {
                    # Do not terminate a session if another document was opened into it.
                    foreach ($record in $ownership.ownedProcesses) { $record.allowKill = $false }; Save-Ownership
                }
            } catch {}
        }
        try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($application) } catch {}
    }
    if ($null -ne $collection) { try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($collection) } catch {} }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
if (-not (Test-Path -LiteralPath $resultPath)) { exit 1 }
$finalResult = [IO.File]::ReadAllText($resultPath) | ConvertFrom-Json
if (-not $finalResult.ok) { exit 1 }
