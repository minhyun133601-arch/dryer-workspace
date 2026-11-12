@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 필요합니다. Node.js 20 이상을 설치한 후 다시 실행해 주세요.
  pause
  exit /b 1
)
node "tooling\launch.mjs" %*
if errorlevel 1 (
  echo.
  echo 실행 중 오류가 발생했습니다. 위 안내를 확인해 주세요.
  pause
  exit /b 1
)
endlocal
