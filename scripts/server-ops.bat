@echo off
setlocal

REM Run the cloud server-ops.sh over SSH.
REM Usage: scripts\server-ops.bat dev check
REM        scripts\server-ops.bat prod restart
REM        scripts\server-ops.bat dev apply-sql sql/002_xxx.sql

set "SSH_HOST=120.53.104.120"
set "SSH_USER=root"

if "%~1"=="" goto usage
if "%~2"=="" goto usage

set "ENV_NAME=%~1"
set "CMD=%~2"
set "EXTRA=%~3"

if /I "%ENV_NAME%"=="dev" (
  set "REMOTE_SCRIPT=/www/apps/slime-express/piratecat_slime_express_dev/scripts/server-ops.sh"
) else if /I "%ENV_NAME%"=="prod" (
  set "REMOTE_SCRIPT=/www/apps/slime-express/piratecat_slime_express/scripts/server-ops.sh"
) else (
  goto usage
)

where ssh >nul 2>&1
if errorlevel 1 (
  echo [ERROR] OpenSSH client not found.
  echo Install "OpenSSH Client" from Windows Optional Features, then retry.
  pause
  exit /b 1
)

echo SSH %SSH_USER%@%SSH_HOST%
echo bash %REMOTE_SCRIPT% %ENV_NAME% %CMD% %EXTRA%
echo.

if "%EXTRA%"=="" (
  ssh %SSH_USER%@%SSH_HOST% "bash %REMOTE_SCRIPT% %ENV_NAME% %CMD%"
) else (
  ssh %SSH_USER%@%SSH_HOST% "bash %REMOTE_SCRIPT% %ENV_NAME% %CMD% %EXTRA%"
)
exit /b %ERRORLEVEL%

:usage
echo Usage:
echo   scripts\server-ops.bat dev check
echo   scripts\server-ops.bat dev restart
echo   scripts\server-ops.bat prod restart
echo   scripts\server-ops.bat dev apply-sql sql/002_xxx.sql
echo   scripts\server-ops.bat prod backup
echo.
echo The script must already be on the server. Upload the new code first.
echo Do not cover .env or logs.
pause
exit /b 1
