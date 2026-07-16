"""ENGINE v2 — numpy-vectorized batch simulator for the Atlas (research tier).

Semantics ported from demon_ranch.backtest_duos.simulate() for the policies the
Atlas uses (threshold_pct, calendar) with NO gate / contributions / microbite:
  - init: fractional shares at target weights, cash = 0 (matches simulate)
  - triggers: calendar (weekly/monthly ISO-week/month change vs prev trading day),
    threshold_pct (any |value - target| >= target * band)
  - rebalance: EXACT port of execute_rebalance (v2.1, 2026-07-11): sells use
    entry-state deltas (whole order-floor units, capped at position, cash accrued
    in delta-ascending order to match stdlib float accumulation); buys run the
    stdlib $1-per-iteration unit loop in LOCKSTEP across all firing worlds —
    full state recompute per unit, first-eligible-in-delta-desc-order pick
    (numpy argmax first-occurrence == python stable sort), stdlib arithmetic
    forms preserved (cash -= notional + cost, not cash -= notional*(1+r)).
    The tolerance-parity gate (verify_v2.py) quantifies any residual.
  - costs: per-ticker (spread_bps + slippage_bps)/1e4, buy pays notional*(1+r),
    sell receives notional*(1-r)
  - metrics: final equity, max drawdown, rebalance-event count

The stdlib engine remains canonical. v2 exists for Atlas-scale statistics; every
cell it writes is tagged "engine": "v2".
"""

from __future__ import annotations

import numpy as np
from datetime import date, datetime


def calendar_mask(dates, freq):
    """fire[t] for t>=1 when the ISO week / month changes vs previous trading day."""
    n = len(dates)
    mask = np.zeros(n, dtype=bool)
    prev = datetime.fromisoformat(dates[0])
    for i in range(1, n):
        today = datetime.fromisoformat(dates[i])
        if freq == "daily":
            mask[i] = True
        elif freq == "weekly":
            mask[i] = today.isocalendar()[:2] != prev.isocalendar()[:2]
        elif freq == "monthly":
            mask[i] = (today.year, today.month) != (prev.year, prev.month)
        prev = today
    return mask


# ---------------- TAX PERFECT (v3.2) — exact per-lot ledger machinery ----------------
# Lot: [purch_ord, eff_ord, shares, basis_total, repl_used_shares]
#   purch_ord — actual acquisition ordinal (FIFO order, wash-window membership)
#   eff_ord   — holding-period start ordinal (differs from purch_ord after wash
#               tacking); LT/ST classification runs on eff_ord
#   repl_used — invariant: 0.0 (fresh) or == shares (fully used as a wash
#               replacement); matching always SPLITS lots so partial usage
#               never exists, and no share can absorb two disallowed losses.

_ANNIV = {}


def _lt_from(acq_ord):
    """First ordinal on which a sale of a lot acquired at acq_ord is long-term.
    IRS anniversary rule (Pub 544/550): LT iff held MORE than one year — a sale
    ON the one-year anniversary is still short-term, so LT begins the day after.

    FEB 29 (Rev. Rul. 66-7): there is no anniversary, and the rule is NOT
    "anniversary+1" applied to Mar 1. Property acquired on the LAST DAY OF A
    MONTH and disposed of on the FIRST DAY OF THE 13TH SUCCEEDING MONTH is held
    more than one year. Feb 29 is the last day of February, so LT begins
    March 1 of the following year — not March 2. (We had March 2: an off-by-one
    that BOTH this engine and the "independent" accountant made identically,
    caught by an adversarial audit 2026-07-13. The lesson: the checker was
    independent in data structures, not in legal interpretation.)"""
    v = _ANNIV.get(acq_ord)
    if v is None:
        d = date.fromordinal(acq_ord)
        try:
            v = d.replace(year=d.year + 1).toordinal() + 1
        except ValueError:                      # Feb 29 -> Rev. Rul. 66-7
            v = date(d.year + 1, 3, 1).toordinal()
        _ANNIV[acq_ord] = v
    return v


def _perfect_liquidate(ls, p_net, last_ord, wash, method="fifo", rates=None):
    """Liquidate an entire sleeve on the final day, WITH sec. 1091.

    The naive version — sell every lot, classify each by its own holding period —
    is wrong, and it was wrong here until an adversarial audit caught it
    (2026-07-13). A loss lot whose replacement was bought within the prior 30
    days still triggers a wash: the loss is disallowed, it shifts into the
    replacement's basis, and — the part that actually bites — the replacement's
    HOLDING PERIOD TACKS, which can convert its gain from short-term to
    long-term. The total gain is unchanged; the CHARACTER is not, and character
    is the difference between 24% and 15%.

    So we sell lot-by-lot in PURCHASE order, letting each loss match against the
    lots not yet sold — identical semantics to the in-flight sell path, where a
    replacement must be one you still hold at that moment. A bps-quantum
    rebalancer mints a lot on every buy, so on the final day nearly every sleeve
    carries in-window lots: this fires on most cells, and skipping it overstated
    the exit tax by ~16% on the audit's constructed case."""
    st = lt_g = 0.0
    dis = 0.0
    while ls:
        stg, ltg, rows = _perfect_sell(ls, ls[0][2], p_net, last_ord, "fifo",
                                       0, rates)
        st += stg
        lt_g += ltg
        for row_sh, lps, eo, ltf in rows:
            mm = 0.0
            if wash and ls:
                lo = last_ord - 30
                j = len(ls)
                while j > 0 and ls[j - 1][0] >= lo:
                    j -= 1
                mm, dd, _ = _wash_back(ls, row_sh, lps, eo, last_ord, j)
                dis += dd
            unm = row_sh - mm
            if unm > 1e-12:                 # nothing can be bought after the
                if ltf:                     # exit, so an unmatched loss is
                    lt_g -= unm * lps       # simply recognized
                else:
                    st -= unm * lps
    return st, lt_g, dis


def _ord_offset(bill, sc, lc, ord_cap, ord_rate):
    """§1211(b) / §1212(b) — the $3,000-a-year capital-loss deduction against
    ORDINARY income, and the character-aware carryover it leaves behind.

    We modelled this as $0.00 for the entire project. It is not $0.00: an
    auditor put the error at 6.5-9.8% of lifetime tax on a high-turnover book,
    and — the part that actually matters — **1.5x worse for FIFO than for
    HIFO**, because FIFO ends more years in a net-loss position and therefore
    forfeits the deduction more often. Omitting it INFLATED the lot-selection
    lever, which is the project's headline finding.

    §1211(b): a net capital loss is deductible against ordinary income up to
    $3,000 ($1,500 MFS). It is worth the ORDINARY rate (fed_st + state), not the
    preferential one — a capital LOSS is the mirror of a short-term gain.

    §1212(b)(2)(A): in the carryover computation the deducted amount is treated
    as a SHORT-TERM CAPITAL GAIN. Mechanically that means it BURNS THE
    SHORT-TERM LOSS FIRST and only spills into the long-term loss once the
    short-term loss is exhausted — so the carryover that survives is
    preferentially LONG-term, which is the WORSE character to carry (it can only
    shelter preferentially-taxed gains). The carryover is reduced by exactly
    what was deducted; nothing is double-counted.

    MODELING BOUNDARY, stated not hidden: we assume the taxpayer HAS at least
    $3,000 of ordinary income to absorb the deduction every year. For Alex
    (W-2 income) that holds. For a taxpayer with no ordinary income the
    deduction is limited and this over-credits. Inert at ord_cap=0.0.
    """
    if ord_cap <= 0.0:
        return bill, sc, lc
    tot = sc + lc
    if tot <= 0.0:
        return bill, sc, lc
    ded = tot if tot <= ord_cap else ord_cap
    bill -= ord_rate * ded
    use_st = sc if sc <= ded else ded           # §1212(b)(2)(A): ST loss burns first
    sc -= use_st
    lc -= ded - use_st
    if sc < 0.0:
        sc = 0.0
    if lc < 0.0:
        lc = 0.0
    return bill, sc, lc


