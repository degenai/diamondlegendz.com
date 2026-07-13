"""UNIVERSE-100 CENSUS REPORT — the 97-symbol periodic table, queried.

Answers, in order:
  1. Elite-edge graph on the full pool (wins>=11 AND hodl>=11 at best policy).
  2. Complete elite k-cliques (k=3,4,5), ranked by CALIBRATED compiled yield.
  3. The Sculptor re-run on the big marble (did the engine hunt find GME peers?).
  4. Engine-hunt verdict: hodlable dispersion engines, ranked.
  5. JSON export for the thisisez data explorer + the Monday candidate sheet.

Run:  python sidecars/demon-atlas-20260709/census_report.py
"""

import itertools
import json
import statistics
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "src"))
from demon_ranch.backtest_duos import load_prices

PANEL = ROOT / "data/derived/total_return_panel_v4_2020_2026.csv"
START, END = "2020-06-01", "2026-06-29"
VAULT = HERE / "atlas_pairs_fc.jsonl"
UNIS = ["U1","U2","U3","U4","U5","U6","U7","U8","U9","U10","U11","U12"]
BLACKLIST = set(json.loads((HERE / "degen_blacklist.json").read_text(encoding="utf-8"))["blacklist"])
CAL = json.loads((HERE / "compiler_calibration.json").read_text(encoding="utf-8"))["coefficients"]

prices = load_prices(PANEL)
symbols = sorted(prices.keys())
idx = {s: i for i, s in enumerate(symbols)}
S = len(symbols)
print(f"panel v4: {S} symbols")

# ---- pairwise V matrix + solo growths (pairwise-aligned, same as calibrate.py) ----
V = np.zeros((S, S))
for a, b in itertools.combinations(symbols, 2):
    common = sorted(set(prices[a]) & set(prices[b]))
    common = [d for d in common if START <= d <= END]
    if len(common) < 252:
        continue
    pa = np.array([prices[a][d] for d in common]); pb = np.array([prices[b][d] for d in common])
    ra = pa[1:] / pa[:-1] - 1.0; rb = pb[1:] / pb[:-1] - 1.0
    V[idx[a], idx[b]] = V[idx[b], idx[a]] = np.var(ra - rb, ddof=1) * 252.0

g_solo = np.zeros(S)
for s in symbols:
    ds = sorted(d for d in prices[s] if START <= d <= END)
    g_solo[idx[s]] = np.log(prices[s][ds[-1]] / prices[s][ds[0]]) / ((len(ds) - 1) / 252.0)

def cal_yield(combo, pol="threshold_4pct"):
    k = len(combo); w2 = 1.0 / (k * k)
    gam = 0.0; disp = 0.0
    for a, b in itertools.combinations(combo, 2):
        i, j = idx[a], idx[b]
        gam += w2 * V[i, j]
        disp += w2 * (g_solo[i] - g_solo[j]) ** 2
    c = CAL[pol]
    return c["kappa"] * 0.5 * gam + c["lambda"] * disp + c["c"]

