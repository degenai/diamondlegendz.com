# DATA MANIFEST — heavy artifacts NOT in git

The commune rule is **no vaults in git** (`CONTRIBUTING.md` §3): result vaults and multi-MB
data files travel by Drive/USB, not the repo. This manifest lists every heavy artifact the
v3 kit update deliberately left out, so Alex can do the Drive/USB pass in one Thursday sweep
and Andy knows exactly what is missing and where it goes.

## How to rehydrate

Every ported script resolves its data root from `DEMON_RANCH_ROOT` (falling back to the kit
root). Two equivalent options:

1. **Point at a full tree.** `export DEMON_RANCH_ROOT=/path/to/DemonRanch` (a populated
   `Desktop/Demon Ranch` copy) and the scripts read the heavy files from there — nothing to
   copy into the kit.
2. **Drop files into the kit.** Copy each artifact below to its **Kit destination** (paths are
   relative to `commune/DemonRanchKit/`) and leave `DEMON_RANCH_ROOT` unset.

Source paths are on Alex's machine, rooted at `C:\Users\alexa\Desktop\Demon Ranch\`.

## In git (small — no action needed)

| Artifact | Size | Location | Note |
|---|---|---|---|
| `yf_commodities_2011_2026.csv` | 663 KB | `sidecars/cointegration-20260715/` | small enough to ship in git; feeds the commodity round-robin + coint commodity window |
| `data/derived/total_return_panel_v4_2020_2026.csv` | ~14 MB | kit root `data/derived/` | already in the kit (97-symbol 2020–2026 panel; the engine gate ran on it) |

## Excluded — bring via Drive/USB

| Artifact | Source path (`…\Demon Ranch\`) | Size | Kit destination | Reason excluded |
|---|---|---|---|---|
| `yf_panel_2008_2026.csv` | `sidecars\cointegration-20260715\` | 7.5 MB | `sidecars/cointegration-20260715/` | 2008–2026 Yahoo adjusted-close panel; input to `coint_test.py`, `validate.py`, `census.py`, `kayfabe_test.py`, `batch1/3.py`. Large. |
| `pairs_results.csv` | `sidecars\cointegration-20260715\` | 670 KB | `sidecars/cointegration-20260715/` | regenerable pair-level output of `coint_test.py` |
| `v11_pairs_results.csv` | `sidecars\cointegration-20260715\` | 1.8 MB | `sidecars/cointegration-20260715/` | regenerable multi-MB pairs output (v1.1 run) |
| `v12_pairs.csv` | `sidecars\cointegration-20260715\` | 640 KB | `sidecars/cointegration-20260715/` | regenerable pairs output of `v12_target_swap.py` |
| `source_check_winB.csv` | `sidecars\cointegration-20260715\` | 87 KB | `sidecars/cointegration-20260715/` | intermediate QC table |
| `v14_pairs_fitA_testB.csv` | `sidecars\cointegration-20260715\` | 66 KB | `sidecars/cointegration-20260715/` | regenerable walk-forward pairs output |
| `v14_pairs_fitB_testA.csv` | `sidecars\cointegration-20260715\` | 66 KB | `sidecars/cointegration-20260715/` | regenerable walk-forward pairs output |
| `kayfabe_pairs.csv` | `sidecars\kayfabe-20260715\` | 1.9 MB | `sidecars/kayfabe-20260715/` | regenerable pair-level output of `kayfabe_test.py` |
| `batch3_pairs_dotcom.csv` | `sidecars\kayfabe-20260715\rumble_batch3\` | 150 KB | `sidecars/kayfabe-20260715/rumble_batch3/` | regenerable pairs output (dotcom window) |
| `batch3_pairs_gfc.csv` | `sidecars\kayfabe-20260715\rumble_batch3\` | 830 KB | `sidecars/kayfabe-20260715/rumble_batch3/` | regenerable pairs output (GFC window) |
| `annex/death_panel_full.csv` | `sidecars\kayfabe-20260715\annex\` | 701 KB | `sidecars/kayfabe-20260715/annex/` | annex price panel (delisted/death names) |
| `annex/dotcom_panel_1996_2005.csv` | `sidecars\kayfabe-20260715\annex\` | 1.1 MB | `sidecars/kayfabe-20260715/annex/` | annex price panel (dot-com era) |
| `annex/gfc_panel_2005_2012.csv` | `sidecars\kayfabe-20260715\annex\` | 2.1 MB | `sidecars/kayfabe-20260715/annex/` | annex price panel (GFC era) |
| `raw/` (whole dir) | `sidecars\roster-overlap-20260715\` | 25 MB | `sidecars/roster-overlap-20260715/raw/` | raw issuer holdings (iShares/SSGA/Vanguard/etc. JSON/CSV/XLSX). **Consume `holdings_normalized.csv` (in git) instead of re-fetching.** |
| `prices/` (whole dir) | `sidecars\hall-of-the-dead-20260715\` | 14 MB | `sidecars/hall-of-the-dead-20260715/prices/` | 56 clean corpse/survivor price series (the Hall of the Dead library). Consume, don't re-fetch. |
| `prices_av/` (whole dir) | `sidecars\hall-of-the-dead-20260715\` | 800 KB | `sidecars/hall-of-the-dead-20260715/prices_av/` | Alpha Vantage sweep outputs |
| `prices_fmp/` (whole dir) | `sidecars\hall-of-the-dead-20260715\` | 188 KB | `sidecars/hall-of-the-dead-20260715/prices_fmp/` | FMP sweep outputs |
| `contaminated/` (whole dir) | `sidecars\hall-of-the-dead-20260715\` | 308 KB | `sidecars/hall-of-the-dead-20260715/contaminated/` | quarantined recycled-ticker impostors (BBBY/BLIAQ) + notes |

**Excluded total: ~55 MB.** The manifests (`manifest*.csv`) and `REPORT.md` files for each
sidecar ARE in git, so the shape of the missing data is documented even before the sweep.
