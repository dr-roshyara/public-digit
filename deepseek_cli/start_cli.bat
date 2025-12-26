REM File: start_cli.bat
@echo off
echo Starting Interactive Knowledge CLI...
echo.

REM Check if virtual environment exists
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
    echo Virtual environment activated
) else (
    echo No virtual environment found, using system Python
)

REM Check dependencies
python -c "import colorama, requests" 2>nul
if errorlevel 1 (
    echo Installing dependencies...
    pip install colorama requests
)

REM Run the CLI
python interactive_cli.py

pause