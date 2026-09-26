/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lila Black - Complete Spatial Telemetry Engine Type Definitions
 * Exact data model and coordinate projection systems for Lila Black Extraction Shooter.
 */

// 1. Union Types
export type GameMap = 'AmbroseValley' | 'GrandRift' | 'Lockdown';

export type TelemetryEventName =
  | 'Kill'
  | 'Killed'
  | 'BotKill'
  | 'BotKilled'
  | 'KilledByStorm'
  | 'Loot';

export type FilterPreset = 'ALL' | 'HUMANS' | 'BOTS' | 'CUSTOM';

// 2. Map Configuration & Projection System
export interface MapConfig {
  scale: number;
  originX: number;
  originZ: number;
  ext: 'png' | 'jpg';
}

export const MAP_CONFIGS: Record<GameMap, MapConfig> = {
  AmbroseValley: {
    scale: 900.0,
    originX: -370.0,
    originZ: -473.0,
    ext: 'png',
  },
  GrandRift: {
    scale: 581.0,
    originX: -290.0,
    originZ: -290.0,
    ext: 'png',
  },
  Lockdown: {
    scale: 1000.0,
    originX: -500.0,
    originZ: -500.0,
    ext: 'jpg',
  },
} as const;

// 3. Core Data Structures

/**
 * Trajectory coordinate point: [t (timestamp in seconds), px (canvas X 0..1024), py (canvas Y 0..1024)]
 */
export type PlayerTrajectory = [number, number, number];

export interface PlayerData {
  is_bot: boolean;
  path: PlayerTrajectory[];
}

export interface GameEvent {
  t: number;
  event: TelemetryEventName;
  user_id: string;
  is_bot: boolean;
  px: number;
  py: number;
}

export interface MatchData {
  match_id: string;
  map_id: GameMap;
  duration_sec: number;
  players: Record<string, PlayerData>;
  events: GameEvent[];
}

export interface ManifestMatch {
  match_id: string;
  map_id: GameMap;
  date: string;
  duration_sec: number;
  player_count: number;
  human_count: number;
  bot_count: number;
  event_count: number;
}

export interface Manifest {
  generated_at: string;
  total_matches: number;
  maps: GameMap[];
  dates: string[];
  matches: ManifestMatch[];
}

// 4. Playback and UI State
export interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number; // 0.5x, 1x, 2x, 4x, etc.
  duration: number;
}

export interface TelemetryFilterState {
  selectedMap: GameMap;
  selectedDate: string;
  selectedMatchId: string;
  filterPreset: FilterPreset;
  selectedPlayerIds: Set<string>;
  showLabels: boolean;
  showTrails: boolean;
  showEvents: boolean;
  showHeatmap: boolean;
}

// 5. Aggregate Heatmap Structures
export interface HeatmapPoint {
  px: number;
  py: number;
  weight: number;
  type: 'combat' | 'storm' | 'traffic';
}

export interface MapAggregateHeatmap {
  map_id: GameMap;
  total_kills: number;
  total_storm_deaths: number;
  points: HeatmapPoint[];
}

/**
 * Check if a player entity is a human or a bot based on ID semantics:
 * Humans: UUID string format (contains hyphens and letters)
 * Bots: Numeric strings
 */
export function isHumanPlayer(userId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
    (/[a-zA-Z-]/.test(userId) && isNaN(Number(userId)));
}

/**
 * Universal Match Data Normalizer & Coordinate Projector
 * Ingests any real Lila Black telemetry JSON, whether it uses:
 * - 3D world coordinates [t, x, y, z] (elevation 'y' ignored, horizontal is x, z)
 * - 2D world coordinates [t, x, z] or [t, x, y]
 * - Pre-projected canvas coordinates [t, px, py]
 * - Events with { x, z }, { x, y }, or { px, py }
 * - Missing or explicit is_bot fields
 */
