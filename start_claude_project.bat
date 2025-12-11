@echo off
:: ==============================================
:: Multi-Tenant Election Platform Project Loader
:: Enhanced for Laravel 12 + Angular Mobile App
:: ==============================================

setlocal enabledelayedexpansion

if "%1"=="" (
    echo.
    echo 🎯 MULTI-TENANT ELECTION PLATFORM - PROJECT LOADER
    echo ================================================
    echo Usage: %0 [project_name]
    echo.
    echo Available projects:
    echo   laravel-backend    - Laravel 12 DDD Backend
    echo   angular-mobile     - Angular Mobile Frontend
    echo   platform-full      - Full platform context
    echo   api-documentation  - API specifications only
    echo.
    exit /b 1
)

set PROJECT_NAME=%1
set PROJECT_ROOT=%~dp0projects
set PROJECT_DIR=%PROJECT_ROOT%\%PROJECT_NAME%

:: ==============================================
:: PROJECT-SPECIFIC CONFIGURATION
:: ==============================================
if "%PROJECT_NAME%"=="laravel-backend" (
    set TECH_STACK=laravel-12,ddd,multi-tenancy
    set API_BASE_URL=http://localhost:8000
    set PRIMARY_CONTEXT=laravel_context.txt
    set ARCHITECTURE_FOCUS=backend,api,authentication
    
) else if "%PROJECT_NAME%"=="angular-mobile" (
    set TECH_STACK=angular,capacitor,rxjs
    set API_BASE_URL=http://localhost:8000/api/v1
    set PRIMARY_CONTEXT=angular_context.txt
    set ARCHITECTURE_FOCUS=frontend,mobile,authentication-ui
    
) else if "%PROJECT_NAME%"=="platform-full" (
    set TECH_STACK=laravel-12,angular,ddd,multi-tenancy
    set API_BASE_URL=http://localhost:8000
    set PRIMARY_CONTEXT=full_platform_context.txt
    set ARCHITECTURE_FOCUS=integration,authentication-flow,tenant-isolation
    
) else (
    set TECH_STACK=general
    set PRIMARY_CONTEXT=project_info.txt
)

:: ==============================================
:: CREATE PROJECT IF NOT EXISTS
:: ==============================================
if not exist "%PROJECT_DIR%" (
    echo.
    echo 🆕 Creating new project: %PROJECT_NAME%
    echo Technology Stack: %TECH_STACK%
    echo.
    
    mkdir "%PROJECT_DIR%" 2>nul
    mkdir "%PROJECT_DIR%\context" 2>nul
    mkdir "%PROJECT_DIR%\api-endpoints" 2>nul
    mkdir "%PROJECT_DIR%\architecture" 2>nul
    mkdir "%PROJECT_DIR%\migration-plans" 2>nul
    mkdir "%PROJECT_DIR%\exports" 2>nul
    
    :: Create project-specific context files
    call :CREATE_PROJECT_CONTEXT
)

:: ==============================================
:: LOAD PROJECT CONTEXT
:: ==============================================
echo.
echo 🎯 LOADING PROJECT: %PROJECT_NAME%
echo 📁 Directory: %PROJECT_DIR%
echo 🏗️  Focus: %ARCHITECTURE_FOCUS%
echo.

:: Load architecture documentation
if exist "%PROJECT_DIR%\architecture\overview.txt" (
    echo 📚 ARCHITECTURE OVERVIEW:
    echo --------------------------
    type "%PROJECT_DIR%\architecture\overview.txt" | findstr /n "^"
    echo.
)

:: Load API endpoints if they exist
if exist "%PROJECT_DIR%\api-endpoints\current_endpoints.txt" (
    echo 🔌 AVAILABLE ENDPOINTS:
    echo -----------------------
    type "%PROJECT_DIR%\api-endpoints\current_endpoints.txt" | findstr /B "  -"
    echo.
)

:: Load current project context
if exist "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%" (
    echo 📋 CURRENT PROJECT CONTEXT:
    echo --------------------------
    type "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo.
)

:: Load recent migration/changes
if exist "%PROJECT_DIR%\migration-plans\current_phase.txt" (
    echo 🚧 CURRENT IMPLEMENTATION PHASE:
    echo --------------------------------
    type "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo.
)

:: ==============================================
:: START CLAUDE WITH PROJECT CONTEXT
:: ==============================================
echo.
echo ⚡ Starting Claude with %PROJECT_NAME% context...
echo 📡 API Base: %API_BASE_URL%
echo 🛠️  Stack: %TECH_STACK%
echo.

:: Create a temporary context file for Claude
echo # CLAUDE PROJECT CONTEXT > temp_context.txt
echo Project: %PROJECT_NAME% >> temp_context.txt
echo Date: %date% %time% >> temp_context.txt
echo Technology: %TECH_STACK% >> temp_context.txt
echo API Base: %API_BASE_URL% >> temp_context.txt
echo Focus Areas: %ARCHITECTURE_FOCUS% >> temp_context.txt
echo. >> temp_context.txt

