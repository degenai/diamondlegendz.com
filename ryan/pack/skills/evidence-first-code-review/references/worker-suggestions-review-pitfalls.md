# Worker-backed suggestions/API review pitfalls

This note captures high-value adversarial checks for features that combine
static pages + runtime API endpoints (Cloudflare Workers shown).

## Pitfall: malformed login/form parsing should not crash into 500
- Symptom: posting `/login` with non-form payload can trigger `formData()` parser errors.
- Expected: explicit client error (`400`/`401`-style) with safe message.
- Repro pattern:
  - `POST /login` with `Content-Type: application/json`.
  - Request should fail fast and remain client-facing; not `500`.

## Pitfall: schema/migration readiness is a deploy gate
- If database binding exists but table missing, writes/reads can fail at first runtime use.
- Expected: deterministic status (`503` with guidance) or deployment pipeline migration check.
- Repro pattern:
  - Use a fresh environment without applying `schema-suggestions.sql`; hit create/report endpoints.
  - Verify either explicit blocked behavior or one-time migration path in CI is enforced.

## Pitfall: API auth is layered
- Household/session auth and admin-report auth are different trust boundaries.
- Expected:
  - household session cannot access report endpoint.
  - admin secret should not leak household credentials behavior.
- Repro pattern:
  - Call report endpoint with only `Cookie`.
  - Call report endpoint with wrong bearer token.

## Pitfall: media codec negotiation can be too narrow
- Frontend recorder MIME probing should survive browser/device variants.
- Expected: fallback to a supported codec without blocking submission path.
- Repro pattern:
  - Simulate `MediaRecorder.isTypeSupported` returning a narrow set; ensure select logic has sane fallback.

## Test harness additions to prefer on such features
- Add explicit negative tests for at least one each:
  - malformed content/body parsing,
  - missing dependency (DB/AI) handling,
  - admin auth boundary checks,
  - malformed media input paths.
