#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"

printf "== LUA REPLAY ==\n"
tools/lua/lua5.1.exe replay/run_tests.lua

printf "== PYTHON KRSYNC TESTS ==\n"
python -m unittest -v sync/tests/test_krabsync.py

printf "== SYNTAX / LINT ==\n"
python - <<'PY'
from pathlib import Path
import subprocess, sys
root = Path('.').resolve()
files = [str(p) for p in (list((root/'KrabsPulse').rglob('*.lua')) + list((root/'replay').rglob('*.lua')) + list((root/'sync').rglob('*.lua')))]
fail = 0
for f in files:
    r = subprocess.run([str(root / 'tools' / 'lua' / 'luac5.1.exe'), '-p', f], capture_output=True, text=True)
    if r.returncode != 0:
        fail += 1
        print(f'FAIL {f}')
print(f'LUAC_FILES={len(files)}')
print(f'LUAC_FAILURES={fail}')
if fail:
    sys.exit(1)
PY
"$HOME/AppData/Local/hermes/cache/luacheck-0.23.0/luacheck.exe" KrabsPulse replay sync/export_saved_variables.lua
uvx ruff check sync/krabsync.py sync/tests/test_krabsync.py
uvx bandit -q -r sync/krabsync.py

if [ -n "${2:-}" ]; then
  ROOT="$2"
  printf "== KRABSYNC LIVE ROOT %s ==\n" "$ROOT"
  python sync/krabsync.py --root "$ROOT" status
  python sync/krabsync.py --root "$ROOT" verify
fi
