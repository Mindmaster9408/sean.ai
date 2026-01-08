@echo off
REM Sean AI Knowledge Layer - Startup Script
REM This script starts the development server and opens the app in your browser

echo.
echo ========================================
echo    Sean - AI Knowledge Layer
echo    Starting Development Server...
echo ========================================
echo.

REM Change to app directory
cd /d "%~dp0"

REM Start npm dev server
echo Opening http://localhost:3000 in your browser...
timeout /t 3 /nobreak

REM Open browser
start http://localhost:3000

REM Run npm dev
npm run dev

pause
