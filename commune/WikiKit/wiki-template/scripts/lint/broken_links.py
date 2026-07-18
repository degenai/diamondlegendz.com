"""
Check: Broken wikilinks.
Finds [[links]] that point to pages with no corresponding .md file.
Anchor portion (`#Heading`) is stripped before lookup — anchored intra-page
links resolve against the page itself, not against `Page#Heading` as a name.
"""

import re
from . import extract_wikilinks


def run(pages, wiki_dir):
    broken = []
    page_names = set(pages.keys())

    for page_name, page_path in sorted(pages.items()):
        text = page_path.read_text(encoding="utf-8")
        for i, line in enumerate(text.split("\n"), 1):
            # Strip inline backtick code before scanning
            cleaned = re.sub(r"`[^`]+`", "", line)
            for target in extract_wikilinks(cleaned):
                # Strip anchor portion: [[Page#Heading]] resolves to Page
                page_target = target.split("#", 1)[0].strip()
                if page_target and page_target not in page_names:
                    broken.append((page_name, i, target))

    return broken


def report(findings):
    print(f"== Broken Wikilinks ({len(findings)}) ==")
    if findings:
        for page, line, target in findings:
            print(f"  {page}.md:{line} — [[{target}]] does not exist")
    else:
        print("  None found.")
