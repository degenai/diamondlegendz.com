"""Deterministic SVG avatars for Demon Ranch duo experiments.

Base identity is stable and outcome-free. Monitoring state belongs in a separate
status overlay supplied by the dashboard.
"""

from __future__ import annotations

import hashlib
import html
from typing import Dict, Mapping, Sequence

HUE_FAMILIES = {
    "blue": ("#56a7ff", "#0f4c81"),
    "magenta": ("#ff5ad1", "#6d1558"),
    "gold": ("#ffd166", "#8a5a00"),
    "violet": ("#b49cff", "#3b2b73"),
    "stone": ("#b8c0cc", "#4b5563"),
    "red": ("#ff6b6b", "#7f1d1d"),
    "green": ("#6ee7a8", "#14532d"),
}

CLASS_MATERIAL = {
    "equity-index": "lattice",
    "leveraged-equity": "molten lattice",
    "gold": "gold plate",
    "long-bond": "duration coils",
    "cash-equiv": "stone anchor",
    "single-stock": "organic barb",
}

VOL_SPIKES = {"low": 2, "medium": 4, "high": 6, "extreme": 9}


def _pair_weights(pair: Sequence[str], weights: Sequence[float]) -> Dict[str, float]:
    return {pair[0].upper(): float(weights[0]), pair[1].upper(): float(weights[1])}


def canonical_string(pair: Sequence[str], weights: Sequence[float], version: str = "v1") -> str:
    weight_map = _pair_weights(pair, weights)
    ordered = sorted(weight_map)
    weight_bits = "-".join(str(int(round(weight_map[t] * 100))) for t in ordered)
    return f"{version}|{ordered[0]}|{ordered[1]}|{weight_bits}"


def _digest_bytes(canonical: str) -> bytes:
    return hashlib.sha256(canonical.encode("utf-8")).digest()


def _mix_color(hue: str, byte: int) -> str:
    light, dark = HUE_FAMILIES.get(hue, HUE_FAMILIES["stone"])
    # Simple deterministic interpolation in RGB space.
    def hx(c: str):
        return tuple(int(c[i : i + 2], 16) for i in (1, 3, 5))
    a, b = hx(light), hx(dark)
    t = 0.25 + (byte / 255) * 0.45
    rgb = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
    return "#" + "".join(f"{v:02x}" for v in rgb)


def _engine_ticker(pair: Sequence[str], traits: Mapping[str, Mapping[str, object]]) -> str:
    def score(t: str) -> tuple:
        tr = traits[t]
        vol = {"low": 0, "medium": 1, "high": 2, "extreme": 3}.get(str(tr.get("volatility_tier")), 1)
        lev = float(tr.get("leverage", 1))
        return (lev, vol)
    return max((p.upper() for p in pair), key=score)


