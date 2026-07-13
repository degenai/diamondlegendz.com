"""THE ATLAS — exhaustive append-only per-world results database. Phase 1: pairs.

Ruled 2026-07-09 (Alex): the judge is dead — measurement and judgment separate.
This writes RAW per-world outcomes (final, hold-twin final, max DD, rebalances)
for every cell = (config, policy, universe), one JSONL line per cell, 250 worlds
per cell, deterministic seed per cell. NO thresholds, NO cohorts, NO verdicts.
Judging is a query someone runs later; the atlas only accretes.

Append-only + resumable: existing cells are skipped on restart. Deepening
(more worlds/universes/policies/configs) = new lines; nothing is invalidated.

Phase 1 population: all C(32,2)=496 pairs, 50/50 (weight dim is future-additive),
policies threshold_4pct / threshold_5pct / calendar_weekly, the 12 universes,
full-cycle window on the total-return panel.

Run:  python sidecars/demon-atlas-20260709/atlas.py [--procs 6] [--worlds 250]
"""

from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
import os
import random
import statistics
import sys
import time
from multiprocessing import Pool
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))
OUT = Path(__file__).resolve().parent

PANEL = ROOT / "data/derived/total_return_panel_v4_2020_2026.csv"  # 97 symbols (universe-100 engine hunt, 2026-07-11)
DATE_START, DATE_END = "2020-06-01", "2026-06-29"
INITIAL_CAPITAL = 1000.0
BLOCK = 21
POLICIES = {
    "threshold_4pct": {"type": "threshold_pct", "band": 0.04},
    "threshold_5pct": {"type": "threshold_pct", "band": 0.05},
    "calendar_weekly": {"type": "calendar", "freq": "weekly"},
}
UNIVERSES = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9", "U10", "U11", "U12"]
ATLAS_FILE = OUT / "atlas_pairs_fc.jsonl"
SEED_BASE = 20260709

_G = {}  # worker globals: prices, costs; ctx cache


def aligned_n(prices, syms, start, end):
    common = set(prices[syms[0]])
    for s in syms[1:]:
        common &= set(prices[s])
    common = sorted(d for d in common if start <= d <= end)
    return common, {s: [prices[s][d] for d in common] for s in syms}


def cholesky(a):
    n = len(a)
    L = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            s = sum(L[i][k] * L[j][k] for k in range(j))
            L[i][j] = math.sqrt(max(a[i][i] - s, 1e-12)) if i == j else (a[i][j] - s) / L[j][j]
    return L