:: Append specific context based on project
if "%PROJECT_NAME%"=="laravel-backend" (
    echo PRIMARY RESPONSIBILITIES: >> temp_context.txt
    echo - Laravel 12 DDD backend maintenance >> temp_context.txt
    echo - Multi-tenant isolation enforcement >> temp_context.txt
    echo - API endpoint development >> temp_context.txt
    echo - Sanctum authentication >> temp_context.txt
    echo - Database migrations (landlord/tenant) >> temp_context.txt
    echo. >> temp_context.txt
    
) else if "%PROJECT_NAME%"=="angular-mobile" (
    echo PRIMARY RESPONSIBILITIES: >> temp_context.txt
    echo - Angular mobile app development >> temp_context.txt
    echo - Capacitor native integration >> temp_context.txt
    echo - Dual-API authentication flow >> temp_context.txt
    echo - Internationalization (i18n) >> temp_context.txt
    echo - Mobile-responsive UI/UX >> temp_context.txt
    echo. >> temp_context.txt
)

:: Show context to user
type temp_context.txt
echo.
echo 📝 Claude is now aware of the %PROJECT_NAME% project context.
echo.

:: Start Claude
claude

:: ==============================================
:: POST-SESSION CLEANUP
:: ==============================================
echo.
echo ✅ Session completed for: %PROJECT_NAME%
echo.
echo 📊 Project artifacts saved in:
echo    %PROJECT_DIR%\context\        - Session notes
echo    %PROJECT_DIR%\exports\        - Generated code
echo    %PROJECT_DIR%\api-endpoints\  - API updates
echo.

:: Ask for session summary
set /p SESSION_SUMMARY="📝 Enter session summary (or press Enter to skip): "
if not "!SESSION_SUMMARY!"=="" (
    echo [%date% %time%] !SESSION_SUMMARY! >> "%PROJECT_DIR%\context\session_history.txt"
)

del temp_context.txt 2>nul
endlocal
goto :eof

:: ==============================================
:: FUNCTION: CREATE PROJECT CONTEXT
:: ==============================================
:CREATE_PROJECT_CONTEXT
if "%PROJECT_NAME%"=="laravel-backend" (
    echo # LARAVEL BACKEND PROJECT > "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo. >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Architecture: Domain-Driven Design (DDD) >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Multi-tenancy: Spatie Laravel Multitenancy >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Database: MySQL with landlord/tenant separation >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Authentication: Laravel Sanctum >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Version: Laravel 12.35.1 >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo. >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo IMPORTANT: >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo - DO NOT move Laravel from packages/laravel-backend/ >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo - Maintain 100%% tenant isolation >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo - Follow existing DDD bounded contexts >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    
    :: Create API endpoints file
    echo Platform APIs: >> "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    echo "  - GET    /api/v1/tenants" >> "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    echo "  - POST   /api/v1/auth/login" >> "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    echo "  - GET    /api/v1/auth/me" >> "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    echo. >> "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    echo Tenant APIs: >> "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    echo "  - POST   {slug}/api/v1/auth/login" >> "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    echo "  - GET    {slug}/api/v1/auth/me" >> "%PROJECT_DIR%\api-endpoints\current_endpoints.txt"
    
) else if "%PROJECT_NAME%"=="angular-mobile" (
    echo # ANGULAR MOBILE APP PROJECT > "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo. >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Target Platforms: Mobile (Capacitor) + Desktop (Web) >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Architecture: Angular with RxJS reactive patterns >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Authentication: Dual-API system >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo Internationalization: Location-based + manual selection >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo. >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo BACKEND INTEGRATION: >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo - Platform APIs: http://localhost:8000/api/v1 >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo - Tenant APIs: https://{slug}.publicdigit.com/api/v1 >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo. >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo AUTHENTICATION FLOW: >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo 1. Welcome → Language detection >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo 2. Platform login → Get available tenants >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo 3. Tenant selection → Switch context >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    echo 4. Tenant authentication → Access dashboard >> "%PROJECT_DIR%\context\%PRIMARY_CONTEXT%"
    
    :: Create migration plan
    echo Phase 1: Core Authentication Migration > "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo Status: IN PROGRESS >> "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo. >> "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo Tasks: >> "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo "  [ ] 1. Platform authentication services" >> "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo "  [ ] 2. Tenant context management" >> "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo "  [ ] 3. HTTP interceptors and guards" >> "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo "  [ ] 4. Internationalization service" >> "%PROJECT_DIR%\migration-plans\current_phase.txt"
    echo "  [ ] 5. Responsive UI components" >> "%PROJECT_DIR%\migration-plans\current_phase.txt"
)
goto :eof
