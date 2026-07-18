"""
Check: Tags present.
Finds content pages whose YAML frontmatter is missing a non-empty `tags:` field.
Skips utility pages and dated archive entries.
"""

import re

from . import UTILITY_PAGES, is_archive


# Match a frontmatter `tags:` line with at least one entry.
# Handles list-form (`tags: [a, b]`), inline list (`tags: [person]`),
# and YAML block-form (`tags:\n  - person`).
TAGS_INLINE_RE = re.compile(r"^tags:\s*\[\s*[^\]\s]")
TAGS_BLOCK_RE = re.compile(r"^tags:\s*$")
LIST_ITEM_RE = re.compile(r"^\s*-\s*\S")


def has_tags(text):
    """Return True if frontmatter contains a non-empty `tags:` field."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return False

    # Walk frontmatter until closing ---
    i = 1
    while i < len(lines) and lines[i].strip() != "---":
        line = lines[i]
        if TAGS_INLINE_RE.match(line):
            return True
        if TAGS_BLOCK_RE.match(line):
            # Look ahead for at least one list item
            j = i + 1
            while j < len(lines) and lines[j].strip() != "---":
                if LIST_ITEM_RE.match(lines[j]):
                    return True
                # If we hit another top-level key, stop scanning the block
                if re.match(r"^\S", lines[j]):
                    break
                j += 1
            return False
        i += 1
    return False


def run(pages, wiki_dir):
    missing = []
    for page_name in sorted(pages):
        if page_name in UTILITY_PAGES or is_archive(page_name):
            continue
        text = pages[page_name].read_text(encoding="utf-8")
        if not has_tags(text):
            missing.append(page_name)
    return missing


def report(findings):
    print(f"== Pages Missing Tags ({len(findings)}) ==")
    if findings:
        for name in findings:
            print(f"  {name}.md")
    else:
        print("  None found.")
