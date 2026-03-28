@echo off
setlocal EnableDelayedExpansion

title De Mol - Local Dev

echo.
echo  ==========================================
echo   De Mol - Local Development Environment
echo  ==========================================
echo.

:: -------------------------------------------------------
:: Check prerequisites
:: -------------------------------------------------------

echo [1/5] Checking prerequisites...

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Install Node.js from https://nodejs.org/
    pause & exit /b 1
)

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] dotnet not found. Install .NET 8 SDK from https://dotnet.microsoft.com/download
    pause & exit /b 1
)

where podman >nul 2>&1
if errorlevel 1 (
    where docker >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Neither podman nor docker found. Install Podman Desktop from https://podman-desktop.io/
        pause & exit /b 1
    )
    set CONTAINER_CMD=docker
) else (
    set CONTAINER_CMD=podman
)
echo        Container runtime: %CONTAINER_CMD%

:: Check Azure Functions Core Tools
where func >nul 2>&1
if errorlevel 1 (
    echo [WARN]  Azure Functions Core Tools not found globally.
    echo        Installing via npm (this may take a minute)...
    call npm install -g azure-functions-core-tools@4 --unsafe-perm true >nul 2>&1
    where func >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Failed to install Azure Functions Core Tools.
        echo        Please install manually: npm install -g azure-functions-core-tools@4
        pause & exit /b 1
    )
)

:: Check SWA CLI
where swa >nul 2>&1
if errorlevel 1 (
    echo [WARN]  SWA CLI not found globally.
    echo        Installing via npm (this may take a minute)...
    call npm install -g @azure/static-web-apps-cli >nul 2>&1
    where swa >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Failed to install SWA CLI.
        echo        Please install manually: npm install -g @azure/static-web-apps-cli
        pause & exit /b 1
    )
)

echo        All prerequisites OK.
echo.

:: -------------------------------------------------------
:: Install dependencies
:: -------------------------------------------------------

echo [2/5] Installing dependencies...

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

echo        Restoring backend dependencies...
pushd api
call dotnet restore --verbosity quiet
popd
if errorlevel 1 (
    echo [ERROR] dotnet restore failed.
    pause & exit /b 1
)

echo        Dependencies OK.
echo.

:: -------------------------------------------------------
:: Start Cosmos DB emulator
:: -------------------------------------------------------

echo [3/5] Starting Cosmos DB emulator...

%CONTAINER_CMD% inspect the-mole-cosmosdb >nul 2>&1
if not errorlevel 1 (
    %CONTAINER_CMD% start the-mole-cosmosdb >nul 2>&1
    echo        Cosmos DB emulator already exists - started.
) else (
    %CONTAINER_CMD% compose up -d >nul 2>&1
    if errorlevel 1 (
        :: podman-compose may not be available, try podman play kube or direct run
        %CONTAINER_CMD% run -d ^
            --name the-mole-cosmosdb ^
            -p 8081:8081 ^
            -p 10250-10255:10250-10255 ^
            -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 ^
            -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true ^
            -e AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1 ^
            -m 3g ^
            mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest >nul 2>&1
        if errorlevel 1 (
            echo [ERROR] Failed to start Cosmos DB emulator.
            echo        Try running manually: podman-compose up -d
            pause & exit /b 1
        )
    )
    echo        Cosmos DB emulator starting (container created)...
)

echo        Waiting for Cosmos DB to be ready (this takes ~30 seconds on first run)...
set /a RETRIES=0
:COSMOS_WAIT
set /a RETRIES+=1
if %RETRIES% gtr 30 (
    echo [WARN]  Cosmos DB not responding yet - continuing anyway.
    echo        The API will retry on first request.
    goto COSMOS_DONE
)
curl -sk https://localhost:8081/_explorer/emulator.pem >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto COSMOS_WAIT
)
echo        Cosmos DB is ready.
:COSMOS_DONE
echo.

:: -------------------------------------------------------
:: Start Azure Functions (API) in a new window
:: -------------------------------------------------------

echo [4/5] Starting Azure Functions API (port 7071)...
start "De Mol - API (func)" cmd /k "cd /d "%~dp0api" && echo Starting Azure Functions... && func start"
echo        API window opened.
echo.

:: Wait a moment for functions to start
timeout /t 3 /nobreak >nul

:: -------------------------------------------------------
:: Start SWA CLI (proxies frontend + API + auth)
:: -------------------------------------------------------

echo [5/5] Starting SWA CLI proxy...
echo.
echo  ==========================================
echo   App available at: http://localhost:4280
echo.
echo   - Login:    http://localhost:4280/.auth/login/github
echo   - API:      http://localhost:4280/api/me
echo   - Cosmos:   https://localhost:8081/_explorer/index.html
echo  ==========================================
echo.
echo  Press Ctrl+C to stop the SWA CLI proxy.
echo  Close the API window separately.
echo.

cd /d "%~dp0"
call swa start http://localhost:5173 --api-devserver-url http://localhost:7071 --run "cd client && npm run dev"

endlocal