export function normalizeMatchData(
  raw: any,
  fallbackMap: GameMap = 'AmbroseValley'
): MatchData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid match data object');
  }

  // 1. Resolve Map ID
  let mapId: GameMap = fallbackMap;
  const rawMap = String(raw.map_id || raw.map || '').trim();
  if (/ambrose/i.test(rawMap)) {
    mapId = 'AmbroseValley';
  } else if (/grand/i.test(rawMap)) {
    mapId = 'GrandRift';
  } else if (/lockdown/i.test(rawMap)) {
    mapId = 'Lockdown';
  }

  const mapConfig = MAP_CONFIGS[mapId];

  // 2. Resolve Players and Coordinate Space Detection
  const rawPlayers = raw.players || {};
  let detectedWorldCoords = false;

  // Pre-scan samples to determine if coordinates are world (x, z) or canvas pixels (0..1024)
  for (const playerVal of Object.values(rawPlayers) as any[]) {
    const path = playerVal?.path;
    if (Array.isArray(path)) {
      for (const sample of path) {
        if (!Array.isArray(sample) || sample.length < 3) continue;
        // If 4 elements [t, x, y, z] -> definitely 3D world coords
        if (sample.length >= 4) {
          detectedWorldCoords = true;
          break;
        }
        const c1 = sample[1];
        const c2 = sample[2];
        // If any coordinate is negative, or outside [0, 1024] -> definitely world coords
        if (c1 < 0 || c2 < 0 || c1 > 1024 || c2 > 1024) {
          detectedWorldCoords = true;
          break;
        }
        // If coordinate aligns with world origin bounds
        if (
          (c1 >= mapConfig.originX && c1 <= mapConfig.originX + mapConfig.scale) &&
          (c2 >= mapConfig.originZ && c2 <= mapConfig.originZ + mapConfig.scale) &&
          (mapConfig.originX < 0 || mapConfig.originZ < 0)
        ) {
          detectedWorldCoords = true;
          break;
        }
      }
    }
    if (detectedWorldCoords) break;
  }

  // Pre-scan events for world coordinate keys { x, z } or { x, y }
  if (!detectedWorldCoords && Array.isArray(raw.events)) {
    for (const ev of raw.events) {
      if (ev && (ev.x !== undefined || ev.z !== undefined)) {
        if (ev.px === undefined && ev.py === undefined) {
          detectedWorldCoords = true;
          break;
        }
        const c1 = ev.x;
        const c2 = ev.z !== undefined ? ev.z : ev.y;
        if (c1 !== undefined && (c1 < 0 || (c2 !== undefined && c2 < 0))) {
          detectedWorldCoords = true;
          break;
        }
      }
    }
  }

  const normalizedPlayers: Record<string, PlayerData> = {};
  let maxTimeFound = 0;

  for (const [userId, pData] of Object.entries(rawPlayers) as [string, any][]) {
    const rawPath = Array.isArray(pData?.path) ? pData.path : [];
    const normalizedPath: PlayerTrajectory[] = [];

    // Entity Semantics: Human vs Bot
    const isBot =
      typeof pData?.is_bot === 'boolean'
        ? pData.is_bot
        : !isHumanPlayer(userId);

    for (const sample of rawPath) {
      if (!Array.isArray(sample) || sample.length < 3) continue;
      const t = Number(sample[0]);
      if (t > maxTimeFound) maxTimeFound = t;

      let px = 0;
      let py = 0;

      if (sample.length >= 4) {
        // [t, x, y, z] -> World elevation 'y' is ignored. Horizontal plane is (x, z).
        const worldX = Number(sample[1]);
        const worldZ = Number(sample[3]);
        const [projPx, projPy] = [worldX, worldZ]
        px = projPx;
        py = projPy;
      } else if (detectedWorldCoords) {
        // [t, x, z] or [t, x, y]
        const worldX = Number(sample[1]);
        const worldZ = Number(sample[2]);
        const [projPx, projPy] = [worldX, worldZ]
        px = projPx;
        py = projPy;
      } else {
        // Already pixel coordinates
        px = Number(sample[1]);
        py = Number(sample[2]);
      }

      // Clamp to canvas borders (0 to 1024)
      px = Math.max(0, Math.min(1024, px));
      py = Math.max(0, Math.min(1024, py));

      normalizedPath.push([t, px, py]);
    }

    // Ensure path is chronologically sorted
    normalizedPath.sort((a, b) => a[0] - b[0]);

    normalizedPlayers[userId] = {
      is_bot: isBot,
      path: normalizedPath,
    };
  }

  // 3. Resolve Events
  const rawEvents = Array.isArray(raw.events) ? raw.events : [];
  const normalizedEvents: GameEvent[] = [];

  for (const rawEv of rawEvents) {
    if (!rawEv || typeof rawEv !== 'object') continue;
    const t = Number(rawEv.t ?? 0);
    if (t > maxTimeFound) maxTimeFound = t;

    const eventName = String(rawEv.event || 'Kill') as TelemetryEventName;
    const userId = String(rawEv.user_id || rawEv.userId || 'unknown');
    const isBot =
      typeof rawEv.is_bot === 'boolean'
        ? rawEv.is_bot
        : (normalizedPlayers[userId]?.is_bot ?? !isHumanPlayer(userId));

    let px = 0;
    let py = 0;

    if (rawEv.px !== undefined && rawEv.py !== undefined && !detectedWorldCoords) {
      px = Number(rawEv.px);
      py = Number(rawEv.py);
    } else {
      // World coordinates: prefer x and z, fallback to x and y
      const rawX = Number(rawEv.x ?? rawEv.px ?? 0);
      const rawZ = Number(rawEv.z ?? rawEv.y ?? rawEv.py ?? 0);
      const [projPx, projPy] = [rawX, rawZ]
      px = projPx;
      py = projPy;
    }

    px = Math.max(0, Math.min(1024, px));
    py = Math.max(0, Math.min(1024, py));

    normalizedEvents.push({
      t,
      event: eventName,
      user_id: userId,
      is_bot: isBot,
      px,
      py,
    });
  }

  normalizedEvents.sort((a, b) => a.t - b.t);

  // 4. Resolve Duration
  const duration_sec =
    Number(raw.duration_sec) > 0
      ? Number(raw.duration_sec)
      : Math.max(maxTimeFound, 10);

  const matchId = String(
    raw.match_id ||
      raw.id ||
      `imported_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );

  return {
    match_id: matchId,
    map_id: mapId,
    duration_sec,
    players: normalizedPlayers,
    events: normalizedEvents,
  };
}

// Backward compatibility alias
export type MapId = GameMap;
export type EventType = TelemetryEventName;
export type TelemetryEvent = GameEvent;
export type TelemetryManifest = Manifest;
export type MatchPartitionData = MatchData;
