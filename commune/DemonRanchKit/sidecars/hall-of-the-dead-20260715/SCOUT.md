# Hall of the Dead (docket #84) — data feasibility scout, verified 2026-07-15

## Verdicts
- **Stooq: DEAD for this use.** Site-wide proof-of-work challenge (~June 2026) + the CSV endpoint is separately captcha-gated ("Access denied" even with auth cookie). Worse: coverage collapsed — of the famous corpses it retains only BBBY and BLIAQ. **Ticker-recycling poison traps:** shld.us→Global X Defense ETF, cc.us→Chemours, dyn.us→Dyne Therapeutics, gm.us→new-GM-2010, wm→Waste Management. Never fetch a dead company by recycled ticker.
- **Tiingo = the free path.** Survivorship-bias-free by design, delisted equities included, adjusted daily, 30+ yrs. Free tier: 500 unique symbols/month, 1,000 req/day — the whole library fits in one month. Pull `supported_tickers.zip` FIRST to learn Tiingo's exact symbol strings for dead names (exchange ticker vs Q-stub varies by vendor). Needs a free API key (Alex signup).
- Cross-checks: **Alpha Vantage** (adjusted daily confirmed working on free tier, 25 req/day; LISTING_STATUS delisted enumeration back to 2010) and **FMP** (250 req/day free, dedicated delisted API).
- Backstop: **EODHD $19.99 for one month** (purpose-built delisted support, `delisted=1`, 40+ yrs) → pull stragglers → cancel.
- Paid ceiling noted: Sharadar SEP (prosumer, 1998+); CRSP/WRDS institutional-only, out of scope.

## The roster — 13 post-2000 deaths (verified Q-tickers) + matched near-death survivors
| corpse | tickers | death | matched survivor |
|---|---|---|---|
| Enron | ENE→ENRNQ | Ch11 2001-12-02 | Williams WMB (−90%, lived) |
| WorldCom | WCOM→WCOEQ | Ch11 2002-07-21 | AT&T / Sprint |
| Lehman | LEH→LEHMQ | Ch11 2008-09-15 | MS / GS; Citigroup −98% lived |
| Bear Stearns | BSC | fire-sale 2008-03 | Morgan Stanley |
| WaMu | WM(old)→WAMUQ | seized 2008-09-25; equity cancelled 2012 | Wells Fargo / C |
| GM (old) | GM→MTLQQ | Ch11 2009-06-01 | **FORD −95%, lived — canonical pair** |
| Sears | SHLD→SHLDQ | Ch11 2018-10-15 | Best Buy (near-death 2012) |
| Blockbuster | BBI→BLIAQ | Ch11 2010-09-23 | GameStop / Best Buy |
| Kodak | EK (→KODK new) | Ch11 2012-01-19, old equity wiped | **Fujifilm FUJIY — classic pair** |
| Rite Aid | RAD→RADCQ | Ch11 2023-10-15 (again 2025) | CVS (WBA itself went private 2025) |
| BBBY | BBBY→BBBYQ | Ch11 2023-04-23 | Williams-Sonoma / Target |
| Circuit City | CC→CCTYQ | Ch11 2008-11-10 | Best Buy |
| Nikola | NKLA→NKLAQ | Ch11 2025-02-19, liquidated 2025-12 | Rivian (so far) |
Plus ETF/retail deaths already on the panel thesis: RSX (halted/delisted 2022), EXPR→EXPRQ (match AEO/ANF).
**Skip as structurally unavailable:** Pan Am, TWA (pre-1990s daily), Toys R Us (died private; public history ends 2005).

## The caveat that will bite
Primary-exchange history is well covered; **the Q-stub OTC death-tail (pennies→zero) is the most signal-rich segment for a failure sensor and the spottiest** — expect to stitch primary series (Tiingo) + Q-tail (EODHD/AV/FMP, whoever carries it), and accept some tails end at delisting rather than $0.

## Build order (when key exists)
1. Tiingo key → supported_tickers.zip → resolve dead-name symbols → pull 13 corpses + 13 survivors + RSX/EXPRQ, adjusted daily.
2. Cross-check 3 series against AV/FMP for phantom-tail QC.
3. EODHD one-month for stragglers/Q-tails.
4. Then: divorce-first sensor traces (per Batch-3's dispersion finding) in the 1–3 yrs pre-death, per death-type label (fraud/crisis/melt/geopolitical).
