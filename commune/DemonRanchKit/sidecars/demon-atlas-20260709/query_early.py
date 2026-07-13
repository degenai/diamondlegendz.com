"""First insight query: everything banked so far vs the fortress benchmark."""
import json
import statistics
from pathlib import Path

VAULT = Path(__file__).parent / "atlas_pairs_fc.jsonl"
UNIS = ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9", "U10", "U11", "U12"]
COMMODITY = {"PDBC", "GLDM", "SLV", "GDX", "XLE"}

cards = {}
for line in VAULT.open(encoding="utf-8"):
    r = json.loads(line)
    if r.get("error"):
        continue
    key = (r["config"], r["policy"])
    p = sum(f > h for f, h in zip(r["finals"], r["holds"])) / len(r["finals"])
    cards.setdefault(key, {})[r["universe"]] = {
        "p": p,
        "med": statistics.median(r["finals"]),
        "med_hold": statistics.median(r["holds"]),
        "med_dd": statistics.median(r["dds"]),
        # insurance metric: P(beat hold | hold in its own worst quartile)
    }
    holds = r["holds"]; finals = r["finals"]
    q25 = sorted(holds)[max(0, len(holds)//4 - 1)]
    bad = [(f, h) for f, h in zip(finals, holds) if h <= q25]
    cards[key][r["universe"]]["p_ins"] = (sum(f > h for f, h in bad) / len(bad)) if bad else None

rows = []
for (cfg, pol), unis in cards.items():
    if len(unis) < 12:
        continue
    wins = sum(1 for u in unis.values() if u["p"] >= 0.5)
    hodl = sum(1 for u in unis.values() if u["med_hold"] >= 600)
    ins = [u["p_ins"] for u in unis.values() if u["p_ins"] is not None]
    rows.append({
        "config": cfg, "policy": pol, "order": cfg.count("/") + 1,
        "wins12": wins, "hodl12": hodl,
        "mean_p": round(statistics.fmean(u["p"] for u in unis.values()), 3),
        "mean_ins": round(statistics.fmean(ins), 3) if ins else None,
        "med_U1": round(unis["U1"]["med"]),
        "commodity": bool(set(cfg.split("/")) & COMMODITY),
    })

rows.sort(key=lambda r: (r["wins12"], r["mean_p"]), reverse=True)
complete = len(rows)
print(f"configs with complete 12-universe cards so far: {complete}")
print()
print("=== THE FORTRESS (benchmark) ===")
for r in rows:
    if r["order"] == 7:
        print(f"  {r['policy']:16s} wins {r['wins12']}/12 hodl {r['hodl12']}/12 "
              f"meanP={r['mean_p']} insuranceP={r['mean_ins']} medU1=${r['med_U1']}")
print()
print("=== TOP 15 COMPLETE PAIRS (by universes won, then mean P) ===")
n = 0
for r in rows:
    if r["order"] != 2:
        continue
    n += 1
    tag = " [CMDTY]" if r["commodity"] else ""
    print(f"  {r['config']:12s} {r['policy']:16s} wins {r['wins12']}/12 hodl {r['hodl12']}/12 "
          f"meanP={r['mean_p']} insP={r['mean_ins']} medU1=${r['med_U1']}{tag}")
    if n >= 15:
        break
print()
print("=== ALL COMPLETE COMMODITY-LEG PAIRS ===")
for r in rows:
    if r["order"] == 2 and r["commodity"]:
        print(f"  {r['config']:12s} {r['policy']:16s} wins {r['wins12']}/12 hodl {r['hodl12']}/12 "
              f"meanP={r['mean_p']} insP={r['mean_ins']}")
