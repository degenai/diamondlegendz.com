"""Run Demon Ranch v0 duo-demon backtests.

Stdlib-only. Uses preliminary price-return daily close data for the first
scaffold pass; verified total-return data is a future data contract upgrade.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple

from .avatar import avatar
from .doctrine import assert_valid_doctrine, caveats, doctrine_summary, load_doctrine, policy_fidelity, policy_provenance, public_disclaimer, unmodeled_mechanics

TRADING_DAYS = 252
# Minimum aligned trading dates for any simulated window; demon_ranch.windows
# enforces the same floor when resolving timeframe specs.
MIN_ALIGNED_DAYS = 30


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def policy_label(policy: Mapping[str, object]) -> str:
    t = policy["type"]
    if t == "buy_and_hold":
        base = "buy_hold"
    elif t == "calendar":
        base = f"calendar_{policy['freq']}"
    elif t == "threshold_pct":
        base = f"threshold_{int(round(float(policy['band']) * 100))}pct"
    elif t == "dollar_first":
        base = f"dollar_first_{float(policy['drift_usd']):.0f}usd"
    elif t == "microbite":
        if policy.get("bite_pct_of_equity") is not None:
            base = f"microbite_{float(policy['bite_pct_of_equity']) * 10000:.0f}bps_x{int(policy.get('max_bites_per_day', 1))}"
        else:
            base = f"microbite_{float(policy.get('bite_usd', 1.0)):.0f}usd_x{int(policy.get('max_bites_per_day', 1))}"
        if policy.get("routing") == "demon":
            base += "_demon"
    else:
        base = str(t)
    if policy.get("gate"):
        base += "_gated"
    return base


def safe_name(pair: Sequence[str], weights: Sequence[float], policy: Mapping[str, object]) -> str:
    pair_bit = f"{pair[0]}-{pair[1]}"
    weight_bit = f"{int(weights[0]*100)}-{int(weights[1]*100)}"
    return f"{pair_bit}_{weight_bit}_{policy_label(policy)}"


def config_hash(obj: object) -> str:
    payload = json.dumps(obj, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def semantic_run_fingerprint(pair: Sequence[str], weights: Sequence[float], policy: Mapping[str, object], costs: Mapping[str, object], config: Mapping[str, object], doctrine: Mapping[str, object]) -> str:
    """Fingerprint semantic inputs only; exclude wall-clock metadata."""
    meta = config.get("meta", {}) if isinstance(config.get("meta", {}), Mapping) else {}
    payload = {
        "pair": list(pair),
        "weights": list(weights),
        "policy": dict(policy),
        "costs": costs,
        "date_range": config.get("date_range", {}),
        "initial_capital_usd": config.get("initial_capital_usd"),
        "prices_panel_csv": config.get("prices_panel_csv"),
        "data_note": meta.get("data_note"),
        "lab_doctrine_id": doctrine.get("doctrine_id"),
        "canonical_live_policy": doctrine.get("canonical_live_policy", {}),
    }
    return config_hash(payload)


def load_prices(path: Path) -> Dict[str, Dict[str, float]]:
    prices: Dict[str, Dict[str, float]] = {}
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                close = float(row["close"])
            except (TypeError, ValueError):
                continue
            prices.setdefault(row["ticker"].upper(), {})[row["date"]] = close
    return prices


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def aligned_series(prices: Mapping[str, Mapping[str, float]], pair: Sequence[str], start: str, end: str) -> Tuple[List[str], Dict[str, List[float]]]:
    a, b = pair[0].upper(), pair[1].upper()
    common = sorted(set(prices[a]).intersection(prices[b]))
    common = [d for d in common if d >= start and d <= end]
    if len(common) < MIN_ALIGNED_DAYS:
        raise ValueError(f"Not enough aligned dates for {pair}: {len(common)}")
    return common, {a: [prices[a][d] for d in common], b: [prices[b][d] for d in common]}


def daily_returns(values: Sequence[float]) -> List[float]:
    return [(values[i] / values[i - 1] - 1.0) for i in range(1, len(values)) if values[i - 1] > 0]


def drawdowns(values: Sequence[float]) -> List[float]:
    peak = values[0]
    out = []
    for v in values:
        peak = max(peak, v)
        out.append(v / peak - 1.0 if peak else 0.0)
    return out


def max_time_underwater(values: Sequence[float]) -> int:
    peak = values[0]
    current = 0
    max_run = 0
    for v in values:
        if v >= peak:
            peak = v
            current = 0
        else:
            current += 1
            max_run = max(max_run, current)
    return max_run


def annual_factor(n_values: int) -> float:
    return TRADING_DAYS / max(1, n_values - 1)


def metric_panel(values: Sequence[float], turnover_usd: float, cost_usd: float, rebalance_count: int, sell_count: int) -> Dict[str, float]:
    rets = daily_returns(values)
    ann = annual_factor(len(values))
    start, end = values[0], values[-1]
    years = max(1 / TRADING_DAYS, (len(values) - 1) / TRADING_DAYS)
    cagr = (end / start) ** (1 / years) - 1 if start > 0 and end > 0 else 0.0
    log_growth_ann = math.log(end / start) / years if start > 0 and end > 0 else 0.0
    vol = statistics.pstdev(rets) * math.sqrt(TRADING_DAYS) if len(rets) > 1 else 0.0
    avg = statistics.mean(rets) if rets else 0.0
    sharpe = (avg / statistics.pstdev(rets) * math.sqrt(TRADING_DAYS)) if len(rets) > 1 and statistics.pstdev(rets) else 0.0
    downside = [min(0.0, r) for r in rets]
    downside_dev = statistics.pstdev(downside) if len(downside) > 1 else 0.0
    sortino = (avg / downside_dev * math.sqrt(TRADING_DAYS)) if downside_dev else 0.0
    dds = drawdowns(values)
    avg_equity = statistics.mean(values) if values else start
    turnover_ann = (turnover_usd / avg_equity) * ann if avg_equity else 0.0
    return {
        "final_equity": end,
        "cagr": cagr,
        "log_growth_ann": log_growth_ann,
        "vol_ann": vol,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": min(dds) if dds else 0.0,
        "time_underwater_days": max_time_underwater(values),
        "turnover_ann": turnover_ann,
        "rebalance_count": rebalance_count,
        "cost_usd": cost_usd,
        "tax_event_proxy_sell_count": sell_count,
    }


def corr(xs: Sequence[float], ys: Sequence[float]) -> float:
    if len(xs) < 2 or len(ys) < 2:
        return 0.0
    n = min(len(xs), len(ys))
    x, y = xs[-n:], ys[-n:]
    mx, my = statistics.mean(x), statistics.mean(y)
    vx = sum((a - mx) ** 2 for a in x)
    vy = sum((b - my) ** 2 for b in y)
    if vx <= 0 or vy <= 0:
        return 0.0
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / math.sqrt(vx * vy)


def should_rebalance(policy: Mapping[str, object], i: int, dates: Sequence[str], values: Mapping[str, float], equity: float, targets: Mapping[str, float]) -> Tuple[bool, str]:
    if i == 0 or policy["type"] == "buy_and_hold":
        return False, ""
    t = policy["type"]
    if t == "calendar":
        freq = policy["freq"]
        if freq == "daily":
            return True, "daily"
        today = datetime.fromisoformat(dates[i])
        prev = datetime.fromisoformat(dates[i - 1])
        if freq == "weekly" and today.isocalendar()[:2] != prev.isocalendar()[:2]:
            return True, "weekly"
        if freq == "monthly" and (today.year, today.month) != (prev.year, prev.month):
            return True, "monthly"
    if t == "threshold_pct":
        band = float(policy["band"])
        for ticker, target in targets.items():
            if target and abs(values[ticker] - target) >= target * band:
                return True, f"threshold_pct_{band:.4f}"
    if t == "dollar_first":
        drift = float(policy["drift_usd"])
        for ticker, target in targets.items():
            if abs(values[ticker] - target) >= drift:
                return True, f"dollar_first_{drift:.2f}"
    return False, ""


def execute_microbite(pair: Sequence[str], prices_today: Mapping[str, float], shares: Dict[str, float], cash: float, target_weights: Mapping[str, float], costs: Mapping[str, object], bite: float, max_bites: int, *, blocked: "frozenset[str]" = frozenset(), pair_scorer=None) -> Tuple[float, float, int, List[dict]]:
    """v2.7a pair-spread microbite: sell `bite` USD from the richest sleeve, buy into the
    poorest, at most `max_bites` per day, only when both legs sit beyond the $1 lines.
    Gate-blocked tickers are excluded from the BUY leg only (trims stay legal)."""

    def rate(ticker: str) -> float:
        spread = float(costs.get("spread_bps", {}).get(ticker, 0.0))
        slip = float(costs.get("slippage_bps", 0.0))
        return (spread + slip) / 10000.0

    trades: List[dict] = []
    total_cost = 0.0
    sell_count = 0
    for _ in range(max_bites):
        values = {t: shares[t] * prices_today[t] for t in pair}
        equity = cash + sum(values.values())
        targets = {t: equity * target_weights[t] for t in pair}
        rich_candidates = [t for t in pair if values[t] - targets[t] >= bite]
        poor_candidates = [t for t in pair if targets[t] - values[t] >= bite and t not in blocked]
        if not rich_candidates or not poor_candidates:
            break
        if pair_scorer is not None:
            # Demon routing: among qualifying legs, take the pair with the highest
            # spread variance — the Shannon-yield-maximizing route.
            rich, poor = max(
                ((r, p) for r in rich_candidates for p in poor_candidates if r != p),
                key=lambda rp: pair_scorer(rp[0], rp[1]),
            )
        else:
            rich = max(rich_candidates, key=lambda t: values[t] - targets[t])
            poor = max(poor_candidates, key=lambda t: targets[t] - values[t])
        sell_cost = bite * rate(rich)
        shares[rich] -= bite / prices_today[rich]
        cash += bite - sell_cost
        sell_count += 1
        trades.append({"ticker": rich, "side": "sell", "usd": bite, "shares": bite / prices_today[rich], "price": prices_today[rich], "cost": sell_cost, "units": 1})
        buy_cost = bite * rate(poor)
        if cash + 1e-12 < bite + buy_cost:
            break
        shares[poor] += bite / prices_today[poor]
        cash -= bite + buy_cost
        trades.append({"ticker": poor, "side": "buy", "usd": bite, "shares": bite / prices_today[poor], "price": prices_today[poor], "cost": buy_cost, "units": 1})
        total_cost += sell_cost + buy_cost
    return cash, total_cost, sell_count, trades


def deploy_contribution(pair: Sequence[str], prices_today: Mapping[str, float], shares: Dict[str, float], cash: float, target_weights: Mapping[str, float], costs: Mapping[str, object], mode: str, *, blocked: "frozenset[str]" = frozenset()) -> Tuple[float, float, List[dict]]:
    """Deploy drip cash same-day, buy-only. `pro_rata` buys at target weights with
    cost-adjusted notionals so the drip covers notional + cost exactly (the naive
    DCA packet); `dispersion_first` routes whole $1 units to the most-underweight
    sleeve, sweeping idle cash down below the order floor (free rebalancing —
    contributions do the demon's buying without a taxable sell)."""

    def rate(ticker: str) -> float:
        spread = float(costs.get("spread_bps", {}).get(ticker, 0.0))
        slip = float(costs.get("slippage_bps", 0.0))
        return (spread + slip) / 10000.0

    order_floor = float(costs.get("order_floor_usd", 1.0))
    trades: List[dict] = []
    total_cost = 0.0
    if mode == "pro_rata":
        budget = cash
        for t in pair:
            r = rate(t)
            notional = budget * target_weights[t] / (1.0 + r)
            if notional <= 0.0:
                continue
            cost = notional * r
            qty = notional / prices_today[t]
            shares[t] += qty
            cash -= notional + cost
            total_cost += cost
            trades.append({"ticker": t, "side": "buy", "usd": notional, "shares": qty, "price": prices_today[t], "cost": cost, "units": 1})
    elif mode == "dispersion_first":
        while True:
            candidates = [t for t in pair if t not in blocked]
            if not candidates:
                break
            values = {t: shares[t] * prices_today[t] for t in pair}
            equity = cash + sum(values.values())
            targets = {t: equity * target_weights[t] for t in pair}
            t = max(candidates, key=lambda x: targets[x] - values[x])
            r = rate(t)
            if cash + 1e-12 < order_floor * (1.0 + r):
                break
            cost = order_floor * r
            qty = order_floor / prices_today[t]
            shares[t] += qty
            cash -= order_floor + cost
            total_cost += cost
            trades.append({"ticker": t, "side": "buy", "usd": order_floor, "shares": qty, "price": prices_today[t], "cost": cost, "units": 1})
    else:
        raise ValueError(f"unknown contribution_mode: {mode}")
    return cash, total_cost, trades


def execute_rebalance(pair: Sequence[str], prices_today: Mapping[str, float], shares: Dict[str, float], cash: float, target_weights: Mapping[str, float], costs: Mapping[str, object], order_floor: float, *, blocked: "frozenset[str]" = frozenset()) -> Tuple[float, float, int, List[dict]]:
    values = {t: shares[t] * prices_today[t] for t in pair}
    equity = cash + sum(values.values())
    targets = {t: equity * target_weights[t] for t in pair}
    deltas = {t: targets[t] - values[t] for t in pair}
    trades: List[dict] = []
    total_cost = 0.0
    sell_count = 0

    def rate(ticker: str) -> float:
        spread = float(costs.get("spread_bps", {}).get(ticker, 0.0))
        slip = float(costs.get("slippage_bps", 0.0))
        return (spread + slip) / 10000.0

    def floor_unit(amount: float) -> float:
        return math.floor((amount + 1e-12) / order_floor) * order_floor

    def current_state() -> Tuple[Dict[str, float], float, Dict[str, float], Dict[str, float]]:
        vals = {t: shares[t] * prices_today[t] for t in pair}
        eq = cash + sum(vals.values())
        tgts = {t: eq * target_weights[t] for t in pair}
        dlts = {t: tgts[t] - vals[t] for t in pair}
        return vals, eq, tgts, dlts

    # Sells first to fund buys. Trim only whole executable dollar units so the
    # simulator mirrors the Robinhood lab's $1 floor instead of pretending
    # sub-dollar drift is actionable.
    for t in sorted(pair, key=lambda x: deltas[x]):
        delta = deltas[t]
        if delta <= -order_floor:
            notional = floor_unit(min(-delta, shares[t] * prices_today[t]))
            if notional >= order_floor:
                cost = notional * rate(t)
                qty = notional / prices_today[t]
                shares[t] -= qty
                cash += notional - cost
                total_cost += cost
                sell_count += 1
                trades.append({"ticker": t, "side": "sell", "usd": notional, "shares": qty, "price": prices_today[t], "cost": cost, "units": int(round(notional / order_floor))})

    # Buy in whole-$1 units, most-underweight first. Recompute after each unit
    # and skip candidates where the next unit would overshoot target.
    while True:
        values, equity, targets, deltas = current_state()
        # Gate: blocked tickers take no new adds (v2.3a); trims above remain legal.
        candidates = [t for t in sorted(pair, key=lambda x: deltas[x], reverse=True) if deltas[t] >= order_floor and t not in blocked]
        bought = False
        for t in candidates:
            r = rate(t)
            notional = order_floor
            if cash + 1e-12 < notional * (1 + r):
                continue
            if deltas[t] + 1e-12 < notional:
                continue
            cost = notional * r
            qty = notional / prices_today[t]
            shares[t] += qty
            cash -= notional + cost
            total_cost += cost
            trades.append({"ticker": t, "side": "buy", "usd": notional, "shares": qty, "price": prices_today[t], "cost": cost, "units": 1})
            bought = True
            break
        if not bought:
            break

    return cash, total_cost, sell_count, trades


def simulate(pair: Sequence[str], weights: Sequence[float], policy: Mapping[str, object], dates: Sequence[str], series: Mapping[str, Sequence[float]], costs: Mapping[str, object], initial_capital: float, *, gate_off: "set[str] | None" = None, gate_blocks: "Sequence[str] | None" = None, contributions: "Mapping[str, float] | None" = None, contribution_mode: str = "dispersion_first", observe_days: "set[str] | None" = None, collect_trades: bool = True) -> Dict[str, object]:
    pair = [p.upper() for p in pair]
    if len(pair) < 2:
        raise ValueError("simulate requires at least two assets")
    if len(weights) != len(pair):
        raise ValueError(f"weights length {len(weights)} must match asset count {len(pair)}")
    weight_values = [float(w) for w in weights]
    if not math.isclose(sum(weight_values), 1.0, rel_tol=0.0, abs_tol=1e-9):
        raise ValueError("weights must sum to 1.0")
    wmap = {ticker: weight_values[i] for i, ticker in enumerate(pair)}
    first_prices = {t: series[t][0] for t in pair}
    shares = {t: (initial_capital * wmap[t]) / first_prices[t] for t in pair}
    cash = 0.0
    curve: List[float] = []
    weight_path: List[dict] = []
    trade_log: List[dict] = []
    rebalance_log: List[dict] = []
    total_turnover = 0.0
    total_cost = 0.0
    total_sells = 0
    total_contrib = 0.0
    order_floor = float(costs.get("order_floor_usd", 1.0))
    gate_block_set = frozenset(str(t).upper() for t in gate_blocks) if gate_blocks else frozenset()
    gate_off_set = gate_off or set()

    for i, date in enumerate(dates):
        today_prices = {t: series[t][i] for t in pair}
        values = {t: shares[t] * today_prices[t] for t in pair}
        equity = cash + sum(values.values())
        targets = {t: equity * wmap[t] for t in pair}
        blocked = gate_block_set if date in gate_off_set else frozenset()
        if contributions:
            contrib = float(contributions.get(date, 0.0))
            if contrib > 0.0:
                cash += contrib
                total_contrib += contrib
                cash, c_cost, c_trades = deploy_contribution(pair, today_prices, shares, cash, wmap, costs, contribution_mode, blocked=blocked)
                total_cost += c_cost
                total_turnover += sum(tr["usd"] for tr in c_trades)
                if collect_trades:
                    for tr in c_trades:
                        trade_log.append({"date": date, **tr})
                values = {t: shares[t] * today_prices[t] for t in pair}
                equity = cash + sum(values.values())
                targets = {t: equity * wmap[t] for t in pair}
        is_microbite = policy["type"] == "microbite" and i > 0
        # Loose supervision: on unobserved days the human never looks, so the
        # microbite cannot fire. Drift accrues and is corrected on the next
        # observed day. Inert (observe every day) when observe_days is None.
        observed = observe_days is None or date in observe_days
        if is_microbite and observed:
            pct = policy.get("bite_pct_of_equity")
            bite = max(order_floor, equity * float(pct)) if pct is not None else float(policy.get("bite_usd", 1.0))
            has_rich = any(values[t] - targets[t] >= bite for t in pair)
            has_poor = any(targets[t] - values[t] >= bite for t in pair if t not in blocked)
            fire, reason = (has_rich and has_poor), "microbite"
            scorer = None
            if fire and policy.get("routing") == "demon":
                lookback = int(policy.get("demon_lookback_days", 63))
                lo = max(1, i - lookback)

                def scorer(a: str, b: str, _lo=lo, _hi=i) -> float:
                    spread = [
                        (series[a][j] / series[a][j - 1] - 1.0) - (series[b][j] / series[b][j - 1] - 1.0)
                        for j in range(_lo, _hi + 1)
                    ]
                    if len(spread) < 2:
                        return 0.0
                    mu = sum(spread) / len(spread)
                    return sum((x - mu) ** 2 for x in spread) / (len(spread) - 1)
        elif is_microbite:
            # microbite policy, but today is unobserved: no action, drift carries.
            fire, reason, scorer = False, "unobserved", None
        else:
            fire, reason = should_rebalance(policy, i, dates, values, equity, targets)
        trades: List[dict] = []
        if fire:
            before_drift = {t: values[t] - targets[t] for t in pair}
            if is_microbite:
                cash, cost, sell_count, trades = execute_microbite(pair, today_prices, shares, cash, wmap, costs, bite, int(policy.get("max_bites_per_day", 1)), blocked=blocked, pair_scorer=scorer)
            else:
                cash, cost, sell_count, trades = execute_rebalance(pair, today_prices, shares, cash, wmap, costs, order_floor, blocked=blocked)
            total_cost += cost
            total_sells += sell_count
            total_turnover += sum(t["usd"] for t in trades)
            values_after = {t: shares[t] * today_prices[t] for t in pair}
            equity_after = cash + sum(values_after.values())
            targets_after = {t: equity_after * wmap[t] for t in pair}
            rebalance_log.append({
                "date": date,
                "reason": reason,
                "trade_count": len(trades),
                "turnover_usd": sum(t["usd"] for t in trades),
                "cost_usd": cost,
                "before_drift": before_drift,
                "after_drift": {t: values_after[t] - targets_after[t] for t in pair},
            })
            if collect_trades:
                for tr in trades:
                    trade_log.append({"date": date, **tr})
            values = values_after
            equity = equity_after
            targets = targets_after

        curve.append(equity)
        weight_path.append({t: (values[t] / equity if equity else 0.0) for t in pair} | {"cash": cash, "date": date})

    metrics = metric_panel(curve, total_turnover, total_cost, len(rebalance_log), total_sells)
    if contributions is not None:
        metrics["total_contributions"] = total_contrib
    ra, rb = daily_returns(series[pair[0]]), daily_returns(series[pair[1]])
    metrics["corr_full"] = corr(ra, rb)
    metrics["corr_63d"] = corr(ra[-63:], rb[-63:]) if len(ra) >= 63 else metrics["corr_full"]
    pairwise = []
    for i, left in enumerate(pair):
        for right in pair[i + 1 :]:
            pairwise.append(corr(daily_returns(series[left]), daily_returns(series[right])))
    metrics["avg_pairwise_corr_full"] = statistics.mean(pairwise) if pairwise else 0.0
    metrics["asset_count"] = len(pair)
    metrics["days"] = len(dates)
    return {"curve": curve, "weights_path": weight_path, "trades": trade_log, "rebalances": rebalance_log, "metrics": metrics}


def decimate(dates: Sequence[str], values: Sequence[float], max_points: int = 96) -> List[dict]:
    dds = drawdowns(values)
    if len(values) <= max_points:
        idxs = list(range(len(values)))
    else:
        idxs = sorted({round(i * (len(values) - 1) / (max_points - 1)) for i in range(max_points)})
    start = values[0]
    return [{"date": dates[i], "equity_norm": values[i] / start if start else 0.0, "drawdown": dds[i]} for i in idxs]


def write_csv(path: Path, rows: Sequence[Mapping[str, object]], fieldnames: Sequence[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def update_run_index(path: Path, row: Mapping[str, object]) -> None:
    fieldnames = ["run_id", "generated_utc", "rows", "leaderboard", "dashboard_data", "data_note"]
    existing: list[dict] = []
    if path.exists():
        with path.open(newline="", encoding="utf-8") as f:
            existing = list(csv.DictReader(f))
    by_id = {r["run_id"]: r for r in existing if r.get("run_id")}
    by_id[str(row["run_id"])] = {k: str(row.get(k, "")) for k in fieldnames}
    write_csv(path, list(by_id.values()), fieldnames)


def run(config_path: Path, run_id: str | None = None) -> dict:
    config_path = config_path.resolve()
    root = config_path.parents[1] if config_path.parent.name == "configs" else Path.cwd().resolve()
    config = load_json(config_path)
    costs_path = root / config["costs"]
    traits_path = root / config["asset_traits"]
    prices_path = root / config["prices_panel_csv"]
    doctrine_path = root / config.get("meta", {}).get("lab_doctrine", "configs/lab_doctrine.json")
    costs = load_json(costs_path)
    traits = load_json(traits_path)
    doctrine = load_doctrine(doctrine_path)
    assert_valid_doctrine(doctrine, traits)
    prices = load_prices(prices_path)
    start = config["date_range"]["start"]
    end = config["date_range"]["end"]
    initial_capital = float(config["initial_capital_usd"])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_id = run_id or f"duo_v0_{stamp}"
    run_dir = root / config["output_root"] / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    data_claims = doctrine.get("data_claims", {}) if isinstance(doctrine.get("data_claims", {}), Mapping) else {}
    price_source = {
        "file": str(Path(config["prices_panel_csv"])),
        "sha256": file_sha256(prices_path),
        "symbols": sorted(prices.keys()),
        "date_min": min(min(v) for v in prices.values()),
        "date_max": max(max(v) for v in prices.values()),
    }
    quality_report_path = root / config.get("quality_report_json", "data/quality/price_quality_v1.json")
    quality_report = None
    if quality_report_path.exists():
        quality_report = load_json(quality_report_path)
        price_source["quality_report"] = str(quality_report_path.relative_to(root))
        price_source["quality_report_sha256"] = file_sha256(quality_report_path)
        price_source["return_basis"] = quality_report.get("return_basis")
        price_source["total_return_available"] = quality_report.get("total_return_available")
    rows: List[dict] = []
    details: List[dict] = []
    baseline_by_key: Dict[Tuple[str, str, str], float] = {}
    single_by_pair: Dict[str, float] = {}

    for pair in config["pairs"]:
        dates, series = aligned_series(prices, pair, start, end)
        pair_label = f"{pair[0]}/{pair[1]}"
        years = max(1 / TRADING_DAYS, (len(dates) - 1) / TRADING_DAYS)
        single_by_pair[pair_label] = max(math.log(series[pair[0]][-1] / series[pair[0]][0]) / years, math.log(series[pair[1]][-1] / series[pair[1]][0]) / years)
        for weights in config["weights"]:
            for policy in config["policies"]:
                sim = simulate(pair, weights, policy, dates, series, costs, initial_capital)
                label = policy_label(policy)
                run_name = safe_name(pair, weights, policy)
                metric = dict(sim["metrics"])
                row = {
                    "run_name": run_name,
                    "pair": pair_label,
                    "asset_a": pair[0],
                    "asset_b": pair[1],
                    "weight_a": weights[0],
                    "weight_b": weights[1],
                    "weight_label": f"{int(weights[0]*100)}/{int(weights[1]*100)}",
                    "policy": label,
                    "policy_provenance": policy_provenance(label, doctrine),
                    "policy_fidelity": policy_fidelity(label, doctrine),
                    "unmodeled_mechanics_count": len(unmodeled_mechanics(doctrine)),
                    "is_simulated": str(bool(data_claims.get("is_simulated", True))).lower(),
                    "data_basis": str(data_claims.get("data_basis", "historical_daily_price_return_preliminary")),
                    "window_start": dates[0],
                    "window_end": dates[-1],
                    "config_hash": semantic_run_fingerprint(pair, weights, policy, costs, config, doctrine),
                    **metric,
                }
                key = (pair_label, row["weight_label"], label)
                if label == "buy_hold":
                    baseline_by_key[(pair_label, row["weight_label"], "baseline")] = metric["log_growth_ann"]
                av = avatar(pair, weights, traits, status="idle")
                row["avatar_alt"] = av["alt"]
                detail = {
                    **row,
                    "avatar": av,
                    "curve": decimate(dates, sim["curve"]),
                    "trades_preview": sim["trades"][:10],
                    "rebalance_preview": sim["rebalances"][:10],
                }
                rows.append(row)
                details.append(detail)

    for row, detail in zip(rows, details):
        baseline = baseline_by_key.get((row["pair"], row["weight_label"], "baseline"), row["log_growth_ann"])
        row["demon_yield_ann"] = row["log_growth_ann"] - baseline
        detail["demon_yield_ann"] = row["demon_yield_ann"]
        row["excess_vs_best_single_ann"] = row["log_growth_ann"] - single_by_pair[row["pair"]]
        detail["excess_vs_best_single_ann"] = row["excess_vs_best_single_ann"]

    rows.sort(key=lambda r: (r["demon_yield_ann"], r["sharpe"]), reverse=True)
    detail_by_name = {d["run_name"]: d for d in details}
    details_sorted = [detail_by_name[r["run_name"]] for r in rows]

    fieldnames = [
        "run_name", "pair", "weight_label", "policy", "policy_provenance", "policy_fidelity", "unmodeled_mechanics_count", "is_simulated", "data_basis", "window_start", "window_end", "days", "final_equity",
        "cagr", "log_growth_ann", "demon_yield_ann", "excess_vs_best_single_ann", "vol_ann", "sharpe", "sortino",
        "max_drawdown", "time_underwater_days", "turnover_ann", "rebalance_count", "cost_usd", "tax_event_proxy_sell_count",
        "corr_full", "corr_63d", "config_hash", "avatar_alt",
    ]
    write_csv(run_dir / "leaderboard.csv", rows, fieldnames)
    reports_dir = root / "backtests" / "reports"
    write_csv(reports_dir / "duo_v0_latest_leaderboard.csv", rows, fieldnames)

    dashboard = {
        "generated_utc": stamp,
        "run_id": run_id,
        "data_note": config["meta"].get("data_note", ""),
        "simulation_disclaimer": public_disclaimer(doctrine),
        "caveats": caveats(doctrine),
        "is_simulated": bool(data_claims.get("is_simulated", True)),
        "data_basis": str(data_claims.get("data_basis", "historical_daily_price_return_preliminary")),
        "initial_capital_usd": initial_capital,
        "price_source": price_source,
        "data_quality": quality_report,
        "lab_doctrine": doctrine_summary(doctrine),
        "unmodeled_mechanics": unmodeled_mechanics(doctrine),
        "fidelity_note": "Rows labeled live_canonical match the doctrine policy label but remain simulated approximations; no broker orders are placed and several live mechanics remain unmodeled.",
        "rows": details_sorted,
        "sidecar_notes": {
            "dashboard_product": "sidecars/results/dashboard-product.md",
            "avatar_system": "sidecars/results/avatar-system.md",
            "backtest_architecture": "sidecars/results/backtest-architecture.md",
        },
    }
    # Dashboard data is large because each row carries SVG + curve preview. Keep
    # it compact in git; CSV/report files provide the human-readable audit trail.
    compact_dashboard = json.dumps(dashboard, ensure_ascii=False, separators=(",", ":"))
    (run_dir / "dashboard_data.json").write_text(compact_dashboard, encoding="utf-8")
    dashboard_path = root / config["dashboard_data"]
    dashboard_path.parent.mkdir(parents=True, exist_ok=True)
    dashboard_path.write_text(compact_dashboard, encoding="utf-8")

    resolved = {"config": config, "costs": costs, "doctrine": doctrine, "price_source": price_source, "data_quality": quality_report, "run_id": run_id, "generated_utc": stamp}
    (run_dir / "config.resolved.json").write_text(json.dumps(resolved, indent=2), encoding="utf-8")
    (run_dir / "README.md").write_text(f"# {run_id}\n\nGenerated by `python -m demon_ranch.backtest_duos --config configs/grid.duo.json`.\n\nRows: {len(rows)}\n\nProvenance: simulated historical backtest, not observed real-money performance. Canonical live policy rows are labeled in `policy_provenance`; research-only rows must not be quoted as live doctrine.\n", encoding="utf-8")
    update_run_index(root / "backtests" / "runs" / "INDEX.csv", {
        "run_id": run_id,
        "generated_utc": stamp,
        "rows": len(rows),
        "leaderboard": str(Path(config["output_root"]) / run_id / "leaderboard.csv"),
        "dashboard_data": str(Path(config["output_root"]) / run_id / "dashboard_data.json"),
        "data_note": config["meta"].get("data_note", ""),
    })
    return {"run_id": run_id, "run_dir": str(run_dir), "rows": len(rows), "leaderboard": str(run_dir / "leaderboard.csv"), "dashboard_data": str(dashboard_path)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="configs/grid.duo.json")
    parser.add_argument("--run-id", default=None)
    args = parser.parse_args()
    result = run(Path(args.config), args.run_id)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
