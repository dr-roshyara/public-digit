@echo off
:: ======================================================
:: Enhanced Claude Election Project Loader
:: Optimized for Multi-Tenant Election Platform
:: ======================================================

setlocal enabledelayedexpansion

:: API Configuration
set ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
set ANTHROPIC_AUTH_TOKEN=sk-ea5c370fbd514e84bc67107e34274881
set ANTHROPIC_MODEL=deepseek-chat
set ANTHROPIC_SMALL_FAST_MODEL=deepseek-chat
set API_TIMEOUT_MS=600000

title DeepSeek Claude - Multi-Tenant Election Platform

:: Check if project name is provided
if "%~1"=="" goto:SHOW_MENU

set PROJECT_NAME=%~1
set PROJECT_ROOT=%~dp0projects
set PROJECT_DIR=%PROJECT_ROOT%\%PROJECT_NAME%

:: Validate project name
set VALID_PROJECTS=laravel-backend angular-mobile platform-full api-documentation
echo %VALID_PROJECTS% | findstr /i "\<%PROJECT_NAME%\>" >nul
if errorlevel 1 (
    echo ❌ Invalid project name: %PROJECT_NAME%
    echo.
    goto:SHOW_MENU
)

:: Load project-specific configuration
call :LOAD_PROJECT_CONFIG

:: Create project structure if needed
if not exist "%PROJECT_DIR%" (
    call :CREATE_PROJECT_STRUCTURE
)

:: Display project header
call :DISPLAY_HEADER

:: Load and display project context
call :LOAD_PROJECT_CONTEXT

:: Prepare Claude session
call :PREPARE_CLAUDESESSION

:: Start Claude
echo ⚡ Starting Claude with %PROJECT_NAME% context...
echo 📡 API Base: %API_BASE_URL%
echo 🛠️  Stack: %TECH_STACK%
echo.
claude

:: Post-session cleanup
call :SESSION_CLEANUP
goto:EOF

:: ======================================================
:: FUNCTIONS
:: ======================================================

:SHOW_MENU
echo ========================================
echo    🤖 Claude Code with DeepSeek
echo ========================================
echo    Multi-Tenant Election Platform
echo ========================================
echo.
echo 📋 Available Projects:
echo -----------------------
echo   laravel-backend    - Laravel 12 DDD Backend
echo   angular-mobile     - Angular Mobile Frontend
echo   platform-full      - Full platform context
echo   api-documentation  - API specifications only
echo.
echo 💡 Usage: %0 ^<project_name^>
echo.
echo Starting default Claude session...
echo Project: election
echo.
claude
echo.
echo Session completed.
timeout /t 3 >nul
exit /b 0

:LOAD_PROJECT_CONFIG
if /i "%PROJECT_NAME%"=="laravel-backend" (
    set "TECH_STACK=laravel-12,ddd,multi-tenancy"
    set "API_BASE_URL=http://localhost:8000"
    set "PRIMARY_CONTEXT=laravel_context.txt"
    set "ARCHITECTURE_FOCUS=backend,api,authentication"
    set "PROJECT_TYPE=backend"
    
) else if /i "%PROJECT_NAME%"=="angular-mobile" (
    set "TECH_STACK=angular,capacitor,rxjs"
    set "API_BASE_URL=http://localhost:8000/api/v1"
    set "PRIMARY_CONTEXT=angular_context.txt"
    set "ARCHITECTURE_FOCUS=frontend,mobile,authentication-ui"
    set "PROJECT_TYPE=frontend"
    
) else if /i "%PROJECT_NAME%"=="platform-full" (
    set "TECH_STACK=laravel-12,angular,ddd,multi-tenancy"
    set "API_BASE_URL=http://localhost:8000"
    set "PRIMARY_CONTEXT=full_platform_context.txt"
    set "ARCHITECTURE_FOCUS=integration,authentication-flow,tenant-isolation"
    set "PROJECT_TYPE=full"
    
) else (
    set "TECH_STACK=general"
    set "PRIMARY_CONTEXT=project_info.txt"
    set "ARCHITECTURE_FOCUS=documentation"
    set "PROJECT_TYPE=docs"
)
goto :EOF

:CREATE_PROJECT_STRUCTURE
echo.
echo 🆕 Creating new project: %PROJECT_NAME%
echo Technology Stack: %TECH_STACK%
echo.

:: Create directory structure
for %%d in (
    "%PROJECT_DIR%"
    "%PROJECT_DIR%\context"
    "%PROJECT_DIR%\api-endpoints"
    "%PROJECT_DIR%\architecture"
    "%PROJECT_DIR%\migration-plans"
    "%PROJECT_DIR%\exports"
    "%PROJECT_DIR%\sessions"
) do (
    if not exist "%%~d" mkdir "%%~d" 2>nul
)

