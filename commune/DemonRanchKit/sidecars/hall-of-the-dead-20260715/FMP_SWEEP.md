# FMP Legends Sweep — Hall of the Dead (docket #84)

Run 2026-07-16. Descriptive census of what Financial Modeling Prep's FREE tier recovers for the
pre-2011 celebrity corpses that Tiingo (build-v2) and Alpha Vantage both lacked. Third sibling to
build-v2 (Tiingo) and the AV sweep. Outputs confined to `prices_fmp/`, `manifest_fmp.csv`, and this
file. **No key material recorded anywhere** (key read in-process only; scrubbed from all output).

## Bottom line
**FMP free tier recovered ZERO death series. Net-new vs Tiingo+AV = nothing.** Same null result as
the AV sweep, but via a *different, harder* paywall: every delisted symbol returns
**HTTP 402 "Special Endpoint : this value set for 'symbol' is not available under your current
subscription."** Live large-caps work fine; delisted/OTC equities are gated behind a paid plan.
The EODHD case is fully intact and unimproved.

## The three walls hit (why SCOUT's "FMP 250/day, dedicated delisted API" premise underdelivers)
1. **v3 API is dead for this key.** `/api/v3/search` (and the rest of v3) → HTTP 403
   *"Legacy Endpoint : no longer supported ... only available for legacy users with subscriptions
   prior to Aug 31 2025."* FMP migrated to a `/stable/` API in 2025. SCOUT's v3 assumptions are stale.
2. **Stable historical endpoint paywalls every delisted symbol.** `/stable/historical-price-eod/full`
   returns **HTTP 402 Special Endpoint** for ENE, ENRNQ, WCOM, WCOEQ, LEH, LEHMQ, BSC, WAMUQ, MTLQQ,
   CCTYQ, BLIAQ, BBI, EK, WRCDF, ERUS — all of them. Not an era/window artifact: a 2018-death tail
   (SHLDQ, which Tiingo carries to 2022) is 402 *and* a 2001 stub (ENRNQ) is 402. Delisting itself is
   the gate.
3. **Even live symbols are capped at ~5 years.** Control `F` (Ford) returns only 2021-07-19..2026-07-15
   (1253 rows), and `adjClose` is left **empty** (raw close only). So the SCOUT-suggested "Ford 2008
   trough" QC anchor is structurally unreachable on free tier.

## The dedicated delisted API: accessible but useless for this roster
`/stable/delisted-companies?page=N` **is** free (200 OK, 100 rows/page, newest-first).
Page 0 → `prices_fmp/delisted_page0.json` spans only **2026-07-14 → 2026-06-23** (~3 weeks/page).
Reaching the 2001-2011 legends would need ~250-400 pages of blind pagination (no name/symbol filter
in the stable endpoint), far past the 80-request budget — and it carries **no price history** anyway,
only {symbol, companyName, exchange, ipoDate, delistedDate}. So it can confirm a symbol string exists
but can never supply a death series on the free tier. Not pursued past page 0.

## The recycling trap, reproduced on FMP
- **`GM` (naive) → HTTP 200, live NEW-GM** (relisted 2010): close 54.18 (2021-07-19) → 77.64
  (2026-07-15). This is the surviving successor, **not** old-GM / Motors Liquidation (MTLQQ, which
  is 402). Textbook recycled-ticker poison. Saved as evidence:
  `prices_fmp/_recycled_GM_newGM_notMTLQQ.csv`. **Do not admit as a corpse.**
- Curiously, bare **`WM`** (Waste Management, live) and **`CC`** (Chemours, live) each returned **402**,
  not live data — FMP seems to key those tickers to a gated historical (WaMu / Circuit City) entity.
  Inconsistent with GM, but the outcome is the same: no usable corpse series, and no clean live-successor
  either. Resolve any legend by verified delisted symbol + death-date window, never a naive current-ticker
  fetch.

## Cross-vendor QC (the one series FMP would serve: Ford control)
Could not run the SCOUT's preferred anchors — Ford's 2008 trough is pre-2021 (window-blocked) and
SHLDQ's 2018 collapse is 402. Ran the achievable diff on the 2021-2026 overlap vs Tiingo `prices/F.csv`:

