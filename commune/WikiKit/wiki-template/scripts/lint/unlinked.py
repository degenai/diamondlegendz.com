"""
Check: Unlinked plain-text mentions.
Finds page names appearing as bare text instead of [[wikilinks]].

Filters to reduce noise:
- Skips utility pages (index, log) as source files
- Skips generic/short page names unlikely to be intentional references
- Skips markdown headings
- Only flags first bare mention per (page, target) pair
"""

import re
from . import SKIP_BARE, UTILITY_PAGES, BLACKLIST, is_archive

# Additional names to skip beyond the shared SKIP_BARE set.
# Add the wiki owner's own name here once you start authoring — an author's
# name shows up in third person on nearly every page by design, and you do
# not want every one of those flagged. Empty on a fresh install.
EXTRA_SKIP = set()


def run(pages, wiki_dir):
    skip = SKIP_BARE | EXTRA_SKIP
    findings = []

    for page_name, page_path in sorted(pages.items()):
        # Don't scan utility or archive pages — their bare mentions are by design
        if page_name in UTILITY_PAGES or is_archive(page_name):
            continue

        text = page_path.read_text(encoding="utf-8")
        lines = text.split("\n")
        already_flagged = set()

        for check_name in pages:
            if check_name in skip or is_archive(check_name):
                continue
            if check_name == page_name:
                continue
            if len(check_name) <= 3:
                continue

            for i, line in enumerate(lines, 1):
                # Skip title line
                if i == 1 and line.startswith("# "):
                    continue
                # Skip all headings
                if line.lstrip().startswith("#"):
                    continue

                # Strip existing wikilinks, inline code, and {nolink} markers
                cleaned = re.sub(r"\[\[[^\]]*\]\]", "", line)
                cleaned = re.sub(r"`[^`]+`", "", cleaned)
                cleaned = re.sub(r"\{[^}]+\}", "", cleaned)

                # Skip code blocks
                if cleaned.strip().startswith("```"):
                    continue

                pattern = r"(?<!\[)\b" + re.escape(check_name) + r"\b(?!\])"
                if re.search(pattern, cleaned):
                    # Only flag first occurrence per (page, target)
                    key = (page_name, check_name)
                    if key in BLACKLIST:
                        continue
                    if key not in already_flagged:
                        already_flagged.add(key)
                        findings.append((page_name, i, check_name, line.strip()))

    return findings


def report(findings):
    print(f"== Unlinked Plain-Text Mentions ({len(findings)}) ==")
    if findings:
        for page, line, mention, text in findings:
            print(f"  {page}.md:{line} -- bare '{mention}'")
            print(f"    {text[:100]}")
    else:
        print("  None found.")
