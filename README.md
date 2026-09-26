# Lila Black — Extraction Telemetry Suite

A high-performance, web-based spatial telemetry visualizer and 60 FPS match replay engine built for extraction shooter level design and player behavior analytics.

🔗 **Live Deployment URL:** [`https://lila-product-engineer-assessment.vercel.app/`](https://lila-product-engineer-assessment.vercel.app/)

📁 **Repository:** [`https://github.com/Srinuyadav149/lila-product-engineer-assessment`](https://github.com/Srinuyadav149/lila-product-engineer-assessment)

---

## Evaluation Documents

* 📊 **Level Design Telemetry Analysis:** [`INSIGHTS.md`](./INSIGHTS.md) — Empirical breakdowns of Mine Pit verticality, Western Canal chokepoints, arterial road traps, and bot navigation signatures.
* 🏗️ **System Architecture & Math:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Coordinate projection formulas, 60 FPS LERP rendering, pipeline data flow, data ambiguities, and trade-offs.

---

## Tech Stack & System Requirements

| Category | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + TypeScript | Component modularity with strict spatial schema typing<div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased overflow-hidden"> |
| **Build Tool** | Vite | Sub-second HMR and optimized static tree-shaking<div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased overflow-hidden"> |
| **Styling** | Tailwind CSS + Lucide Icons | Responsive layout engine and tactical floating HUDs<div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased overflow-hidden"> |
| **Rendering Engine** | Dual-Layer HTML5 Canvas 2D | High-density 60 FPS sub-frame rendering without DOM overhead<div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased overflow-hidden"> |
| **ETL Pipeline** | Python 3 (Pandas, PyArrow) | Fast columnar Parquet parsing and 4px spatial grid binning |

### Environment Variables
* **None required**: The application operates entirely via a static client-side architecture with pre-partitioned JSON feeds and in-memory caches.

---

## Setup & Local Installation

### 1. Prerequisites
* **Node.js:** v18.0.0 or higher
* **Python:** v3.9+ (required only if running the Parquet ETL pipeline)

### 2. Frontend Installation & Dev Server
```bash
# Install frontend dependencies
npm install

# Start development server
npm run dev

```

Open `http://localhost:3000` in your browser.

---

### 3. Automated Python ETL Environment Setup

Automated scripts are included to provision an isolated Python virtual environment at `scripts/.venv` and install the required dependencies (`pandas`, `pyarrow`):

#### Linux / macOS / Git Bash:

```bash
chmod +x setup.sh
./setup.sh

```

#### Windows (PowerShell):

```powershell
.\setup.ps1

```

#### Windows (Command Prompt):

```cmd
setup.bat

```

#### Run the Telemetry Pipeline:

*(Note: Production JSON partitions are already pre-generated and included under `public/data/`)*

```bash
# Run the complete pipeline (Processes matches, manifest, and heatmaps)
python scripts/run_pipeline.py

```

---

## Feature Walkthrough

### 1. Interactive Minimap Viewport

* **Pan & Zoom:** Click and drag anywhere on the canvas to pan across the terrain. Use your mouse wheel to zoom dynamically (anchored to your cursor coordinates from $0.5\times$ to $5.0\times$).

* **Tactical Navigation HUD:** Use the floating controls in the bottom-right for incremental zooming (`+` / `-`) or click **FIT** to auto-center the map to your screen dimensions.

* **Dynamic Icon Scaling:** Player heads, combat markers, and KIA tombstones scale smoothly with your zoom level, remaining legible without crowding high-density compounds.

### 2. Match Replay & Timeline Scrubbing

* **Playback Controls:** Pinned at the top of the sidebar. Toggle between **Play** and **Pause**, restart playback, or switch between playback speeds (**1x**, **2x**, **5x**).

* **Direct Timeline Seeking:** Drag the progress scrubber or click anywhere along the duration track to jump to an exact elapsed second in the match.

* **Sub-Frame LERP Interpolation:** Continuous 60 FPS sub-frame linear interpolation ensures fluid entity tracking between discrete server sample ticks.

* **Terminal Entity States:** Players eliminated in combat display persistent skull markers (`[KIA]`), storm victims display purple hazard pins, and survivors who extract without dying are highlighted with green extraction badges (`[EXTRACTED]`).

### 3. Global Aggregate Heatmap Engine

* **Mode Switcher:** Toggle between **Playback** and **Heatmap** modes directly from the top navigation bar.

* **Global vs. Match Scope:**
* **Global Aggregate:** Composites thousands of binned density nodes across all 796 matches to expose macro-level choke points and neglected sectors.

* **Match Session:** Restricts density contours strictly to the selected match session.

* **Independent Layer Toggles:** Toggle **Combat** (firefights and eliminations), **Storm** (perimeter casualties), and **Traffic** (traversal footprints) on or off independently.

* **Intensity Multiplier:** Adjust the alpha gain slider in real-time from $0.1\times$ to $2.0\times$ for clear contrast across dense and sparse regions alike.

### 4. Roster Filtering & Chronological Combat Feed

* **Preset Filters:** Quickly isolate **Humans**, **Bots**, or **All Entities** in the sidebar dock.

* **Individual Entity Isolation:** Click individual player rows to track specific squad engagements and remove background noise.

* **Combat Log:** Switch to the **LOG** tab to view a chronological feed of kills, bot encounters, and storm casualties. Clicking any event automatically seeks the playback engine to that exact second.

### 5. Drag-and-Drop Raw Telemetry Ingestion

* Drag and drop any raw `.json` telemetry file from your local machine directly into the browser window.
* The visualizer parses, normalizes coordinates, and mounts the match immediately into the live session without requiring server reloads.

---

## Production Build & Deployment

To generate an optimized production bundle:

```bash
npm run build
npm run preview

```

The output in `dist/` can be deployed directly to Vercel, Netlify, or any static web host.

---

## Methodology & Tooling Note

AI programming assistants were utilized during development to accelerate canvas gradient lookups, component scaffolding, and TypeScript interface declarations. Coordinate projection math, spatial debugging (resolving double-scaling and Unreal vertical axis inversion), pipeline modularization, and level-design analyses were directed and validated manually.