def _sched_d3(st_in, lt_in, co_in, st_c, lt_c, fed_st, fed_lt, co_rate, state,
              ord_cap=0.0):
    """Schedule D with the COLLECTIBLES bucket (§1(h)(4)) — three characters, not two.

    Physical-metal grantor trusts (GLDM, SLV, PALL, IAUI, SIVR) produce
    "28-percent rate gain": long-term gain taxed at min(28%, ordinary). At or
    below the 28% bracket that means **the ST/LT spread collapses to ZERO**, and
    every lot rule that ranks on that spread is ranking on a discount that does
    not exist. This function is why the rate has to be per-sleeve.

    §1(h) netting, simplified but honest: losses of any character offset gains of
    any character (they all land in the same capital-gain netting), so we net
    ST/LT first (as before), then apply what remains against the 28% bucket. The
    ordering approximation is documented rather than hidden: a full §1(h)
    implementation would order 28%-rate gain ahead of adjusted net capital gain.

    ord_cap > 0 additionally applies §1211(b) (see _ord_offset). Inert at 0.0.
    """
    st = st_in - st_c
    lt = lt_in - lt_c
    co = co_in
    # a net loss in one bucket shelters gains in the others
    for a, b in ((0, 1), (0, 2), (1, 2), (1, 0), (2, 0), (2, 1)):
        vals = [st, lt, co]
        if vals[a] < 0.0 < vals[b]:
            x = min(-vals[a], vals[b])
            vals[a] += x
            vals[b] -= x
            st, lt, co = vals
    stp = st if st > 0.0 else 0.0
    ltp = lt if lt > 0.0 else 0.0
    cop = co if co > 0.0 else 0.0
    bill = (fed_st * stp + fed_lt * ltp + co_rate * cop
            + state * (stp + ltp + cop))
    # carryovers keep character; the collectibles loss folds into LT (it is a
    # long-term loss for carryover purposes — §1222(7) — only its RATE differs)
    sc = -st if st < 0.0 else 0.0
    lc = (-lt if lt < 0.0 else 0.0) + (-co if co < 0.0 else 0.0)
    return _ord_offset(bill, sc, lc, ord_cap, fed_st + state)


# ---- per-sleeve tax character (docket: tax_character.py wired in) ----
# The engine sees SLEEVE INDICES, not tickers, so the caller resolves tickers ->
# characters (tax_character.CHARACTER) and hands us the strings.
CHAR_ORDINARY = "ordinary"
CHAR_COLLECTIBLE = "collectible"
CHAR_IMPLEMENTED = (CHAR_ORDINARY, CHAR_COLLECTIBLE)


def _char_rates(char_map, S, fed_st, fed_lt, state, coll_cap=0.28):
    """(srates, is_coll, coll_fed) from a per-sleeve tax-character list.

    srates[si] — the (st, lt) EFFECTIVE rates (fed + state) for sleeve si, fed to
                 _consume_order so a rate-aware lot rule (mintax) stops pricing
                 collectibles on an ST/LT spread that does not exist.
    is_coll[si] — route this sleeve's LONG-term gains/losses into the third
                 (§1(h)(4), 28%) Schedule-D bucket.
    coll_fed    — the federal 28%-rate-gain rate, min(28%, ordinary).

    RAISES on any character we have not actually implemented (sec1256, passthru,
    ordinary_dist). That is deliberate. Those three regimes are NOT wrong by a
    rate — they are wrong by DEFERRAL (they are taxed annually whether or not you
    sell, and §1256 has no wash rule and no lot ledger at all). Silently mapping
    them onto the ordinary path with a fudged rate would be exactly the kind of
    half-fix that this file's comments already record us being burned by. See the
    engine docstring for what remains undone.
    """
    if len(char_map) != S:
        raise ValueError(f"char_map has {len(char_map)} entries, need {S}")
    bad = sorted({c for c in char_map if c not in CHAR_IMPLEMENTED})
    if bad:
        raise NotImplementedError(
            f"tax character(s) {bad} are not implemented in the lot engine "
            f"(implemented: {list(CHAR_IMPLEMENTED)}). sec1256/passthru/"
            f"ordinary_dist are taxed ANNUALLY without deferral — a rate swap "
            f"does not model them. Do not launder them through 'ordinary'.")
    coll_fed = coll_cap if coll_cap <= fed_st else fed_st       # min(28%, ordinary)
    srates = []
    is_coll = []
    for c in char_map:
        if c == CHAR_COLLECTIBLE:
            srates.append((fed_st + state, coll_fed + state))
            is_coll.append(True)
        else:
            srates.append((fed_st + state, fed_lt + state))
            is_coll.append(False)
    return srates, is_coll, coll_fed


def _consume_order(ls, p_net, today_ord, method, rates=None):
    """Lot-consumption order (docket 41/45 lever).

    fifo   — acquisition order (every broker's silent default).
    hifo   — highest basis/share first.
    opt    — character-bucket specific-ID (a real broker-style "tax optimizer"
             ordering): ST losses deepest-first, then LT losses, then LT gains
             smallest-first, then ST gains smallest-first. NOTE this ranks
             CHARACTER above MAGNITUDE, which in a long-running demon is a trap:
             the LT lots are the oldest and lowest-basis, so this rule reaches
             for the biggest gains first merely because they are cheaply taxed.
    mintax — minimum-tax-now: rank by the actual bill this sale would incur,
             tax_cost/share = effective_rate(lot) * gain/share, ascending. The
             deepest tax BENEFIT (an ST loss, credited at the ordinary rate)
             sorts first; the cheapest gain sorts last. Myopic by construction
             (it prices this sale, not the lifetime bill).
    """
    n = len(ls)
    if method == "fifo":
        return range(n)
    if method == "hifo":
        return sorted(range(n), key=lambda i: -(ls[i][3] / ls[i][2]))
    if method == "mintax":
        st_r, lt_r = rates if rates else (0.24, 0.15)

        def c(i):
            g = p_net - ls[i][3] / ls[i][2]
            return (lt_r if today_ord >= _lt_from(ls[i][1]) else st_r) * g
        return sorted(range(n), key=c)

    def k(i):
        g = p_net - ls[i][3] / ls[i][2]
        lt = today_ord >= _lt_from(ls[i][1])
        if g < 0.0:
            return (1 if lt else 0, g)
        return (2 if lt else 3, g)
    return sorted(range(n), key=k)


