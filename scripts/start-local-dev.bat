@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo ==============================================
echo  Slime local server + dev database tunnel
echo  Tunnel: 127.0.0.1:15432 -^> cloud 127.0.0.1:5432
echo  Server: http://localhost:3000
echo ==============================================
echo.

where ssh >nul 2>nul
if errorlevel 1 (
  echo [ERROR] OpenSSH client not found.
  echo Install "OpenSSH Client" from Windows Optional Features, then retry.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js 20, then retry.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [ERROR] .env is missing.
  pause
  exit /b 1
)

findstr /C:"127.0.0.1:15432/slime_dev" ".env" >nul
if errorlevel 1 (
  echo [ERROR] .env has no DATABASE_URL for 127.0.0.1:15432/slime_dev
  pause
  exit /b 1
)

if not exist "node_modules\pg" (
  echo [ERROR] Dependencies are not installed. Run npm install in this project, then retry.
  pause
  exit /b 1
)

call :port_listening 3000
if not errorlevel 1 (
  echo [ERROR] Port 3000 is already in use. Stop the existing local server first.
  pause
  exit /b 1
)

set "OWN_TUNNEL=0"
call :port_listening 15432
if errorlevel 1 (
  echo Opening database tunnel...
  start "Slime Dev DB Tunnel" /b ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 15432:127.0.0.1:5432 root@120.53.104.120
  set "OWN_TUNNEL=1"
  call :wait_port 15432 30
  if errorlevel 1 (
    echo [ERROR] Tunnel did not start. Check the SSH key %%USERPROFILE%%\.ssh\slime_server
    call :stop_owned_tunnel
    pause
    exit /b 1
  )
) else (
  echo Port 15432 is already listening. Reusing the existing tunnel.
)

echo Tunnel is ready. Starting the local server.
echo Close this window, or press Ctrl+C, to stop the server.
echo.

call npm start
set "CODE=%ERRORLEVEL%"

call :stop_owned_tunnel
echo.
echo Local server stopped.
pause
exit /b %CODE%

:port_listening
netstat -ano | findstr /C:":%~1 " | findstr /I "LISTENING" >nul
if errorlevel 1 exit /b 1
exit /b 0

:wait_port
set /a N=0
:wait_port_loop
call :port_listening %~1
if not errorlevel 1 exit /b 0
set /a N+=1
if %N% GEQ %~2 exit /b 1
ping -n 2 127.0.0.1 >nul
goto wait_port_loop

:stop_owned_tunnel
if not "%OWN_TUNNEL%"=="1" exit /b 0
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":15432 " ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>&1
)
set "OWN_TUNNEL=0"
exit /b 0
