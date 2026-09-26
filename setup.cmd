@echo off
setlocal enabledelayedexpansion

:: 1. Resolve Python executable
where python >nul 2>nul
if %errorlevel% equ 0 (
    set PY_BIN=python
) else (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        set PY_BIN=py
    ) else (
        echo [!] Error: Python was not found in PATH.
        exit /b 1
    )
)

echo [*] Using: 
%PY_BIN% --version

:: 2. Create virtual environment if missing
if not exist "scripts\.venv" (
    echo [*] Creating virtual environment at scripts\.venv...
    %PY_BIN% -m venv scripts\.venv
    if %errorlevel% neq 0 exit /b %errorlevel%
)

set VENV_PY=scripts\.venv\Scripts\python.exe

if not exist "%VENV_PY%" (
    echo [!] Error: Virtual environment python.exe not found.
    exit /b 1
)

:: 3. Install dependencies
echo [*] Upgrading pip...
"%VENV_PY%" -m pip install --upgrade pip

echo [*] Installing dependencies from scripts\requirements.txt...
"%VENV_PY%" -m pip install -r scripts\requirements.txt

echo.
echo [+] Environment setup complete.
echo     To activate manually in CMD, run:
echo     call scripts\.venv\Scripts\activate.bat