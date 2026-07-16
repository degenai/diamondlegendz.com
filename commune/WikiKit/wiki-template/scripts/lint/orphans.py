"""
Check: Orphan pages.
Finds pages that no content page links to (utility pages don't count).
"""

from . import UTILITY_PAGES, extract_wikilinks, is_archive


def run(pages, wiki_dir):
    content_linked = set()

    for page_name, page_path in pages.items():
        if page_name in UTILITY_PAGES:
            continue
        text = page_path.read_text(encoding="utf-8")
        for target in extract_wikilinks(text):
            content_linked.add(target)

    orphans = []
    for page_name in sorted(pages):
        if page_name in UTILITY_PAGES or is_archive(page_name):
            continue
        if page_name not in content_linked:
            orphans.append(page_name)

    return orphans


def report(findings):
    print(f"== Orphan Pages ({len(findings)}) ==")
    if findings:
        for name in findings:
            print(f"  {name}.md")
    else:
        print("  None found.")
