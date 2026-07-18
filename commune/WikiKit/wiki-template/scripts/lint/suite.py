"""
WikiKit Lint Suite.

Runs all lint checks by default, or pick specific ones with flags.

Usage (run from the scripts/ directory):
  python -m lint.suite                    # run all checks
  python -m lint.suite --only unlinked    # run one check
  python -m lint.suite --skip orphans     # skip one check
  python -m lint.suite --wiki /path/to/wiki  # point at a different wiki dir

Available checks: unlinked, orphans, broken_links, tags_present

There is deliberately NO index check. The append-only log + the filesystem
are canonical; there is no index file to sync against. Retrieval is
diagnostic (grep the log for when a thing entered), not topical browsing.
"""

import argparse
import io
import sys
from pathlib import Path

# Force UTF-8 output on Windows (cp1252 chokes on arrows, dashes, etc.)
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from . import load_pages
from . import unlinked, orphans, broken_links, tags_present

CHECKS = {
    "unlinked": unlinked,
    "orphans": orphans,
    "broken_links": broken_links,
    "tags_present": tags_present,
}


def get_wiki_dir(cli_path=None):
    if cli_path:
        return Path(cli_path)
    # Default: two levels up from this file (scripts/lint/ -> wiki-template/)
    return Path(__file__).resolve().parent.parent.parent


def main():
    parser = argparse.ArgumentParser(description="WikiKit Lint Suite")
    parser.add_argument("--wiki", help="Path to wiki directory")
    parser.add_argument("--only", nargs="+", choices=CHECKS.keys(),
                        help="Run only these checks")
    parser.add_argument("--skip", nargs="+", choices=CHECKS.keys(),
                        help="Skip these checks")
    args = parser.parse_args()

    wiki_dir = get_wiki_dir(args.wiki)
    if not wiki_dir.exists():
        print(f"Error: {wiki_dir} does not exist")
        sys.exit(1)

    pages = load_pages(wiki_dir)
    print(f"Scanning {len(pages)} pages in {wiki_dir}\n")

    # Determine which checks to run
    to_run = list(CHECKS.keys())
    if args.only:
        to_run = args.only
    elif args.skip:
        to_run = [c for c in to_run if c not in args.skip]

    total = 0
    for name in to_run:
        module = CHECKS[name]
        findings = module.run(pages, wiki_dir)
        module.report(findings)
        total += len(findings)
        print()

    print("=" * 40)
    print(f"Total issues: {total}")
    if total == 0:
        print("Wiki is clean.")


if __name__ == "__main__":
    main()
