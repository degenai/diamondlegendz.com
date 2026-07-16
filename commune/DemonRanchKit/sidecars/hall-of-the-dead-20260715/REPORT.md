# Hall of the Dead — corpse library build (docket #84)

**Date: 2026-07-15 · Author: Fable (Claude) · Status: DESCRIPTIVE CENSUS — NOT A SELECTION. Census/training-set build, NOT doctrine.**
**Scripts:** `scratchpad/{fetch,qc,manifest}.py` (throttled Tiingo pull, QC gates, manifest builder — kept out of repo; key read in-process, never written to disk)
**Data:** Tiingo daily (`/tiingo/daily/{sym}/prices`), adjusted + raw close + volume, full history 1980→2026-07-15. Symbol resolution via Tiingo `supported_tickers.zip` (4.97 MB manifest, columns `ticker,exchange,assetType,priceCurrency,startDate,endDate`). Free tier; 28 symbol requests spent, zero 429s.
**Library:** `prices/` = 26 clean series, 179,952 daily rows (11 death series / 47,120 rows + 15 survivor controls). `contaminated/` = 2 quarantined series + `CONTAMINATION_NOTES.md`. `manifest.csv` = 30 entity rows.

## Question

**Can the failure library support divorce-first corpse-sensor training?** i.e., does Tiingo's free delisted coverage give us enough real pre-death / death-tail price paths, matched to survivor controls, to train a sensor that separates dying firms from firms that merely fell hard and lived?

**Answer: PARTIALLY, and the partition is by era, not by death-type.** The modern retail/EV graveyard (2018–2025) is well covered with clean pennies-to-near-zero Q-stub tails. The GFC-and-earlier graveyard (2001–2010) is a wall: Enron, WorldCom, Lehman-common, Bear Stearns, WaMu-common, old-GM-common, Circuit City, and Blockbuster are simply not in Tiingo's free tier under any symbol. A divorce-first sensor can be trained TODAY on the modern cohort + full survivor panel; the classic fraud/crisis corpses need a backstop vendor before the fraud_collapse and crisis_kill classes are populated with real pre-death signal.

## Coverage by death-type

| type_label | entities | usable death signal in Tiingo | verdict |
|---|---|---|---|
| **fraud_collapse** | Enron, WorldCom, Nikola | **Nikola only** (NKLA main pre-death + NKLAQ penny tail) | 1 of 3 — both dot-com frauds MISSING |
| **crisis_kill** | Lehman, Bear Stearns, WaMu, GM(old) | **stubs/artifacts only** (LEHKQ/LEHLQ preferred tails; MTLQU liquidation units) | 0 clean; 2 partial post-death; Bear + WaMu MISSING |
| **slow_melt** | Sears, Blockbuster, Kodak, Rite Aid, BBBY, Circuit City, Express | **Sears, Rite Aid, BBBY(via Q), Express** clean; Kodak partial | 4 clean of 7 — Blockbuster + Circuit City MISSING, Kodak post-reorg only |
| **geopolitical** | RSX (VanEck Russia) | **RSX** clean (halt-frozen at $5.62, not zero) | 1 of 1 |
| **survivor_control** | 15 names | all 15 FULL, multi-decade | 15 of 15 |

## Findings

**F1 — Modern slow-melt retail deaths are the strongest asset (4 clean pennies-to-near-zero tails).**
`SHLDQ` (Sears, Kmart/Sears-Holdings lineage 2003→2022-10-31, min adjClose **$0.006**, and the file shows the exact Oct-2018 Ch11 collapse: $0.81→$0.31 on the 2018-10-15 filing date→$0.16 within two weeks). `RADCQ` (Rite Aid, full history **1984**→2026, through the 2023-10 Ch11, min $0.001, still an OTC penny). `BBBYQ` (Bed Bath & Beyond 1992→2023-09-29, tail ends ~$0.079). `EXPRQ` (Express 2010→2026, through 2024-04 Ch11, min **$0.0001** — the cleanest pennies-to-zero in the set). Each reaches within 30 days of its death and carries a Q-stub tail.

