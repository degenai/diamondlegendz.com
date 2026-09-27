# Session notes — KrabsPulse adversarial audit (faction scope + sync schema)

## Scope verified
- Faction/realm authority for logistics and durable mail workflows in WoW addon.
- Hostile-input hardening for KrabSync importer/schema.

## Key bugs reproduced before fixes
- Cross-realm inventory was used as fallback source for logistics.
- Cross-faction/legacy inventory snapshots could drive sourcing.
- Mail requests could become executable without authority tuple in keying.
- Sync ingest accepted malformed/legacy payloads in edge cases:
  - numeric overflow integer fields
  - unknown extra fields
  - invalid UTF-8 bundle files
  - mis-typed config shapes

## Test pattern that worked well
1. Create RED fixture(s) in replay suites (`test_inventory`, `test_outbox`, `test_executor`).
2. Add sync failure tests in `sync/tests/test_krabsync.py` for schema and parse edges.
3. Patch minimal logic to enforce fail-closed checks.
4. Re-run: replay suite + unittest + syntax/lint gates.
5. Run real sync status/verify on configured root.

## Useful assertions added conceptually
- Authority tuple should include `realm` and `faction` when:
  - writing snapshots
  - keying queue/mail requests
  - reconciling/transit consumption in outbox
- Unknown/invalid schema keys should raise `KrabSyncError`.
- Malformed config payloads should never deref `.get` on wrong-type object.

## Evidence summary pattern for future releases
- `replay/run_tests.lua`: all sections pass, including logistics/mail/outbox.
- `python -m unittest sync/tests/test_krabsync.py`: green.
- `luac` and luacheck: clean for touched files.
- `python sync/krabsync.py --root <root> status|verify`: sqlite quick check OK; bundle files valid.