:: Create project-specific context
if /i "%PROJECT_NAME%"=="laravel-backend" (
    call :CREATE_LARAVEL_CONTEXT
) else if /i "%PROJECT_NAME%"=="angular-mobile" (
    call :CREATE_ANGULAR_CONTEXT
) else if /i "%PROJECT_NAME%"=="platform-full" (
    call :CREATE_FULL_PLATFORM_CONTEXT
)
goto :EOF

:DISPLAY_HEADER
cls
echo ========================================
echo    🤖 Claude Code with DeepSeek
echo ========================================
echo    Project: %PROJECT_NAME%
echo ========================================
echo 📁 Directory: %PROJECT_DIR:~0,50%...
echo 🏗️  Focus: %ARCHITECTURE_FOCUS%
echo.
goto :EOF

:LOAD_PROJECT_CONTEXT
set "CONTENT_SHOWN=0"

:: Architecture overview
if exist "%PROJECT_DIR%\architecture\overview.txt" (
    echo 📚 ARCHITECTURE OVERVIEW:
    echo --------------------------
    type "%PROJECT_DIR%\architecture\overview.txt"
    echo.
    set "CONTENT_SHOWN=1"
)

:: API endpoints
if exist "%PROJECT_DIR%\api-endpoints\current_endpoints.txt" (
    echo 🔌 AVAILABLE ENDPOINTS:
    echo -----------------------
    type "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    echo.
    set "CONTENT_SHOWN=1"
)

:: Current context
if exist "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%" (
    echo 📋 CURRENT PROJECT CONTEXT:
    echo --------------------------
    type "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo.
    set "CONTENT_SHOWN=1"
)

:: Migration plans
if exist "%PROJECT_DIR%\migration-plans\current_phase.txt" (
    echo 🚧 CURRENT IMPLEMENTATION PHASE:
    echo --------------------------------
    type "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo.
    set "CONTENT_SHOWN=1"
)

if "%CONTENT_SHOWN%"=="0" (
    echo ℹ️  No project context found. Creating default structure...
    echo.
)
goto :EOF

:PREPARE_CLAUDESESSION
:: Generate session timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "DATETIME=%%I"
set "SESSION_ID=%DATETIME:~0,8%_%DATETIME:~8,6%"
set "SESSION_FILE=%PROJECT_DIR%\sessions\%SESSION_ID%.txt"

:: Create context file
(
    echo # CLAUDE PROJECT CONTEXT
    echo =========================
    echo Project: %PROJECT_NAME%
    echo Session: %SESSION_ID%
    echo Date/Time: %date% %time%
    echo Technology: %TECH_STACK%
    echo API Base: %API_BASE_URL%
    echo Focus Areas: %ARCHITECTURE_FOCUS%
    echo.
) > temp_context.txt

:: Add project-specific responsibilities
call :ADD_PROJECT_RESPONSIBILITIES

:: Append existing context files
if exist "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%" (
    echo.
    echo # EXISTING PROJECT CONTEXT:
    echo ---------------------------
    type "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
) >> temp_context.txt 2>nul

echo 📝 Claude context prepared. Session ID: %SESSION_ID%
goto :EOF

:ADD_PROJECT_RESPONSIBILITIES
if /i "%PROJECT_NAME%"=="laravel-backend" (
    (
        echo PRIMARY RESPONSIBILITIES:
        echo - Laravel 12 DDD backend maintenance
        echo - Multi-tenant isolation enforcement
        echo - API endpoint development
        echo - Sanctum authentication
        echo - Database migrations (landlord/tenant)
        echo - Queue management and job scheduling
        echo - API rate limiting and security
        echo.
    ) >> temp_context.txt
) else if /i "%PROJECT_NAME%"=="angular-mobile" (
    (
        echo PRIMARY RESPONSIBILITIES:
        echo - Angular mobile app development
        echo - Capacitor native integration
        echo - Dual-API authentication flow
        echo - Internationalization (i18n)
        echo - Mobile-responsive UI/UX
        echo - Offline capability with service workers
        echo - Push notifications
        echo.
    ) >> temp_context.txt
) else if /i "%PROJECT_NAME%"=="platform-full" (
    (
        echo PRIMARY RESPONSIBILITIES:
        echo - Full platform integration
        echo - Authentication flow coordination
        echo - Tenant context switching
        echo - Cross-project API consistency
        echo - Deployment and scaling strategies
        echo - Monitoring and logging
        echo.
    ) >> temp_context.txt
)
goto :EOF

