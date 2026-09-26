"""
scripts/generate_heatmaps.py
Computes normalized spatial density grids for combat, storm, and traffic.
Outputs lightweight JSON partitions for AmbroseValley, GrandRift, and Lockdown.
"""
import os
import json
import glob
from collections import defaultdict
from config import MATCHES_DIR, HEATMAPS_DIR, MAP_CONFIGS, GRID_BIN_SIZE

def bin_val(v):
    return round(round(v / GRID_BIN_SIZE) * GRID_BIN_SIZE, 1)

def run_generate_heatmaps():
    print("==> [3/3] Aggregating spatial heatmaps across all matches...")
    os.makedirs(HEATMAPS_DIR, exist_ok=True)

    match_files = glob.glob(os.path.join(MATCHES_DIR, "*.json"))
    if not match_files:
        print(f"[!] No match JSON files found in {MATCHES_DIR}/. Run process_matches.py first.")
        return

    density_grids = {
        m: {"combat": defaultdict(int), "storm": defaultdict(int), "traffic": defaultdict(int)}
        for m in MAP_CONFIGS
    }
    totals = {m: {"kills": 0, "storm_deaths": 0} for m in MAP_CONFIGS}

    processed = 0
    for fpath in match_files:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue

        map_id = data.get("map_id")
        if map_id not in density_grids:
            continue

        processed += 1

        # 1. Aggregate Events
        for ev in data.get("events", []):
            evt_type = ev.get("event", "")
            px, py = ev.get("px", 0.0), ev.get("py", 0.0)
            bx, by = bin_val(px), bin_val(py)

            if evt_type in ['Kill', 'BotKill']:
                density_grids[map_id]["combat"][(bx, by)] += 1
                totals[map_id]["kills"] += 1
            elif evt_type in ['Killed', 'BotKilled']:
                density_grids[map_id]["combat"][(bx, by)] += 1
            elif evt_type == 'KilledByStorm':
                density_grids[map_id]["storm"][(bx, by)] += 1
                totals[map_id]["storm_deaths"] += 1
            elif evt_type == 'Loot':
                density_grids[map_id]["combat"][(bx, by)] += 0.5

        # 2. Aggregate Paths (Subsampled for traffic density)
        for player in data.get("players", {}).values():
            path = player.get("path", [])
            if not path:
                continue

            step = max(1, len(path) // 20)
            is_bot = player.get("is_bot", False)
            weight_inc = 0.5 if is_bot else 1.0

            for i in range(0, len(path), step):
                px, py = path[i][1], path[i][2]
                bx, by = bin_val(px), bin_val(py)
                density_grids[map_id]["traffic"][(bx, by)] += weight_inc

    print(f"Aggregated {processed} matches. Normalizing weights and saving heatmaps...")

    for map_id in MAP_CONFIGS:
        points = []
        map_grids = density_grids[map_id]

        for p_type in ["combat", "storm", "traffic"]:
            grid = map_grids[p_type]
            if not grid:
                continue

            max_count = max(grid.values()) if grid.values() else 1
            for (bx, by), count in grid.items():
                # Normalized weight between 0.05 and 1.0
                norm_weight = round(min(1.0, max(0.05, count / max_count)), 3)
                points.append({
                    "px": bx,
                    "py": by,
                    "weight": norm_weight,
                    "type": p_type
                })

        output_payload = {
            "map_id": map_id,
            "total_matches_aggregated": processed,
            "total_kills": totals[map_id]["kills"],
            "total_storm_deaths": totals[map_id]["storm_deaths"],
            "points": points
        }

        out_path = os.path.join(HEATMAPS_DIR, f"{map_id}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output_payload, f, separators=(',', ':'))

        print(f"  -> Generated {out_path} ({len(points)} binned density nodes)")

    print("[+] All aggregate heatmaps generated successfully.")

if __name__ == "__main__":
    run_generate_heatmaps()