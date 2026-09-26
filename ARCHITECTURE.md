# Technical Architecture: Project Lila Black Telemetry Suite

A zero-backend, client-side spatial telemetry visualizer and high-performance playback engine engineered for extraction shooter analytics.

---

## 1. Technology Stack & Justification

| Layer | Technology | Engineering Rationale |
| :--- | :--- | :--- |
| **Runtime & Build** | React 18 + Vite + TypeScript | Instant HMR, static tree-shaking, strict type safety for custom telemetry schemas. |
| **Styling** | Tailwind CSS + Lucide Icons | Responsive layout engine, high-density HUD overlays, zero runtime CSS overhead. |
| **Spatial Canvas** | Native HTML5 Canvas 2D (Dual-Layer) | 60 FPS sub-frame animation without DOM reflow costs (SVG) or shader compilation overhead (WebGL). |
| **Interpolation** | Custom requestAnimationFrame Engine | Linear interpolation ($LERP$) across discrete server ticks with variable playback speed (1x, 2x, 5x). |
| **ETL Pipeline** | Python 3 + Pandas + PyArrow | Vectorized Parquet parsing, coordinate projection, and spatial grid binning ($4\text{px}$ cells). |

---

## 2. End-to-End Data Flow

```text
[Raw Production Parquet] (player_data/*.nakama-0)
           │
           ▼
[scripts/process_matches.py]
   • Vectorized projection (World X, Z -> Pixel px, py)
   • Relative timestamp normalization (t_sec = (ts - min_ts) * 1000)
   • Output: public/data/matches/{match_id}.json
           │
           ├───► [scripts/generate_manifest.py] -> public/data/manifest.json
           │
           └───► [scripts/generate_heatmaps.py]
                   • Spatial grid binning (4px cells)
                   • Layer classification (combat, storm, traffic)
                   • Weight normalization (0.05 to 1.0)
                   • Output: public/data/heatmaps/{map_id}.json
           │
           ▼
[Vite Frontend SPA]
   ├── In-Memory LRU MatchStore (instant match switching)
   ├── MapViewport: CSS 3D Matrix Controller (translate3d + scale)
   ├── Canvas Layer 1 (Static): Minimap background painted once
   ├── Canvas Layer 2 (Dynamic): 60 FPS LERP paths, heads, and event pins
   └── HeatmapCanvas: Offscreen alpha-stamping + 256-color LUT pixel transfer

```

---

## 3. Coordinate System & Projection Mathematics

Unreal Engine uses a left-handed Cartesian coordinate system ($X, Y, Z$) measured in centimeters, where $Y$ represents elevation (vertical height) and $X, Z$ represent the horizontal ground plane. The web visualizer maps $(X, Z)$ to an HTML5 Canvas of size $1024 \times 1024$ pixels, where $(0, 0)$ is the top-left corner.

### Projection Formula

$$\text{px} = \left(\frac{X - \text{origin}_X}{\text{scale}}\right) \times 1024.0$$

$$\text{py} = \left(1.0 - \frac{Z - \text{origin}_Z}{\text{scale}}\right) \times 1024.0$$

The vertical inversion $(1.0 - v)$ is required because Unreal world coordinates increase upward along the Z-axis, whereas screen pixel coordinates increase downward.

### Calibrated Map Coefficients

* **Ambrose Valley:** $\text{scale} = 900.0, \; \text{origin}_X = -370.0, \; \text{origin}_Z = -473.0$

* **Grand Rift:** $\text{scale} = 581.0, \; \text{origin}_X = -290.0, \; \text{origin}_Z = -290.0$

* **Lockdown:** $\text{scale} = 1000.0, \; \text{origin}_X = -500.0, \; \text{origin}_Z = -500.0$


---

## 4. Edge Cases, Data Nuances & Handling of Ambiguities

During ingestion and analysis of the 1,243 Parquet files across 796 matches, we encountered several edge cases requiring explicit design choices:

1. **The "Phantom Bot" & Missing Entity Trajectories:**
* *Anomaly:* In many matches, human players record `BotKill` (killed a bot) or `BotKilled` (eliminated by a bot) events, yet no corresponding bot trajectory file (`{bot_id}_{match_id}.nakama-0`) exists in the directory. In fact, 796 matches yield only 1,243 total files (~1.56 files per match), meaning most server-controlled bots never emitted client-style trajectory streams.


* *Solution:* The ingestion pipeline synthesizes a discrete proxy event marker at the event's $(px, py)$ coordinate and flags the entity as a server-side bot so the UI log and canvas render the combat encounter without throwing missing-key exceptions.


2. **Absence of an Explicit `Extract` Event:**
* *Anomaly:* The telemetry schema includes `Kill`, `Killed`, `BotKill`, `BotKilled`, `KilledByStorm`, and `Loot`, but **no `Extract` event**.


* *Solution:* An entity is inferred to have **Extracted** if their movement trail terminates without an elimination event (`Killed`, `BotKilled`, `KilledByStorm`) and their final timestamp coincides with the terminal phase of their session. The UI displays them as `[EXTRACTED]` (green checkmark), separating them from `[KIA]` casualties.


3. **Parquet Timestamp Normalization (The 1970 Epoch Anomaly):**
* *Anomaly:* The raw `ts` column contains timestamps near the Unix epoch (`1970-01-21 ...`). Taking raw `dt.total_seconds()` resulted in fractional durations (~0.5s) because the internal parquet timestamp units were scaled.


* *Solution:* Timestamps are normalized relative to the match origin ($T_0 = \min(\text{ts})$) and scaled to reflect real elapsed match seconds ($0$ to $600\text{s}$).


4. **Lockdown File Format Discrepancy:**
* *Anomaly:* Ambrose Valley and Grand Rift use `.png` minimap assets, whereas Lockdown is provided as `.jpg`.


* *Solution:* Implemented dynamic extension mapping (`mapConfig.ext`) to prevent 404 image load failures.



---

## 5. Doubts & Open Questions for the Game Backend Team

1. **Bot Logging Policy:** Are bot movement trajectories omitted intentionally to conserve server disk I/O, or were bot position packets dropped due to network buffer limits?
2. **Storm Boundary Vectors:** The dataset records individual `KilledByStorm` events, but does not serialize the dynamic storm front's coordinate radius or velocity vector over time. Can the server emit periodic `StormZone` snapshots ($X, Z, \text{radius}$) so the visualizer can render the collapsing circle?


3. **Extraction Zones:** Can extraction point trigger boxes (POI locations and active timers) be added to match metadata to visualize proximity-to-extraction behavior?

---

## 6. Architecture Trade-Offs

| Decision | Alternative Considered | Trade-Off Chosen | Rationale |
| --- | --- | --- | --- |
| **Dual-Layer 2D Canvas** | WebGL / Three.js / SVG | Canvas 2D Dual-Layer | SVG DOM nodes choke at 5,000+ points; WebGL introduces shader overhead. Canvas 2D easily achieves 60 FPS. |
| **Offline ETL Pre-Binning** | Client-Side Parquet Processing | Precomputed Spatial JSON | Parsing 1,243 Parquet files in-browser would freeze the client; pre-binning yields 150KB payloads. |
| **Linear Path LERP** | Hermite / Catmull-Rom Splines | Linear Interpolation | Splines introduce artificial positional overshoot at sharp corners. LERP preserves true server tick truth. |
| **Color LUT Transfer** | Dynamic Blur Filters / WebGL | Typed Array LUT | Native `CanvasRenderingContext2D` LUT replacement is deterministic, cross-browser, and CPU-efficient. |
---