**F2 — Nikola is the only fraud_collapse with real pre-death signal, and it is complete.**
`NKLA` main carries the full 2018→2025-02-25 slide (real trading ends exactly at the 2025-02-19 Ch11); `NKLAQ` picks up the OTC penny tail 2025-02-25→2026 (min $0.0012). Together = a full divorce-first trace for an EV-fraud death. **But** NKLA main then forward-fills a flat **0.183 zero-volume** line from 2026-02 to today — a stale artifact; **truncate NKLA at 2025-02-25.**

**F3 — The dot-com frauds are gone. Enron (ENE/ENRNQ) and WorldCom (WCOM/WCOEQ) return nothing** under exchange ticker or Q-stub, and a broad substring sweep of the manifest finds no alternate string (ENR = Energizer, not Enron; WOR/WORC = unrelated). The two textbook accounting-fraud corpses — the highest-value fraud_collapse training examples — are absent from Tiingo free tier.

**F4 — The GFC bank/broker deaths are gone or stub-only.** Bear Stearns (BSC) → nothing but Invesco BulletShares ETFs (BSCA…BSCZ). WaMu common (WAMUQ) → nothing; only the post-bankruptcy reorg shell **WMIH** (2012–2018, a recovery vehicle, not a corpse) exists. Lehman common (LEH/LEHMQ) → absent; only **preferred** stubs `LEHKQ`/`LEHLQ` survive, and they first print **2008-09-18 — three days AFTER the Ch11**, so they give a post-death penny tail but **zero pre-death signal**. The 2007–2008 bank-equity slide that a crisis sensor most needs is not here.

**F5 — Old GM is a liquidation-trust artifact, old Kodak is a different company.** `MTLQQ` (Motors Liquidation common) absent; only `MTLQU` (GUC Trust units, 2012–2021) exists — a bankruptcy trust, not the equity slide. `EK` (old Kodak, wiped 2012) absent; `KODK` is the **new** post-reorg Kodak (2013→2026, min adjClose $1.55, alive) — kept and labeled, but it is a live successor, NOT a death series.

**F6 — Contamination caught and quarantined (2 series).** (a) NYSE **`BBBY`** is a recycled/spliced live listing: at BBBY's 2023-04 Ch11 the real common was ~$0.25, but Tiingo's series shows **~$18** and trades to 2026 at $4–7 with 1–4M daily volume, min adjClose **$2.65** — it never reaches pennies, so it cannot be the corpse. Quarantined; real death lives in BBBYQ. (b) **`BLIAQ`** (roster-mapped to Blockbuster) is dated **2017-09-19→2026** — Blockbuster died in 2010, so a series beginning in 2017 is a different sub-penny stock. Quarantined; Blockbuster is effectively MISSING. Both moves documented in `contaminated/CONTAMINATION_NOTES.md`, along with the recycled tickers rejected on manifest date-ranges alone and never fetched (SHLD=defense ETF, CC=Chemours, GM=new-GM, WM=Waste Management).

**F7 — QC gates: PASS.**
- **(a) Ford trough** — Dec-2007 adjClose **3.64** → 2008-11-19 trough **0.664**, ratio **0.182** (well under half); raw close bottoms at **$1.26** (Ford famously ~$1 in Nov 2008). PASS.
- **(b) Recycled-continuation check** — every series that trades with real volume years past its death date was caught: BBBY and BLIAQ quarantined; NKLA's post-death tail is zero-volume forward-fill (flagged, not contamination); RADCQ/LEHKQ/LEHLQ continuations are the same dead entity dormant on OTC (legitimate). No recycled series entered the library.
- **(c) Spot-check** — SHLDQ reproduces the Sears Ch11 collapse to the day (2018-10-15); LEHKQ/LEHLQ first-print 2008-09-18 is consistent with Lehman moving to OTC immediately post-Ch11. (LEH common could not be spot-checked — not in Tiingo.)

