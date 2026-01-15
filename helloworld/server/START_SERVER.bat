@echo off
echo ========================================
echo Starting Agri-AI Server
echo ========================================
cd /d %~dp0
echo Current directory: %CD%
echo.
echo Checking Node.js...
node --version
echo.
echo Starting server...
node index.js
pause
