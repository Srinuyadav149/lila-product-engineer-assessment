import os
import json
import glob
import pyarrow.parquet as pq
import pandas as pd

# Map configuration specified in README.md
MAP_CONFIGS = {
    "AmbroseValley": {"scale": 900.0, "origin_x": -370.0, "origin_z": -473.0},
    "GrandRift":      {"scale": 581.0, "origin_x": -290.0, "origin_z": -290.0},
    "Lockdown":       {"scale": 1000.0, "origin_x": -500.0, "origin_z": -500.0},
}

OUT_DIR = "public/data"
MATCHES_DIR = os.path.join(OUT_DIR, "matches")
HEATMAPS_DIR = os.path.join(OUT_DIR, "heatmaps")

os.makedirs(MATCHES_DIR, exist_ok=True)
os.makedirs(HEATMAPS_DIR, exist_ok=True)

def world_to_pixel(x, z, map_id):
    """
    Projects 3D world coordinates (x, z) to 1024x1024 2D minimap canvas pixels.
    Y-axis is flipped because screen canvas origin (0,0) is top-left.
    """
    cfg = MAP_CONFIGS.get(map_id)
    if not cfg:
        return 0.0, 0.0
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    px = round(u * 1024.0, 1)
    py = round((1.0 - v) * 1024.0, 1)
    return px, py

def is_bot(user_id):
    """Bots use short numeric IDs; humans use UUIDs."""
    return str(user_id).isdigit()

print("==> 1. Indexing files from player_data/ ...")
# Filter folder scanning to only capture February_* date directories
date_folders = sorted([
    d for d in glob.glob("player_data/*") 
    if os.path.isdir(d) and os.path.basename(d).startswith("February_")
])

# Group all player files by unique match_id
match_files = {}
for folder in date_folders:
    date_name = os.path.basename(folder)
    files = [os.path.join(folder, f) for f in os.listdir(folder) if not f.endswith((".md", ".txt"))]
    for fpath in files:
        fname = os.path.basename(fpath)
        parts = fname.split("_")
        if len(parts) >= 2:
            # File convention: {user_id}_{match_id}.nakama-0
            match_id = parts[1].replace(".nakama-0", "")
            match_files.setdefault(match_id, {"date": date_name, "files": []})["files"].append(fpath)

print(f"Discovered {len(match_files)} distinct matches across {len(date_folders)} dates.")

manifest = {
    "maps": list(MAP_CONFIGS.keys()),
    "dates": [os.path.basename(d) for d in date_folders],
    "matches": []
}

# Heatmap accumulators across the entire dataset
heatmaps = {
    m: {
        "kills": [],       # [px, py]
        "deaths": [],      # [px, py]
        "storm_deaths": [],# [px, py]
        "traffic": []      # [px, py] sampled points
    }
    for m in MAP_CONFIGS.keys()
}

print("==> 2. Processing matches and building JSON partitions...")
processed_count = 0

for match_id, m_meta in match_files.items():
    frames = []
    for fpath in m_meta["files"]:
        try:
            tbl = pq.read_table(fpath)
            frames.append(tbl.to_pandas())
        except Exception:
            continue

    if not frames:
        continue

    df_match = pd.concat(frames, ignore_index=True)
    if df_match.empty or 'map_id' not in df_match.columns:
        continue

    map_id = df_match['map_id'].iloc[0]
    if map_id not in MAP_CONFIGS:
        continue

    # Decode event bytes to string
    if df_match['event'].dtype == object or isinstance(df_match['event'].iloc[0], (bytes, bytearray)):
        df_match['event'] = df_match['event'].apply(
            lambda x: x.decode('utf-8', errors='ignore') if isinstance(x, (bytes, bytearray)) else str(x)
        )

    df_match['is_bot'] = df_match['user_id'].apply(is_bot)

    # Normalize match timestamps relative to start (T=0)
    # Because ts was scaled by 1,000 during parquet timestamp loading, 
    # multiply total_seconds() by 1000 to restore true match-elapsed seconds.
    min_ts = df_match['ts'].min()
    df_match['t_sec'] = ((df_match['ts'] - min_ts).dt.total_seconds() * 1000.0).round(1)

    # Calculate pixel projections
    coords = [world_to_pixel(r['x'], r['z'], map_id) for _, r in df_match.iterrows()]
    df_match['px'] = [c[0] for c in coords]
    df_match['py'] = [c[1] for c in coords]

    duration = float(df_match['t_sec'].max())

    match_payload = {
        "match_id": match_id,
        "map_id": map_id,
        "date": m_meta["date"],
        "duration_sec": duration,
        "players": {},
        "events": []
    }

    # Extract combat, environment, and loot events
    discrete_events = df_match[~df_match['event'].isin(['Position', 'BotPosition'])]
    for _, row in discrete_events.iterrows():
        evt_type = row['event']
        px, py = row['px'], row['py']
        evt = {
            "t": float(row['t_sec']),
            "event": evt_type,
            "user_id": str(row['user_id']),
            "is_bot": bool(row['is_bot']),
            "x": px,
            "y": py
        }
        match_payload["events"].append(evt)

        # Aggregate into global heatmap layers
        if evt_type in ['Kill', 'BotKill']:
            heatmaps[map_id]["kills"].append([px, py])
        elif evt_type in ['Killed', 'BotKilled']:
            heatmaps[map_id]["deaths"].append([px, py])
        elif evt_type == 'KilledByStorm':
            heatmaps[map_id]["storm_deaths"].append([px, py])

    # Extract movement trajectories per player/bot
    for uid, p_df in df_match.groupby('user_id'):
        p_sorted = p_df.sort_values('t_sec')
        is_bot_flag = bool(p_sorted['is_bot'].iloc[0])
        
        # Path array: [time_sec, px, py]
        path = list(zip(
            p_sorted['t_sec'].tolist(),
            p_sorted['px'].tolist(),
            p_sorted['py'].tolist()
        ))
        
        match_payload["players"][str(uid)] = {
            "is_bot": is_bot_flag,
            "path": path
        }

        # Sub-sample traffic points (every 4th sample) to keep heatmap payload lean
        heatmaps[map_id]["traffic"].extend(p_sorted[['px', 'py']].iloc[::4].values.tolist())

    # Save match partition
    with open(os.path.join(MATCHES_DIR, f"{match_id}.json"), "w") as f:
        json.dump(match_payload, f)

    # Append to manifest index
    manifest["matches"].append({
        "match_id": match_id,
        "map_id": map_id,
        "date": m_meta["date"],
        "duration_sec": duration,
        "player_count": len(match_payload["players"]),
        "event_count": len(match_payload["events"]),
        "human_count": sum(1 for p in match_payload["players"].values() if not p["is_bot"]),
        "bot_count": sum(1 for p in match_payload["players"].values() if p["is_bot"])
    })

    processed_count += 1
    if processed_count % 100 == 0:
        print(f"Processed {processed_count}/{len(match_files)} matches...")

# Write manifest
with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
    json.dump(manifest, f)

# Write precomputed heatmaps per map
for map_id, data in heatmaps.items():
    with open(os.path.join(HEATMAPS_DIR, f"{map_id}.json"), "w") as f:
        json.dump(data, f)

print(f"\n[DONE] Successfully partitioned {processed_count} matches.")
print(f"Manifest written to: {OUT_DIR}/manifest.json")
print(f"Heatmap data written to: {HEATMAPS_DIR}/")