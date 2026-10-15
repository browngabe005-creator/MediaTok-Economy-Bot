@echo off
setlocal
cd /d "%~dp0"
title MediaTok Economy Bot

echo ========================================
echo          MediaTok Economy Bot
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on your PATH.
  echo Download Node.js 20.11 or newer: https://nodejs.org/
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP-BOT.ps1"
if errorlevel 1 (
  echo Setup was not completed. Please try again.
  pause
  exit /b 1
)

if not exist "node_modules\discord.js\package.json" (
  echo Installing required packages for first launch...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed. Check your internet connection.
    pause
    exit /b 1
  )
)

echo Starting MediaTok Economy Bot...
node index.js

echo.
echo Bot stopped. Check the error messages above if it did not start.
pause
