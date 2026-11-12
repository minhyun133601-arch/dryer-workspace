param([int]$DelaySeconds = 20)

$ErrorActionPreference = 'Stop'
$shutdownRecordPath = Join-Path $PSScriptRoot 'shutdown-request.json'
$shutdownRecord = [ordered]@{
    requestedByUser = $true
    scheduledUtc = [DateTime]::UtcNow.ToString('o')
    delaySeconds = $DelaySeconds
    command = 'shutdown.exe /s /t 0'
    forceClose = $false
    status = 'scheduled'
}
$shutdownRecord | ConvertTo-Json | Set-Content -LiteralPath $shutdownRecordPath -Encoding UTF8
Start-Sleep -Seconds $DelaySeconds

try {
    $shutdownRecord.status = 'requesting_normal_shutdown'
    $shutdownRecord.requestUtc = [DateTime]::UtcNow.ToString('o')
    $shutdownRecord | ConvertTo-Json | Set-Content -LiteralPath $shutdownRecordPath -Encoding UTF8
    & (Join-Path $env:SystemRoot 'System32/shutdown.exe') /s /t 0
    $shutdownResultCode = $LASTEXITCODE
    $shutdownRecord.exitCode = $shutdownResultCode
    $shutdownRecord.status = if ($shutdownResultCode -eq 0) { 'normal_shutdown_requested' } else { 'request_failed' }
    $shutdownRecord | ConvertTo-Json | Set-Content -LiteralPath $shutdownRecordPath -Encoding UTF8
} catch {
    $shutdownRecord.status = 'request_failed'
    $shutdownRecord.error = $_.Exception.Message
    $shutdownRecord | ConvertTo-Json | Set-Content -LiteralPath $shutdownRecordPath -Encoding UTF8
}
