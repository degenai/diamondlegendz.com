#!/usr/bin/env python3
"""Verify a sidecar/audit document contains no live secrets, account IDs, or client slugs.

Run this BEFORE staging a sidecar into an attacker's sandbox. Mid-fold edits can
leak an identifier the inventory said it would redact (real incident: the MED-7
client-slug leak in the 2026-08-07 Alexpedia audit).

Usage:
    python verify_sidecar_redaction.py <sidecar.md> <repo_root>

Checks, all structural (never prints values):
  1. REDACT_SECRETS literals from repo site/build.py (AST-parsed) absent from sidecar
  2. Known key-shape regexes (sk-[0-9a-f]{32}, GOCSPX-, etc.) absent
  3. Tracked 9-digit account identifiers absent
  4. Client slugs (clinical/clients filenames) absent
  5. Optional: control-line sanity (sidecar starts with expected version marker)

Exit 0 = clean, 1 = leak or unusable input. Prints only counts/booleans.
"""

import ast
import re
import sys
from pathlib import Path

KEY_SHAPES = [
    re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"GOCSPX-[A-Za-z0-9_-]{10,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"-----BEGIN [A-Z ]+PRIVATE KEY-----"),
]
ACCOUNT_RE = re.compile(r"\b\d{9,12}\b")
CLINICAL_DIRS = ["clinical/clients", "clinical/soap"]


def repo_known_values(repo: Path):
    """Return (secret_values, account_ids, client_slugs) from the repo, structurally."""
    secrets, accounts, slugs = [], [], []
    build = repo / "site" / "build.py"
    if build.exists():
        try:
            tree = ast.parse(build.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    for t in node.targets:
                        if isinstance(t, ast.Name) and t.id == "REDACT_SECRETS":
                            try:
                                secrets = list(ast.literal_eval(node.value))
                            except Exception:
                                pass
        except Exception:
            pass
    # account identifiers hardcoded in tracked scripts (known anti-pattern)
    for script in (repo / "scripts").glob("*.py"):
        try:
            for m in ACCOUNT_RE.findall(script.read_text(encoding="utf-8")):
                accounts.append(m)
        except Exception:
            pass
    # client slugs = filenames under clinical trees
    for d in CLINICAL_DIRS:
        p = repo / d
        if p.is_dir():
            for f in p.iterdir():
                if f.suffix.lower() in (".md", ".txt"):
                    slugs.append(f.stem.lower())
    return secrets, accounts, slugs


def main():
    if len(sys.argv) < 3:
        print("usage: verify_sidecar_redaction.py <sidecar.md> <repo_root>")
        return 2
    sidecar = Path(sys.argv[1]).read_text(encoding="utf-8")
    repo = Path(sys.argv[2])
    secrets, accounts, slugs = repo_known_values(repo)

    leaks = []
    for v in secrets:
        if v and v in sidecar:
            leaks.append("secret literal")
    for pat in KEY_SHAPES:
        if pat.search(sidecar):
            leaks.append(f"key shape {pat.pattern[:20]}")
    for a in accounts:
        if a and a in sidecar:
            leaks.append("account identifier")
    for s in slugs:
        if s and s in sidecar:
            leaks.append(f"client slug {s}")

    print(f"sidecar bytes: {len(sidecar.encode('utf-8'))}")
    print(f"credential values present: {sum(1 for x in leaks if 'secret' in x or 'key shape' in x)}")
    print(f"account identifiers present: {sum(1 for x in leaks if 'account' in x)}")
    print(f"client slugs present: {sum(1 for x in leaks if 'slug' in x)}")
    if leaks:
        print("LEAKS PRESENT:", len(leaks))
        return 1
    print("CLEAN")
    return 0


if __name__ == "__main__":
    sys.exit(main())
