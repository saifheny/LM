@echo off
title LM Super App - Local Server
cd /d "%~dp0"
echo.
echo   ==========================================
echo     LM Super App - Starting Local Server
echo     URL: http://localhost:4000
echo   ==========================================
echo.
start "" http://localhost:4000
npm start
pause
