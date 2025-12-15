@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ======================================================
:: 🧠 CLAUDE LOCAL KNOWLEDGE AGENT
:: Saves and retrieves knowledge locally before using API
:: ======================================================

:: ⚡ DeepSeek API Configuration
set ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
set ANTHROPIC_AUTH_TOKEN=sk-ea5c370fbd514e84bc67107e34274881
set ANTHROPIC_MODEL=deepseek-chat
set API_TIMEOUT_MS=600000

title 🧠 Claude Local Agent - Election Platform

:: 📁 Knowledge Storage
set PROJECT_ROOT=%~dp0
set KNOWLEDGE_DIR=%PROJECT_ROOT%claude_knowledge
set CACHE_DIR=%KNOWLEDGE_DIR%\cache
set CONTEXT_DIR=%KNOWLEDGE_DIR%\context
set SESSIONS_DIR=%KNOWLEDGE_DIR%\sessions
set INDEX_FILE=%KNOWLEDGE_DIR%\knowledge_index.json

:: Create directories
for %%d in ("%KNOWLEDGE_DIR%" "%CACHE_DIR%" "%CONTEXT_DIR%" "%SESSIONS_DIR%") do (
    if not exist "%%~d" mkdir "%%~d"
)

:: Create initial index if not exists
if not exist "%INDEX_FILE%" (
    echo {"topics": {}, "last_updated": "%date% %time%"} > "%INDEX_FILE%"
)

:: 🎯 Session ID
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "DATETIME=%%I"
set "SESSION_ID=%DATETIME:~0,8%_%DATETIME:~8,6%"
set "SESSION_FILE=%SESSIONS_DIR%\%SESSION_ID%.txt"

:: ======================================================
:: 🚀 START INTERACTIVE SESSION
:: ======================================================

echo ========================================
echo    🧠 Claude Local Knowledge Agent
echo ========================================
echo    Election Project with Local Cache
echo ========================================
echo.
echo 📁 Knowledge Base: %KNOWLEDGE_DIR%
echo 🔗 API: %ANTHROPIC_BASE_URL%
echo 🆔 Session: %SESSION_ID%
echo.
echo Loading local knowledge...
call :LOAD_KNOWLEDGE_BASE
echo.

:: Interactive loop
:MAIN_LOOP
echo ========================================
echo 🤖 Type your question (or commands):
echo 💾 Commands: save, search, topics, clear, exit
echo ========================================
echo.

set /p "USER_INPUT=You: "

if "!USER_INPUT!"=="exit" goto:END_SESSION
if "!USER_INPUT!"=="save" goto:SAVE_KNOWLEDGE
if "!USER_INPUT!"=="search" goto:SEARCH_KNOWLEDGE
if "!USER_INPUT!"=="topics" goto:SHOW_TOPICS
if "!USER_INPUT!"=="clear" goto:CLEAR_SCREEN
if "!USER_INPUT!"=="" goto:MAIN_LOOP

:: Check local cache first
echo 🔍 Checking local knowledge...
call :CHECK_LOCAL_CACHE "!USER_INPUT!"

if "!CACHE_HIT!"=="true" (
    echo ✅ Found in local cache!
    echo.
    echo 💭 Local Knowledge:
    echo !CACHE_RESULT!
    echo.
    echo 📝 Add to this knowledge or ask follow-up:
    set /p "FOLLOWUP=Follow-up (or Enter to continue): "
    if not "!FOLLOWUP!"=="" (
        set "USER_INPUT=!FOLLOWUP!"
        set "CACHE_HIT="
    )
)

if not "!CACHE_HIT!"=="true" (
    echo 🔄 Not found locally, asking Claude...
    echo.
    
    :: Prepare context with local knowledge
    call :PREPARE_CONTEXT "!USER_INPUT!"
    
    :: Start Claude with context
    echo 📋 Context prepared. Starting Claude...
    echo ========================================
    echo.
    claude
    
    :: Save response to knowledge base
    echo.
    echo 💾 Save this answer to knowledge base?
    set /p "SAVE_ANSWER=Save as: (topic name or Enter to skip): "
    if not "!SAVE_ANSWER!"=="" (
        call :SAVE_TO_KNOWLEDGE "!SAVE_ANSWER!" "!USER_INPUT!"
    )
)

