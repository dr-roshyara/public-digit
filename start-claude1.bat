@echo off
chcp 65001 >nul
title 🧠 Claude DeepSeek - Memory Manager

:: ================================================================
:: CONFIGURATION
:: ================================================================
set "DEEPSEEK_API_KEY=sk-ea5c370fbd514e84bc67107e34274881"
set "DEEPSEEK_BASE_URL=https://api.deepseek.com"
set "MODEL=deepseek-chat"
set "MEMORY_DIR=.claude_memory"
set "MAX_MEMORY_FILES=20"
set "CURRENT_SESSION=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%"
set "CURRENT_SESSION=%CURRENT_SESSION: =0%"

:: ================================================================
:: INITIALIZE MEMORY SYSTEM
:: ================================================================
if not exist "%MEMORY_DIR%" mkdir "%MEMORY_DIR%"
if not exist "%MEMORY_DIR%\sessions" mkdir "%MEMORY_DIR%\sessions"
if not exist "%MEMORY_DIR%\summaries" mkdir "%MEMORY_DIR%\summaries"

:: ================================================================
:: MAIN MENU
:: ================================================================
:menu
cls
echo ================================================================
echo           CLAUDE DEEPSEEK - INTELLIGENT MEMORY MANAGER
echo ================================================================
echo Session: %CURRENT_SESSION%
echo Memory Files: 
for /f %%i in ('dir /b "%MEMORY_DIR%\summaries\*.txt" 2^>nul ^| find /c /v ""') do echo   • %%i summaries available
echo.
echo 1. 🆕 Start Fresh Session (Clears Memory)
echo 2. 🧠 Start Smart Session (Loads Recent Context)
echo 3. 📁 Process File with Memory
echo 4. 📊 View/Manage Memory
echo 5. 🗑️  Clear All Memory
echo 6. 🚪 Exit
echo.

set /p choice="Select [1-6]: "

if "%choice%"=="1" goto fresh_session
if "%choice%"=="2" goto smart_session
if "%choice%"=="3" goto process_with_memory
if "%choice%"=="4" goto manage_memory
if "%choice%"=="5" goto clear_memory
if "%choice%"=="6" exit /b 0

echo Invalid choice
timeout /t 1 >nul
goto menu

:: ================================================================
:: 1. FRESH SESSION - No memory loaded
:: ================================================================
:fresh_session
cls
echo ================================================================
echo                 🆕 FRESH SESSION
echo ================================================================
echo.
echo Starting new session with clean memory...
echo No previous context will be loaded.
echo.

:: Create session file
echo Session started: %date% %time% > "%MEMORY_DIR%\sessions\%CURRENT_SESSION%.txt"
echo Context: Fresh start >> "%MEMORY_DIR%\sessions\%CURRENT_SESSION%.txt"

:: Start Claude with minimal system prompt
set "ANTHROPIC_API_KEY=%DEEPSEEK_API_KEY%"
set "ANTHROPIC_BASE_URL=%DEEPSEEK_BASE_URL%/anthropic"

(
echo System: You are a helpful coding assistant. This is a fresh session.
echo No previous conversation history is available.
echo Keep responses concise to preserve context space.
) | claude --model %MODEL% --max-tokens 4000

:: Save conversation end
echo Session ended: %date% %time% >> "%MEMORY_DIR%\sessions\%CURRENT_SESSION%.txt"
goto menu

:: ================================================================
:: 2. SMART SESSION - Loads summarized memory
:: ================================================================
:smart_session
cls
echo ================================================================
echo                 🧠 SMART SESSION
echo ================================================================
echo.
echo Loading recent context summaries...
echo.

:: Check for recent summaries
set summary_count=0
set latest_summary=
for /f "delims=" %%F in ('dir "%MEMORY_DIR%\summaries\*.txt" /b /o-d 2^>nul') do (
    set /a summary_count+=1
    if !summary_count! equ 1 set latest_summary=%%F
)