# ---- read the vault: per-(config,policy) 12-universe pair cards ----
cards = {}
for line in VAULT.open(encoding="utf-8"):
    r = json.loads(line)
    if r.get("error") or r["order"] != 2:
        continue
    key = (r["config"], r["policy"])
    finals, holds = r["finals"], r["holds"]
    if not finals:
        continue
    p = sum(f > h for f, h in zip(finals, holds)) / len(finals)
    q25 = sorted(holds)[max(0, len(holds)//4 - 1)]
    bad = [(f, h) for f, h in zip(finals, holds) if h <= q25]
    cards.setdefault(key, {})[r["universe"]] = {
        "p": p, "med": statistics.median(finals),
        "med_hold": statistics.median(holds),
        "p_ins": (sum(f > h for f, h in bad) / len(bad)) if bad else None,
    }

# best policy per config; elite = wins>=11 and hodl>=11
best = {}
for (cfg, pol), unis in cards.items():
    if len(unis) < 12:
        continue
    syms = tuple(cfg.split("/"))
    if not all(s in idx for s in syms) or (set(syms) & BLACKLIST):
        continue
    wins = sum(1 for u in unis.values() if u["p"] >= 0.5)
    hodl = sum(1 for u in unis.values() if u["med_hold"] >= 600)
    meanp = statistics.fmean(u["p"] for u in unis.values())
    ins = [u["p_ins"] for u in unis.values() if u["p_ins"] is not None]
    row = {"config": cfg, "policy": pol, "wins": wins, "hodl": hodl,
           "mean_p": round(meanp, 3),
           "ins": round(statistics.fmean(ins), 3) if ins else None,
           "med_U1": round(unis["U1"]["med"]), "hold_U1": round(unis["U1"]["med_hold"]),
           "cal": round(cal_yield(syms), 4)}
    cur = best.get(cfg)
    if cur is None or (wins, meanp) > (cur["wins"], cur["mean_p"]):
        best[cfg] = row

complete = list(best.values())
print(f"complete 12-universe pair cards (clean, on-panel): {len(complete)}")

# ---- 1. elite graph ----
elite = [r for r in complete if r["wins"] >= 11 and r["hodl"] >= 11]
nodes = sorted({s for r in elite for s in r["config"].split("/")})
edge_set = {frozenset(r["config"].split("/")) for r in elite}
adj = {n: set() for n in nodes}
for e in edge_set:
    a, b = tuple(e)
    adj[a].add(b); adj[b].add(a)
print(f"\n=== ELITE GRAPH: {len(nodes)} nodes / {len(edge_set)} edges (wins>=11 & hodl>=11) ===")
deg = sorted(((len(adj[n]), n) for n in nodes), reverse=True)
print("top-degree nodes:", ", ".join(f"{n}({d})" for d, n in deg[:15]))

# ---- 2. complete elite k-cliques, calibrated ----
def extend(clique, cand):
    out = []
    for c in sorted(cand):
        out.append(clique + (c,))
    return out

cliques = {2: [tuple(sorted(e)) for e in edge_set]}
for k in (3, 4, 5, 6):
    found = set()
    for cl in cliques[k-1]:
        cand = set.intersection(*(adj[n] for n in cl)) - set(cl)
        for c in cand:
            found.add(tuple(sorted(cl + (c,))))
    cliques[k] = sorted(found)
    print(f"complete elite {k}-cliques: {len(found)}")

leader = {}
for k in (3, 4, 5):
    ranked = sorted(cliques[k], key=cal_yield, reverse=True)
    leader[k] = ranked
    print(f"\n=== TOP 10 ELITE {k}-CLIQUES by calibrated yield (t4) ===")
    for cl in ranked[:10]:
        print(f"  {cal_yield(cl):+.4f}  {'/'.join(cl)}")

# ---- 3. the Sculptor on the big marble ----
print("\n=== THE SCULPTOR — greedy carve from the full clean pool ===")
pool = [s for s in symbols if s not in BLACKLIST]
combo = list(pool)
path = []
while len(combo) > 2:
    best_y, best_drop = -9e9, None
    for drop in combo:
        rest = tuple(s for s in combo if s != drop)
        y = cal_yield(rest)
        if y > best_y:
            best_y, best_drop = y, drop
    combo.remove(best_drop)
    path.append((len(combo), best_drop, best_y, tuple(combo)))
for n, dropped, y, c in path:
    if n <= 7:
        print(f"  order {n}: dropped {dropped:5s} -> {y:+.4f}  {'/'.join(c)}")

# ---- 4. engine-hunt verdict ----
print("\n=== ENGINE HUNT: hodlable dispersion engines ===")
print("(engine score = mean spread variance vs rest of clean pool; hodlable = solo growth > 0, non-blacklist)")
rows = []
pool_i = [idx[s] for s in pool]
for s in pool:
    i = idx[s]
    vrow = [V[i, j] for j in pool_i if j != i and V[i, j] > 0]
    if not vrow:
        continue
    rows.append((float(np.mean(vrow)), s, float(g_solo[i])))
rows.sort(reverse=True)
for score, s, g in rows[:15]:
    tag = "ENGINE" if g > 0 else "corpse-drift"
    print(f"  {s:6s} engine_score={score:.4f}  solo_growth={g:+.3f}/yr  [{tag}]")

# ---- 5. exports ----
export = {
    "generated": "2026-07-11",
    "panel": "total_return_panel_v4_2020_2026 (97 symbols)",
    "pairs_complete": len(complete),
    "elite_nodes": len(nodes), "elite_edges": len(edge_set),
    "top_pairs": sorted(complete, key=lambda r: (r["wins"], r["mean_p"]), reverse=True)[:40],
    "elite_cliques": {str(k): [{"combo": "/".join(cl), "cal_yield": round(cal_yield(cl), 4)}
                               for cl in leader[k][:15]] for k in (3, 4, 5)},
    "sculptor_path": [{"order": n, "dropped": d, "cal_yield": round(y, 4), "combo": "/".join(c)}
                      for n, d, y, c in path if n <= 10],
    "engines": [{"symbol": s, "engine_score": round(sc, 4), "solo_growth": round(g, 3)}
                for sc, s, g in rows[:20]],
}
(HERE / "census_20260711.json").write_text(json.dumps(export, indent=1), encoding="utf-8")
print(f"\nsaved: census_20260711.json")