**F8 — Survivor controls are complete and deep.** All 15 matched survivors returned full multi-decade series (WMB, T, MS, GS, C, WFC, F, BBY, GME, FUJIY, CVS, WSM, TGT, RIVN, AEO). Citigroup (−98%, lived), Ford (−95%, lived, the canonical GM pair), and the 2008 banks give the "fell hard but lived" negatives a corpse sensor must not fire on. The control side of the training set has no gaps.

**F9 — What is missing entirely (backstop targets).** Six roster entities have NO usable Tiingo signal: **Enron, WorldCom, Bear Stearns, Washington Mutual, Blockbuster, Circuit City.** Three more are partial and want their pre-death common: **Lehman** (need LEH/LEHMQ common 2007–2008), **GM(old)** (need MTLQQ common 2007–2009), **Kodak** (need EK common through the 2012 wipe). These nine are the shopping list for the paid backstop.

## Library size

- **Clean library (`prices/`): 26 series / 179,952 daily rows.** 11 death series (47,120 rows) + 15 survivor controls.
- **Death series with real death signal: 6 of 15 roster deaths** clean/near-clean (Sears, Rite Aid, BBBY-via-Q, Nikola, Express, RSX); **3 partial** (Lehman stubs, GM units, Kodak-reorg); **6 missing** (Enron, WorldCom, Bear, WaMu, Blockbuster, Circuit City).
- **Quarantined: 2** (BBBY, BLIAQ). **Requests spent: 28** (of 50/hr, 1,000/day budget).

## Recommended next fetch (for the backstop pass)

1. **AV/FMP cross-check first (free):** Alpha Vantage `LISTING_STATUS` (delisted enumeration back to 2010) and FMP's delisted API — confirm whether *any* free vendor carries the six missing corpses before paying. FMP's dedicated delisted endpoint is the cheapest shot at Circuit City (CCTYQ) and Blockbuster (BLIAQ-real/BBI).
2. **EODHD one-month ($19.99, `delisted=1`, 40+ yrs) for the pre-2011 wall** — the six missing + three partials' pre-death common: **ENRNQ (Enron), WCOEQ (WorldCom), LEHMQ (Lehman common), BSC (Bear Stearns), WAMUQ (WaMu), MTLQQ (old GM common), CCTYQ (Circuit City), BLIAQ-real/BBI (Blockbuster), EK (old Kodak)**. This is the one purchase that converts the dead fraud_collapse and crisis_kill classes from empty to populated. Pull, verify pennies-to-zero tails against the known death dates, cancel.
3. **Do NOT re-pull** anything already clean in `prices/`; and never fetch a dead name by its recycled live ticker (SHLD/CC/GM/WM) — the manifest date-range check is the guard.

---

## BUILD v2 — post-2010 corpses, filling the empty classes (2026-07-16)

**Status: DESCRIPTIVE CENSUS — NOT A SELECTION.** Same procedure as v1: Tiingo free tier only, `supported_tickers.zip` resolution → identity verified by IPO/date-range vs known death date → throttled adjusted-daily pull → QC gates → manifest. Key read in-process, never written. **30 new symbols fetched, zero 404s, zero 429s. Month total: 58 unique symbols (28 v1 + 30 v2), ~440 of 500 remaining.** New records: `manifest_v2.csv` (build=v2, 24 entity rows) + this section.

**The two empty classes are now populated with real pre-death signal.** v2 targeted the modern graveyard (2015–2024) where Tiingo's delisted coverage is dense, precisely the era v1 found strong. Result: **crisis_kill went 0→4 clean corpses; fraud_collapse gained Wirecard (2 series) + a fraud_survivor control (Luckin); a new died_and_resurrected class was created (Hertz, Chesapeake).**

### Coverage by class (v2 additions)

