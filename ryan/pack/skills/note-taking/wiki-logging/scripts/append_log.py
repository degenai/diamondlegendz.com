#!/usr/bin/env python3
"""Insert a dated entry beneath ``# Log`` without replacing concurrent content."""

from __future__ import annotations

import argparse
import os
import tempfile
import time
from pathlib import Path


def acquire_lock(path: Path, timeout: float = 10.0) -> int:
    deadline = time.monotonic() + timeout
    while True:
        try:
            return os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise TimeoutError(f"Timed out waiting for log lock: {path}")
            time.sleep(0.05)


def insert_entry(wiki_root: Path, entry: str) -> Path:
    log_path = wiki_root / "_meta" / "log.md"
    lock_path = log_path.with_suffix(log_path.suffix + ".lock")
    lock_fd = acquire_lock(lock_path)
    try:
        text = log_path.read_text(encoding="utf-8")
        marker = "# Log\n"
        if marker not in text:
            raise RuntimeError(f"Missing {marker!r} marker in {log_path}")
        normalized = entry.strip() + "\n\n"
        if normalized.strip() in text:
            raise RuntimeError("Entry already exists in log; refusing duplicate insertion")
        updated = text.replace(marker, marker + normalized, 1)
        fd, temp_name = tempfile.mkstemp(
            prefix=log_path.name + ".", suffix=".tmp", dir=log_path.parent
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
                handle.write(updated)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, log_path)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
        return log_path
    finally:
        os.close(lock_fd)
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wiki-root", type=Path, default=Path.cwd())
    parser.add_argument("--entry-file", type=Path, required=True)
    args = parser.parse_args()
    entry = args.entry_file.read_text(encoding="utf-8")
    path = insert_entry(args.wiki_root.resolve(), entry)
    print(path)


if __name__ == "__main__":
    main()
