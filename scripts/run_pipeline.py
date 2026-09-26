"""
scripts/run_pipeline.py
Master execution pipeline.
"""
import time
import shutil
from process_matches import run_process_matches
from generate_manifest import run_generate_manifest
from generate_heatmaps import run_generate_heatmaps
from config import MINIMAPS_SOURCE_DIR, MINIMAPS_DEST_DIR

def copy_minimaps_to_public():
    shutil.copytree(MINIMAPS_SOURCE_DIR, MINIMAPS_DEST_DIR, dirs_exist_ok=True)


def main():
    start_time = time.time()
    print("==================================================")
    print("      LILA BLACK TELEMETRY ETL PIPELINE          ")
    print("==================================================")

    # Step 1: Parse Matches
    run_process_matches()

    # Step 2: Build Manifest Index
    run_generate_manifest()

    # Step 3: Compute Heatmaps
    run_generate_heatmaps()

    copy_minimaps_to_public()

    elapsed = round(time.time() - start_time, 2)
    print("==================================================")
    print(f" PIPELINE COMPLETE in {elapsed}s")
    print("==================================================")

if __name__ == "__main__":
    main()