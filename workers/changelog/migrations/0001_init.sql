-- dlz-changelog schema v2
-- Upgrades from PE v1:
--   * created_at (D1 insertion time) separate from commit_date (git author time)
--   * subject / body / tech_detail split at write time so reader is dumb
--   * prefix_hint carries the optional conventional-commit tone tag
--   * raw_message preserved so filter logic can evolve without re-push

CREATE TABLE IF NOT EXISTS changelog_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_hash   TEXT    NOT NULL UNIQUE,
  commit_date   TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  author_name   TEXT,
  author_email  TEXT,
  prefix_hint   TEXT,
  subject       TEXT    NOT NULL,
  body          TEXT,
  tech_detail   TEXT,
  raw_message   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_changelog_commit_date ON changelog_entries (commit_date);
CREATE INDEX IF NOT EXISTS idx_changelog_created_at  ON changelog_entries (created_at);