def _perfect_sell(ls, q, p_net, today_ord, method, max_lots=0, rates=None):
    """Consume q shares from lot list ls at net-of-costs price p_net. Realized
    GAINS are returned immediately as (st_gain, lt_gain); realized LOSSES are
    returned as rows [shares, loss_per_share(+), eff_ord, lt_flag] awaiting the
    wash-sale checks. Zero lots are pruned; a float-drift remainder (ledger vs
    the vectorized share array, <1e-9 shares in practice) realizes at zero
    basis, ST (conservative)."""
    st = lt_g = 0.0
    rows = []
    rem = q
    emptied = False
    order = _consume_order(ls, p_net, today_ord, method, rates)
    if max_lots and method != "fifo":
        # Robinhood caps specified-lot sells at max_lots lots; whatever the
        # specified lots don't cover falls back to the account default (FIFO).
        # So: the first max_lots picks are the lever, the tail is FIFO.
        chosen = list(order)[:max_lots]
        taken = set(chosen)
        order = chosen + [i for i in range(len(ls)) if i not in taken]
    for i in order:
        if rem <= 1e-12:
            break
        lot = ls[i]
        take = lot[2] if lot[2] <= rem else rem
        if take <= 0.0:
            continue
        b = lot[3] * (take / lot[2])
        lot[2] -= take
        lot[3] -= b
        if lot[2] <= 1e-12:
            emptied = True
        if lot[4] > lot[2]:
            lot[4] = lot[2]
        g = take * p_net - b
        ltf = today_ord >= _lt_from(lot[1])
        if g >= 0.0:
            if ltf:
                lt_g += g
            else:
                st += g
        else:
            rows.append([take, -g / take, lot[1], ltf])
        rem -= take
    if rem > 1e-9:
        st += rem * p_net
    if emptied:
        # FIFO zeroes a PREFIX (consumption is front-first): C-speed del.
        k = 0
        n_ = len(ls)
        while k < n_ and ls[k][2] <= 1e-12:
            k += 1
        if k:
            del ls[:k]
        if method != "fifo":
            for l_ in ls:
                if l_[2] <= 1e-12:
                    ls[:] = [l for l in ls if l[2] > 1e-12]
                    break
    return st, lt_g, rows


def _wash_back(ls, row_sh, lps, eo, sale_ord, j):
    """Sec. 1091 back-window: match loss shares against replacement lots
    PURCHASED within 30 days before the sale (still held; includes the sold
    lot's own unsold remainder), earliest acquisition first. Matched pieces
    split off: basis += disallowed loss, holding period tacks
    (eff = purch - days the sold shares were held).

    j is the caller-maintained resume pointer: lots are purchase-ordered so
    the window is a suffix, and matching exhausts capacity left-to-right, so
    within one sell the exhausted lots form a growing prefix — each window
    lot is visited O(1) amortized across all loss rows (profiled 2026-07-13:
    per-row rescans were the dominant feast-cell cost). Returns
    (matched_shares, disallowed_total, next_j)."""
    n = len(ls)
    need = row_sh
    dis_tot = 0.0
    while j < n and need > 1e-12:
        lot = ls[j]
        cap = lot[2] - lot[4]
        if cap <= 1e-12:
            j += 1
            continue
        m = cap if cap <= need else need
        dis = m * lps
        new_eff = lot[0] - (sale_ord - eo)
        if m >= lot[2] - 1e-12:            # whole lot becomes replacement
            lot[1] = new_eff
            lot[3] += dis
            lot[4] = lot[2]
            j += 1                          # exhausted — advance the pointer
        else:
            # partial split: fresh lot (cap == shares), so m < shares implies
            # m == need — the loop exits and the source lot (still at j)
            # retains capacity for the next loss row.
            bps_ = lot[3] * (m / lot[2])
            lot[2] -= m
            lot[3] -= bps_
            ls.insert(j + 1, [lot[0], new_eff, m, bps_ + dis, m])
            n += 1
        dis_tot += dis
        need -= m
    return row_sh - need, dis_tot, j


def _perfect_buy(ls, pend, sh_add, basis_add, today_ord):
    """Append a purchase lot, then sec. 1091 forward-window matching against
    pending unmatched loss sales (earliest sale first, expired entries pruned).
    Returns reversals [(disallowed, lt_flag, year)] — each previously
    recognized loss now disallowed, to be credited back to the period that
    recognized it (current year, or an amended return if already settled)."""
    lot = [today_ord, today_ord, sh_add, basis_add, 0.0]
    ls.append(lot)
    revs = []
    if pend:
        pend[:] = [e for e in pend if today_ord - e[0] <= 30]
        pieces = []
        for e in pend:
            cap = lot[2] - lot[4]
            if cap <= 1e-12:
                break
            m = cap if cap <= e[1] else e[1]
            if m <= 1e-12:
                continue
            dis = m * e[2]
            new_eff = lot[0] - (e[0] - e[3])
            if m >= lot[2] - 1e-12:
                lot[1] = new_eff
                lot[3] += dis
                lot[4] = lot[2]
            else:
                bps_ = lot[3] * (m / lot[2])
                lot[2] -= m
                lot[3] -= bps_
                pieces.append([lot[0], new_eff, m, bps_ + dis, m])
            e[1] -= m
            revs.append((dis, e[4], e[5]))
        ls.extend(pieces)
        pend[:] = [e for e in pend if e[1] > 1e-12]
    return revs


def _sched_d(st_in, lt_in, st_c, lt_c, fed_st, fed_lt, state, ord_cap=0.0):
    """One year's Schedule D, exact: ST and LT net separately with
    CHARACTER-PRESERVING carryovers (ST carryover enters the ST line, LT the
    LT line — v2b's character-blind ST-first shortcut retired), then
    cross-netting (a net loss of one character offsets a net gain of the
    other). State taxes net gains as ordinary income (GA-style, no
    preferential LT rate). Returns (bill, new_st_carry, new_lt_carry);
    carryovers are positive loss amounts.

    ord_cap > 0 applies §1211(b): a net capital loss is deducted against
    ordinary income up to the cap ($3,000; $1,500 MFS), valued at the ORDINARY
    rate, and §1212(b)(2)(A) burns the SHORT-term loss first in the carryover
    computation (see _ord_offset). With ord_cap = 0.0 this is the old function,
    byte for byte — the whole 43-config atlas was run that way. Inert default."""
    st = st_in - st_c
    lt = lt_in - lt_c
    if st < 0.0 < lt:
        x = -st if -st <= lt else lt
        st += x
        lt -= x
    elif lt < 0.0 < st:
        x = -lt if -lt <= st else st
        lt += x
        st -= x
    stp = st if st > 0.0 else 0.0
    ltp = lt if lt > 0.0 else 0.0
    bill = fed_st * stp + fed_lt * ltp + state * (stp + ltp)
    if ord_cap <= 0.0:                      # the shipped path — untouched
        return bill, (-st if st < 0.0 else 0.0), (-lt if lt < 0.0 else 0.0)
    return _ord_offset(bill, (-st if st < 0.0 else 0.0),
                       (-lt if lt < 0.0 else 0.0), ord_cap, fed_st + state)


