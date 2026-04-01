@echo off
setlocal EnableDelayedExpansion

title Mollenjagers - Local Dev

echo.
echo  ==========================================
echo   Mollenjagers - Local Development Environment
echo  ==========================================
echo.

:: -------------------------------------------------------
:: Check prerequisites
:: -------------------------------------------------------

echo [1/3] Checking prerequisites...

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Install Node.js from https://nodejs.org/
    pause & exit /b 1
)

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] dotnet not found. Install .NET 10 SDK from https://dotnet.microsoft.com/download
    pause & exit /b 1
)

echo        All prerequisites OK.
echo.

:: -------------------------------------------------------
:: Install frontend dependencies if needed
:: -------------------------------------------------------

echo [2/3] Installing dependencies...

if not exist "client\node_modules" (
    echo        Installing frontend dependencies...
    pushd client
    call npm install --silent
    popd
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause & exit /b 1
    )
) else (
    echo        Frontend dependencies already installed.
)

echo.

:: -------------------------------------------------------
:: Start API + frontend dev servers
:: -------------------------------------------------------

echo [3/3] Starting servers...
echo.
echo  ==========================================
echo   Frontend: http://localhost:5173
echo   API:      http://localhost:5000
echo.
echo   API me:   http://localhost:5000/api/me
echo  ==========================================
echo.
echo  Starting API in this window...
echo  Frontend dev server will open in a new window.
echo.
echo  Press Ctrl+C to stop.
echo.

start "Mollenjagers - Frontend (Vite)" cmd /k "cd /d "%~dp0client" && npm run dev"

cd /d "%~dp0"
dotnet watch run --project api/Api.csproj --non-interactive

endlocal

