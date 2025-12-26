@echo off
title DeepSeek AI Toolkit - Election Project
color 0A

echo ============================================
echo    🤖 DeepSeek AI Toolkit - Election Project
echo ============================================
echo.

:menu
cls
echo.
echo [1] Start Claude Code (Anthropic-compatible)
echo [2] Start Interactive Knowledge CLI
echo [3] Start Python DeepSeek CLI
echo [4] Setup API Key Only
echo [5] Test API Connection
echo [6] Exit
echo.

set /p choice="Select option (1-6): "

if "%choice%"=="1" goto claude
if "%choice%"=="2" goto interactive
if "%choice%"=="3" goto python_cli
if "%choice%"=="4" goto setup
if "%choice%"=="5" goto test
if "%choice%"=="6" goto exit

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto menu

:claude
echo.
echo Starting Claude Code with DeepSeek...
echo.

REM Set correct environment variables for Claude Code
set ANTHROPIC_API_KEY=sk-ea5c370fbd514e84bc67107e34274881
set ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
set ANTHROPIC_MODEL=deepseek-chat
set API_TIMEOUT_MS=600000

echo API Key configured: %ANTHROPIC_API_KEY:~0,8%...
echo Endpoint: %ANTHROPIC_BASE_URL%
echo Model: %ANTHROPIC_MODEL%
echo Project: election
echo.

REM Check if Claude is installed
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Claude Code not found in PATH!
    echo Please install Claude Code from:
    echo https://claude.ai/code
    pause
    goto menu
)

echo Starting Claude Code...
echo.
claude
goto menu

:interactive
echo.
echo Starting Interactive Knowledge CLI...
echo.

REM Set API key for Python CLI
set DEEPSEEK_API_KEY=sk-ea5c370fbd514e84bc67107e34274881

REM Check dependencies
python -c "import colorama, requests" 2>nul
if %errorlevel% neq 0 (
    echo Installing dependencies...
    pip install colorama requests
)

REM Check if interactive_cli.py exists
if not exist "interactive_cli.py" (
    echo ❌ interactive_cli.py not found!
    echo Please create the interactive CLI first.
    pause
    goto menu
)

echo Starting Interactive CLI...
echo.
python interactive_cli.py
goto menu

:python_cli
echo.
echo Starting Python DeepSeek CLI...
echo.

REM Create a simple Python CLI if it doesn't exist
if not exist "deepseek_cli.py" (
    echo Creating Python DeepSeek CLI...
    (
echo import os
echo from openai import OpenAI
echo.
echo client = OpenAI^(
echo    api_key="sk-ea5c370fbd514e84bc67107e34274881",
echo    base_url="https://api.deepseek.com"
echo ^)
echo.
echo print^("🤖 DeepSeek CLI - Election Project"^)
echo print^("Type 'exit' to quit."^)
echo.
echo while True:
echo     user_input = input^("You: "^).strip^(^)
echo     if user_input.lower^(^) == 'exit':
echo         break
echo     response = client.chat.completions.create^(
echo         model="deepseek-chat",
echo         messages=[{"role": "user", "content": user_input}]
echo     ^)
echo     print^("DeepSeek: " + response.choices[0].message.content^)
echo     print^(^)
    ) > deepseek_cli.py
)

echo Installing OpenAI package if needed...
pip install openai >nul 2>&1

echo Starting Python CLI...
echo.
python deepseek_cli.py
goto menu

:setup
echo.
echo Setting up API Key Configuration...
echo.

REM Create configuration file
(
echo {
echo   "api_key": "sk-ea5c370fbd514e84bc67107e34274881",
echo   "endpoint": "https://api.deepseek.com",
echo   "anthropic_endpoint": "https://api.deepseek.com/anthropic",
echo   "model": "deepseek-chat",
echo   "project": "election",
echo   "timestamp": "%date% %time%"
echo }
) > .knowledge\config.json

REM Set environment variables
set DEEPSEEK_API_KEY=sk-ea5c370fbd514e84bc67107e34274881
set ANTHROPIC_API_KEY=sk-ea5c370fbd514e84bc67107e34274881

echo ✓ Configuration saved to .knowledge\config.json
echo ✓ Environment variables set
echo.
echo Current configuration:
echo   DEEPSEEK_API_KEY: %DEEPSEEK_API_KEY:~0,8%...
echo   ANTHROPIC_API_KEY: %ANTHROPIC_API_KEY:~0,8%...
echo.
pause
goto menu

:test
echo.
echo Testing API Connection...
echo.

REM Create test script
(
echo import os
echo import requests
echo import json
echo.
echo api_key = "sk-ea5c370fbd514e84bc67107e34274881"
echo.
echo # Test 1: Standard OpenAI-compatible endpoint
echo print^("Testing OpenAI-compatible endpoint..."^)
echo try:
echo     headers = {
echo         "Authorization": f"Bearer {api_key}",
echo         "Content-Type": "application/json"
echo     }
echo     data = {
echo         "model": "deepseek-chat",
echo         "messages": [{"role": "user", "content": "Say hello"}],
echo         "max_tokens": 10
echo     }
echo     response = requests.post^(
echo         "https://api.deepseek.com/chat/completions",
echo         headers=headers,
echo         json=data,
echo         timeout=10
echo     ^)
echo     if response.status_code == 200:
echo         print^("✓ OpenAI endpoint: Working"^)
echo     else:
echo         print^("✗ OpenAI endpoint: Failed -", response.status_code^)
echo except Exception as e:
echo     print^("✗ OpenAI endpoint: Error -", str^(e^)^)
echo.
echo # Test 2: Anthropic-compatible endpoint
echo print^("\nTesting Anthropic-compatible endpoint..."^)
echo try:
echo     headers = {
echo         "x-api-key": api_key,
echo         "anthropic-version": "2023-06-01",
echo         "content-type": "application/json"
echo     }
echo     data = {
echo         "model": "deepseek-chat",
echo         "max_tokens": 10,
echo         "messages": [{"role": "user", "content": "Say hello"}]
echo     }
echo     response = requests.post^(
echo         "https://api.deepseek.com/anthropic/v1/messages",
echo         headers=headers,
echo         json=data,
echo         timeout=10
echo     ^)
echo     if response.status_code == 200:
echo         print^("✓ Anthropic endpoint: Working"^)
echo     else:
echo         print^("✗ Anthropic endpoint: Failed -", response.status_code^)
echo except Exception as e:
echo     print^("✗ Anthropic endpoint: Error -", str^(e^)^)
echo.
echo print^("\nAPI Key: " + api_key[:8] + "..."^)
) > test_api.py

python test_api.py
del test_api.py
echo.
pause
goto menu

:exit
echo.
echo Thank you for using DeepSeek AI Toolkit!
echo.
timeout /t 2 >nul
exit