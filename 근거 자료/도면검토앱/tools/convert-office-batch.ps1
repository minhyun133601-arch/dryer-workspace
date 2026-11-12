param([Parameter(Mandatory=$true)][string]$JobPath)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$workerStarted = [DateTime]::UtcNow
$jobDirectory = [IO.Path]::GetFullPath($JobPath)
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
if (([IO.Path]::GetDirectoryName($jobDirectory).TrimEnd('\') -ne $temporaryRoot) -or -not ([IO.Path]::GetFileName($jobDirectory).StartsWith('heechang-office-batch-'))) { exit 2 }
$utf8 = New-Object Text.UTF8Encoding($false)
$job = [IO.File]::ReadAllText((Join-Path $jobDirectory 'job.json')) | ConvertFrom-Json
$application = $null; $collection = $null; $document = $null; $owned = $false
$ownership = @{ ownedProcesses=@(); batch=$true }
$ownershipPath = Join-Path $jobDirectory 'ownership.json'
$format = [string]$job.format
switch ($format) {
 'excel' { $expectedName='EXCEL'; $progId='Excel.Application'; $collectionName='Workbooks'; $extensions=@('.xls','.xlsx') }
 'word' { $expectedName='WINWORD'; $progId='Word.Application'; $collectionName='Documents'; $extensions=@('.doc','.docx') }
 'powerpoint' { $expectedName='POWERPNT'; $progId='PowerPoint.Application'; $collectionName='Presentations'; $extensions=@('.ppt','.pptx') }
 default { throw 'Unsupported Office batch format.' }
}
$existingIds = @(Get-Process $expectedName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ExcelBatchWindowOwner {
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
}
'@
function Save-Ownership { [IO.File]::WriteAllText($ownershipPath, ($ownership | ConvertTo-Json -Depth 5 -Compress), $utf8) }
function Get-OfficeProperty($Object, [string]$Name) {
 return ,$Object.GetType().InvokeMember($Name, [Reflection.BindingFlags]::GetProperty, $null, $Object, @())
}
function Set-OfficeProperty($Object, [string]$Name, $Value) {
 [void]$Object.GetType().InvokeMember($Name, [Reflection.BindingFlags]::SetProperty, $null, $Object, @($Value.PSObject.BaseObject))
}
function Invoke-OfficeMethod($Object, [string]$Name, [object[]]$Arguments = @()) {
 $rawArguments = New-Object object[] $Arguments.Length
 for ($i=0; $i -lt $Arguments.Length; $i++) {
  if ($null -eq $Arguments[$i]) { $rawArguments[$i]=$null } else { $rawArguments[$i]=$Arguments[$i].PSObject.BaseObject }
 }
 return ,$Object.GetType().InvokeMember($Name, [Reflection.BindingFlags]::InvokeMethod, $null, $Object, $rawArguments)
}
try {
 if ($format -eq 'powerpoint' -and $existingIds.Count) { throw 'An existing user PowerPoint session is preserved. Close it before an isolated batch.' }
 $application = New-Object -ComObject $progId
 if ($format -eq 'excel') {
  [uint32]$officeProcessId = 0
  [void][ExcelBatchWindowOwner]::GetWindowThreadProcessId([IntPtr](Get-OfficeProperty $application 'Hwnd'), [ref]$officeProcessId)
  $officeProcess = Get-Process -Id ([int]$officeProcessId) -ErrorAction Stop
 } else {
  $newProcesses=@(Get-Process $expectedName -ErrorAction SilentlyContinue|Where-Object{$existingIds -notcontains $_.Id})
  if($newProcesses.Count -ne 1){throw 'Cannot identify an isolated conversion Office process.'}
  $officeProcess=$newProcesses[0]; $officeProcessId=[uint32]$officeProcess.Id
 }
 if (($existingIds -contains [int]$officeProcessId) -or $officeProcess.ProcessName -ne $expectedName -or $officeProcess.StartTime.ToUniversalTime() -lt $workerStarted.AddSeconds(-2)) { throw 'Cannot identify an isolated conversion Office process.' }
 $owned=$true
 $ownership.ownedProcesses=@(@{id=[int]$officeProcessId;name=$expectedName;startTicks=[string]$officeProcess.StartTime.ToUniversalTime().Ticks;allowKill=$true})
 Save-Ownership
 if($format -ne 'powerpoint'){Set-OfficeProperty $application 'Visible' $false}
 Set-OfficeProperty $application 'AutomationSecurity' 3
 if($format -eq 'excel'){
  Set-OfficeProperty $application 'DisplayAlerts' $false
  Set-OfficeProperty $application 'EnableEvents' $false
  Set-OfficeProperty $application 'AskToUpdateLinks' $false
  Set-OfficeProperty $application 'ScreenUpdating' $false
 } elseif($format -eq 'word'){
  Set-OfficeProperty $application 'DisplayAlerts' 0
  $options=Get-OfficeProperty $application 'Options'
  Set-OfficeProperty $options 'UpdateLinksAtOpen' $false
  Set-OfficeProperty $options 'SaveNormalPrompt' $false
  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($options)
 } else {Set-OfficeProperty $application 'DisplayAlerts' 1}
 $collection=Get-OfficeProperty $application $collectionName
 if ((Get-OfficeProperty $collection 'Count') -ne 0) { throw 'Isolated Office session was not empty.' }
 foreach ($item in $job.items) {
  $timer=[Diagnostics.Stopwatch]::StartNew()
  $identifier=[string]$item.id
  if ($identifier -notmatch '^[a-f0-9]{64}$') { throw 'Invalid job identity.' }
  $sourceName=[string]$item.sourceName
  if ([IO.Path]::GetFileName($sourceName) -ne $sourceName -or [IO.Path]::GetExtension($sourceName) -notin $extensions) { throw 'Invalid copied source name.' }
  $source=Join-Path $jobDirectory $sourceName
  $output=Join-Path $jobDirectory ($identifier+'.pdf')
  $result=@{id=$identifier;ok=$false;outputName=($identifier+'.pdf')}
  try {
   $password=[Guid]::NewGuid().ToString('N').Substring(0,12)
   switch($format){
    'excel' {
     $document=Invoke-OfficeMethod $collection 'Open' @($source,0,$true,1,$password,$password,$true)
     [void](Invoke-OfficeMethod $document 'ExportAsFixedFormat' @(0,$output,0,$false,$false))
    }
    'word' {
     $document=Invoke-OfficeMethod $collection 'Open' @($source,$false,$true,$false,$password)
     [void](Invoke-OfficeMethod $document 'ExportAsFixedFormat' @($output,17,$false,0,0,1,1,0,$false,$true,0,$true,$true,$false))
    }
    'powerpoint' {
     $document=Invoke-OfficeMethod $collection 'Open' @($source,-1,0,0)
     [void](Invoke-OfficeMethod $document 'SaveAs' @($output,32))
    }
   }
   if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw 'Office did not export a PDF.' }
   $result.ok=$true
  } catch { $result.error=[string]$_.Exception.Message }
  finally {
   if ($null -ne $document) {
    try {
     switch($format){'excel'{[void](Invoke-OfficeMethod $document 'Close' @($false))};'word'{[void](Invoke-OfficeMethod $document 'Close' @(0))};'powerpoint'{[void](Invoke-OfficeMethod $document 'Close')}}
    } catch {}
    try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) } catch {}
    $document=$null
   }
  }
  $timer.Stop(); $result.seconds=$timer.Elapsed.TotalSeconds
  [IO.File]::WriteAllText((Join-Path $jobDirectory ($identifier+'.json')),($result|ConvertTo-Json -Compress),$utf8)
  Write-Output ($result|ConvertTo-Json -Compress)
 }
} catch {
 [IO.File]::WriteAllText((Join-Path $jobDirectory 'fatal.json'),(@{error=[string]$_.Exception.Message}|ConvertTo-Json -Compress),$utf8)
 exit 1
} finally {
 if ($owned -and $null -ne $application) {
  try {
   if ((Get-OfficeProperty $collection 'Count') -eq 0) {
    if($format -eq 'word'){[void](Invoke-OfficeMethod $application 'Quit' @(0))}else{[void](Invoke-OfficeMethod $application 'Quit')}
   }
   else { foreach($record in $ownership.ownedProcesses){$record.allowKill=$false}; Save-Ownership }
  } catch {}
 }
 if($null -ne $collection){try{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($collection)}catch{}}
 if($null -ne $application){try{[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($application)}catch{}}
 [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