def simulate_batch(P, weights, policy, dates, rates, order_floor=1.0, capital=1000.0,
                   exec_mode="unit", quantum_bps=0.0, tax_rate=0.0, halt_mask=None,
                   tax_mode="immediate", lt_rate=0.15, lot_res="daily",
                   state_rate=0.0, lot_method="fifo", wash=True, tax_out=None,
                   trace_world=None, max_lots=0, settle_lag=0,
                   ord_offset_cap=0.0, char_map=None, collectible_cap=0.28):
    """P: [W, T, S] prices. weights: [S]. rates: [S]. Returns finals, max_dd, rebals.

    exec_mode="unit"    — v2.1 canonical: exact stdlib $1-per-iteration buy loop
                          (bit-identical to backtest_duos.simulate, gate 2026-07-11).
    exec_mode="chunked" — v2.2 semantics (docket item 31): the $1 floor is a MINIMUM,
                          not a quantum. Buys leap in closed-form chunks to the next
                          argmax crossover (deltas drift linearly per unit: pick loses
                          floor + cost*w_pick per unit, others lose cost*w each), so a
                          $40k rebalance is ~a dozen ops instead of 40k. Same waterfall
                          allocation in real arithmetic; differs from "unit" only by
                          float non-associativity. Gate: verify_v22 (7/7 completed
                          cases PASS at 1e-12..1e-15, 2026-07-12).

    tax_mode="perfect"  — TAX PERFECT (v3.2, docket 41; Alex's ruling 2026-07-13
                          "forget the diff — I want perfect"): exact per-world,
                          per-sleeve tax-lot ledgers, no approximations.
                          * Basis includes buy-side trading costs; amount
                            realized is net of sell-side costs (Pub 551/550) —
                            v2b ignored both.
                          * ST/LT by the IRS anniversary rule (LT iff held MORE
                            than one year; anniversary-date sale is ST; exact
                            across leap years). v2b's flat >=366d test retired.
                          * WASH SALES (sec. 1091): a loss is disallowed to the
                            extent substantially identical shares are acquired
                            within 30 days before or after the sale; the
                            disallowed loss shifts into the replacement lot's
                            basis and the holding period tacks. Matching:
                            in-window still-held acquisitions, earliest first,
                            each share absorbs at most one loss (lots split so
                            replacement usage is all-or-nothing). A loss
                            recognized in an already-settled year and washed by
                            a later buy triggers an AMENDED RETURN: that year's
                            Schedule D recomputes, the tax delta is charged
                            when the wash occurs, and carryovers correct.
                          * Year-end Schedule D: character-preserving
                            carryovers + ST/LT cross-netting (see _sched_d);
                            bill = tax_rate*ST + lt_rate*LT
                            + state_rate*(ST+LT), charged to cash at each
                            year's last trading day.
                          * lot_method: "fifo" | "hifo" | "opt" (docket 41
                            lot-selection lever; see _consume_order).
                          * wash=False disables sec. 1091 (ablation lever).
                          * tax_out (dict, optional): filled per world with
                            taxes_paid, wash_disallowed, final_basis,
                            st_carry/lt_carry, liq_tax + after_liq (terminal
                            liquidation on the final day, amending the final
                            year's return; full exit = no wash, standard
                            treatment), liq_st_carry/liq_lt_carry,
                            bills_by_year; trace_world=w additionally emits
                            world w's full trade list for independent replay
                            (accountant.py — the docket 41 spot-check gate).
    ord_offset_cap > 0  — §1211(b) / §1212(b) (2026-07-14): a net capital loss
                          is deducted against ORDINARY income at each year-end
                          settlement, up to the cap ($3,000; $1,500 MFS),
                          credited at the ordinary rate (tax_rate+state_rate);
                          the carryover is reduced by what was deducted, and
                          §1212(b)(2)(A) burns the SHORT-term loss FIRST so what
                          survives is preferentially long-term. We modeled this
                          at $0 for the whole project; an audit put the error at
                          6.5-9.8% of lifetime tax on high-turnover books and
                          1.5x WORSE for FIFO than HIFO — i.e. omitting it
                          INFLATED the lot-selection lever. Assumes >= $3k of
                          ordinary income exists to absorb it (true for Alex).
                          Applies to the year-end bill, to AMENDED returns, and
                          to the terminal liquidation. Inert at 0.0 (gated:
                          verify_perfect PART E, 42 taxed-path hashes).
    char_map not None   — PER-SLEEVE TAX CHARACTER (tax_character.py wired in,
                          2026-07-14). A list of S character strings
                          ("ordinary" | "collectible"). The engine then
                          (a) prices each sleeve's lots at ITS OWN (st, lt)
                          rates in _consume_order — so `mintax` stops ranking
                          GLDM/SLV/IAUI/SIVR on an ST/LT spread that does not
                          exist (§1(h)(4): LT on a collectible is min(28%,
                          ordinary), which AT OR BELOW the 28% bracket equals
                          the ordinary rate — the spread is ZERO); and
                          (b) routes those sleeves' long-term gains and losses
                          into the third _sched_d3 bucket, taxed at
                          min(collectible_cap, tax_rate) instead of lt_rate.
                          RAISES NotImplementedError on "sec1256" / "passthru" /
                          "ordinary_dist" rather than laundering them through
                          the ordinary path — see NOT DONE below. Inert at None.
                          Known modeling boundaries (documented, not silent):
                          dividend taxation is NOT modeled — the total-return
                          panel embeds dividends as price growth, so the
                          engine defers them as capital gains (flatters
                          high-yield sleeves; needs a dividend-split panel);
                          estimated-payment timing is year-end
                          (conservative); sleeves are distinct securities
                          (no cross-ticker "substantially identical"); IRA-
                          side wash poisoning is out of scope until docket 42.
                          NOT DONE (2026-07-14), deliberately, and NOT faked:
                          * §1256 (USO, WEAT) — 60/40 mark-to-market. Correct
                            treatment SKIPS THE LOT LEDGER ENTIRELY (annual MTM,
                            no holding period, no lot lever) and switches OFF
                            §1091 (§1256(f)(5) says §1091 "shall not apply").
                            That is a second accounting path, not a rate, and it
                            changes the HOLDER twin too. char_map raises on it.
                          * PASSTHRU (DBB) / ORDINARY_DIST (SGOV, TLT, PDBC) —
                            taxed ANNUALLY with no deferral, and SGOV/TLT are
                            state-EXEMPT (31 U.S.C. §3124). Their error is
                            deferral, not rate; a rate swap would not fix them.
                            char_map raises on these too.
    tax_mode="annual_ltst" — TAX v2b: real lot tracking. Shares+basis bucketed
                          by acquisition month; sells consume lots FIFO (oldest
                          first); each realized gain is ST (<=12 months, taxed
                          at tax_rate) or LT (>12 months, taxed at lt_rate).
                          Year-end: ST/LT cross-netting (losses of one character
                          offset gains of the other), then carryforward
                          (character-blind, applied ST-first — documented
                          approximation), then the bill. No wash rule (gap).
    tax_mode="annual"   — TAX v2a (docket 38 refinement): realized gains AND
                          losses net per calendar year per world; tax settles at
                          each year boundary on max(0, net - carryforward);
                          losses carry forward indefinitely. Cash pays the bill
                          at settlement (may go transiently negative — a
                          borrow; buys pause until it recovers). Still all-ST,
                          no wash rule (documented gaps). "immediate" preserves
                          v1 shadow semantics exactly.
    tax_rate > 0        — SHADOW U14 (The Tax Collector): average-cost basis is
                          tracked per sleeve; each sell's realized gain
                          (proceeds - basis share) is taxed immediately at
                          tax_rate, positive gains only, no loss offsets, no
                          terminal liquidation tax; the hold twin defers
                          (untaxed) — the honest asymmetry. Chunked mode only.
                          Inert at 0.0 (bit-identical, gated).
    halt_mask not None  — SHADOW U23 (The Frozen Exchange): [W, T] bool; True
                          days cannot fire a rebalance (drift accrues). Inert
                          at None (gated).

    quantum_bps > 0     — v3.1 semantics (docket item 35, Alex): flat floors are a
                          scale artifact. Per rebalance event, per world, the trade
                          quantum = max(order_floor, quantum_bps/1e4 * equity at
                          trigger). Scale-invariant execution (units/event ~ band/bps),
                          identical to flat-floor at small books (10bps of $1,000 <
                          $1), realistic at large ones. Chunked mode only. With
                          quantum_bps=0 this is bit-identical to v2.2 chunked
                          (plumbing gate: verify_v31)."""
    W, T, S = P.shape
    w = np.asarray(weights, dtype=np.float64)
    r = np.asarray(rates, dtype=np.float64)

    # Both new levers live ONLY in the exact-ledger path. Fail loudly rather than
    # accept a flag we would then quietly ignore (both default to OFF).
    if (char_map is not None or ord_offset_cap > 0.0) and not (
            tax_rate > 0.0 and tax_mode == "perfect"):
        raise ValueError('ord_offset_cap / char_map require tax_rate > 0 and '
                         'tax_mode="perfect"')

    shares = (capital * w[None, :]) / P[:, 0, :]           # [W,S] fractional
    cash = np.zeros(W)
    pending = np.zeros(W)      # unsettled sale proceeds (settle_lag; always 0 at lag=0)
    peak = np.full(W, capital)
    max_dd = np.zeros(W)
    rebals = np.zeros(W, dtype=np.int64)

    if tax_rate > 0.0:
        assert exec_mode == "chunked", "tax semantics implemented for chunked mode"
        basis = capital * w[None, :] * np.ones((W, 1))
        if tax_mode in ("annual", "annual_ltst", "perfect"):
            net_realized = np.zeros(W)
            carry = np.zeros(W)
            year_of = [d[:4] for d in dates]
            year_end = np.array([t == len(dates) - 1 or year_of[t] != year_of[t + 1]
                                 for t in range(len(dates))], dtype=bool)
        if tax_mode == "perfect":
            # TAX PERFECT (v3.2): exact per-world/per-sleeve lot ledgers.
            ords = np.array([datetime.fromisoformat(d).toordinal() for d in dates])
            _o0 = int(ords[0])
            lots_pw = [[[[_o0, _o0, float(shares[wi, si]), float(capital * w[si]), 0.0]]
                        for si in range(S)] for wi in range(W)]
            pend_pw = [[[] for _si in range(S)] for _wi in range(W)]
            st_net = np.zeros(W)
            lt_net = np.zeros(W)
            co_net = np.zeros(W)       # §1(h)(4) 28%-rate bucket; all-zero when char_map is None
            st_carry = np.zeros(W)
            lt_carry = np.zeros(W)
            taxes_paid = np.zeros(W)
            wash_dis = np.zeros(W)
            snaps = [None] * W
            bills_yr = {}
            trades_tr = []
            # ---- per-sleeve tax character. char_map=None reproduces the three
            # global constants EXACTLY (same float expressions), so the shipped
            # atlas is bit-identical. ----
            if char_map is None:
                srates = [(tax_rate + state_rate, lt_rate + state_rate)] * S
                coll = [False] * S
                coll_fed = lt_rate

                def _sd(st_, lt_, co_, sc_, lc_):
                    return _sched_d(st_, lt_, sc_, lc_, tax_rate, lt_rate,
                                    state_rate, ord_offset_cap)
            else:
                srates, coll, coll_fed = _char_rates(char_map, S, tax_rate, lt_rate,
                                                     state_rate, collectible_cap)

                def _sd(st_, lt_, co_, sc_, lc_):
                    return _sched_d3(st_, lt_, co_, sc_, lc_, tax_rate, lt_rate,
                                     coll_fed, state_rate, ord_offset_cap)
            if trace_world is not None:
                for si in range(S):
                    trades_tr.append((dates[0], si, "BUY", float(shares[trace_world, si]),
                                      float(P[trace_world, 0, si]), 0.0,
                                      float(capital * w[si]), 0.0))
        if tax_mode == "annual_ltst":
            # Lot buckets at lot_res: "daily" = one bucket per trading day, LT
            # test on exact calendar-day age (>= 366d) — zero classification
            # error; "weekly" = calendar-week buckets (+/-6d at the line).
            ords = np.array([datetime.fromisoformat(d).toordinal() for d in dates])
            if lot_res == "daily":
                bucket_of_t = np.arange(len(dates))
                bucket_ord = ords.copy()
            else:
                bucket_of_t = (ords - ords[0]) // 7
                first = {}
                for ti, b in enumerate(bucket_of_t):
                    first.setdefault(int(b), int(ords[ti]))
                bucket_ord = np.array([first[b] for b in range(int(bucket_of_t[-1]) + 1)])
            M = int(bucket_of_t[-1]) + 1
            share_lots = np.zeros((M, W, S))
            basis_lots = np.zeros((M, W, S))
            share_lots[0] = shares.copy()
            basis_lots[0] = capital * w[None, :] * np.ones((W, 1))
            st_net = np.zeros(W)
            lt_net = np.zeros(W)
            lot_lo = 0  # frontier: all buckets < lot_lo are empty everywhere
    kind = policy["type"]
    if kind == "calendar":
        cmask = calendar_mask(dates, policy["freq"])
    band = float(policy.get("band", 0.0))

    for t in range(T):
        if settle_lag and t > 0:
            cash = cash + pending          # yesterday's proceeds land
            pending = np.zeros(W)
        prices = P[:, t, :]                                 # [W,S]
        values = shares * prices
        equity = cash + pending + values.sum(axis=1)
        targets = equity[:, None] * w[None, :]

        if t == 0:
            fire = np.zeros(W, dtype=bool)
        elif kind == "calendar":
            fire = np.full(W, bool(cmask[t]))
        else:  # threshold_pct
            fire = (np.abs(values - targets) >= targets * band).any(axis=1)

        if settle_lag and t > 0:
            q_now = (np.maximum(order_floor, (quantum_bps / 1e4) * equity)
                     if quantum_bps > 0.0 else np.full(W, order_floor))
            fire = fire | ((cash >= q_now) & ((targets - values) >= q_now[:, None]).any(axis=1))

        if halt_mask is not None:
            fire = fire & ~halt_mask[:, t]
        if fire.any():
            fi = np.where(fire)[0]
            sh = shares[fi].copy(); ca = cash[fi].copy(); pr = prices[fi]
            pa = pending[fi].copy()
            F = len(fi)
            rows = np.arange(F)
            val = sh * pr
            eq = ca + pa + val.sum(axis=1)
            tg = eq[:, None] * w[None, :]
            dl = tg - val
            # per-world trade quantum: flat floor, or v3.1 bps-of-equity (item 35)
            if quantum_bps > 0.0:
                q = np.maximum(order_floor, (quantum_bps / 1e4) * eq)
            else:
                q = np.full(F, order_floor)
            qv = q[:, None]
            # ---- sells (exact): entry-state deltas, whole quanta, capped at position;
            #      cash accrued in delta-ascending order (stdlib float accumulation) ----
            sell_mask = dl <= -qv
            notion = np.floor((np.minimum(-dl, val) + 1e-12) / qv) * qv
            notion = np.where(sell_mask & (notion >= qv), notion, 0.0)
            sh = sh - notion / pr
            sell_order = np.argsort(dl, axis=1, kind="stable")
            if tax_rate > 0.0 and tax_mode == "perfect":
                tax = None                     # ledgers processed at event end
                bought_usd = np.zeros((F, S))
                bought_cost = np.zeros((F, S))
            elif tax_rate > 0.0 and tax_mode == "annual_ltst":
                tax = None
                cur_m = int(bucket_of_t[t])
                cur_ord = int(ords[t])
                q_rem = notion / pr                       # shares to sell [F,S]
                st_g = np.zeros(F); lt_g = np.zeros(F)
                while lot_lo < cur_m and share_lots[lot_lo].max() <= 0:
                    lot_lo += 1                           # frontier past dead lots
                for m in range(lot_lo, cur_m + 1):
                    if q_rem.max() <= 1e-12:
                        break
                    lot_s = share_lots[m][fi]
                    take = np.minimum(lot_s, q_rem)
                    if take.max() <= 0:
                        continue
                    with np.errstate(divide="ignore", invalid="ignore"):
                        ratio = np.where(lot_s > 0, take / lot_s, 0.0)
                    b_taken = basis_lots[m][fi] * ratio
                    share_lots[m][fi] = lot_s - take
                    basis_lots[m][fi] = basis_lots[m][fi] - b_taken
                    g = (take * pr - b_taken).sum(axis=1)
                    if cur_ord - int(bucket_ord[m]) >= 366:
                        lt_g += g
                    else:
                        st_g += g
                    q_rem = q_rem - take
                st_net[fi] += st_g
                lt_net[fi] += lt_g
            elif tax_rate > 0.0:
                bas = basis[fi]
                with np.errstate(divide="ignore", invalid="ignore"):
                    frac = np.where(val > 0, notion / val, 0.0)
                gain = notion - frac * bas
                if tax_mode == "annual":
                    tax = None
                    net_realized[fi] += gain.sum(axis=1)
                else:
                    tax = tax_rate * np.clip(gain, 0.0, None)
                basis[fi] = bas * (1.0 - frac)
            if settle_lag:
                proceeds = np.zeros(F)
                for s_i in range(S):
                    col = sell_order[:, s_i]
                    n_ = notion[rows, col]
                    proceeds += n_ - n_ * r[col]
                pa += proceeds              # T+1: owned, but unspendable today
            else:
                # NOTE: accrue term-by-term straight into `ca`, in delta-ascending
                # order. Accumulating into a temp and adding once is the SAME
                # number in real arithmetic and a DIFFERENT one in floats —
                # (ca+t1)+t2 != ca+(t1+t2). This ordering is the v2.1 bit-identity
                # contract with the stdlib engine; it is not stylistic. (Broke it
                # once, 2026-07-13; the inertness gate caught it immediately.)
                for s_i in range(S):
                    col = sell_order[:, s_i]
                    n_ = notion[rows, col]
                    ca += n_ - n_ * r[col]
            if tax_rate > 0.0 and tax is not None:
                ca -= tax.sum(axis=1)
            # ---- buys: lockstep across firing worlds. Per iteration: full state
            #      recompute; pick = first ticker in delta-desc stable order with
            #      delta >= floor and cash + 1e-12 >= floor*(1+r). "unit" buys one
            #      floor-unit per iteration (exact stdlib); "chunked" leaps to the
            #      next argmax crossover in one arithmetic step (v2.2 semantics). ----
            chunked = exec_mode == "chunked"
            act = np.ones(F, dtype=bool)
            while act.any():
                ai = np.where(act)[0]
                val_a = sh[ai] * pr[ai]
                eq_a = ca[ai] + pa[ai] + val_a.sum(axis=1)
                dl_a = eq_a[:, None] * w[None, :] - val_a
                qa = q[ai]
                ok = (dl_a >= qa[:, None]) & (ca[ai, None] + 1e-12 >= qa[:, None] * (1.0 + r)[None, :])
                any_ok = ok.any(axis=1)
                act[ai[~any_ok]] = False
                good = ai[any_ok]
                if good.size == 0:
                    break
                dlm = np.where(ok[any_ok], dl_a[any_ok], -np.inf)
                pick = dlm.argmax(axis=1)     # first occurrence of max == stable tie-break
                qg = q[good]
                cost = qg * r[pick]
                if chunked:
                    g = np.arange(len(good))
                    d0 = dlm[g, pick]                                   # pick's delta
                    cw_p = cost * w[pick]                               # pick target shrink/unit
                    # units until pick stops being eligible (delta stays >= quantum)
                    n_delta = np.floor((d0 - qg) / (qg + cw_p)) + 1
                    # units until cash can no longer fund the next unit
                    n_cash = np.floor((ca[good] + 1e-12) / (qg * (1.0 + r[pick])))
                    # units until any OTHER eligible sleeve's delta overtakes pick's:
                    # d_p(n) = d0 - n(quantum + c*w_p); d_o(n) = d_o - n*c*w_o
                    num = d0[:, None] - dlm[g]                          # >= 0 vs eligible others
                    den = (qg + cw_p)[:, None] - cost[:, None] * w[None, :]
                    frac = np.where(np.isfinite(dlm[g]) & (den > 0), num / den, np.inf)
                    frac[g, pick] = np.inf
                    n_cross = np.floor(frac.min(axis=1)) + 1
                    n = np.maximum(1, np.minimum(np.minimum(n_delta, n_cash), n_cross))
                    sh[good, pick] += n * qg / pr[good, pick]
                    ca[good] -= n * (qg + cost)
                    if tax_rate > 0.0:
                        if tax_mode == "annual_ltst":
                            cm = int(bucket_of_t[t])
                            share_lots[cm][fi[good], pick] += n * qg / pr[good, pick]
                            basis_lots[cm][fi[good], pick] += n * qg
                        elif tax_mode == "perfect":
                            bought_usd[good, pick] += n * qg
                            bought_cost[good, pick] += n * cost
                        else:
                            basis[fi[good], pick] += n * qg
                else:
                    sh[good, pick] += qg / pr[good, pick]
                    ca[good] -= qg + cost
            shares[fi] = sh; cash[fi] = ca; pending[fi] = pa
            rebals[fi] += 1
            if tax_rate > 0.0 and tax_mode == "perfect":
                # ---- exact ledger pass. Within an event a sleeve is either
                # sold or bought, never both, so sells-then-buys at event end
                # is order-exact for sec. 1091 (same-day buys of a sold sleeve
                # cannot occur; cross-day matching runs both windows). ----
                t_ord = int(ords[t])
                yr = year_of[t]
                q_rows = (notion / pr).tolist()
                b_rows = bought_usd.tolist()
                c_rows = bought_cost.tolist()
                p_rows = pr.tolist()
                r_l = r.tolist()
                fi_l = fi.tolist()
                for k_ in range(F):
                    q_row = q_rows[k_]
                    b_row = b_rows[k_]
                    if max(q_row) <= 1e-12 and max(b_row) <= 0.0:
                        continue
                    wi = fi_l[k_]
                    L = lots_pw[wi]
                    PD = pend_pw[wi]
                    p_row = p_rows[k_]
                    for si in range(S):
                        qs = q_row[si]
                        if qs <= 1e-12:
                            continue
                        p_ = p_row[si]
                        # PER-SLEEVE rates: a collectible sleeve prices its lots
                        # on a ZERO ST/LT spread, so `mintax` stops chasing a
                        # discount that §1(h)(4) does not grant. (char_map=None
                        # -> srates[si] is the old global tuple, bit-for-bit.)
                        stg, ltg, loss_rows = _perfect_sell(
                            L[si], qs, p_ * (1.0 - r_l[si]), t_ord, lot_method,
                            max_lots, srates[si])
                        st_net[wi] += stg
                        # a collectible's LONG-term gain/loss is 28%-rate gain:
                        # it lands in the THIRD Schedule-D bucket, not the LT one
                        lt_b = co_net if coll[si] else lt_net
                        lt_b[wi] += ltg
                        # back-window resume pointer: lots are purchase-ordered,
                        # so the in-window replacements are a suffix; find its
                        # start once per sell (post-consumption) and let
                        # _wash_back carry the pointer across the loss rows.
                        if wash and loss_rows:
                            ls_ = L[si]
                            wj = len(ls_)
                            lo_ = t_ord - 30
                            while wj > 0 and ls_[wj - 1][0] >= lo_:
                                wj -= 1
                        for row_sh, lps, eo, ltf in loss_rows:
                            mm = 0.0
                            if wash:
                                mm, dd, wj = _wash_back(L[si], row_sh, lps, eo,
                                                        t_ord, wj)
                                wash_dis[wi] += dd
                            unm = row_sh - mm
                            if unm > 1e-12:
                                if ltf:
                                    lt_b[wi] -= unm * lps
                                else:
                                    st_net[wi] -= unm * lps
                                if wash:
                                    PD[si].append([t_ord, unm, lps, eo, ltf, yr])
                        if trace_world is not None and wi == trace_world:
                            trades_tr.append((dates[t], si, "SELL", float(qs),
                                              float(p_), float(r_l[si]), 0.0, 0.0))
                    for si in range(S):
                        bu = b_row[si]
                        if bu <= 0.0:
                            continue
                        p_ = p_row[si]
                        bc = c_rows[k_][si]
                        revs = _perfect_buy(L[si], PD[si], bu / p_, bu + bc, t_ord)
                        lt_b = co_net if coll[si] else lt_net
                        sn_lt = 6 if coll[si] else 1     # snaps: [st,lt,stc,ltc,bill,yr,co]
                        for dd, ltf, y0 in revs:
                            wash_dis[wi] += dd
                            if y0 == yr or snaps[wi] is None:
                                # loss recognized in the still-open year: reverse
                                if ltf:
                                    lt_b[wi] += dd
                                else:
                                    st_net[wi] += dd
                            else:
                                # amended return for the settled year
                                sn = snaps[wi]
                                if ltf:
                                    sn[sn_lt] += dd
                                else:
                                    sn[0] += dd
                                b2, s2, l2 = _sd(sn[0], sn[1], sn[6], sn[2], sn[3])
                                cash[wi] -= b2 - sn[4]
                                taxes_paid[wi] += b2 - sn[4]
                                bills_yr[sn[5]][wi] = b2
                                sn[4] = b2
                                st_carry[wi] = s2
                                lt_carry[wi] = l2
                        if trace_world is not None and wi == trace_world:
                            trades_tr.append((dates[t], si, "BUY", float(bu / p_),
                                              float(p_), float(r[si]), float(bu), float(bc)))
            values = shares * prices
            equity = cash + pending + values.sum(axis=1)

        if tax_rate > 0.0 and tax_mode == "annual" and year_end[t]:
            usable = np.minimum(carry, np.clip(net_realized, 0.0, None))
            taxable = np.clip(net_realized - usable, 0.0, None)
            carry = carry - usable + np.clip(-net_realized, 0.0, None)
            bill = tax_rate * taxable
            cash = cash - bill
            net_realized[:] = 0.0
            values = shares * P[:, t, :]
            equity = cash + pending + values.sum(axis=1)
        if tax_rate > 0.0 and tax_mode == "annual_ltst" and year_end[t]:
            st = st_net.copy(); lt = lt_net.copy()
            # cross-netting: losses of one character offset gains of the other
            adj = np.where((st < 0) & (lt > 0), np.minimum(-st, lt), 0.0)
            st += adj; lt -= adj
            adj = np.where((lt < 0) & (st > 0), np.minimum(-lt, st), 0.0)
            lt += adj; st -= adj
            # carryforward, character-blind, ST first
            use_st = np.minimum(carry, np.clip(st, 0.0, None))
            st -= use_st; carry -= use_st
            use_lt = np.minimum(carry, np.clip(lt, 0.0, None))
            lt -= use_lt; carry -= use_lt
            carry += np.clip(-st, 0.0, None) + np.clip(-lt, 0.0, None)
            bill = tax_rate * np.clip(st, 0.0, None) + lt_rate * np.clip(lt, 0.0, None)
            cash = cash - bill
            st_net[:] = 0.0; lt_net[:] = 0.0
            values = shares * P[:, t, :]
            equity = cash + pending + values.sum(axis=1)
        if tax_rate > 0.0 and tax_mode == "perfect" and year_end[t]:
            yr_ = year_of[t]
            by = bills_yr.setdefault(yr_, np.zeros(W))
            for wi in range(W):
                # _sd == _sched_d (ord_offset_cap) or _sched_d3 (+ collectibles).
                # With ord_offset_cap > 0 the bill can go NEGATIVE — §1211(b) is a
                # deduction against ORDINARY income, so a pure-loss year is a
                # genuine cash REFUND, and `cash -= b_` credits it correctly.
                b_, s2, l2 = _sd(st_net[wi], lt_net[wi], co_net[wi],
                                 st_carry[wi], lt_carry[wi])
                snaps[wi] = [float(st_net[wi]), float(lt_net[wi]),
                             float(st_carry[wi]), float(lt_carry[wi]), b_, yr_,
                             float(co_net[wi])]
                by[wi] = b_
                st_carry[wi] = s2
                lt_carry[wi] = l2
                cash[wi] -= b_
                taxes_paid[wi] += b_
            st_net[:] = 0.0; lt_net[:] = 0.0; co_net[:] = 0.0
            values = shares * P[:, t, :]
            equity = cash + pending + values.sum(axis=1)

        peak = np.maximum(peak, equity)
        max_dd = np.minimum(max_dd, equity / peak - 1.0)

    if tax_rate > 0.0 and tax_mode == "perfect" and tax_out is not None:
        # ---- terminal liquidation (docket 41): hypothetically sell every lot
        # at final prices net of costs on the last day, amending the final
        # year's (already settled) return. Full exit = no wash, standard
        # treatment. liq_tax may be NEGATIVE (liquidation losses refund part
        # of the final year's bill). Emits basis + carryforward per world so
        # queries can compare trader vs holder AFTER liquidation. ----
        last_ord = int(ords[-1])
        liq_tax = np.zeros(W)
        final_basis = np.zeros(W)
        liq_sc = np.zeros(W)
        liq_lc = np.zeros(W)
        net_final = (shares * P[:, -1, :] * (1.0 - r[None, :])).sum(axis=1)
        for wi in range(W):
            st_l = lt_l = co_l = fb = 0.0
            for si in range(S):
                pn = P[wi, -1, si] * (1.0 - r[si])
                fb += sum(lot[3] for lot in lots_pw[wi][si])
                s_, l_, d_ = _perfect_liquidate(lots_pw[wi][si], pn, last_ord,
                                                wash, lot_method, srates[si])
                st_l += s_
                if coll[si]:
                    co_l += l_          # 28%-rate gain, not preferential LT
                else:
                    lt_l += l_
                wash_dis[wi] += d_
            sn = snaps[wi]
            b2, s2, l2 = _sd(sn[0] + st_l, sn[1] + lt_l, sn[6] + co_l, sn[2], sn[3])
            liq_tax[wi] = b2 - sn[4]
            final_basis[wi] = fb
            liq_sc[wi] = s2
            liq_lc[wi] = l2
        tax_out["taxes_paid"] = taxes_paid
        tax_out["wash_disallowed"] = wash_dis
        tax_out["final_basis"] = final_basis
        tax_out["st_carry"] = st_carry.copy()
        tax_out["lt_carry"] = lt_carry.copy()
        tax_out["liq_tax"] = liq_tax
        tax_out["after_liq"] = cash + net_final - liq_tax
        tax_out["liq_st_carry"] = liq_sc
        tax_out["liq_lt_carry"] = liq_lc
        # A world that exits holding an unused capital-loss carryover is NOT
        # holding zero — the carryover offsets ordinary income ($3k/yr) and any
        # future capital gain. Booking it at $0 (what after_liq does) is the
        # CONSERVATIVE bound, and the bias is NOT uniform across lot methods:
        # FIFO worlds end with a leftover carryover about twice as often as HIFO
        # worlds, so scoring on after_liq alone INFLATES the lot lever by ~30%
        # (adversarial audit, 2026-07-13). after_liq_credit is the OPTIMISTIC
        # bound — the carryover valued at the full ordinary rate, i.e. assumed
        # entirely usable. The truth is between the two; rank on both, and if a
        # finding only survives one of them, it is not a finding.
        # With ord_offset_cap > 0 the $3k/yr slice of that carryover has ALREADY
        # been monetized into taxes_paid year by year (§1211(b)), so these two
        # bounds close on each other — which is the point: most of the gap between
        # them was an artifact of not modeling the deduction at all.
        tax_out["after_liq_credit"] = (tax_out["after_liq"]
                                       + (liq_sc + liq_lc) * (tax_rate + state_rate))
        tax_out["bills_by_year"] = bills_yr
        if trace_world is not None:
            tax_out["trades"] = trades_tr

    return equity, max_dd, rebals


