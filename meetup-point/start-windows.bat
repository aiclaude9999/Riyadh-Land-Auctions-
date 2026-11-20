@echo off
title Riyadh Meetup Point - keep this window open
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Go to https://nodejs.org , click the LTS button, install it,
  echo  then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo  First time only: installing. This takes a few minutes...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Install failed. Please send a photo of this window.
    pause
    exit /b 1
  )
)

echo.
echo  Starting the app. Your browser opens in a few seconds.
echo  KEEP THIS WINDOW OPEN while you use the app. Close it to stop.
echo  If the page says "can't reach", wait 10 seconds and press F5.
echo.
start "" cmd /c "timeout /t 10 >nul & start http://localhost:3000"
call npm run dev
echo.
echo  The app stopped. Please send a photo of this window.
pause
