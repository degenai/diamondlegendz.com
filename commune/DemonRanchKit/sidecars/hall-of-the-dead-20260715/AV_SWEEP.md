# Alpha Vantage Legends Sweep — Hall of the Dead (docket #84)

Run 2026-07-16. Descriptive census of what AV's FREE tier recovers for the pre-2011 celebrity
corpses Tiingo's free tier lacks. Sibling to build-v2 (Tiingo). Outputs confined to `prices_av/`,
this file, and `manifest_av.csv`. No key material recorded anywhere.

## Bottom line
**AV free tier recovered ZERO usable death series. Net-new vs Tiingo = nothing.**
Every target Q-stub and every pre-death primary ticker returns `Invalid API call` (not in AV's
universe). The one symbol that returns data — BLIAQ — is a live 2026 sub-penny shell that free
compact can't connect to Blockbuster's 2010 death. The EODHD case is fully intact and unimproved.

## Two hard paywalls discovered (this is WHY the SCOUT's "AV free adjusted daily" premise fails)
1. `TIME_SERIES_DAILY_ADJUSTED` — now a **premium** endpoint. Zero free access. (SCOUT.md line 6
   "adjusted daily confirmed working on free tier" is STALE — no longer true 2026-07.)
2. `TIME_SERIES_DAILY&outputsize=full` — **premium**. Free tier caps at `outputsize=compact`
   = **last 100 data points only**.

Consequence: even for a symbol AV *does* carry, free tier gives only the final ~100 sessions and
no adjusted_close. For a stub that died in 2008-2013, compact would return its death tail IF the
symbol existed — but none of them do.

## Discovery: LISTING_STATUS is exchange-only, so the OTC death-tails are structurally absent
`LISTING_STATUS?state=delisted` (1 request, full pull, 9,346 rows -> `prices_av/av_delisted.csv`):
- Exchanges present: NASDAQ, NYSE, NYSE ARCA, BATS, NYSE MKT, AMEX. **No OTC / Pink / Expert Market.**
- Delisted coverage effectively starts ~2008-11 (a handful of 1997/2006/2007 stragglers aside).
- Grep for every target symbol + company name = **zero hits** except recycling noise: `SHLD`=Global X
  Defense ETF (poison), `KODK-WS`=NEW-Kodak warrants, plus Lehman/Bear structured-product certs.
- Note: a dated `state=delisted&date=YYYY-MM-DD` query only returns a *subset* (delistingDate <= date)
  of the full pull — it reveals nothing new, so I did NOT waste a request on it.

The Q-stub tails (LEHMQ, ENRNQ, WCOEQ, MTLQQ, WAMUQ, CCTYQ, BLIAQ) all traded OTC, and AV's free
universe excludes OTC. That single fact predicts (and the probes confirm) the whole null result.

## Probe results (TIME_SERIES_DAILY compact, free)
| entity | symbol(s) | outcome | detail |
|---|---|---|---|
| Lehman | LEHMQ, LEH | NOT-FOUND | Invalid (both) |
| GM (old) | MTLQQ | NOT-FOUND | Invalid |
| Enron | ENRNQ, ENE | NOT-FOUND | Invalid (both) |
| WorldCom | WCOEQ, WCOM | NOT-FOUND | Invalid (both) |
| WaMu | WAMUQ | NOT-FOUND | Invalid |
| Circuit City | CCTYQ | NOT-FOUND | Invalid |
| Bear Stearns | BSC | NOT-FOUND | Invalid |
| Kodak (old) | EK | NOT-FOUND | Invalid |
| Blockbuster | BBI, BLIAQ | RECYCLED | BBI Invalid; BLIAQ = live 2026 penny shell (0.0001-0.019, ends 2026-07-15), no reach to 2010 death |
| CONTROL Altaba | AABA | FULL | last 100 sessions ending 2019-11-06 delist — proves compact serves delisted names |

The AABA control is the load-bearing check: it rules out "my call was malformed" — free compact
genuinely returns delisted series when AV has them. So the Invalids are true absences.

## What AV has that Tiingo lacked
Nothing. Tiingo already had the more-recent / still-OTC stubs (SHLDQ, RADCQ, BBBYQ, EXPRQ, NKLAQ,
LEHKQ/LEHLQ prefs, MTLQU units, RSX). AV free tier is a strict subset for this roster and adds no
corpse Tiingo was missing.

## The honest EODHD-only set (legends still missing after Tiingo + AV free)
These six-plus remain unrecovered by any free path and are the genuine case for the EODHD
one-month ($19.99, delisted=1, 40+yr, OTC-inclusive) pull:
1. **Enron** (ENE / ENRNQ) — 2001-12 fraud collapse
2. **WorldCom** (WCOM / WCOEQ) — 2002-07 fraud collapse
3. **Bear Stearns** (BSC) — 2008-03 fire-sale (pre-death exchange common)
4. **Washington Mutual** (WAMUQ) — 2008-09 seizure / 2012 cancel
5. **Blockbuster** (BLIAQ / BBI) — 2010-09 death tail (AV's BLIAQ is a recycled 2026 shell, not this)
6. **Circuit City** (CCTYQ) — 2008-11 collapse

Plus the PARTIAL upgrades Tiingo couldn't fully serve, also EODHD-bound:
7. **Lehman** common death slide (LEHMQ) — Tiingo had only LEHKQ/LEHLQ prefs (post-Ch11 penny)
8. **GM (old)** equity slide (MTLQQ) — Tiingo had only MTLQU liquidation units (2012+ artifact)
9. **Kodak (old)** wiped common (EK) — Tiingo had only NEW post-2013 KODK successor

Note for the EODHD run: BLIAQ is a recycling trap — AV shows it live at sub-penny in 2026. Resolve
Blockbuster by delisted-symbol + death-date window, never by naive current-ticker fetch.

## Budget ledger (hard cap 22)
Spent **17**, remaining **5** (stopped early — every unspent probe is a certain Invalid; no value).
1. LISTING_STATUS delisted full -> av_delisted.csv (DATA, 9346 rows)
2. LEHMQ DAILY_ADJUSTED full -> premium-blocked (revealed paywall #1)
3. LEHMQ DAILY outputsize=full -> premium-blocked (revealed paywall #2)
4. LEHMQ DAILY compact -> Invalid
5. AABA DAILY compact -> DATA (control, validates method)
6-9. MTLQQ, ENRNQ, WCOEQ, WAMUQ compact -> all Invalid
10-14. EK, BBI, BLIAQ, CCTYQ, BSC compact -> Invalid/Invalid/RECYCLED-DATA/Invalid/Invalid
15-17. LEH, ENE, WCOM compact -> all Invalid
(#2 and #3 are premium rejections that likely do NOT count against AV's 25/day quota; counted here
for conservative honesty. True on-quota spend may be as low as 15.)

## Files written (mine only; did not touch REPORT.md / manifest.csv / manifest_v2.csv / prices/)
- `prices_av/av_delisted.csv` — full AV delisted enumeration (evidence + reusable)
- `prices_av/_control_AABA.csv` — method-validation control series
- `prices_av/BLIAQ.csv` — the recycled 2026 shell (evidence; NOT Blockbuster)
- `manifest_av.csv`, `AV_SWEEP.md`
(Invalid-response placeholder CSVs were deleted so nothing masquerades as price data.)