| date | Tiingo close | FMP close | Tiingo vol | FMP vol | verdict |
|---|---|---|---|---|---|
| 2021-07-19 | 13.28 | 13.28 | 99,949,231 | 99,949,231 | EXACT match (raw close + vol) |
| 2026-07-15 | 14.18 | 14.195 | 57,373,202 | 50,806,443 | close agree ~1c; current-day vol still settling |

FMP's raw price levels agree with Tiingo to the cent where they overlap → data quality is fine where
accessible. Two FMP quirks noted: (a) `adjClose` unpopulated on the stable EOD endpoint (Tiingo's
adjClose 10.36 vs FMP raw 13.28 on 2021-07-19 is the dividend-adjustment gap, not an error); (b) the
live-day bar (close + volume) not yet reconciled to consolidated tape.

## What FMP has that Tiingo/AV lacked
Nothing. FMP free tier is a strict subset for this roster. It cannot serve a single delisted corpse,
Q-stub, or opportunistic name (Wirecard/ERUS already FULL in Tiingo). It adds a *cleaner* signal than
AV on one point: AV returned "Invalid" (ambiguous — malformed vs absent), whereas FMP's 402 explicitly
says the symbols **exist in FMP's universe but sit behind the paid tier** — i.e. EODHD is not the only
paid path, FMP paid would also carry them, but neither is free.

## FINAL still-missing list (unchanged — the honest EODHD-only shopping list)
No free vendor (Tiingo + AV + FMP) recovers these pre-2011 celebrity deaths. EODHD one-month
($19.99, delisted=1, OTC-inclusive, 40+yr) remains the only path:
1. **Enron** (ENE / ENRNQ) — 2001-12 fraud collapse
2. **WorldCom** (WCOM / WCOEQ) — 2002-07 fraud collapse
3. **Bear Stearns** (BSC) — 2008-03 fire-sale (pre-death exchange common)
4. **Washington Mutual** (WAMUQ) — 2008-09 seizure / 2012 cancel
5. **Blockbuster** (BLIAQ / BBI) — 2010-09 death tail
6. **Circuit City** (CCTYQ) — 2008-11 collapse
7. **Lehman** common death slide (LEHMQ) — Tiingo had only LEHKQ/LEHLQ prefs (post-Ch11 penny)
8. **GM (old)** equity slide (MTLQQ) — Tiingo had only MTLQU liquidation units (2012+ artifact)
9. **Kodak (old)** wiped common (EK) — Tiingo had only NEW post-2013 KODK successor

## Budget ledger (cap 80; spent 25)
Requests that reached FMP (2 DNS-mangled attempts never left the host — not counted):
1. `/api/v3/search` Enron → 403 Legacy (revealed v3 retirement)
2. `/stable/search-symbol` ENE → 200 (live-only index; no delisted Enron)
3. `/stable/search-name` Enron → 200 (no relevant match)
4-5. `/stable/historical-price-eod/full` F ×2 → 200 (control; #4 write-crashed on missing dir, refetched)
6. hist ENRNQ → 402 (first proof of the delisted paywall)
7. hist SHLDQ → 402 (proves it's delisting-based, not era-based)
8. `/stable/delisted-companies` page 0 → 200 (100 rows → delisted_page0.json)
9-20. census batch: ENE, WCOEQ, WCOM, LEHMQ, LEH, BSC, WAMUQ, MTLQQ, CCTYQ, BLIAQ, BBI, EK → all 402
21-25. census batch: GM(200 recycled), CC(402), WM(402), ERUS(402), WRCDF(402)
**Total: 25 requests. Remaining budget: 55. Stopped — every remaining probe is a certain 402; no value.**

## Files written (mine only; did NOT touch REPORT.md / manifest.csv / manifest_v2.csv / manifest_av.csv / prices/ / prices_av/)
- `prices_fmp/delisted_page0.json` — delisted enumeration page 0 (evidence the endpoint works; newest-first)
- `prices_fmp/_control_F.csv` — Ford QC control (proves live symbols pass; cross-vendor match anchor)
- `prices_fmp/_recycled_GM_newGM_notMTLQQ.csv` — recycled-ticker trap evidence (live new-GM, NOT a corpse)
- `manifest_fmp.csv`, `FMP_SWEEP.md`
No corpse price CSVs were written — none were recoverable. (No file contains key material.)
