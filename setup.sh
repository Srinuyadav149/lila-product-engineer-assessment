#!/usr/bin/env bash
set -e

# 1. Resolve Python executable
if command -v python3 &>/dev/null; then
    PY_BIN="python3"
elif command -v python &>/dev/null; then
    PY_BIN="python"
else
    echo "[!] Error: Neither python3 nor python was found in PATH." >&2
    exit 1
fi

echo "[*] Using: $($PY_BIN --version)"

# 2. Create virtual environment if missing
if [ ! -d "scripts/.venv" ]; then
    echo "[*] Creating virtual environment at scripts/.venv..."
    "$PY_BIN" -m venv scripts/.venv
fi

# 3. Detect Unix vs Windows (Git Bash) layout
if [ -f "scripts/.venv/bin/python" ]; then
    VENV_PY="scripts/.venv/bin/python"
    ACTIVATE_PATH="scripts/.venv/bin/activate"
elif [ -f "scripts/.venv/Scripts/python.exe" ]; then
    VENV_PY="scripts/.venv/Scripts/python.exe"
    ACTIVATE_PATH="scripts/.venv/Scripts/activate"
else
    echo "[!] Error: Virtual environment python binary not found." >&2
    exit 1
fi

# 4. Install dependencies directly inside the venv
echo "[*] Upgrading pip..."
"$VENV_PY" -m pip install --upgrade pip

echo "[*] Installing dependencies from scripts/requirements.txt..."
"$VENV_PY" -m pip install -r scripts/requirements.txt

echo ""
echo "[+] Environment setup complete."
echo "    To activate manually in your terminal, run:"
echo "    source $ACTIVATE_PATH"