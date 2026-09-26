/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  GameMap,
  Manifest,
  ManifestMatch,
  MatchData,
  FilterPreset,
  MAP_CONFIGS,
  normalizeMatchData,
  MapAggregateHeatmap,
} from './types/telemetry';
import { usePlayback } from './hooks/usePlayback';
import { MapCanvas } from './components/MapCanvas';
import { MapViewport } from './components/MapViewport';
import { PlaybackControls } from './components/PlaybackControls';
import { PlayerRoster } from './components/PlayerRoster';
import { EventFeed } from './components/EventFeed';
import { HeatmapCanvas, HeatmapLayersState } from './components/HeatmapCanvas';
import {
  Crosshair,
  MapPin,
  Calendar,
  Layers,
  Users,
  Eye,
  EyeOff,
  Radio,
  Loader2,
  AlertTriangle,
  Zap,
  Upload,
  CheckCircle2,
  X,
  Flame,
  Footprints,
  Sliders,
  Globe,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

export default function App() {
  const PREFERRED_DEFAULT_MAP: GameMap = 'AmbroseValley';

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState<boolean>(true);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const [matchStore, setMatchStore] = useState<Map<string, MatchData>>(new Map());

  const [selectedMap, setSelectedMap] = useState<GameMap>(PREFERRED_DEFAULT_MAP);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [matchLoading, setMatchLoading] = useState<boolean>(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const [heatmapMode, setHeatmapMode] = useState<'GLOBAL' | 'MATCH'>('GLOBAL');
  const [globalHeatmap, setGlobalHeatmap] = useState<MapAggregateHeatmap | null>(null);
  const [heatmapLayers, setHeatmapLayers] = useState<HeatmapLayersState>({
    combat: true,
    storm: true,
    traffic: true,
  });
  const [heatmapIntensity, setHeatmapIntensity] = useState<number>(1.0);

  const [ingestBanner, setIngestBanner] = useState<{
    matchId: string;
    mapId: GameMap;
    humans: number;
    bots: number;
    events: number;
    duration: number;
  } | null>(null);

  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('ALL');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'PLAYBACK' | 'HEATMAP'>('PLAYBACK');
  const [activeRightTab, setActiveRightTab] = useState<'roster' | 'events'>('roster');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Current zoom level
  const [viewportZoom, setViewportZoom] = useState<number>(1.0);

  // Stable handler preventing unnecessary renders
  const handleTransformChange = useCallback((scale: number) => {
    setViewportZoom(scale);
  }, []);

  const matchDuration = matchData?.duration_sec ?? 0;
  const {
    currentTime,
    isPlaying,
    speed,
    seek,
    togglePlay,
    setSpeed,
    reset: resetPlayback,
  } = usePlayback(matchDuration);

  // 1. Fetch Manifest
  useEffect(() => {
    let isCancelled = false;
    setManifestLoading(true);
    setManifestError(null);

    fetch('/data/manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Manifest>;
      })
      .then((data) => {
        if (isCancelled) return;
        setManifest(data);

        if (data.matches && data.matches.length > 0) {
          // Filter to preferred map first, or fallback to all matches
          const mapMatches = data.matches.filter((m) => m.map_id === PREFERRED_DEFAULT_MAP);
          const candidatePool = mapMatches.length > 0 ? mapMatches : data.matches;

          // Pick the match with the most events and human activity for the best demo
          const showcaseMatch = [...candidatePool].sort((a, b) => {
            // Prioritize matches with human players and high event counts
            if (b.human_count !== a.human_count) {
              return b.human_count - a.human_count;
            }
            return b.event_count - a.event_count;
          })[0];

          setSelectedMap(showcaseMatch.map_id);
          setSelectedDate(showcaseMatch.date);
          setSelectedMatchId(showcaseMatch.match_id);
        }
        setManifestLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        setManifestError(err.message || 'Error loading manifest.json');
        setManifestLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const availableDates = useMemo(() => {
    if (!manifest) return [];
    const dates = new Set<string>();
    manifest.matches
      .filter((m) => m.map_id === selectedMap)
      .forEach((m) => dates.add(m.date));
    return Array.from(dates);
  }, [manifest, selectedMap]);

  const filteredMatches = useMemo(() => {
    if (!manifest) return [];
    return manifest.matches.filter(
      (m) => m.map_id === selectedMap && (selectedDate ? m.date === selectedDate : true)
    );
  }, [manifest, selectedMap, selectedDate]);

  const handleMapChange = (newMap: GameMap) => {
    setSelectedMap(newMap);
    if (!manifest) return;
    const mapMatches = manifest.matches.filter((m) => m.map_id === newMap);
    if (mapMatches.length > 0) {
      const nextMatch = mapMatches[0];
      setSelectedDate(nextMatch.date);
      setSelectedMatchId(nextMatch.match_id);
    } else {
      setSelectedDate('');
      setSelectedMatchId('');
      setMatchData(null);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    if (!manifest) return;
    const dateMatches = manifest.matches.filter(
      (m) => m.map_id === selectedMap && m.date === newDate
    );
    if (dateMatches.length > 0) {
      setSelectedMatchId(dateMatches[0].match_id);
    }
  };

  const ingestRawTelemetryData = useCallback(
    (rawJson: any) => {
      try {
        const normalized = normalizeMatchData(rawJson, selectedMap);
        setMatchStore((prev) => new Map(prev).set(normalized.match_id, normalized));

        const matchDate =
          rawJson.date || new Date().toISOString().slice(0, 10).replace(/-/g, '_');
        const playerCount = Object.keys(normalized.players).length;
        const humanCount = Object.values(normalized.players).filter((p) => !p.is_bot).length;
        const botCount = Object.values(normalized.players).filter((p) => p.is_bot).length;

        const manifestEntry: ManifestMatch = {
          match_id: normalized.match_id,
          map_id: normalized.map_id,
          date: matchDate,
          duration_sec: normalized.duration_sec,
          player_count: playerCount,
          human_count: humanCount,
          bot_count: botCount,
          event_count: normalized.events.length,
        };

        setManifest((prev) => {
          const prevMatches = prev?.matches || [];
          const existingIdx = prevMatches.findIndex((m) => m.match_id === normalized.match_id);
          const newMatches =
            existingIdx >= 0
              ? prevMatches.map((m, idx) => (idx === existingIdx ? manifestEntry : m))
              : [manifestEntry, ...prevMatches];

          return {
            generated_at: new Date().toISOString(),
            total_matches: newMatches.length,
            maps: Array.from(new Set(newMatches.map((m) => m.map_id))) as GameMap[],
            dates: Array.from(new Set(newMatches.map((m) => m.date))),
            matches: newMatches,
          };
        });

        setSelectedMap(normalized.map_id);
        setSelectedDate(matchDate);
        setSelectedMatchId(normalized.match_id);
        setMatchData(normalized);
        setSelectedPlayerIds(new Set(Object.keys(normalized.players)));
        setFilterPreset('ALL');
        resetPlayback();

        setIngestBanner({
          matchId: normalized.match_id,
          mapId: normalized.map_id,
          humans: humanCount,
          bots: botCount,
          events: normalized.events.length,
          duration: normalized.duration_sec,
        });

        setMatchLoading(false);
      } catch (err: any) {
        setMatchError(`Failed to parse telemetry: ${err.message}`);
      }
    },
    [selectedMap, resetPlayback]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        if (!file.name.endsWith('.json')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target?.result as string);
            ingestRawTelemetryData(parsed);
          } catch (err: any) {
            setMatchError(`JSON parse error: ${err.message}`);
          }
        };
        reader.readAsText(file);
      });
    },
    [ingestRawTelemetryData]
  );

  useEffect(() => {
    if (!selectedMatchId) return;

    if (matchStore.has(selectedMatchId)) {
      const stored = matchStore.get(selectedMatchId)!;
      setMatchData(stored);
      setSelectedPlayerIds(new Set(Object.keys(stored.players)));
      setFilterPreset('ALL');
      resetPlayback();
      return;
    }

    let isCancelled = false;
    setMatchLoading(true);
    setMatchError(null);
    resetPlayback();

    fetch(`/data/matches/${selectedMatchId}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Match ${selectedMatchId} not found`);
        return res.json();
      })
      .then((raw) => {
        if (isCancelled) return;
        const normalized = normalizeMatchData(raw, selectedMap);
        setMatchStore((prev) => new Map(prev).set(selectedMatchId, normalized));
        setMatchData(normalized);
        setSelectedPlayerIds(new Set(Object.keys(normalized.players)));
        setFilterPreset('ALL');
        setMatchLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        setMatchError(err.message);
        setMatchLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedMatchId, selectedMap, matchStore, resetPlayback]);

  useEffect(() => {
    if (!selectedMap) return;
    fetch(`/data/heatmaps/${selectedMap}.json`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => setGlobalHeatmap(data))
      .catch(() => setGlobalHeatmap(null));
  }, [selectedMap]);

  const matchHeatmapData = useMemo(() => {
    if (!matchData) return null;
    const derivedPoints: Array<{
      px: number;
      py: number;
      weight: number;
      type: 'combat' | 'storm' | 'traffic';
    }> = [];

    matchData.events.forEach((ev) => {
      const isStorm = ev.event === 'KilledByStorm';
      const isKill =
        ev.event === 'Kill' ||
        ev.event === 'BotKill' ||
        ev.event === 'Killed' ||
        ev.event === 'BotKilled';
      derivedPoints.push({
        px: ev.px,
        py: ev.py,
        weight: isStorm ? 1.0 : isKill ? 0.85 : 0.5,
        type: isStorm ? 'storm' : 'combat',
      });
    });

    Object.values(matchData.players).forEach((p) => {
      const path = p.path;
      const step = Math.max(1, Math.floor(path.length / 20));
      for (let i = 0; i < path.length; i += step) {
        derivedPoints.push({
          px: path[i][1],
          py: path[i][2],
          weight: p.is_bot ? 0.25 : 0.4,
          type: 'traffic',
        });
      }
    });

    return {
      map_id: selectedMap,
      total_kills: matchData.events.filter((e) => e.event.includes('Kill')).length,
      total_storm_deaths: matchData.events.filter((e) => e.event === 'KilledByStorm').length,
      points: derivedPoints,
    };
  }, [matchData, selectedMap]);

  const activeHeatmapData = heatmapMode === 'GLOBAL' ? globalHeatmap : matchHeatmapData;

  const activeMatchMeta = useMemo(() => {
    if (!manifest) return null;
    return manifest.matches.find((m) => m.match_id === selectedMatchId) || null;
  }, [manifest, selectedMatchId]);

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased overflow-hidden">
      {/* Top Header */}
      <header className="flex-shrink-0 border-b border-neutral-800/80 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Crosshair className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold tracking-wider uppercase text-neutral-100 font-mono">
              Lila Black
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-semibold">
              TELEMETRY
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <select
              value={selectedMap}
              onChange={(e) => handleMapChange(e.target.value as GameMap)}
              className="bg-transparent text-neutral-200 focus:outline-none cursor-pointer text-xs font-semibold"
            >
              {(['AmbroseValley', 'GrandRift', 'Lockdown'] as GameMap[]).map((mapId) => (
                <option key={mapId} value={mapId} className="bg-neutral-900">
                  {mapId}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
            <Calendar className="w-3 h-3 text-neutral-400" />
            <select
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-neutral-200 focus:outline-none cursor-pointer text-xs"
            >
              {availableDates.map((date) => (
                <option key={date} value={date} className="bg-neutral-900">
                  {date.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
            <Layers className="w-3 h-3 text-neutral-400" />
            <select
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="bg-transparent text-neutral-200 focus:outline-none cursor-pointer text-xs font-mono max-w-[130px] truncate"
            >
              {filteredMatches.map((m) => (
                <option key={m.match_id} value={m.match_id} className="bg-neutral-900">
                  {m.match_id.slice(0, 8)}... ({m.player_count}P)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center bg-neutral-950 p-0.5 rounded border border-neutral-800">
            <button
              onClick={() => setViewMode('PLAYBACK')}
              className={`px-2 py-1 rounded font-semibold text-xs transition-all ${
                viewMode === 'PLAYBACK'
                  ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Playback
            </button>
            <button
              onClick={() => setViewMode('HEATMAP')}
              className={`px-2 py-1 rounded font-semibold text-xs transition-all ${
                viewMode === 'HEATMAP'
                  ? 'bg-neutral-800 text-orange-400 shadow-sm border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Heatmap
            </button>
          </div>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-semibold transition-all ${
              showLabels
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800'
            }`}
          >
            {showLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-neutral-500" />}
            <span className="hidden sm:inline">Labels</span>
          </button>

          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-semibold transition-all ${
              isSidebarOpen
                ? 'bg-neutral-800 text-neutral-200 border-neutral-700 shadow-sm'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {isSidebarOpen ? (
              <PanelRightClose className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <span className="hidden sm:inline">Sidebar</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
                e.target.value = '';
              }
            }}
            accept=".json"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all"
          >
            <Upload className="w-3 h-3" />
            <span>Import</span>
          </button>
        </div>
      </header>

      {/* Ingestion Banner */}
      {ingestBanner && (
        <div className="flex-shrink-0 bg-emerald-950/70 border-b border-emerald-800/80 px-3 py-1 flex items-center justify-between text-xs font-mono text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Ingested <strong className="text-white">{ingestBanner.matchId.slice(0, 12)}</strong> on{' '}
              {ingestBanner.mapId} ({ingestBanner.humans}H / {ingestBanner.bots}B).
            </span>
          </div>
          <button onClick={() => setIngestBanner(null)} className="text-emerald-400 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Workspace Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsDraggingOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className="relative flex-1 min-h-0 flex flex-row overflow-hidden"
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-neutral-950/90 backdrop-blur-sm border-2 border-dashed border-emerald-500 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
            <Upload className="w-10 h-10 text-emerald-400 mb-2 animate-bounce" />
            <h3 className="text-sm font-bold font-mono text-emerald-300">DROP TELEMETRY JSON HERE</h3>
          </div>
        )}

        <section className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-neutral-950">
          {manifestLoading || matchLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 font-mono text-neutral-400">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              <div className="text-xs uppercase tracking-wider">Loading Spatial Data...</div>
            </div>
          ) : matchError || manifestError ? (
            <div className="m-auto max-w-sm bg-red-950/40 border border-red-800/80 rounded-xl p-5 text-center space-y-2 font-mono">
              <AlertTriangle className="w-7 h-7 text-red-400 mx-auto" />
              <div className="text-xs font-bold text-red-200">Load Error</div>
              <p className="text-[11px] text-red-300/80">{matchError || manifestError}</p>
            </div>
          ) : matchData ? (
            <div className="flex-1 min-h-0 w-full h-full relative overflow-hidden">
              <MapViewport onTransformChange={handleTransformChange}>
                {viewMode === 'HEATMAP' ? (
                  <HeatmapCanvas
                    mapId={selectedMap}
                    heatmapData={activeHeatmapData}
                    activeLayers={heatmapLayers}
                    intensity={heatmapIntensity}
                  />
                ) : (
                  <MapCanvas
                    matchData={matchData}
                    currentTime={currentTime}
                    selectedPlayerIds={selectedPlayerIds}
                    showLabels={showLabels}
                    viewMode={viewMode}
                    zoom={viewportZoom}
                  />
                )}
              </MapViewport>

              {/* Floating Heatmap HUD */}
              {viewMode === 'HEATMAP' && (
                <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 bg-neutral-900/90 border border-neutral-800 rounded-xl p-2 shadow-2xl backdrop-blur-md font-mono text-xs max-w-[calc(100vw-32px)]">
                  <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800">
                    <button
                      onClick={() => setHeatmapMode('GLOBAL')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                        heatmapMode === 'GLOBAL'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="Aggregate from all matches"
                    >
                      <Globe className="w-3 h-3 text-emerald-400" />
                      <span>Global Aggregate</span>
                    </button>

                    <button
                      onClick={() => setHeatmapMode('MATCH')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                        heatmapMode === 'MATCH'
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                      title="Density from active match session"
                    >
                      <span>Match Session</span>
                    </button>
                  </div>

                  <div className="w-[1px] h-4 bg-neutral-800" />

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setHeatmapLayers((prev) => ({ ...prev, combat: !prev.combat }))
                      }
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all border ${
                        heatmapLayers.combat
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-neutral-950 text-neutral-500 border-neutral-800'
                      }`}
                    >
                      <Flame className="w-3 h-3 text-red-400" />
                      <span>Combat</span>
                    </button>

                    <button
                      onClick={() =>
                        setHeatmapLayers((prev) => ({ ...prev, storm: !prev.storm }))
                      }
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all border ${
                        heatmapLayers.storm
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-neutral-950 text-neutral-500 border-neutral-800'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span>Storm</span>
                    </button>

                    <button
                      onClick={() =>
                        setHeatmapLayers((prev) => ({ ...prev, traffic: !prev.traffic }))
                      }
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all border ${
                        heatmapLayers.traffic
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-neutral-950 text-neutral-500 border-neutral-800'
                      }`}
                    >
                      <Footprints className="w-3 h-3 text-cyan-400" />
                      <span>Traffic</span>
                    </button>
                  </div>

                  <div className="w-[1px] h-4 bg-neutral-800" />

                  <div className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
                    <Sliders className="w-3 h-3" />
                    <span>{heatmapIntensity.toFixed(1)}x</span>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={heatmapIntensity}
                      onChange={(e) => setHeatmapIntensity(parseFloat(e.target.value))}
                      className="w-16 accent-emerald-500 cursor-pointer h-1 bg-neutral-950 rounded border border-neutral-800"
                    />
                  </div>

                  <span className="text-[10px] text-neutral-500 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800 font-bold">
                    {activeHeatmapData?.points?.length ?? 0} NODES
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* Right Dock */}
        {matchData && isSidebarOpen && (
          <aside className="w-72 lg:w-80 xl:w-96 flex flex-col min-h-0 border-l border-neutral-800 bg-neutral-900/80 backdrop-blur-md flex-shrink-0 h-full overflow-hidden transition-all duration-200">
            {viewMode === 'PLAYBACK' && (
              <div className="flex-shrink-0">
                <PlaybackControls
                  currentTime={currentTime}
                  duration={matchDuration}
                  isPlaying={isPlaying}
                  speed={speed}
                  onSeek={seek}
                  onTogglePlay={togglePlay}
                  onSetSpeed={setSpeed}
                  onRestart={resetPlayback}
                />
              </div>
            )}

            <div className="flex-shrink-0 flex border-b border-neutral-800 bg-neutral-950 font-mono text-xs">
              <button
                onClick={() => setActiveRightTab('roster')}
                className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 font-semibold transition-all border-b-2 ${
                  activeRightTab === 'roster'
                    ? 'border-emerald-500 text-emerald-400 bg-neutral-900/60'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Users className="w-3 h-3" />
                <span className="truncate">ROSTER ({Object.keys(matchData.players).length})</span>
              </button>

              <button
                onClick={() => setActiveRightTab('events')}
                className={`flex-1 py-2 px-2 flex items-center justify-center gap-1.5 font-semibold transition-all border-b-2 ${
                  activeRightTab === 'events'
                    ? 'border-orange-500 text-orange-400 bg-neutral-900/60'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span className="truncate">LOG ({matchData.events.length})</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {activeRightTab === 'roster' ? (
                <div className="h-full w-full overflow-hidden">
                  <PlayerRoster
                    matchData={matchData}
                    currentTime={currentTime}
                    selectedPlayerIds={selectedPlayerIds}
                    onSelectionChange={(newSelected, preset) => {
                      setSelectedPlayerIds(newSelected);
                      if (preset) setFilterPreset(preset);
                    }}
                    filterPreset={filterPreset}
                    onPresetChange={setFilterPreset}
                  />
                </div>
              ) : (
                <div className="h-full w-full p-2 overflow-hidden">
                  <EventFeed
                    events={matchData.events}
                    currentTime={currentTime}
                    onSeek={seek}
                    selectedPlayerIds={selectedPlayerIds}
                  />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="flex-shrink-0 border-t border-neutral-800/80 px-3 py-1 bg-neutral-950 text-neutral-500 text-[10px] font-mono flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>60 FPS LERP PIPELINE</span>
          <span className="text-neutral-700">|</span>
          <span>MAP: {selectedMap.toUpperCase()}</span>
          {activeMatchMeta && (
            <>
              <span className="text-neutral-700">|</span>
              <span className="text-neutral-400">
                {activeMatchMeta.human_count}H • {activeMatchMeta.bot_count}B
              </span>
            </>
          )}
        </div>
        <div>LILA BLACK TELEMETRY</div>
      </footer>
    </div>
  );
}