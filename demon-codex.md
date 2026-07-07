# The Demon Codex — Volatility Harvesting Strategy Spec

**Project:** Demon Ranch → Robinhood Lab (research → live), codified for Diamond Legendz
**Authors:** Alex (operator) · Fable/Opus (research layer) · Hermes (execution layer)
**Status:** Doctrine to date, 2026-07-07. Simulated research — see disclaimer. Not investment advice.

**Tagline:** *A portfolio is something you work, not something you hold. The yield lives in the spread between the assets, never in an asset.*

> **Status key.** ✅ **BUILT & TESTED** = backed by runnable backtests and the test suite.
> 🚧 **WORK IN PROGRESS** = designed and specified, not yet built or run. The doctrine (the seven
> laws, the findings) is built and tested on a single historical panel; the Tournament and the
> frontier below are the honest WIP. They're marked so you know which is which.

---

## Core Concept — the operator, not the rentier

Shannon's Demon: two (or more) assets that each go nowhere but wander, rebalanced on a
schedule, compound a positive **excess growth rate** out of pure volatility. The money is not
in any sleeve — it's in the *relationship between* sleeves (the variance of their return
spread). Harvest it by systematically **trimming what rose and buying what fell.**

An ETF is congealed multiplicity — a hundred firms in one handle. The **rentier** re-atomizes
it: relates to the bundle as a single object to hold or flee. The **operator** keeps it as one
node in an ensemble and works the edges between nodes. Composability is the whole game; it is
also a class position. (Full argument: the `operator-mindset` node in Alex's wiki.)

> Excess growth rate of a pair ≈ **½ · var(return spread) · 252** = annualized pairwise demon
> yield. This single scalar is the heat map the whole apparatus is built around.

---

## The Stakes Gradient — three markets, one curriculum

Strategies are derived cheap and promoted up a ladder of consequence. Same verification
epistemics (ledger over theory, parity gates, catch-each-other's-errors) run identically at
every tier.

| Tier | Market | Stakes | Role |
|---|---|---|---|
| 1 | **Demon Ranch** (backtest sim) | Zero | Where math is derived and stress-tested |
| 2 | **Doomhowl** (WoW HC auction house) | Live opponents, fake money | Where strategy meets counterparties no backtest can simulate |
| 3 | **Robinhood Lab** (agentic cash account) | Real dollars, small | Where doctrine gets blood |

Findings promote upward only. *This* — not any single lab — is the novel apparatus.

---

## The Reference Book — seven equal sleeves · ✅ THE EXAMPLE PORTFOLIO

The strategy is the rebalancing; the book is just a diversified, low-correlation committee to
run it on. Here is the example seven-sleeve book — **equal weight, ~14.3% each.** Copy the
shape, not the conviction: the point is uncorrelated volatility to harvest, not these names.

| Ticker | Weight | What it is | Its job in the book |
|---|---|---|---|
| **TQQQ** | 14.3% | 3× Nasdaq-100 | Leveraged growth engine / harvest fuel — the only leveraged sleeve |
| **TLT** | 14.3% | 20+yr Treasuries | Rate / duration hedge |
| **GLDM** | 14.3% | Gold | Debasement hedge |
| **GME** | 14.3% | GameStop (single stock) | Idiosyncratic wildcard volatility |
| **SGOV** | 14.3% | 0–3 month T-bills | Cash anchor / dry powder |
| **VEU** | 14.3% | FTSE All-World ex-US | International / dollar-down tilt |
| **F** | 14.3% | Ford (single stock) | Cyclical / value wildcard |

The demon feeds on **low correlation + volatility**: a leveraged growth engine, two macro
hedges (rates, gold), a cash anchor, an ex-US tilt, and two high-variance single-stock
wildcards. Diverse enough that something is always rich and something always poor — which is the
only precondition a bite needs.

---

## The Doctrines — the seven laws · ✅ BUILT & TESTED

*(Established across Sprints A–I on the 2020–2026 total-return-proxy panel. Caveats in Findings.)*

### I. Prime the Spring
Rebalancing **into** a drawdown is the return engine. Each buy of a crashing sleeve is a
low-basis, high-share-count lot — the spring loads under tension and pays out on the reversion.
The discipline stores the payoff; the rebound releases it. Corollary: drawdown is not the
enemy, it's the raw material. (What *reduces* drawdown is trimming winners *before* the crash —
a separate, mostly-pre-drawdown action.)

### II. The Bite
The atomic move. Sell one whole executable dollar-unit from the **richest** sleeve (most over
target), buy it into the **poorest** (most under target). Fire only when both legs sit beyond
the $1 execution line. Human-runnable: no fractional-penny fantasy, just $1 quanta.

### III. The Plateau — bite size is a drawdown-and-tax lever, not a returns lever
Across resampled histories, bite sizes from 1% to 5% of book all return roughly the same. What
size controls is **drawdown and taxable events.** And it is **cadence-conditional** — pick bite
size and check-frequency *together*; they are substitutes.

| Cadence (how often you look) | Bite size | Why |
|---|---|---|
| Automated / strong (≤3 bites/day) | **~1.0–1.5%** (≈125bps) | Frequent small corrections keep drift tight |
| Manual / realistic (~1 look/day) | **2.0–5.0%** | A single coarse bite corrects hard when you *do* look; fine bites at low cadence post the worst drawdown of any policy |

**Key substitution:** every-2-days @ 500bps ≈ daily @ 200bps. Coarseness *buys attention-slack.*
Ship the band, not an "ideal point" — the plateau is flat, so a round number inside it is the
anti-overfit choice.

### IV. The Free Demon — contributions deploy dispersion-first
Every drip / top-up routes as $1 units to the **most-underweight** sleeve — never pro-rata,
never selling. Free rebalancing, **zero taxable events.** On a quiet day the paycheck is often
the book's single best rebalancing event. Captures ~13–15% of the harvest premium on its own;
stacks with the bites. (Pro-rata deployment leaves that on the table.)

### V. The Tax Knob — the completion band
Widening the urgent-rebalance threshold from 5% → 10% gives **identical returns with ~4× fewer
taxable events.** The band is a tax dial, not a returns dial. Turn it toward tax-light.

### VI. Demon Routing — advisory only
When multiple pairs qualify, route the bite through the **highest spread-variance pair** (the
demon board `web/demon_board.html` is the live heat map). Promising in theory; under
block-bootstrap it collapsed to a **coin flip** (50.4% win, median +$0.38). Tiebreaker, never an
oracle. Never force a trade to chase it. *(Open 🚧: a regime-persistence test — the block
bootstrap destroys the very structure routing might exploit, so its ceiling is still unmeasured.)*

### VII. The Gate — and why it's OFF
The v2.3a rule ("no new TQQQ buys while QQQ is below its 200-day average") was **dropped
2026-07-07.** It is a passive single-asset holder's trend filter mis-imported into an active,
diversified, buy-the-drawdown book. It priced at ~2% of terminal wealth in *every* window, went
0-for-totals, and its only payoff is ~2 points of max-drawdown relief in a bear — i.e., it
shaves the *productive* drawdown the harvest is paid to take. **Anti-spring.** It insures a
3x-non-reversion tail already bounded by 1/7 position sizing and never observed in-sample. Off.

---

## The Demon Ladder — demons by order

Demons rank by **order** = compositional scale of the fixed committee they harvest:

- **1st order** — two-sleeve pairs. ✅ Swept 2026-07-01: 190 pairs × 5 weights × 8 policies =
  7,600 rows. Taught the cautionary tale: YANG/YINN topped demon-yield at +34%/yr on a **+0.2%
  CAGR** — the metric definition doing the work, a pure selection artifact.
- **2nd order** — triads. **3rd** — quads. … up to **n-sleeve.** 🚧 **Not yet swept** — the
  exhaustive higher-order tournament (below) is designed, not run.
- The current live book (7 equal sleeves: TQQQ, TLT, GLDM, GME, SGOV, VEU, F) is a high-order
  demon — and, surprisingly, hard to beat. That it is "surprisingly awesome" is itself a finding.

---

## The Tournament of Power — 12 universes · 🚧 WORK IN PROGRESS (designed, not built)

**The problem:** 500 block-bootstrap worlds sound like a lot, but they are all children of *one
dataset* — same data-generating process, same regime pieces reshuffled. A demon that survives
them has only survived one reality's statistics. **Real robustness means surviving structurally
different market physics.**

**The framing (Alex, 2026-07-07):** run the tournament across **twelve universe-types**, DBZ
Tournament-of-Power style — 500 worlds *each*, 6,000 worlds total. A demon that fails to survive
a universe is erased from it; the champion is the demon that survives all twelve.

> **Status: designed, not yet built.** Only **U1** (the real-history block-bootstrap) has
> actually been run — that's the machinery behind the findings. U2–U12 are specified here but not
> implemented; the full 6,000-world tournament is the next build. Treat the twelve-universe
> result as a promise, not a receipt.

| # | Universe | Physics | Tests | Status |
|---|---|---|---|---|
| U1 | **The Prime Timeline** | Block-bootstrap of real 2020–2026 (baseline) | Empirical robustness | ✅ built |
| U2 | **The Stationary Drift** | Stationary bootstrap, random-length blocks | Removes the fixed-block artifact | 🚧 |
| U3 | **The Amnesiac** | IID daily shuffle, no blocks | Memoryless market — kills momentum/mean-reversion | 🚧 |
| U4 | **The Gaussian Mirror** | Multivariate normal from empirical covariance | Thin-tailed textbook world | 🚧 |
| U5 | **The Heavy Hand** | Multivariate Student-t | Fat tails — crashes far more common | 🚧 |
| U6 | **The Moody Realm** | 2-state regime-switching (calm/crisis Markov) | Regime persistence | 🚧 |
| U7 | **The Inferno** | Bear blocks oversampled — mostly-2022 | Pure survival stress | 🚧 |
| U8 | **The Ascension** | Bull blocks oversampled — melt-up | How much upside the harvest surrenders | 🚧 |
| U9 | **The Convergence** | Correlations inflated toward 1 | Diversification breaks (the 2008 world) | 🚧 |
| U10 | **The Scattering** | Correlations deflated / negative | The demon's paradise — abundant free volatility | 🚧 |
| U11 | **The Maelstrom** | All volatilities scaled up | Whipsaw; cost-drag appetite | 🚧 |
| U12 | **The Still Waters** | All volatilities scaled down | Does the demon starve when there's nothing to harvest? | 🚧 |

**The referee is NOT the in-sample leaderboard.** Ranking thousands of demons by raw demon
yield is selection-biased *by construction* — you'd just crown the prettiest coincidence. The
judge is **survival across the universes.** A demon earns its rank by keeping its edge when the
physics change, not by winning one movie.

**The core research question** (borrowed straight from the [Spirit Pool](spirit-of-diamond-legends-spec.md)
self-play tournament): do the same demons win across all twelve universes — *structural
determinism* — or does each universe crown its own champion — *universe-dependence*? **Either
result is a finding.** Convergence says the winning structure is a law; divergence says regime
selection is everything.

---

## Rung Four — The Protean Portfolio (the last frontier) · 🚧 NOT STARTED

Everything above holds the asset *universe* fixed and works the relationships inside it. Rung
four lets **membership itself mutate** over time — add, drop, swap sleeves. Operator-mindset
taken one level higher: composing the node *set*, not just the edges.

This is where backtests lie hardest — survivorship bias, look-ahead. It demands a selection
*rule* fixed in advance, walk-forward validation, zero peeking. **It comes only after** the
predefined-demon tournament maps the static topography — you cannot intelligently mutate a
universe until you know its fixed shape. The math is already waiting: this is exactly what the
universal-portfolio literature (Cover; online portfolio selection) is the theory *of*.

---

## The Tooling — what the research layer built · ✅ BUILT & TESTED

The doctrine above isn't vibes — it's the output of a small, reproducible apparatus the research
layer (codename **Fable**) authored in stdlib Python. Disclosed for transparency:

- **The backtest engine.** One dependency-free `simulate()` core walks a price panel day by day
  under a single policy — buy-and-hold, calendar, threshold-band, dollar-first, or the microbite
  (with optional demon-routing, regime-gate, contribution, and loose-supervision hooks). Trades
  execute in whole $1 units with spread + slippage costs; every metric falls out of the panel.
- **Parity gates + 92 unit tests.** Before any comparison run, the unchanged code path is
  re-executed and its output hash-compared byte-for-byte against the prior run. Every new feature
  ships *inert by default* and provably can't alter results until switched on. TDD throughout.
- **The bootstrap machinery.** A circular moving-block resampler draws 21-day blocks jointly
  across all sleeves (preserving cross-asset correlation) to build hundreds of synthetic
  histories — the referee that forces a finding to survive resampling. (That's universe U1; the
  Tournament extends it to twelve.)
- **The sweep suite.** The first-order explorer (7,600 sims) plus the sprint sweeps — bite-size,
  cadence, threshold-band, contributions, supervision — that produced the seven laws.
- **The dated-sidecar discipline.** Every experiment writes a timestamped, reproducible sidecar:
  the script, the raw rows, and a report. Nothing is quoted from memory; the artifacts re-run.

Division of labor: the operator (Alex) directs and rules; the research layer (**Fable**) builds
the tooling and runs the sims; the execution layer (**Hermes**) pilots the live account. The
ledger outranks all three.

---

## Methodology — the epistemics

- **Ledger over theory.** The broker's confirmed fills outrank every backtest, every doc,
  including this one. Reconcile to 6 decimal places.
- **Parity gates.** Before any comparison run, the unchanged code path is re-run and
  hash-compared byte-for-byte. Every engine feature (gates, microbites, contributions,
  loose-supervision) ships inert-by-default and provably doesn't exist until asked for.
- **Bootstrap as judge.** Findings must survive resampling, and — going forward — the twelve
  universes. In-sample wins are hypotheses, not results.
- **Selection-bias honesty.** Exhaustive search over thousands of demons produces winners by
  construction. Log what was dropped; never quote a top row as doctrine.
- **The primitive stack.** Stdlib Python, vanilla HTML/JS, hand-rolled dashboards. Libraries,
  not frameworks (anime.js passes). "I love using this primitive shit to do a novel thing." The
  corner test applied to technology — don't hold what everyone can farm.

---

## Findings to date (Lab 7-sleeve, $1,000, adjusted-close proxy) · ✅ BUILT & TESTED

- **The full cycle REVERSES the bull-window verdict.** 2023–2026 said buy-and-hold wins TQQQ
  books; 2020–2026 (with the 2022 bear) has harvesting finish **~$4,600 vs $2,717 at −37% max
  drawdown vs −69%.** Rebalancers bought the collapse and owned the recovery.
- **Harvest is insurance.** Across 500 bootstrap worlds it wins ~62% — and 91% of the worlds
  where hold suffers most, losing only the TQQQ-moonshot tail. It sells the right tail to buy
  the floor, the median, and the drawdown.
- **The $1 microbite is homeopathic** at a $550 book — sized for $100, captures <45% of the
  premium. The plateau (1–5%) fixes it.
- **The 10% band, coarse bites, dispersion drips, no gate** — the human-runnable configuration:
  beats buy-and-hold in ~60% of resampled worlds at roughly half the drawdown, on a dozen
  deliberate trades a year. Runnable between massage clients, no automation required.

**Caveats:** single historical panel (adjusted-close total-return proxy, 2020–22 gap-checked but
not issuer-reconciled); costs are spread + slippage only; taxes not modeled. The plateau's
breadth and round-number parameters are the anti-overfit defense; the Tournament of Power is the
plan to harden all of it against different physics.

---

*A Diamond Legendz research artifact. SIMULATED BACKTEST — hypothetical, price/total-return
proxy, partial cost estimates, taxes and most frictions not modeled. Nothing here is an
execution instruction or investment advice. The ledger outranks this document.*
