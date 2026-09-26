"""
scripts/generate_manifest.py
Builds manifest.json by indexing the processed match JSON files.
"""
import os
import json
import glob
from datetime import datetime
from config import MATCHES_DIR, MANIFEST_PATH, MAP_CONFIGS

def run_generate_manifest():
    print("==> [2/3] Building manifest from processed matches...")
    match_files = glob.glob(os.path.join(MATCHES_DIR, "*.json"))

    if not match_files:
        print(f"[!] No match JSON files found in {MATCHES_DIR}/. Run process_matches.py first.")
        return

    manifest_matches = []
    dates = set()

    for fpath in match_files:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue

        players = data.get("players", {})
        human_count = sum(1 for p in players.values() if not p.get("is_bot", False))
        bot_count = sum(1 for p in players.values() if p.get("is_bot", False))
        date_str = data.get("date", "Unknown")
        dates.add(date_str)

        manifest_matches.append({
            "match_id": data.get("match_id"),
            "map_id": data.get("map_id"),
            "date": date_str,
            "duration_sec": data.get("duration_sec", 0.0),
            "player_count": len(players),
            "human_count": human_count,
            "bot_count": bot_count,
            "event_count": len(data.get("events", []))
        })

    # Sort matches chronologically by date and match_id
    manifest_matches.sort(key=lambda m: (m["date"], m["match_id"]))

    manifest = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_matches": len(manifest_matches),
        "maps": list(MAP_CONFIGS.keys()),
        "dates": sorted(list(dates)),
        "matches": manifest_matches
    }

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"[+] Manifest created at {MANIFEST_PATH} with {len(manifest_matches)} matches.")

if __name__ == "__main__":
    run_generate_manifest()