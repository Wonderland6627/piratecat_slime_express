@echo off
setlocal

REM Forward local 15432 -> cloud server 127.0.0.1:5432 over SSH.
REM Keep this window open while developing against slime_dev.

set "SSH_HOST=120.53.104.120"
set "SSH_USER=root"
set "LOCAL_PORT=15432"
set "REMOTE_PORT=5432"

echo ==============================================
echo  Slime Dev DB SSH Tunnel
echo  Local:  127.0.0.1:%LOCAL_PORT%
echo  Remote: %SSH_USER%@%SSH_HOST%:127.0.0.1:%REMOTE_PORT%
echo ==============================================
echo.
echo Keep this window open. Close it to disconnect the tunnel.
echo In local .env use:
echo DATABASE_URL=postgresql://slime_dev_user:PASSWORD@127.0.0.1:%LOCAL_PORT%/slime_dev
echo.

where ssh >nul 2>nul
if errorlevel 1 (
  echo [ERROR] OpenSSH client not found.
  echo Install "OpenSSH Client" from Windows Optional Features, then retry.
  pause
  exit /b 1
)

set "SSH_KEY=%USERPROFILE%\.ssh\slime_server"
set "SSH_I="
if exist "%SSH_KEY%" set SSH_I=-o IdentitiesOnly=yes -i "%SSH_KEY%"

ssh %SSH_I% -N -L %LOCAL_PORT%:127.0.0.1:%REMOTE_PORT% %SSH_USER%@%SSH_HOST%
echo.
echo Tunnel closed.
pause