| class | entity | symbol(s) | range | reaches death? | tail | verdict |
|---|---|---|---|---|---|---|
| **crisis_kill** | SVB Financial | SIVBQ | 1990-03..2026-07 | YES (99.9% Mar-2023) | OTC claim-stub → FF from 2026-02 | FULL |
| **crisis_kill** | Signature Bank | SBNY | 2004-03..2026-07 | YES (99.9% Mar-2023) | active receivership stub ~$0.43 | FULL |
| **crisis_kill** | First Republic | FRCB | 2010-12..2026-07 | YES (99.8% Mar–May 2023) | OTC penny to 2026 | FULL |
| **crisis_kill** | Silvergate | SICP | 2019-11..2026-07 | YES (98% Mar-2023) | wind-down stub ~$0.48 | FULL |
| **fraud_collapse** | Wirecard | WCAGY + WRCDF | 2009-06..2026-07 | YES (99% Jun-2020) | ADR + ordinary; WRCDF→1e-06 | FULL (2 series) |
| **fraud_survivor** | Luckin Coffee | LKNCY | 2019-05..2026-07 | crashed to $1.38, **lived** → $32 | control | FULL |
| **slow_melt** | WeWork | WEWKQ | 2020-10..2024-06 | YES (Nov-2023 Ch11) | emergence tail | FULL |
| **slow_melt** | Tupperware | TUPBQ | 1996-05..2026-07 | YES (Sep-2024 Ch11) | FF from 2026-02 | FULL |
| **slow_melt** | RadioShack | RSH + RSHCQ | 1982-01..2015-10 | YES (Feb-2015 Ch11) | primary→Q pair, $0.24→$0.019 | FULL |
| **slow_melt** | Pier 1 | PIR | 1987-12..2020-10 | YES (Feb-2020 Ch11) | liquidation tail $0.15 | FULL |
| **slow_melt** | Party City | PRTYQ | 2015-04..2023-10 | YES (Jan-2023 Ch11) | penny tail | FULL |
| **slow_melt** | GNC | GNC + GNCIQ | 2011-04..2020-11 | YES (Jun-2020 Ch11) | primary→Q pair | FULL |
| **slow_melt** | Revlon | REVRQ | 1996-02..2023-05 | YES (Jun-2022 Ch11, equity wiped) | FF from 2023-05 | FULL |
| **died_and_resurrected** | Hertz | HTZGQ + HTZ | 2006-11..2026-07 | old died 2020, new relisted 2021 | meme-recovery + successor | FULL (both) |
| **died_and_resurrected** | Chesapeake | CHKGQ + EXE (+CHK) | 1993-02..2026-07 | old Ch11 2020, renamed EXE 2024 | old stub $0.80 + healthy successor | FULL (both) |
| **geopolitical** | iShares Russia | ERUS | 2010-11..2022-08 | YES (frozen $8.06, Mar-2022) | halt-frozen NAV (twin of RSX) | FULL |
| **survivor_control** | WAL, PACW→BANC, SCHW | — | full multi-decade | crisis banks that lived | — | FULL |
| **survivor_control** | GAP, KSS, M, PTON | — | full multi-decade | retail/near-death that lived | — | FULL |

### QC results (v2)

