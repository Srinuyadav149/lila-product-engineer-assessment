"""
scripts/config.py
Shared telemetry pipeline configuration.
"""
import os

# Minimap projection calibration settings
MAP_CONFIGS = {
    "AmbroseValley": {"scale": 900.0, "origin_x": -370.0, "origin_z": -473.0},
    "GrandRift":      {"scale": 581.0, "origin_x": -290.0, "origin_z": -290.0},
    "Lockdown":       {"scale": 1000.0, "origin_x": -500.0, "origin_z": -500.0},
}

CANVAS_SIZE = 1024.0
GRID_BIN_SIZE = 4.0  # 4px spatial binning for heatmap compression

# Output Directories
RAW_DATA_DIR = "player_data"
MINIMAPS_SOURCE_DIR = os.path.join(RAW_DATA_DIR, "minimaps")
PUBLIC_DIR = "public"
OUT_DIR = os.path.join(PUBLIC_DIR, "data")
MINIMAPS_DEST_DIR = os.path.join(PUBLIC_DIR, "minimaps")
MATCHES_DIR = os.path.join(OUT_DIR, "matches")
HEATMAPS_DIR = os.path.join(OUT_DIR, "heatmaps")
MANIFEST_PATH = os.path.join(OUT_DIR, "manifest.json")