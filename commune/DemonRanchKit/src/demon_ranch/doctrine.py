"""Robinhood lab doctrine defaults for Demon Ranch research.

This module makes Alex's live-lab constraints machine-readable for research
artifacts. It does not place, review, cancel, or route broker orders.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DOCTRINE_PATH = REPO_ROOT / "configs" / "lab_doctrine.json"


def load_doctrine(path: str | Path | None = None) -> dict:
    doctrine_path = Path(path) if path else DEFAULT_DOCTRINE_PATH
    return json.loads(doctrine_path.read_text(encoding="utf-8"))


def validate_doctrine(doctrine: Mapping[str, object], asset_traits: Mapping[str, object] | None = None) -> list[str]:
    """Return validation errors for the lab doctrine contract."""
    errors: list[str] = []
    sleeves = [str(s).upper() for s in doctrine.get("live_sleeves", [])]
    if doctrine.get("active_lab_account") != "920610144":
        errors.append("active_lab_account must be 920610144")
    if doctrine.get("joint_account_mode") != "read_strategy_only":
        errors.append("joint_account_mode must be read_strategy_only")
    if doctrine.get("asset_universe") != "equities_only":
        errors.append("asset_universe must be equities_only")
    if len(sleeves) != 7 or len(set(sleeves)) != 7:
        errors.append("live_sleeves must contain 7 unique tickers")
    target = float(doctrine.get("sleeve_target_weight", 0.0))
    if sleeves and abs(target * len(sleeves) - 1.0) > 1e-9:
        errors.append("sleeve_target_weight must equal 1 / len(live_sleeves)")
    canonical = doctrine.get("canonical_live_policy", {})
    if not isinstance(canonical, Mapping):
        errors.append("canonical_live_policy must be an object")
    else:
        if canonical.get("type") != "dollar_first":
            errors.append("canonical_live_policy.type must be dollar_first")
        if float(canonical.get("drift_usd", 0.0)) != 1.0:
            errors.append("canonical_live_policy.drift_usd must be 1.0")
    topup = doctrine.get("rounding_topup", {})
    if isinstance(topup, Mapping) and float(topup.get("cap_fraction_of_trim_proceeds", 0.0)) > 0.1:
        errors.append("rounding_topup cap must be <= 0.10")
    pair_watch = doctrine.get("pair_spread_watch", {})
    if not isinstance(pair_watch, Mapping):
        errors.append("pair_spread_watch must be an object")
    else:
        if pair_watch.get("type") != "high_low_pair_spread":
            errors.append("pair_spread_watch.type must be high_low_pair_spread")
        if float(pair_watch.get("watch_threshold_usd", 0.0)) != 1.0:
            errors.append("pair_spread_watch.watch_threshold_usd must be 1.0")
        if float(pair_watch.get("bite_usd", 0.0)) != 1.0:
            errors.append("pair_spread_watch.bite_usd must be 1.0")
        if pair_watch.get("compression") != "2q":
            errors.append("pair_spread_watch.compression must be 2q")
    if asset_traits is not None:
        trait_keys = {str(k).upper() for k in asset_traits}
        missing = sorted(set(sleeves) - trait_keys)
        if missing:
            errors.append("asset_traits missing live sleeve traits: " + ", ".join(missing))
    return errors


def assert_valid_doctrine(doctrine: Mapping[str, object], asset_traits: Mapping[str, object] | None = None) -> None:
    errors = validate_doctrine(doctrine, asset_traits)
    if errors:
        raise ValueError("Invalid lab doctrine: " + "; ".join(errors))


def policy_provenance(label: str, doctrine: Mapping[str, object]) -> str:
    """Classify a leaderboard policy label against the live Robinhood doctrine."""
    canonical = doctrine.get("canonical_live_policy", {})
    canonical_label = ""
    if isinstance(canonical, Mapping) and canonical.get("type") == "dollar_first":
        canonical_label = f"dollar_first_{float(canonical.get('drift_usd', 1.0)):.0f}usd"
    if label == canonical_label:
        return "live_canonical"
    if label == "buy_hold":
        return "baseline"
    if label == "threshold_4pct":
        return "telemetry_only"
    if label == "threshold_5pct":
        return "urgent_watch_telemetry"
    return "research_only"


def policy_fidelity(label: str, doctrine: Mapping[str, object]) -> str:
    """Say how faithfully a simulated row reflects the live doctrine.

    `live_canonical` means the policy label matches the live lab doctrine. It does
    not mean the duo-v0 simulator enforces every broker/settlement/regime guard.
    """
    provenance = policy_provenance(label, doctrine)
    if provenance == "live_canonical":
        return "live_doctrine_approx_not_execution"
    if provenance == "baseline":
        return "baseline_comparison"
    if "telemetry" in provenance:
        return "telemetry_not_execution"
    return "research_only"


def unmodeled_mechanics(doctrine: Mapping[str, object]) -> list[str]:
    claims = doctrine.get("data_claims", {})
    if isinstance(claims, Mapping):
        return [str(x) for x in claims.get("unmodeled_mechanics", [])]
    return []


def public_disclaimer(doctrine: Mapping[str, object]) -> str:
    claims = doctrine.get("data_claims", {})
    if isinstance(claims, Mapping):
        return str(claims.get("public_disclaimer", ""))
    return ""


def caveats(doctrine: Mapping[str, object]) -> list[str]:
    claims = doctrine.get("data_claims", {})
    if isinstance(claims, Mapping):
        return [str(c) for c in claims.get("caveats", [])]
    return []


def doctrine_summary(doctrine: Mapping[str, object]) -> dict:
    canonical = doctrine.get("canonical_live_policy", {})
    return {
        "doctrine_id": doctrine.get("doctrine_id"),
        "active_lab_account": doctrine.get("active_lab_account"),
        "joint_account_mode": doctrine.get("joint_account_mode"),
        "live_sleeves": doctrine.get("live_sleeves", []),
        "default_basis": doctrine.get("default_basis"),
        "target_rule": doctrine.get("target_rule"),
        "canonical_live_policy": canonical,
        "telemetry_bands": doctrine.get("telemetry_bands", {}),
        "pair_spread_watch": doctrine.get("pair_spread_watch", {}),
    }