:: Save session
echo !date! !time! - !USER_INPUT! >> "%SESSION_FILE%"
goto:MAIN_LOOP

:: ======================================================
## 🔧 FUNCTIONS
:: ======================================================

:LOAD_KNOWLEDGE_BASE
echo 📊 Loading knowledge base...
if exist "%INDEX_FILE%" (
    for /f "tokens=2 delims=:" %%i in ('find /c ":" "%INDEX_FILE%"') do set "TOPIC_COUNT=%%i"
    if "!TOPIC_COUNT!"=="0" (
        echo ℹ️  Knowledge base empty. Start asking questions!
    ) else (
        echo ✅ Loaded !TOPIC_COUNT! topics from local knowledge
    )
) else (
    echo ℹ️  No knowledge base found. Creating new one.
)
goto :EOF

:CHECK_LOCAL_CACHE
set "QUERY=%~1"
set "CACHE_HIT=false"
set "CACHE_RESULT="

:: Search in topic files
for /f "delims=" %%f in ('dir /b "%CONTEXT_DIR%\*.txt" 2^>nul') do (
    findstr /i "!QUERY!" "%CONTEXT_DIR%\%%f" >nul
    if !errorlevel! equ 0 (
        set "CACHE_HIT=true"
        echo 📁 Related topic: %%~nf
        type "%CONTEXT_DIR%\%%f" | findstr /i "!QUERY!"
        echo.
    )
)

:: Search in cache (exact matches)
if exist "%CACHE_DIR%\%QUERY:.=_.%.txt" (
    set "CACHE_HIT=true"
    type "%CACHE_DIR%\%QUERY:.=_.%.txt"
)
goto :EOF

:PREPARE_CONTEXT
set "QUESTION=%~1"

:: Create context file for Claude
(
    echo # CLAUDE CONTEXT WITH LOCAL KNOWLEDGE
    echo # Session: !SESSION_ID!
    echo # Date: %date% %time%
    echo.
    echo ## LOCAL KNOWLEDGE BASE:
) > "%KNOWLEDGE_DIR%\claude_context.txt"

:: Add relevant local knowledge
for /f "delims=" %%f in ('dir /b "%CONTEXT_DIR%\*.txt" 2^>nul') do (
    findstr /i "!QUESTION!" "%CONTEXT_DIR%\%%f" >nul
    if !errorlevel! equ 0 (
        echo. >> "%KNOWLEDGE_DIR%\claude_context.txt"
        echo Topic: %%~nf >> "%KNOWLEDGE_DIR%\claude_context.txt"
        echo ----------------- >> "%KNOWLEDGE_DIR%\claude_context.txt"
        type "%CONTEXT_DIR%\%%f" >> "%KNOWLEDGE_DIR%\claude_context.txt"
    )
)

:: Add current question
(
    echo.
    echo ## CURRENT QUESTION:
    echo !QUESTION!
    echo.
    echo ## INSTRUCTIONS:
    echo 1. Reference local knowledge when applicable
    echo 2. Update knowledge base with new insights
    echo 3. Follow CLAUDE.md rules if present
    echo 4. Provide code examples when relevant
) >> "%KNOWLEDGE_DIR%\claude_context.txt"

:: Show context to user
echo 📋 Context includes relevant local knowledge.
goto :EOF

:SAVE_TO_KNOWLEDGE
set "TOPIC=%~1"
set "QUESTION=%~2"

echo 📝 Saving to topic: !TOPIC!
echo 💡 Question: !QUESTION!