def avatar(pair: Sequence[str], weights: Sequence[float], traits: Mapping[str, Mapping[str, object]], status: str = "idle") -> Dict[str, str]:
    """Return deterministic avatar metadata + inline SVG.

    `status` is a dashboard overlay hint only; base identity is fully determined by
    pair + weights + traits.
    """
    canonical = canonical_string(pair, weights)
    digest = _digest_bytes(canonical)
    weight_map = _pair_weights(pair, weights)
    ordered = sorted(weight_map)
    left, right = ordered[0], ordered[1]
    engine = _engine_ticker(pair, traits)

    left_trait = traits[left]
    right_trait = traits[right]
    left_w = weight_map[left]
    right_w = weight_map[right]

    left_color = _mix_color(str(left_trait.get("hue", "stone")), digest[0])
    right_color = _mix_color(str(right_trait.get("hue", "stone")), digest[1])
    eye_count = 1 + digest[2] % 3
    horn_curve = 6 + digest[3] % 9
    tail_flip = -1 if digest[4] % 2 else 1

    # Bounded perceptual sizing: minority leg never disappears.
    left_mass = 0.28 + left_w * 0.44
    right_mass = 0.28 + right_w * 0.44
    total_mass = left_mass + right_mass
    left_width = 74 * left_mass / total_mass
    right_width = 74 * right_mass / total_mass
    left_x = 48 - left_width
    seam_x = 48
    right_x = 48

    left_spikes = VOL_SPIKES.get(str(left_trait.get("volatility_tier", "medium")), 4)
    right_spikes = VOL_SPIKES.get(str(right_trait.get("volatility_tier", "medium")), 4)
    halo_left = float(left_trait.get("leverage", 1)) > 1
    halo_right = float(right_trait.get("leverage", 1)) > 1

    eye_positions = "".join(
        f'<circle cx="{42 + i * 6}" cy="31" r="2.2" fill="#f8fafc"/><circle cx="{42 + i * 6}" cy="31" r="0.9" fill="#0f172a"/>'
        for i in range(eye_count)
    )
    left_teeth = "".join(
        f'<path d="M {left_x + 5 + i * 5:.1f} 22 l 2 -{2 + (i % 2) * 2} l 2 {2 + (i % 2) * 2}" stroke="#111827" stroke-width="1" fill="none" opacity="0.45"/>'
        for i in range(left_spikes)
    )
    right_teeth = "".join(
        f'<path d="M {right_x + 5 + i * 5:.1f} 51 l 2 {2 + (i % 2) * 2} l 2 -{2 + (i % 2) * 2}" stroke="#111827" stroke-width="1" fill="none" opacity="0.45"/>'
        for i in range(right_spikes)
    )
    halos = ""
    if halo_left:
        halos += f'<ellipse cx="{left_x + left_width/2:.1f}" cy="35" rx="{left_width/2 + 5:.1f}" ry="25" fill="none" stroke="#ff7ad9" stroke-width="3" opacity="0.55"/>'
    if halo_right:
        halos += f'<ellipse cx="{right_x + right_width/2:.1f}" cy="35" rx="{right_width/2 + 5:.1f}" ry="25" fill="none" stroke="#ff7ad9" stroke-width="3" opacity="0.55"/>'

    status_ring = {
        "alive": "#7dd3fc",
        "stressed": "#fbbf24",
        "dead": "#fb7185",
        "idle": "#94a3b8",
    }.get(status, "#94a3b8")

    svg = f'''<svg class="demon-avatar" viewBox="0 0 96 72" role="img" aria-label="{html.escape(alt_text(pair, weights, traits, status))}" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="72" rx="14" fill="#0b1020"/>
  {halos}
  <path d="M22 18 q-{horn_curve} -16 8 -12" fill="none" stroke="#dbeafe" stroke-width="3" stroke-linecap="round"/>
  <path d="M74 18 q{horn_curve} -16 -8 -12" fill="none" stroke="#dbeafe" stroke-width="3" stroke-linecap="round"/>
  <path d="M{left_x:.1f} 22 C{left_x-8:.1f} 36 {left_x+2:.1f} 58 {seam_x:.1f} 57 L{seam_x:.1f} 18 C{left_x+10:.1f} 17 {left_x+3:.1f} 20 {left_x:.1f} 22Z" fill="{left_color}" opacity="0.96"/>
  <path d="M{right_x:.1f} 18 L{right_x:.1f} 57 C{right_x+right_width+8:.1f} 58 {right_x+right_width+7:.1f} 31 {right_x+right_width:.1f} 22 C{right_x+right_width-4:.1f} 18 {right_x+10:.1f} 17 {right_x:.1f} 18Z" fill="{right_color}" opacity="0.96"/>
  <line x1="48" y1="18" x2="48" y2="57" stroke="#0f172a" stroke-width="2" opacity="0.5"/>
  {left_teeth}{right_teeth}
  <circle cx="48" cy="39" r="8" fill="#0f172a" stroke="{status_ring}" stroke-width="3"/>
  <path d="M76 45 q{10 * tail_flip} 7 4 15" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>
  {eye_positions}
  <text x="48" y="68" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="7" fill="#e2e8f0">{html.escape(left)} {int(left_w*100)}/{int(right_w*100)} {html.escape(right)}</text>
</svg>'''

    return {
        "canonical": canonical,
        "engine": engine,
        "left": left,
        "right": right,
        "alt": alt_text(pair, weights, traits, status),
        "svg": svg,
    }


def alt_text(pair: Sequence[str], weights: Sequence[float], traits: Mapping[str, Mapping[str, object]], status: str = "idle") -> str:
    weight_map = _pair_weights(pair, weights)
    ordered = sorted(weight_map)
    engine = _engine_ticker(pair, traits)
    pieces = []
    for t in ordered:
        tr = traits[t]
        mat = CLASS_MATERIAL.get(str(tr.get("asset_class")), str(tr.get("asset_class")))
        pieces.append(f"{t} {round(weight_map[t] * 100)}% {mat}")
    return f"{' / '.join(pieces)} demon; engine {engine}; status {status}"
