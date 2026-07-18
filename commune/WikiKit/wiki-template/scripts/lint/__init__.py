"""
Shared utilities for the WikiKit lint suite.

Ported from the alexpedia lint suite (degenai/alexpedia), sanitized for a
fresh install: personal blacklist entries and author-specific skip names
removed. Everything here is generic wiki plumbing.
"""

import re
from pathlib import Path

# Pages whose names are too generic to flag as bare mentions.
# Utility/tooling stems only — add your own conventional page names here
# (e.g. "projects", "tech") once they exist and start showing up bare a lot.
SKIP_BARE = {"meta", "log", "index", "tags"}

# Per-file suppression for known false positives.
# Format: {(file_stem, page_name): "reason"}
# Starts empty on a fresh install. Add an entry only when a bare-mention
# flag is a genuine false positive you want silenced (e.g. a URL that
# happens to contain a page name).
BLACKLIST = {}

# Utility pages exempt from orphan / tag checks.
UTILITY_PAGES = {"index", "log", "tags"}

# Date pattern — dated archive filenames like 2026-07-16, 2026-07-16b.
# Exempt from unlinked and orphan checks; they are archive entries, not
# content nodes. (The captain's log lives in _meta/captains-log/ and is not
# scanned at all — it is the narrative layer, not the graph.)
DATE_PAGE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[a-z]?$")


def is_archive(page_name):
    return bool(DATE_PAGE_RE.match(page_name))


def load_pages(wiki_dir):
    """Return dict of {page_name: Path} for all .md files in nodes/ and _meta/.

    Only the top level of _meta/ is scanned; subfolders like
    _meta/captains-log/ are deliberately excluded — captain's logs are the
    narrative layer, not graph nodes.
    """
    pages = {}
    for f in (Path(wiki_dir) / "nodes").glob("*.md"):
        pages[f.stem] = f
    for f in (Path(wiki_dir) / "_meta").glob("*.md"):
        pages[f.stem] = f
    return pages


def extract_wikilinks(text):
    """Extract all [[target]] or [[target|alias]] wikilink targets from text."""
    return re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", text)
