$ErrorActionPreference = 'Stop'
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $appDir '..\..\프로젝트 실행.cmd'
if (-not (Test-Path -LiteralPath $launcher)) { throw '프로젝트 실행.cmd를 찾을 수 없습니다. 근거 자료 폴더를 프로젝트 폴더 안에 두세요.' }
& $launcher '--module=drawings' @args
exit $LASTEXITCODE