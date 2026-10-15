@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 20.11+ from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\discord.js" (
  call npm install
  if errorlevel 1 exit /b 1
)
node index.js
pause
