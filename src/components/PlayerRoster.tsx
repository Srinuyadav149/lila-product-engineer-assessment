/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  MatchData,
  FilterPreset,
  isHumanPlayer,
} from '../types/telemetry';
import {
  Users,
  Shield,
  Bot,
  Skull,
  Crosshair,
  Package,
  CheckSquare,
  Square,
  Check,
  X,
} from 'lucide-react';

export interface PlayerRosterProps {
  matchData: MatchData;
  currentTime: number;
  selectedPlayerIds: Set<string>;
  onSelectionChange: (newSelected: Set<string>, preset?: FilterPreset) => void;
  filterPreset: FilterPreset;
  onPresetChange: (preset: FilterPreset) => void;
}

export const PlayerRoster: React.FC<PlayerRosterProps> = ({
  matchData,
  currentTime,
  selectedPlayerIds,
  onSelectionChange,
  filterPreset,
  onPresetChange,
}) => {
  const allPlayerIds = useMemo(
    () => Object.keys(matchData.players),
    [matchData.players]
  );

  // Compute live combat stats per player up to currentTime
  const playerStats = useMemo(() => {
    const stats: Record<
      string,
      {
        isDead: boolean;
        deathReason?: string;
        deathTime?: number;
        kills: number;
        loots: number;
      }
    > = {};

    for (const pid of allPlayerIds) {
      stats[pid] = {
        isDead: false,
        kills: 0,
        loots: 0,
      };
    }

    for (const ev of matchData.events) {
      if (ev.t > currentTime) continue;

      const pStat = stats[ev.user_id];
      if (!pStat) continue;

      if (ev.event === 'Kill' || ev.event === 'BotKill') {
        pStat.kills += 1;
      } else if (ev.event === 'Loot') {
        pStat.loots += 1;
      } else if (
        ev.event === 'Killed' ||
        ev.event === 'BotKilled' ||
        ev.event === 'KilledByStorm'
      ) {
        pStat.isDead = true;
        pStat.deathTime = ev.t;
        pStat.deathReason = ev.event === 'KilledByStorm' ? 'STORM' : 'KIA';
      }
    }

    return stats;
  }, [allPlayerIds, matchData.events, currentTime]);

  // Batch action: Filter Preset Handlers
  const handlePresetSelect = (preset: FilterPreset) => {
    onPresetChange(preset);
    if (preset === 'ALL') {
      onSelectionChange(new Set(allPlayerIds), 'ALL');
    } else if (preset === 'HUMANS') {
      const humanIds = allPlayerIds.filter((id) => {
        const p = matchData.players[id];
        return typeof p.is_bot === 'boolean' ? !p.is_bot : isHumanPlayer(id);
      });
      onSelectionChange(new Set(humanIds), 'HUMANS');
    } else if (preset === 'BOTS') {
      const botIds = allPlayerIds.filter((id) => {
        const p = matchData.players[id];
        return typeof p.is_bot === 'boolean' ? p.is_bot : !isHumanPlayer(id);
      });
      onSelectionChange(new Set(botIds), 'BOTS');
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(new Set(allPlayerIds), 'ALL');
    onPresetChange('ALL');
  };

  const handleClearAll = () => {
    onSelectionChange(new Set(), 'CUSTOM');
    onPresetChange('CUSTOM');
  };

  const handleTogglePlayer = (userId: string) => {
    const nextSet = new Set(selectedPlayerIds);
    if (nextSet.has(userId)) {
      nextSet.delete(userId);
    } else {
      nextSet.add(userId);
    }
    onSelectionChange(nextSet, 'CUSTOM');
    onPresetChange('CUSTOM');
  };

  const totalCount = allPlayerIds.length;
  const activeCount = selectedPlayerIds.size;

  const formatShortId = (id: string, isBot: boolean): string => {
    if (isBot) {
      return `BOT-${id}`;
    }
    if (id.length > 12) {
      return `${id.slice(0, 4)}..${id.slice(-4)}`;
    }
    return id;
  };

  const formatTime = (seconds?: number): string => {
    if (seconds === undefined) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col h-full font-mono select-none overflow-hidden bg-neutral-900/40">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-neutral-800 space-y-3 bg-neutral-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs uppercase tracking-wider font-semibold text-neutral-200">
              Combat Roster
            </h2>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium">
            {activeCount} / {totalCount} Active
          </span>
        </div>

        {/* Preset Segmented Buttons */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px]">
          {(['ALL', 'HUMANS', 'BOTS', 'CUSTOM'] as FilterPreset[]).map(
            (preset) => {
              const isActive = filterPreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => handlePresetSelect(preset)}
                  className={`py-1 rounded text-center transition-all font-medium ${
                    isActive
                      ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                  }`}
                >
                  {preset === 'ALL'
                    ? 'All'
                    : preset === 'HUMANS'
                    ? 'Humans'
                    : preset === 'BOTS'
                    ? 'Bots'
                    : 'Custom'}
                </button>
              );
            }
          )}
        </div>

        {/* Batch Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={handleSelectAll}
            className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-300 hover:text-neutral-100 text-[11px] transition-colors"
          >
            <Check className="w-3 h-3 text-emerald-400" />
            <span>Select All</span>
          </button>
          <button
            onClick={handleClearAll}
            className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-300 hover:text-neutral-100 text-[11px] transition-colors"
          >
            <X className="w-3 h-3 text-red-400" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Participant List (Scrollable) */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60 p-2 space-y-1">
        {allPlayerIds.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            No participants detected in match telemetry.
          </div>
        ) : (
          allPlayerIds.map((userId) => {
            const player = matchData.players[userId];
            const isSelected = selectedPlayerIds.has(userId);
            const isBot = typeof player.is_bot === 'boolean' ? player.is_bot : !isHumanPlayer(userId);
            const stats = playerStats[userId] || {
              isDead: false,
              kills: 0,
              loots: 0,
            };

            return (
              <div
                key={userId}
                onClick={() => handleTogglePlayer(userId)}
                className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-neutral-800/40 border-neutral-700/80 hover:bg-neutral-800/60'
                    : 'bg-neutral-950/40 border-neutral-900/60 opacity-60 hover:opacity-90 hover:bg-neutral-900/80'
                }`}
              >
                {/* Left: Checkbox + Identity Badge + Label */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="text-neutral-400 group-hover:text-neutral-200">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-600" />
                    )}
                  </div>

                  {/* Entity Type Badge */}
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                      isBot
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isBot ? '●' : '▲'}
                  </div>

                  {/* User Identifier */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-semibold truncate ${
                          isSelected ? 'text-neutral-200' : 'text-neutral-400'
                        }`}
                        title={userId}
                      >
                        {formatShortId(userId, isBot)}
                      </span>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                      {stats.isDead ? (
                        <span className="flex items-center gap-1 text-red-400">
                          <Skull className="w-3 h-3" />
                          <span>
                            {stats.deathReason} {formatTime(stats.deathTime)}
                          </span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>ALIVE</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Live Combat Diagnostics (Kills, Loot) */}
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 pl-2">
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800"
                    title={`Kills: ${stats.kills}`}
                  >
                    <Crosshair className="w-3 h-3 text-orange-400" />
                    <span className="font-semibold text-neutral-300">
                      {stats.kills}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800"
                    title={`Loot secured: ${stats.loots}`}
                  >
                    <Package className="w-3 h-3 text-amber-400" />
                    <span className="font-semibold text-neutral-300">
                      {stats.loots}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer Stats Summary */}
      <div className="p-3 border-t border-neutral-800/80 bg-neutral-950/60 text-[11px] text-neutral-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-neutral-400" />
          <span>ISOLATION MATRIX</span>
        </div>
        <div className="text-[10px] text-neutral-400">
          {allPlayerIds.filter((id) => !matchData.players[id].is_bot).length} HUMANS |{' '}
          {allPlayerIds.filter((id) => matchData.players[id].is_bot).length} BOTS
        </div>
      </div>
    </div>
  );
};

export default PlayerRoster;