if %summary_count%==0 (
    echo No previous summaries found. Starting fresh.
    goto :fresh_session
)

echo Found %summary_count% previous summaries
echo Loading most recent: %latest_summary%
echo.

:: Load and display summary
type "%MEMORY_DIR%\summaries\%latest_summary%" | more
echo.

:: Ask user what to load
echo What context should I load?
echo 1. Just the latest summary (recommended)
echo 2. Last 3 summaries
echo 3. Specific summary file
echo 4. Start fresh anyway
echo.

set /p load_choice="Select [1-4]: "

:: Build context based on choice
set "context_to_load="

if "%load_choice%"=="1" (
    set "context_to_load=%MEMORY_DIR%\summaries\%latest_summary%"
    echo Loading: %latest_summary%
)

if "%load_choice%"=="2" (
    echo Loading last 3 summaries...
    set count=0
    for /f "delims=" %%F in ('dir "%MEMORY_DIR%\summaries\*.txt" /b /o-d 2^>nul') do (
        set /a count+=1
        if !count! leq 3 (
            echo   • %%F
            set "context_to_load=!context_to_load![From !count!: %%F]"
            type "%MEMORY_DIR%\summaries\%%F" >> "%temp%\context_loaded.txt"
        )
    )
    set "context_to_load=%temp%\context_loaded.txt"
)

:: Start Claude with loaded context
set "ANTHROPIC_API_KEY=%DEEPSEEK_API_KEY%"
set "ANTHROPIC_BASE_URL=%DEEPSEEK_BASE_URL%/anthropic"

echo Starting Claude with loaded context...
timeout /t 2 >nul

(
echo System: You are a helpful coding assistant. Here is relevant context from previous sessions:
echo.
if exist "%context_to_load%" type "%context_to_load%"
echo.
echo Current session: %CURRENT_SESSION%
echo Keep responses concise to preserve context space. Reference previous work when relevant.
) | claude --model %MODEL% --max-tokens 4000

:: Cleanup
if exist "%temp%\context_loaded.txt" del "%temp%\context_loaded.txt"
goto menu

:: ================================================================
:: 3. PROCESS FILE WITH MEMORY SYSTEM
:: ================================================================
:process_with_memory
cls
echo ================================================================
echo           📁 PROCESS FILE WITH MEMORY MANAGEMENT
echo ================================================================
echo.

set /p file_path="Enter file path to process: "
call :clean_path file_path

if not exist "%file_path%" (
    echo ❌ File not found
    timeout /t 2 >nul
    goto menu
)

for %%F in ("%file_path%") do set "file_name=%%~nxF"

echo.
echo Processing: %file_name%
echo.

:: Step 1: Analyze file and create summary
echo 🔍 Step 1: Creating analysis summary...
set "ANTHROPIC_API_KEY=%DEEPSEEK_API_KEY%"
set "ANTHROPIC_BASE_URL=%DEEPSEEK_BASE_URL%/anthropic"

set "summary_file=%MEMORY_DIR%\summaries\summary_%CURRENT_SESSION%_%file_name%.txt"

(
echo System: Create a concise summary of this file for future context reference.
echo Include: Main purpose, key functions/classes, important patterns, and dependencies.
echo Keep it under 500 tokens for memory efficiency.
echo.
echo File: %file_name%
echo Content:
type "%file_path%"
) | claude --model %MODEL% --max-tokens 500 > "%summary_file%"

echo ✅ Summary saved to: %summary_file%
echo.

:: Step 2: Process file with optional previous context
echo 🤔 Load previous context for this analysis?
echo 1. Yes, load latest summary
echo 2. No, process independently
echo 3. Load specific context
echo.

set /p context_choice="Select [1-3]: "