# ---------------- vectorized universe generators ----------------

def paths_from_idx(R, firsts, idx):
    """R: [n,S] returns. idx: [W,n]. -> P: [W, n+1, S] prices."""
    sel = R[idx]                                            # [W,n,S]
    growth = np.cumprod(1.0 + sel, axis=1)
    P = np.empty((idx.shape[0], idx.shape[1] + 1, R.shape[1]))
    P[:, 0, :] = firsts[None, :]
    P[:, 1:, :] = firsts[None, None, :] * growth
    return P


def joint_block_idx(W, n, block, rng, pool=None):
    nb = -(-n // block)
    if pool is not None:
        use_pool = rng.random((W, nb)) < 0.5
        pool_starts = pool[rng.integers(0, len(pool), (W, nb))]
        uni_starts = rng.integers(0, n, (W, nb))
        starts = np.where(use_pool, pool_starts, uni_starts)
    else:
        starts = rng.integers(0, n, (W, nb))
    idx = (starts[:, :, None] + np.arange(block)[None, None, :]) % n
    return idx.reshape(W, -1)[:, :n]


def make_worlds(u, ctx, W, rng):
    """ctx: dict with R (hist rets [n,S]), R9, R11, R12, firsts [S], n, mu [S],
    chol [S,S], bear, bull, calm, crisis (np arrays of day indices)."""
    n = ctx["n"]; firsts = ctx["firsts"]
    if u in ("U1", "U7", "U8", "U9", "U11", "U12"):
        pool = {"U7": ctx["bear"], "U8": ctx["bull"]}.get(u)
        R = {"U9": ctx["R9"], "U11": ctx["R11"], "U12": ctx["R12"]}.get(u, ctx["R"])
        return paths_from_idx(R, firsts, joint_block_idx(W, n, 21, rng, pool))
    if u == "U3":
        return paths_from_idx(ctx["R"], firsts, rng.integers(0, n, (W, n)))
    if u == "U2":
        idx = np.empty((W, n), dtype=np.int64)
        cur = rng.integers(0, n, W)
        for j in range(n):
            jump = rng.random(W) < (1.0 / 21.0)
            cur = np.where(jump, rng.integers(0, n, W), (cur + 1) % n)
            idx[:, j] = cur
        return paths_from_idx(ctx["R"], firsts, idx)
    if u == "U10":
        S = ctx["R"].shape[1]
        P = np.empty((W, n + 1, S))
        for s in range(S):
            idx = joint_block_idx(W, n, 21, rng)
            sel = ctx["R"][idx, s]
            P[:, 0, s] = firsts[s]
            P[:, 1:, s] = firsts[s] * np.cumprod(1.0 + sel, axis=1)
        return P
    if u == "U6":
        idx = np.empty((W, n), dtype=np.int64)
        state = np.zeros(W, dtype=bool)  # False=calm
        calm, crisis = ctx["calm"], ctx["crisis"]
        for j in range(n):
            c_pick = calm[rng.integers(0, len(calm), W)]
            x_pick = crisis[rng.integers(0, len(crisis), W)]
            idx[:, j] = np.where(state, x_pick, c_pick)
            state = state ^ (rng.random(W) > 0.95)
        return paths_from_idx(ctx["R"], firsts, idx)
    if u in ("U4", "U5"):
        S = ctx["R"].shape[1]
        z = rng.standard_normal((W, n, S))
        shock = z @ ctx["chol"].T                            # [W,n,S]
        if u == "U5":
            df = 4.0
            chi2 = rng.chisquare(df, (W, n))
            shock = shock * np.sqrt(df / np.maximum(chi2, 1e-9))[:, :, None]
        rets = np.maximum(ctx["mu"][None, None, :] + shock, -0.95)
        P = np.empty((W, n + 1, S))
        P[:, 0, :] = firsts[None, :]
        P[:, 1:, :] = firsts[None, None, :] * np.cumprod(1.0 + rets, axis=1)
        return P
    raise ValueError(u)


def build_ctx_np(syms, series, vti):
    S = len(syms)
    prices = np.array([series[t] for t in syms], dtype=np.float64).T   # [T,S]
    R = prices[1:] / prices[:-1] - 1.0                                  # [n,S]
    n = R.shape[0]
    firsts = prices[0].copy()
    mu = R.mean(axis=0)
    sd = R.std(axis=0)
    cov = np.cov(R.T) if S > 1 else np.array([[R.var()]])
    cov = np.atleast_2d(cov) + np.eye(S) * 1e-12
    chol = np.linalg.cholesky(cov)
    v = np.asarray(vti, dtype=np.float64)
    vret = v[1:] / v[:-1] - 1.0
    fwd = v[np.minimum(np.arange(n) + 21, n)] / v[np.arange(n)] - 1.0
    order = np.argsort(fwd)
    q = max(1, n // 4)
    bear = order[:q].copy()
    bull = order[-q:].copy()
    vols = np.array([vret[max(0, i - 21):i + 1].std() if i > 1 else 0.0 for i in range(n)])
    medv = np.median(vols)
    calm = np.where(vols <= medv)[0]
    crisis = np.where(vols > medv)[0]
    if len(calm) == 0: calm = np.arange(n)
    if len(crisis) == 0: crisis = np.arange(n)
    rbar = R.mean(axis=1)
    blend = 0.7 * (rbar[:, None] - rbar.mean()) + 0.3 * (R - mu[None, :])
    bsd = blend.std(axis=0); bsd[bsd == 0] = 1e-12
    R9 = mu[None, :] + blend * (sd / bsd)[None, :]
    R11 = mu[None, :] + (R - mu[None, :]) * 1.5
    R12 = mu[None, :] + (R - mu[None, :]) * 0.6
    return dict(R=R, R9=R9, R11=R11, R12=R12, n=n, firsts=firsts, mu=mu, chol=chol,
                bear=bear, bull=bull, calm=calm, crisis=crisis)
