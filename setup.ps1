# setup.ps1
$ErrorActionPreference = "Stop"

# 1. Resolve Python executable
if (Get-Command python -ErrorAction SilentlyContinue) {
    $PY_BIN = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $PY_BIN = "py"
} else {
    Write-Error "[!] Error: Python was not found in PATH."
    exit 1
}

Write-Host "[*] Using: $(& $PY_BIN --version)"

# 2. Create virtual environment if missing
if (-not (Test-Path "scripts\.venv")) {
    Write-Host "[*] Creating virtual environment at scripts\.venv..."
    & $PY_BIN -m venv scripts\.venv
}

$VENV_PY = "scripts\.venv\Scripts\python.exe"

if (-not (Test-Path $VENV_PY)) {
    Write-Error "[!] Error: Virtual environment python.exe not found."
    exit 1
}

# 3. Install dependencies
Write-Host "[*] Upgrading pip..."
& $VENV_PY -m pip install --upgrade pip

Write-Host "[*] Installing dependencies from scripts\requirements.txt..."
& $VENV_PY -m pip install -r scripts\requirements.txt

Write-Host "`n[+] Environment setup complete." -ForegroundColor Green
Write-Host "    To activate manually in PowerShell, run:"
Write-Host "    .\scripts\.venv\Scripts\Activate.ps1" -ForegroundColor Yellow