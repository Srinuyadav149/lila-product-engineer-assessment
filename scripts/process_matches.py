"""
scripts/process_matches.py
Extracts raw Parquet telemetry into per-match JSON files.
"""
import os
import json
import glob
from collections import defaultdict
import pyarrow.parquet as pq
import pandas as pd
from config import MAP_CONFIGS, CANVAS_SIZE, RAW_DATA_DIR, MATCHES_DIR

def run_process_matches():
    os.makedirs(MATCHES_DIR, exist_ok=True)

    print("==> [1/3] Indexing player files...")
    match_files = defaultdict(list)
    match_dates = {}

    for folder in sorted(glob.glob(os.path.join(RAW_DATA_DIR, "February_*"))):
        date_name = os.path.basename(folder)
        for fpath in glob.glob(os.path.join(folder, "*")):
            fname = os.path.basename(fpath)
            if "_" in fname and not fname.endswith((".md", ".txt")):
                match_id = fname.split("_")[1].replace(".nakama-0", "")
                match_files[match_id].append(fpath)
                match_dates[match_id] = date_name

    total_matches = len(match_files)
    print(f"Found {total_matches} matches across {len(set(match_dates.values()))} dates.")
    print("==> Processing matches & projecting coordinates to 1024px canvas...")

    count = 0
    for match_id, files in match_files.items():
        frames = []
        for f in files:
            try:
                frames.append(pq.read_table(f).to_pandas())
            except Exception:
                continue

        if not frames:
            continue

        df = pd.concat(frames, ignore_index=True)
        if df.empty or 'map_id' not in df.columns:
            continue

        map_id = df['map_id'].iloc[0]
        if map_id not in MAP_CONFIGS:
            continue

        # Decode event strings if byte-encoded
        if df['event'].dtype == object or isinstance(df['event'].iloc[0], (bytes, bytearray)):
            df['event'] = df['event'].apply(
                lambda x: x.decode('utf-8', errors='ignore') if isinstance(x, (bytes, bytearray)) else str(x)
            )

        # Elapsed match seconds
        min_ts = df['ts'].min()
        df['t_sec'] = ((df['ts'] - min_ts).dt.total_seconds() * 1000.0).round(1)

        # Vectorized coordinate projection
        cfg = MAP_CONFIGS[map_id]
        u = (df['x'] - cfg['origin_x']) / cfg['scale']
        v = (df['z'] - cfg['origin_z']) / cfg['scale']
        df['px'] = (u * CANVAS_SIZE).round(1)
        df['py'] = ((1.0 - v) * CANVAS_SIZE).round(1)
        df['is_bot'] = df['user_id'].astype(str).str.isdigit()

        duration = float(df['t_sec'].max())

        match_payload = {
            "match_id": match_id,
            "map_id": map_id,
            "date": match_dates[match_id],
            "duration_sec": duration,
            "players": {},
            "events": []
        }

        # Discrete events
        discrete = df[~df['event'].isin(['Position', 'BotPosition'])]
        for _, row in discrete.iterrows():
            match_payload["events"].append({
                "t": float(row['t_sec']),
                "event": row['event'],
                "user_id": str(row['user_id']),
                "is_bot": bool(row['is_bot']),
                "px": row['px'],
                "py": row['py']
            })

        # Trajectories per entity
        for uid, p_df in df.groupby('user_id'):
            p_sorted = p_df.sort_values('t_sec')
            match_payload["players"][str(uid)] = {
                "is_bot": bool(p_sorted['is_bot'].iloc[0]),
                "path": list(zip(
                    p_sorted['t_sec'].tolist(),
                    p_sorted['px'].tolist(),
                    p_sorted['py'].tolist()
                ))
            }

        # Write match JSON partition
        out_path = os.path.join(MATCHES_DIR, f"{match_id}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(match_payload, f, separators=(',', ':'))

        count += 1
        if count % 150 == 0:
            print(f"  Processed {count}/{total_matches} matches...")

    print(f"[+] Complete. Exported {count} match files to {MATCHES_DIR}/")

if __name__ == "__main__":
    run_process_matches()