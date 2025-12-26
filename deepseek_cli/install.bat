REM File: install.bat
@echo off
echo ==========================================
echo  Knowledge-Based CLI with DeepSeek API
echo ==========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python from: https://python.org
    pause
    exit /b 1
)

echo ✅ Python found

REM Create virtual environment
echo.
echo Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ❌ Failed to create virtual environment
    pause
    exit /b 1
)
echo ✅ Virtual environment created

REM Activate virtual environment
echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ❌ Failed to activate virtual environment
    pause
    exit /b 1
)
echo ✅ Virtual environment activated

REM Install requirements
echo.
echo Installing dependencies...
pip install requests
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed

REM Create .knowledge directory
echo.
echo Setting up knowledge base...
mkdir .knowledge 2>nul
if exist .knowledge (
    echo ✅ Knowledge directory created
) else (
    echo ❌ Failed to create knowledge directory
)

echo.
echo ==========================================
echo            INSTALLATION COMPLETE
echo ==========================================
echo.
echo To use the CLI:
echo.
echo 1. First, get your API key from:
echo    https://platform.deepseek.com/api_keys
echo.
echo 2. Set up your API key:
echo    python knowledge_cli.py setup-api-key YOUR_KEY
echo    OR
echo    set DEEPSEEK_API_KEY=YOUR_KEY
echo.
echo 3. Try it out:
echo    python knowledge_cli.py develop "Create a simple calculator"
echo.
echo 4. Other commands:
echo    python knowledge_cli.py search "query"
echo    python knowledge_cli.py list
echo.
echo ==========================================
pause