:: Create or update topic file
(
    echo # Topic: !TOPIC!
    echo # Saved: %date% %time%
    echo # Related to: !QUESTION!
    echo.
    echo Please enter the knowledge to save (Ctrl+Z then Enter when done):
    echo.
) > "%CONTEXT_DIR%\!TOPIC!.txt"

:: Let user input the knowledge
copy con "%CONTEXT_DIR%\!TOPIC!.part" >nul
type "%CONTEXT_DIR%\!TOPIC!.part" >> "%CONTEXT_DIR%\!TOPIC!.txt"
del "%CONTEXT_DIR%\!TOPIC!.part" 2>nul

:: Update index
echo ✅ Saved to !TOPIC!.txt
goto :EOF

:SAVE_KNOWLEDGE
echo.
echo 💾 SAVE CURRENT KNOWLEDGE
echo ========================
echo.
set /p "TOPIC_NAME=Enter topic name: "
if "!TOPIC_NAME!"=="" goto:MAIN_LOOP

echo 📝 Enter knowledge for topic '!TOPIC_NAME!':
echo (Type your text, Ctrl+Z then Enter when done)
echo.

copy con "%CONTEXT_DIR%\!TOPIC_NAME!.txt" >nul
echo ✅ Saved to !TOPIC_NAME!.txt

:: Update index
call :UPDATE_INDEX "!TOPIC_NAME!"
goto:MAIN_LOOP

:SEARCH_KNOWLEDGE
echo.
echo 🔍 SEARCH LOCAL KNOWLEDGE
echo ========================
echo.
set /p "SEARCH_TERM=Enter search term: "
if "!SEARCH_TERM!"=="" goto:MAIN_LOOP

echo 📊 Searching for: !SEARCH_TERM!
echo.

set "FOUND=false"
for /f "delims=" %%f in ('dir /b "%CONTEXT_DIR%\*.txt" 2^>nul') do (
    findstr /i "!SEARCH_TERM!" "%CONTEXT_DIR%\%%f" >nul
    if !errorlevel! equ 0 (
        echo 📁 Found in: %%~nf
        echo -------------------------
        findstr /i "!SEARCH_TERM!" "%CONTEXT_DIR%\%%f"
        echo.
        set "FOUND=true"
    )
)

if "!FOUND!"=="false" (
    echo ❌ No matches found for "!SEARCH_TERM!"
)
pause
goto:MAIN_LOOP

:SHOW_TOPICS
echo.
echo 📚 AVAILABLE TOPICS
echo ===================
echo.
dir /b "%CONTEXT_DIR%\*.txt" 2>nul
echo.
if exist "%INDEX_FILE%" (
    echo 📊 Knowledge index: %INDEX_FILE%
)
pause
goto:MAIN_LOOP

:CLEAR_SCREEN
cls
echo ========================================
echo    🧠 Claude Local Knowledge Agent
echo ========================================
echo    Election Project with Local Cache
echo ========================================
echo.
echo 📁 Knowledge Base: %KNOWLEDGE_DIR%
echo 🔗 API: %ANTHROPIC_BASE_URL%
echo 🆔 Session: %SESSION_ID%
echo.
goto:MAIN_LOOP

:UPDATE_INDEX
set "TOPIC=%~1"
:: Simple index update - in production would use JSON
echo !date! !time! - Added/updated: !TOPIC! >> "%KNOWLEDGE_DIR%\index_log.txt"
goto :EOF

:: ======================================================
## 🏁 END SESSION
:: ======================================================

:END_SESSION
echo.
echo ========================================
echo    🧠 Session Complete
echo ========================================
echo 📁 Session saved: %SESSION_FILE%
echo 💾 Knowledge base: %KNOWLEDGE_DIR%
echo 📊 Topics available: 
dir /b "%CONTEXT_DIR%\*.txt" 2>nul | find /c /v ""
echo.
echo 🔄 Next time, Claude will check local knowledge first!
echo.
timeout /t 3 >nul
exit /b 0