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
from datetime import datetime


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


def simulate_batch(P, weights, policy, dates, rates, order_floor=1.0, capital=1000.0,
                   exec_mode="unit", quantum_bps=0.0):
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

    shares = (capital * w[None, :]) / P[:, 0, :]           # [W,S] fractional
    cash = np.zeros(W)
    peak = np.full(W, capital)
    max_dd = np.zeros(W)
    rebals = np.zeros(W, dtype=np.int64)

    kind = policy["type"]
    if kind == "calendar":
        cmask = calendar_mask(dates, policy["freq"])
    band = float(policy.get("band", 0.0))

    for t in range(T):
        prices = P[:, t, :]                                 # [W,S]
        values = shares * prices
        equity = cash + values.sum(axis=1)
        targets = equity[:, None] * w[None, :]

        if t == 0:
            fire = np.zeros(W, dtype=bool)
        elif kind == "calendar":
            fire = np.full(W, bool(cmask[t]))
        else:  # threshold_pct
            fire = (np.abs(values - targets) >= targets * band).any(axis=1)

        if fire.any():
            fi = np.where(fire)[0]
            sh = shares[fi].copy(); ca = cash[fi].copy(); pr = prices[fi]
            F = len(fi)
            rows = np.arange(F)
            val = sh * pr
            eq = ca + val.sum(axis=1)
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
            for s_i in range(S):
                col = sell_order[:, s_i]
                n_ = notion[rows, col]
                ca += n_ - n_ * r[col]
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
                eq_a = ca[ai] + val_a.sum(axis=1)
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
                else:
                    sh[good, pick] += qg / pr[good, pick]
                    ca[good] -= qg + cost
            shares[fi] = sh; cash[fi] = ca
            rebals[fi] += 1
            values = shares * prices
            equity = cash + values.sum(axis=1)

        peak = np.maximum(peak, equity)
        max_dd = np.minimum(max_dd, equity / peak - 1.0)

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
