@echo off
echo ========================================
echo   KILL PROCESS ON PORT 5000
echo ========================================
echo.

echo Finding process on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo Killing process %%a...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo Done! Port 5000 should now be free.
echo You can now restart your server.
echo ========================================
pause