:SESSION_CLEANUP
echo.
echo ✅ Session completed for: %PROJECT_NAME%
echo 📊 Session artifacts saved in:
echo    %PROJECT_DIR%\sessions\%SESSION_ID%.txt
echo.

:: Save session context
if exist "temp_context.txt" (
    move /y "temp_context.txt" "%SESSION_FILE%" >nul
)

:: Ask for session summary
set "SESSION_SUMMARY="
set /p "SESSION_SUMMARY=📝 Enter session summary (or press Enter to skip): "
if not "!SESSION_SUMMARY!"=="" (
    echo [%date% %time%] !SESSION_SUMMARY! >> "%PROJECT_DIR%\context\session_history.txt"
    echo Summary saved to session history.
    echo.
)

echo Press any key to exit...
pause >nul
goto :EOF

:: ======================================================
:: PROJECT CONTEXT CREATION FUNCTIONS
:: ======================================================

:CREATE_LARAVEL_CONTEXT
(
    echo # LARAVEL BACKEND PROJECT
    echo =========================
    echo.
    echo Architecture: Domain-Driven Design (DDD)
    echo Multi-tenancy: Spatie Laravel Multitenancy
    echo Database: MySQL with landlord/tenant separation
    echo Authentication: Laravel Sanctum
    echo Version: Laravel 12.35.1
    echo.
    echo IMPORTANT:
    echo - DO NOT move Laravel from packages/laravel-backend/
    echo - Maintain 100%% tenant isolation
    echo - Follow existing DDD bounded contexts
    echo - Use repository pattern for data access
    echo - Implement proper event sourcing
    echo.
) > "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"

:: Create API endpoints file
(
    echo Platform APIs:
    echo "  - GET    /api/v1/tenants"
    echo "  - POST   /api/v1/auth/login"
    echo "  - GET    /api/v1/auth/me"
    echo "  - POST   /api/v1/auth/refresh"
    echo "  - POST   /api/v1/auth/logout"
    echo.
    echo Tenant APIs:
    echo "  - POST   /{slug}/api/v1/auth/login"
    echo "  - GET    /{slug}/api/v1/auth/me"
    echo "  - GET    /{slug}/api/v1/dashboard"
    echo "  - POST   /{slug}/api/v1/elections"
    echo "  - GET    /{slug}/api/v1/elections/{id}"
) > "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
goto :EOF

:CREATE_ANGULAR_CONTEXT
(
    echo # ANGULAR MOBILE APP PROJECT
    echo ============================
    echo.
    echo Target Platforms: Mobile (Capacitor) + Desktop (Web)
    echo Architecture: Angular with RxJS reactive patterns
    echo Authentication: Dual-API system
    echo Internationalization: Location-based + manual selection
    echo.
    echo BACKEND INTEGRATION:
    echo - Platform APIs: http://localhost:8000/api/v1
    echo - Tenant APIs: https://{slug}.publicdigit.com/api/v1
    echo.
    echo AUTHENTICATION FLOW:
    echo 1. Welcome → Language detection
    echo 2. Platform login → Get available tenants
    echo 3. Tenant selection → Switch context
    echo 4. Tenant authentication → Access dashboard
    echo 5. Session management → Token refresh
    echo.
) > "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"

:: Create migration plan
(
    echo Phase 1: Core Authentication Migration
    echo Status: IN PROGRESS
    echo Start Date: %date%
    echo.
    echo Tasks:
    echo "  [ ] 1. Platform authentication services"
    echo "  [ ] 2. Tenant context management"
    echo "  [ ] 3. HTTP interceptors and guards"
    echo "  [ ] 4. Internationalization service"
    echo "  [ ] 5. Responsive UI components"
    echo "  [ ] 6. Capacitor plugin integration"
    echo "  [ ] 7. Offline storage implementation"
    echo "  [ ] 8. Push notification setup"
) > "%PROJECT_DIR%\migration-plans\current_phase.txt"
goto :EOF

:CREATE_FULL_PLATFORM_CONTEXT
(
    echo # FULL PLATFORM CONTEXT
    echo =======================
    echo.
    echo Components:
    echo 1. Laravel Backend (DDD + Multi-tenancy)
    echo 2. Angular Mobile App
    echo 3. Tenant Management Dashboard
    echo 4. Real-time Notification System
    echo 5. Analytics and Reporting
    echo.
    echo Integration Points:
    echo - Authentication flow between platform and tenants
    echo - Real-time updates via WebSocket
    echo - File storage and CDN integration
    echo - Payment gateway integration
    echo - SMS/Email notification services
    echo.
) > "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
goto :EOF