def build_ctx(syms, series, vti, dates):
    rets = {t: [series[t][i+1]/series[t][i] - 1.0 for i in range(len(series[t])-1)] for t in syms}
    n = len(rets[syms[0]])
    firsts = {t: series[t][0] for t in syms}
    mu = {t: statistics.fmean(rets[t]) for t in syms}
    sd = {t: statistics.pstdev(rets[t]) for t in syms}
    cov = [[statistics.fmean([(rets[a][d]-mu[a])*(rets[b][d]-mu[b]) for d in range(n)])
            for b in syms] for a in syms]
    chol = cholesky(cov)
    vret = [vti[i+1]/vti[i] - 1.0 for i in range(len(vti)-1)]
    fwd = sorted((vti[min(i+BLOCK, n)]/vti[i] - 1.0, i) for i in range(n))
    bear = [i for _, i in fwd[: max(1, len(fwd)//4)]]
    bull = [i for _, i in fwd[-max(1, len(fwd)//4):]]
    vols = []
    for i in range(n):
        lo = max(0, i - BLOCK)
        w = vret[lo:i+1]
        vols.append(statistics.pstdev(w) if len(w) > 2 else 0.0)
    medv = statistics.median(vols)
    calm = [i for i in range(n) if vols[i] <= medv] or list(range(n))
    crisis = [i for i in range(n) if vols[i] > medv] or list(range(n))
    rbar = [statistics.fmean([rets[t][d] for t in syms]) for d in range(n)]
    mubar = statistics.fmean(rbar)
    r9 = {}
    for t in syms:
        blend = [0.7*(rbar[d]-mubar) + 0.3*(rets[t][d]-mu[t]) for d in range(n)]
        bsd = statistics.pstdev(blend) or 1e-12
        r9[t] = [mu[t] + b * sd[t]/bsd for b in blend]
    r11 = {t: [mu[t] + (r-mu[t])*1.5 for r in rets[t]] for t in syms}
    r12 = {t: [mu[t] + (r-mu[t])*0.6 for r in rets[t]] for t in syms}
    return dict(syms=syms, rets=rets, n=n, firsts=firsts, mu=mu, chol=chol,
                bear=bear, bull=bull, calm=calm, crisis=crisis,
                r9=r9, r11=r11, r12=r12, dates=dates, series=series)


def path_from_rets(source, firsts, idx, syms):
    out = {}
    for t in syms:
        r = source[t]
        path = [firsts[t]]
        for i in idx:
            path.append(path[-1] * (1.0 + r[i]))
        out[t] = path
    return out


def joint_block_idx(n, block, rng, pool=None):
    idx = []
    while len(idx) < n:
        start = pool[rng.randrange(len(pool))] if pool and rng.random() < 0.5 else rng.randrange(n)
        idx.extend((start + k) % n for k in range(block))
    return idx[:n]


def make_world(u, ctx, rng):
    syms, n, firsts = ctx["syms"], ctx["n"], ctx["firsts"]
    if u in ("U1", "U7", "U8", "U9", "U11", "U12"):
        pool = {"U7": ctx["bear"], "U8": ctx["bull"]}.get(u)
        src = {"U9": ctx["r9"], "U11": ctx["r11"], "U12": ctx["r12"]}.get(u, ctx["rets"])
        return path_from_rets(src, firsts, joint_block_idx(n, BLOCK, rng, pool), syms)
    if u == "U2":
        idx, i = [], rng.randrange(n)
        while len(idx) < n:
            idx.append(i)
            i = rng.randrange(n) if rng.random() < 1.0/BLOCK else (i + 1) % n
        return path_from_rets(ctx["rets"], firsts, idx, syms)
    if u == "U3":
        return path_from_rets(ctx["rets"], firsts, [rng.randrange(n) for _ in range(n)], syms)
    if u == "U10":
        out = {}
        for t in syms:
            idx = joint_block_idx(n, BLOCK, rng)
            out.update(path_from_rets({t: ctx["rets"][t]}, firsts, idx, (t,)))
        return out
    if u == "U6":
        idx, state = [], "calm"
        for _ in range(n):
            pool = ctx[state]
            idx.append(pool[rng.randrange(len(pool))])
            if rng.random() > 0.95:
                state = "crisis" if state == "calm" else "calm"
        return path_from_rets(ctx["rets"], firsts, idx, syms)
    if u in ("U4", "U5"):
        k, L, mu = len(syms), ctx["chol"], ctx["mu"]
        out = {t: [firsts[t]] for t in syms}
        df = 4.0
        for _ in range(n):
            z = [rng.gauss(0, 1) for _ in range(k)]
            scale = 1.0
            if u == "U5":
                chi2 = 2.0 * rng.gammavariate(df/2.0, 1.0)
                scale = math.sqrt(df / max(chi2, 1e-9))
            for i, t in enumerate(syms):
                shock = sum(L[i][j] * z[j] for j in range(i + 1)) * scale
                r = max(mu[t] + shock, -0.95)
                out[t].append(out[t][-1] * (1.0 + r))
        return out
    raise ValueError(u)


def init_worker():
    from demon_ranch.backtest_duos import load_json, load_prices
    _G["prices"] = load_prices(PANEL)
    _G["costs"] = load_json(ROOT / "configs/costs.default.json")
    _G["ctx"] = {}
    _G["engine"] = os.environ.get("ATLAS_ENGINE", "stdlib")
    _G["exec_mode"] = os.environ.get("ATLAS_EXEC", "unit")
    _G["bps"] = float(os.environ.get("ATLAS_BPS", "0"))
    _G["ctx_np"] = {}


def run_cell(cell):
    try:
        if _G.get("engine") == "v2":  # all orders: v2.1 exact port, bit-parity gate PASS 2026-07-11
            return _run_cell_v2(cell)
        return _run_cell(cell)
    except MemoryError:
        _G["ctx"].clear()
        syms, plabel, universe, worlds = cell
        return {"config": "/".join(syms), "order": len(syms), "weights": "equal",
                "policy": plabel, "universe": universe,
                "window": f"{DATE_START}..{DATE_END}", "panel": "total_return_v2",
                "seed": f"{SEED_BASE}", "worlds": 0, "error": "oom_monster_world",
                "finals": [], "holds": [], "dds": [], "rebalances": []}
    except Exception as e:  # quarantine, don't kill the pool; error cells retry on relaunch
        _G["ctx"].clear()
        syms, plabel, universe, worlds = cell
        return {"config": "/".join(syms), "order": len(syms), "weights": "equal",
                "policy": plabel, "universe": universe,
                "window": f"{DATE_START}..{DATE_END}", "panel": "total_return_v2",
                "seed": f"{SEED_BASE}", "worlds": 0,
                "error": f"worker_exception:{type(e).__name__}: {e}"[:300],
                "finals": [], "holds": [], "dds": [], "rebalances": []}


def _run_cell(cell):
    syms, plabel, universe, worlds = cell
    from demon_ranch.backtest_duos import simulate
    if syms not in _G["ctx"]:
        align_syms = tuple(dict.fromkeys(syms + ("VTI",)))
        dates, series_all = aligned_n(_G["prices"], align_syms, DATE_START, DATE_END)
        _G["ctx"][syms] = build_ctx(syms, {t: series_all[t] for t in syms}, series_all["VTI"], dates)
        if len(_G["ctx"]) > 4:  # bound worker memory
            for k in list(_G["ctx"])[:-2]:
                if k != syms:
                    del _G["ctx"][k]
    ctx = _G["ctx"][syms]
    policy = POLICIES[plabel]
    weights = [1.0 / len(syms)] * len(syms)
    rng = random.Random(f"{SEED_BASE}|{'/'.join(syms)}|{plabel}|{universe}")
    finals, holds, dds, rebs = [], [], [], []
    for _ in range(worlds):
        path = make_world(universe, ctx, rng)
        m = simulate(syms, weights, policy, ctx["dates"], path, _G["costs"], INITIAL_CAPITAL, collect_trades=False)["metrics"]
        finals.append(round(m["final_equity"], 2))
        holds.append(round(sum(INITIAL_CAPITAL * w * path[t][-1] / path[t][0]
                                for w, t in zip(weights, syms)), 2))
        dds.append(round(m["max_drawdown"], 4))
        rebs.append(m["rebalance_count"])
    return {
        "config": "/".join(syms), "order": len(syms), "weights": "equal",
        "policy": plabel, "universe": universe,
        "window": f"{DATE_START}..{DATE_END}", "panel": "total_return_v2",
        "seed": f"{SEED_BASE}", "worlds": worlds,
        "finals": finals, "holds": holds, "dds": dds, "rebalances": rebs,
    }


def _run_cell_v2(cell):
    import numpy as np
    if str(OUT) not in sys.path:
        sys.path.insert(0, str(OUT))
    from engine_v2 import build_ctx_np, make_worlds, simulate_batch
    syms, plabel, universe, worlds = cell
    if syms not in _G["ctx_np"]:
        align_syms = tuple(dict.fromkeys(syms + ("VTI",)))
        dates, series_all = aligned_n(_G["prices"], align_syms, DATE_START, DATE_END)
        ctxn = build_ctx_np(syms, {t: series_all[t] for t in syms}, series_all["VTI"])
        ctxn["dates"] = dates
        _G["ctx_np"][syms] = ctxn
        if len(_G["ctx_np"]) > 6:
            for k in list(_G["ctx_np"])[:-3]:
                if k != syms:
                    del _G["ctx_np"][k]
    ctx = _G["ctx_np"][syms]
    policy = POLICIES[plabel]
    weights = [1.0 / len(syms)] * len(syms)
    costs = _G["costs"]
    rates = np.array([(float(costs.get("spread_bps", {}).get(t, 0.0))
                       + float(costs.get("slippage_bps", 0.0))) / 1e4 for t in syms])
    seed = int.from_bytes(hashlib.sha256(
        ("%s|%s|%s|%s|v2" % (SEED_BASE, "/".join(syms), plabel, universe)).encode()).digest()[:8], "big")
    rng = np.random.default_rng(seed)
    P = make_worlds(universe, ctx, worlds, rng)
    finals, dds, rebs = simulate_batch(P, weights, policy, ctx["dates"], rates,
                                       order_floor=float(costs.get("order_floor_usd", 1.0)),
                                       capital=INITIAL_CAPITAL,
                                       exec_mode=_G.get("exec_mode", "unit"),
                                       quantum_bps=_G.get("bps", 0.0))
    w = np.asarray(weights)
    holds = (INITIAL_CAPITAL * w[None, :] * P[:, -1, :] / P[:, 0, :]).sum(axis=1)
    return {
        "config": "/".join(syms), "order": len(syms), "weights": "equal",
        "policy": plabel, "universe": universe,
        "window": "%s..%s" % (DATE_START, DATE_END), "panel": "total_return_v2",
        "seed": str(seed), "worlds": worlds,
        "engine": ("v3.1-bps%g" % _G["bps"]) if _G.get("bps", 0.0) > 0
                  else ("v2.2-chunked" if _G.get("exec_mode") == "chunked" else "v2"),
        "finals": [round(float(x), 2) for x in finals],
        "holds": [round(float(x), 2) for x in holds],
        "dds": [round(float(x), 4) for x in dds],
        "rebalances": [int(x) for x in rebs],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--procs", type=int, default=6)
    ap.add_argument("--worlds", type=int, default=250)
    ap.add_argument("--engine", choices=["stdlib", "v2"], default="stdlib")
    ap.add_argument("--exec", dest="exec_mode", choices=["unit", "chunked"], default="unit")
    ap.add_argument("--outfile", default=None, help="override vault file (fresh multiverse)")
    ap.add_argument("--bps", type=float, default=0.0, help="v3.1 quantum in bps of equity (0 = flat floor)")
    ap.add_argument("--shard", default=None, help="i/N — run only this machine's hash-partition of the cells (the compute commune, docket 32)")
    args = ap.parse_args()
    os.environ["ATLAS_ENGINE"] = args.engine
    os.environ["ATLAS_EXEC"] = args.exec_mode
    os.environ["ATLAS_BPS"] = str(args.bps)
    global ATLAS_FILE
    if args.outfile:
        ATLAS_FILE = Path(args.outfile) if Path(args.outfile).is_absolute() else OUT / args.outfile
    t0 = time.time()

    from demon_ranch.backtest_duos import load_prices
    symbols = sorted(load_prices(PANEL).keys())
    pairs = sorted(itertools.combinations(symbols, 2))
    # The fortress: benchmark rows queried up-front in every read (Alex, 2026-07-09)
    pairs.insert(0, ("TQQQ", "TLT", "GLDM", "GME", "SGOV", "VEU", "F"))
    # The metronome-7: complete-graph committee — every internal pair is a champion (2026-07-10)
    pairs.insert(1, ("GDX", "EWZ", "SLV", "XLU", "XLP", "PDBC", "GLDM"))
    # ABLATION LATTICE for the strong star (Alex 2026-07-11): leave-one-out quads
    for _c in [("EWW","EZA","SLV","VTI"),      # No-GameStop
               ("EZA","GME","SLV","VTI"),      # No-Mexico
               ("EWW","GME","SLV","VTI"),      # No-SouthAfrica
               ("EWW","EZA","GME","VTI"),      # No-Silver
               ("EWW","EZA","GME","SLV")]:     # No-Market
        pairs.insert(2, _c)
    # Calibrated champions verify (2026-07-11 night): top triangle + the strong pentagram
    pairs.insert(2, ("EWY", "GME", "SLV"))
    pairs.insert(2, ("EWW", "EZA", "GME", "SLV", "VTI"))
    # MONDAY VERIFY BATCH (2026-07-11 census night): committee-level cards for the
    # candidate sheet. Cold lane = top-3 perfect-edge pentagrams from the 97-pool;
    # feast lane (docket, NOT Monday) = the new Sculptor nucleus family.
    for _c in [("DBB","EWU","EWZ","GDX","TUR"),   # perfect pent #1 (meanEdgeP .702)
               ("DBB","EWZ","GDX","INDA","TUR"),  # perfect pent #2
               ("DBB","EWZ","GDX","TUR","XLU"),   # perfect pent #3
               ("ARGT","COPX","F","GME","URA"),   # top elite 5-clique (strong-star candidate)
               ("GME","MSTR","TSLA"),             # new Sculptor triangle (feast lane)
               ("GME","MSTR","TSLA","USO")]:      # Sculptor order-4 (feast lane)
        pairs.insert(2, _c)
    # Compile->screen->VERIFY batch (2026-07-11): clean top-10 compiled order-5 + both pentagrams
    for _c in [("F","GDX","GME","KWEB","SLV"),("F","GME","KWEB","SLV","XLE"),
               ("F","GDX","GME","KWEB","XLE"),("F","GME","KWEB","SLV","SMH"),
               ("F","GME","KWEB","SLV","TLT"),("EWZ","F","GME","KWEB","SLV"),
               ("F","GME","KWEB","SLV","XLU"),("F","GDX","GME","KWEB","SMH"),
               ("F","GME","KWEB","PDBC","SLV"),("EIDO","F","GME","KWEB","SLV"),
               ("ECH","EWZ","GDX","XLP","XLU"),("ECH","EWJ","EWZ","GDX","XLU")]:
        pairs.insert(2, _c)

    done = set()
    if ATLAS_FILE.exists():
        with ATLAS_FILE.open(encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                    if args.engine == "v2" and r.get("error"):
                        continue  # heal OOM-quarantined cells under v2
                    done.add((r["config"], r["policy"], r["universe"]))
                except Exception:
                    pass
    COMMODITY = {"PDBC", "GLDM", "SLV", "GDX", "XLE"}
    def prio(pair):  # fortress first, then commodity-leg pairs, then the rest
        if len(pair) == 7:
            return 0
        return 1 if set(pair) & COMMODITY else 2
    pairs.sort(key=prio)
    cells = [(p, pl, u, args.worlds)
             for p in pairs for pl in POLICIES for u in UNIVERSES
             if ("/".join(p), pl, u) not in done]
    if args.shard:
        i, n = (int(x) for x in args.shard.split("/"))
        assert 1 <= i <= n
        cells = [c for c in cells if int(hashlib.sha256(
            ("%s|%s|%s" % ("/".join(c[0]), c[1], c[2])).encode()).hexdigest(), 16) % n == i - 1]
        print(f"shard {i}/{n}: {len(cells)} cells for this machine", flush=True)
    total = len(pairs) * len(POLICIES) * len(UNIVERSES)
    print(f"atlas phase 1: {total} cells total, {len(done)} done, {len(cells)} to run, "
          f"{args.procs} procs, {args.worlds} worlds/cell", flush=True)

    written = 0
    with ATLAS_FILE.open("a", encoding="utf-8") as out, \
         Pool(processes=args.procs, initializer=init_worker, maxtasksperchild=12) as pool:
        for rec in pool.imap_unordered(run_cell, cells, chunksize=4):
            out.write(json.dumps(rec, separators=(",", ":")) + "\n")
            out.flush()
            written += 1
            if written % 100 == 0 or written == len(cells):
                rate = written / max(1e-9, time.time() - t0)
                eta = (len(cells) - written) / max(1e-9, rate) / 3600
                print(f"[{written}/{len(cells)}] {rate:.1f} cells/s, ETA {eta:.1f}h", flush=True)
    print(f"atlas phase 1 complete: +{written} cells, {time.time()-t0:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