- **QC anchor PASS — crisis_kill collapses reproduce to the day.** SIVBQ: $313 (02-08) → NASDAQ halt $106 (03-13, frozen zero-vol) → **$0.97 on 67.4M vol (03-29)** = 99.9%. SBNY: $135 → halt $70 → **$0.24 on 76.7M vol (03-29)** = 99.9%. **FRCB (the required anchor): $133 (02-15) → $34 (03-16) → limped ~$13 through April → $0.39 (05-08) at the JPMorgan seizure = 99.8% in weeks** — exactly the Mar–May 2023 path specified. SICP: $55 (2022-11) → $5.41 (03-06) → $1.72 (03-24) = 98% on the liquidation announcement.
- **QC PASS — fraud collapses.** Wirecard WCAGY $58.50 (06-17-2020) → $1.74 (06-25 insolvency); WRCDF $113 → $3.60 same window, tail to 1e-06. Luckin LKNCY: $26 → halt $4.39 (fraud 04-2020) → $1.38 min on delisting day → **recovered to $32.32** (fraud_survivor, the ideal contrast to Wirecard→0).
- **QC PASS — geopolitical.** ERUS frozen at $8.06 from 2022-03-04 through 2022-08-30 delist — identical halt-frozen-NAV signature to v1's RSX. Two independent Russia-ETF deaths now in the class.
- **Contamination caught (recycled-ticker poison), zero entered the library:** (a) **SI** (NYSE, starts 2025-07-31) is a recycled ticker — NOT Silvergate; the real corpse is **SICP** (PINK, 2019-11-07 IPO). Rejected on manifest date-range, never fetched. (b) **LUCK** (NYSE, 2021-04-23) is NOT Luckin Coffee — real Luckin is **LKNCY**. Rejected, never fetched. (c) **CHKAQ** (2021-03-17→2021-05-17, 2 months) is post-emergence warrants, NOT old Chesapeake common — not fetched.
- **Splice flag (kept, not quarantined):** **CHK** (1993→2024) is genuine old-Chesapeake through its 2020 Ch11 collapse, but Tiingo appends **one stray row 2024-10-04 @ $81.46** (new Expand Energy price) after a 1313-day gap → **truncate CHK at 2021-03-01**. The clean old-equity tail lives in CHKGQ; the resurrected entity in EXE. Unlike v1's BBBY (fully recycled, never reached pennies → quarantined), CHK's bulk is the real corpse, so it stays in `prices/` with the truncation note.
- **Zero-volume forward-fill tails flagged (truncate at last real print):** SIVBQ → 2024-11-07; WRCDF → 2026-06-29; TUPBQ → 2025-06-11; GNCIQ → 2020-10-30; REVRQ → 2023-05-01; ERUS → 2022-04-19 (frozen-NAV death, the FF *is* the death signature). Active OTC claim-stubs (SBNY, SICP, FRCB still trading 2026) are legitimate dead-entity bankruptcy/receivership stubs, NOT contamination — each repriced 98–99.9% at the exact death date on tens of millions of shares.

### What resolved vs what Tiingo lacks

- **Resolved (all clean):** every crisis_kill target (SVB, Signature, First Republic, Silvergate); Wirecard (both share classes); Luckin; and every slow_melt/resurrection/geopolitical target below.
- **Tiingo could NOT resolve — one gap:** **JCPenney (JCP / JCPNQ)** — absent entirely (root `JCP` returns only ETFs `JCPB`/`JCPI` and mutual funds; no common-equity symbol, no Q-stub). → **candidate for the AV/FMP free-key sweep or the EODHD month**, alongside the v1 pre-2011 wall (Enron, WorldCom, Bear, WaMu, Blockbuster, Circuit City).
- **Pier 1 PIRRQ** not in Tiingo, but the PIR primary (NYSE) carries the full death through liquidation — no gap.

### Library size after v2

- **`prices/` = 56 series / 318,788 daily rows** (v1: 26 / 179,952 + v2: 30 / 138,836, of which 79,104 rows are v2 death-series).
- **Empty classes closed:** crisis_kill 0→4 clean corpses (+4 matched survivors); fraud_collapse now has Wirecard (2 series) + Nikola (v1) + Luckin fraud_survivor control; new **died_and_resurrected** class (Hertz, Chesapeake); geopolitical deepened to 2 (RSX + ERUS).
- **A divorce-first crisis-sensor is now trainable on real 2023 regional-bank collapse paths** matched to the banks that fell hard and lived (WAL, PACW, SCHW) — the gap v1 flagged as the highest-value missing piece is filled for the modern crisis cohort.
