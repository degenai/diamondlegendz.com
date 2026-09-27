#!/usr/bin/env python3
"""Extract Telegram JSONL turns into an evidence-first bounded ledger.

This utility is optimized for one-pass audit runs:
- source-range filter
- normalization + dedupe
- basic triage classification
- deterministic TSV output
- compact machine-readable summary (required counters)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, OrderedDict
from datetime import datetime, date
from pathlib import Path
from typing import Iterable, List, Tuple, Optional, Dict, Any

VOICE_RE = re.compile(r'^\[The user sent a voice message~.*?"(.*?)"\]$', re.S)
NOISE_PREFIXES = (
    "[important:",
    "[important",
    "[async delegation complete",
    "[the user sent a voice message",
)
TEST_NOISE = {"test", "test test", "o", "blep", "got it"}


def parse_ts(ts: str) -> Optional[datetime]:
    """Parse timestamp values seen across Telegram exports."""
    if not ts:
        return None
    candidates = [ts]
    if " " in ts and "+" not in ts:
        candidates.append(ts.replace(" ", "T", 1))
    candidates.extend([f"{ts}Z", f"{ts}.000000", f"{ts}.000000Z"])

    for value in candidates:
        for fmt in [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
        ]:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
            
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        return None


def clean_text(row: Dict[str, Any]) -> str:
    """Return normalized candidate text while preserving user-visible speech."""
    text = (row.get("text") or row.get("content") or "").strip()

    # Preserve raw image/voice wrappers for audit traceability but normalize text for matching.
    if text.startswith("[The user sent a voice message"):
        m = VOICE_RE.search(text)
        if m:
            text = m.group(1)
    return text.replace("\r", " ").replace("\t", " ").replace("\n", " ").strip()


def classify(text: str) -> str:
    """Heuristic classification for audit triage."""
    t = text.lower().strip()
    if not t:
        return "NOISE"

    if t in TEST_NOISE:
        return "NOISE_TEST"

    # Tool/agent runtime chatter — keep in the same run but mark non-durable.
    for pfx in NOISE_PREFIXES:
        if t.startswith(pfx):
            return "NOISE_TOOLING"

    if "[important" in t and "command" in t:
        return "NOISE_TOOLING"

    if "ping" == t or t.startswith("ping"):
        return "NOISE_SHORT"

    if "image attached" in t and "attached at:" in t:
        return "IMAGE"

    return "USER_CONTENT"


def within_window(ts: datetime, start: Optional[date], end: Optional[date]) -> bool:
    if start is None and end is None:
        return True
    d = ts.date()
    if start is not None and d < start:
        return False
    if end is not None and d > end:
        return False
    return True


def iter_jsonl(path: Path) -> Iterable[Tuple[int, Dict[str, Any], str]]:
    """Yield `(line_no, row, raw)` tuples for valid JSON rows only."""
    with path.open("r", encoding="utf-8") as f:
        for line_no, raw in enumerate(f, start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                yield line_no, json.loads(raw), raw
            except json.JSONDecodeError:
                yield line_no, {"__error": "json-decode"}, raw


def extract_rows(rows: Iterable[Tuple[int, Dict[str, Any], str]], start: Optional[date], end: Optional[date]) -> Tuple[List[dict], Dict[str, int], List[dict]]:
    out: List[dict] = []
    bad_rows: List[dict] = []
    stats = Counter()

    for line_no, row, raw in rows:
        stats["rows_input"] += 1

        if "__error" in row:
            stats["rows_malformed"] += 1
            bad_rows.append({"line_no": line_no, "error": row.get("__error"), "raw_excerpt": raw[:180]})
            continue

        stats["rows_parsable"] += 1

        ts_text = str(row.get("timestamp", "")).strip()
        dt = parse_ts(ts_text)
        if not dt:
            stats["rows_bad_timestamp"] += 1
            continue

        if not within_window(dt, start, end):
            continue

        stats["rows_in_window"] += 1

        text = clean_text(row)
        if not text:
            # Keep empty user payloads visible if requested; do not silently drop without a reason.
            stats["rows_skipped_empty"] += 1
            continue

        entry = {
            "message_id": str(row.get("message_id", "")),
            "session_id": str(row.get("session_id", "")),
            "timestamp": dt.isoformat(),
            "title": str(row.get("title", "")),
            "class": classify(text),
            "content_preview": text[:500],
            "raw_excerpt": raw[:320],
        }
        out.append(entry)
        stats["rows_kept"] += 1

    return out, dict(stats), bad_rows


def dedupe_rows(rows: List[dict]) -> Tuple[List[dict], int]:
    if not rows:
        return rows, 0
    seen = set()
    deduped: List[dict] = []
    collapsed = 0

    for r in rows:
        key = (r["message_id"], r["session_id"], r["timestamp"], r["content_preview"])
        if key in seen:
            collapsed += 1
            continue
        seen.add(key)
        deduped.append(r)
    return deduped, collapsed


def write_tsv(path: Path, rows: List[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow([
            "message_id",
            "session_id",
            "timestamp",
            "title",
            "class",
            "content_preview",
            "raw_excerpt",
        ])
        for r in rows:
            w.writerow([
                r["message_id"],
                r["session_id"],
                r["timestamp"],
                r["title"],
                r["class"],
                r["content_preview"],
                r["raw_excerpt"],
            ])


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="Path to telegram jsonl export")
    p.add_argument("--output", required=True, help="TSV output path")
    p.add_argument("--start", default=None, help="YYYY-MM-DD inclusive start date")
    p.add_argument("--end", default=None, help="YYYY-MM-DD inclusive end date")
    p.add_argument("--dedupe", action="store_true", help="Collapse exact duplicate rows in session")
    p.add_argument("--summary-json", default=None, help="Optional path to persist run summary JSON")
    args = p.parse_args()

    start = date.fromisoformat(args.start) if args.start else None
    end = date.fromisoformat(args.end) if args.end else None

    rows, stats, bad_rows = extract_rows(iter_jsonl(Path(args.input)), start, end)
    rows_deduped = 0

    if args.dedupe:
        rows, rows_deduped = dedupe_rows(rows)

    rows.sort(key=lambda r: r["timestamp"])
    write_tsv(Path(args.output), rows)

    # Preserve deterministic one-pass integrity counters.
    status_counts: Dict[str, int] = dict(OrderedDict(sorted(Counter(r["class"] for r in rows).items())))
    summary = {
        "rows_input": stats.get("rows_input", 0),
        "rows_parsable": stats.get("rows_parsable", 0),
        "rows_in_window": stats.get("rows_in_window", 0),
        "rows_kept": stats.get("rows_kept", 0),
        "rows_deduped": rows_deduped,
        "rows_output": len(rows),
        "rows_malformed": stats.get("rows_malformed", 0),
        "rows_bad_timestamp": stats.get("rows_bad_timestamp", 0),
        "rows_skipped_empty": stats.get("rows_skipped_empty", 0),
        "status_counts": status_counts,
        "output": args.output,
        "bad_rows_sample": bad_rows[:5],
    }

    if args.summary_json:
        summary_path = Path(args.summary_json)
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(summary, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
