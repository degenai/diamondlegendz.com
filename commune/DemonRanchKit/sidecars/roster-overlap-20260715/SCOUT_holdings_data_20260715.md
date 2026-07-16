# Docket #83 Holdings-Data Scout (restored 2026-07-15 — original archive was 0 bytes; Phase-1 build in fetch_holdings.py supersedes the URL specifics)

**NOTE:** several scout-era URL patterns were already dead at build time (etf-scraper's iShares/Vanguard/Invesco paths; the iShares `.ajax` endpoint now serves an SPA). The LIVE routes are documented in `fetch_holdings.py` (BlackRock varnish `get-product-data?portfolioId={pid}&component=holdings`, Vanguard investor API, etc.). This file preserves the scout's still-valid strategic content.

## Historical depth (Phases 2–3, parked)
- **SEC N-PORT bulk flat-files** (sec.gov/data-research/sec-markets-data/form-n-port-data-sets): quarterly holdings 2019→present as pre-parsed TSV tables joined on ACCESSION_NUMBER — `FUND_REPORTED_HOLDING` carries name/CUSIP/ISIN/LEI/pctVal. Every '40-Act fund; only quarter-end months public. Moderate effort.
- **iShares self-serve month-end history** back to ~2006–2010 free via dated pulls (see talsan/ishares on GitHub) — deep history for the whole country-fund bloc without EDGAR.
- **Form N-Q (2004–2019)**: unstructured HTML schedules; bespoke parsing; only free route to 2012–2018 for non-iShares. Do last, annual snapshots only.
- **Paid APIs (FMP/EODHD/AlphaVantage): skip.** Historical holdings are paywalled tiers; current snapshots are free from issuers anyway.

## Measure + identifier gotchas (encoded in overlap.py)
- Overlap(A,B) = Σᵢ min(w_A,i, w_B,i) = 1 − ½·L1 distance. Standard.
- Join CUSIP first, ISIN second, never ticker. Foreign lines have no CUSIP (use ISIN/SEDOL).
- ADR ≠ local ordinary (different identifiers, same issuer) — entity-level crosswalk (LEI) needed for true economic overlap across US-fund-vs-country-fund comparisons.
- Drop cash/FX/derivative lines; renormalize equity sleeve to 1.
- Dual share classes (GOOG/GOOGL): decide entity-collapse policy.

## Fund-type routing (encoded in classification.csv)
- **Commodity pools (USO, UNG, Teucrium)**: '33-Act LPs — NO N-PORT/N-Q; holdings from issuer pages or 10-K/Q. Overlap defined on commodity-exposure tags, separate space. PDBC is '40-Act (Cayman-subsidiary design) but holds T-bills+swaps — treat as commodity-exposure.
- **Leveraged/inverse (TQQQ, SOXL/SOXS, TNA/TZA, UPRO/SQQQ, YINN/YANG)**: '40-Act, but holdings are swaps+collateral — look through to reference index basket.

## Fetch hygiene
Browser User-Agent, ~1 req/sec throttle, cache raw by (ticker, asof). Issuer 403s are soft UA fingerprinting; Invesco/Schwab hard-block this host (SPLV/SCHD failed in Phase 1; QQQ recovered partial via stockanalysis.com).