set "context_prompt="
if "%context_choice%"=="1" (
    for /f "delims=" %%F in ('dir "%MEMORY_DIR%\summaries\*.txt" /b /o-d 2^>nul') do (
        if not defined context_prompt (
            echo Loading: %%F
            set "context_prompt=Previous context:"
            type "%MEMORY_DIR%\summaries\%%F" > "%temp%\current_context.txt"
        )
    )
)

:: Step 3: Process the file
echo.
echo 🚀 Step 2: Processing file...
echo.

(
echo System: You are analyzing a code file. Provide detailed analysis with improvements.
echo.
if exist "%temp%\current_context.txt" (
    echo Relevant previous context:
    type "%temp%\current_context.txt"
    echo.
)
echo Current file: %file_name%
echo Please analyze: structure, patterns, improvements, and potential issues.
echo Content:
type "%file_path%"
) | claude --model %MODEL% --max-tokens 3000

:: Cleanup
if exist "%temp%\current_context.txt" del "%temp%\current_context.txt"

echo.
echo ✅ File processed and summary saved for future sessions
timeout /t 3 >nul
goto menu

:: ================================================================
:: 4. MANAGE MEMORY
:: ================================================================
:manage_memory
cls
echo ================================================================
echo                 📊 MEMORY MANAGEMENT
echo ================================================================
echo.

echo 📁 Summary Files:
echo -----------------
dir /b "%MEMORY_DIR%\summaries\*.txt" 2>nul || echo No summary files found
echo.

echo 📋 Session Files:
echo -----------------
dir /b "%MEMORY_DIR%\sessions\*.txt" 2>nul || echo No session files found
echo.

echo 🛠️  Memory Operations:
echo 1. View a summary file
echo 2. Delete specific summary
echo 3. Compress old summaries (keep only last 10)
echo 4. Export all summaries
echo 5. Back to menu
echo.

set /p mem_choice="Select [1-5]: "

if "%mem_choice%"=="1" (
    set /p view_file="Enter summary filename: "
    if exist "%MEMORY_DIR%\summaries\%view_file%" (
        echo.
        echo Contents of %view_file%:
        echo ========================================
        type "%MEMORY_DIR%\summaries\%view_file%"
        echo.
        pause
    ) else (
        echo File not found
        timeout /t 2 >nul
    )
)

if "%mem_choice%"=="2" (
    set /p del_file="Enter summary filename to delete: "
    if exist "%MEMORY_DIR%\summaries\%del_file%" (
        del "%MEMORY_DIR%\summaries\%del_file%"
        echo ✅ Deleted: %del_file%
    ) else (
        echo File not found
    )
    timeout /t 2 >nul
)

if "%mem_choice%"=="3" (
    echo Compressing old summaries...
    set count=0
    for /f "delims=" %%F in ('dir "%MEMORY_DIR%\summaries\*.txt" /b /o-d 2^>nul') do (
        set /a count+=1
        if !count! gtr 10 (
            echo Deleting old summary: %%F
            del "%MEMORY_DIR%\summaries\%%F"
        )
    )
    echo ✅ Kept 10 most recent summaries
    timeout /t 2 >nul
)

goto manage_memory

:: ================================================================
:: 5. CLEAR ALL MEMORY
:: ================================================================
:clear_memory
cls
echo ================================================================
echo                 🗑️  CLEAR ALL MEMORY
echo ================================================================
echo ⚠️  WARNING: This will delete ALL saved context and summaries!
echo.
set /p confirm="Type 'DELETE' to confirm: "
if /i not "%confirm%"=="DELETE" goto menu

echo Clearing memory...
if exist "%MEMORY_DIR%\summaries" del /q "%MEMORY_DIR%\summaries\*.*"
if exist "%MEMORY_DIR%\sessions" del /q "%MEMORY_DIR%\sessions\*.*"
echo ✅ All memory cleared
timeout /t 2 >nul
goto menu

:: ================================================================
:: UTILITY FUNCTION
:: ================================================================
:clean_path
set "raw_path=!%~1!"
set "clean_path=%raw_path:"=%"
set "%~1=%clean_path%"
exit /b