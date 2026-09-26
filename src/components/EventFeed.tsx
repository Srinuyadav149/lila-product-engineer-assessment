/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { GameEvent, TelemetryEventName } from '../types/telemetry';
import { Radio } from 'lucide-react';

export interface EventFeedProps {
  events: GameEvent[];
  currentTime: number;
  onSeek: (time: number) => void;
  selectedPlayerIds?: Set<string>;
}

interface EventVisualConfig {
  glyph: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  label: string;
}

const EVENT_CONFIGS: Record<TelemetryEventName, EventVisualConfig> = {
  Kill: {
    glyph: '⚔',
    badgeBg: 'bg-orange-500/10',
    badgeBorder: 'border-orange-500/30',
    badgeText: 'text-orange-400',
    label: 'Kill',
  },
  BotKill: {
    glyph: '⚔',
    badgeBg: 'bg-orange-500/10',
    badgeBorder: 'border-orange-500/30',
    badgeText: 'text-orange-400',
    label: 'Bot Kill',
  },
  Killed: {
    glyph: '☠',
    badgeBg: 'bg-red-500/10',
    badgeBorder: 'border-red-500/30',
    badgeText: 'text-red-400',
    label: 'Killed',
  },
  BotKilled: {
    glyph: '☠',
    badgeBg: 'bg-red-500/10',
    badgeBorder: 'border-red-500/30',
    badgeText: 'text-red-400',
    label: 'Bot Killed',
  },
  KilledByStorm: {
    glyph: '⚡',
    badgeBg: 'bg-purple-500/10',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-400',
    label: 'Storm Death',
  },
  Loot: {
    glyph: '◆',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
    label: 'Loot Secured',
  },
};

export const EventFeed: React.FC<EventFeedProps> = ({
  events,
  currentTime,
  onSeek,
  selectedPlayerIds,
}) => {
  // Chronologically sorted events
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.t - b.t);
  }, [events]);

  const activeRowRef = useRef<HTMLDivElement | null>(null);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatUserId = (userId: string, isBot: boolean): string => {
    if (isBot) return `BOT-${userId}`;
    if (userId.length > 12) {
      return `${userId.slice(0, 4)}..${userId.slice(-4)}`;
    }
    return userId;
  };

  // Find index of the most recently occurred or active event
  const activeEventIndex = useMemo(() => {
    let closestIdx = -1;
    let minDiff = Infinity;
    sortedEvents.forEach((ev, idx) => {
      const diff = Math.abs(currentTime - ev.t);
      if (diff < 2.0 && diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    return closestIdx;
  }, [sortedEvents, currentTime]);

  return (
    <div className="flex flex-col h-full bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden font-mono select-none backdrop-blur-md">
      {/* Feed Header */}
      <div className="p-3 border-b border-neutral-800 bg-neutral-950/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-orange-400 animate-pulse" />
          <h2 className="text-xs uppercase tracking-wider font-semibold text-neutral-200">
            Combat Log Feed
          </h2>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
          {sortedEvents.length} Events
        </span>
      </div>

      {/* Chronological Event Rows */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-neutral-800/40">
        {sortedEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            No telemetry events recorded for this match.
          </div>
        ) : (
          sortedEvents.map((ev, index) => {
            const config =
              EVENT_CONFIGS[ev.event] || EVENT_CONFIGS.Kill;
            const isOccurred = ev.t <= currentTime;
            const isActive = Math.abs(currentTime - ev.t) < 2.0;
            const isFilteredIn =
              !selectedPlayerIds || selectedPlayerIds.has(ev.user_id);

            return (
              <div
                key={`${ev.user_id}-${ev.t}-${index}`}
                ref={isActive ? activeRowRef : null}
                onClick={() => onSeek(ev.t)}
                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-neutral-800/90 border-orange-500/80 shadow-[0_0_12px_rgba(249,115,22,0.25)] scale-[1.01]'
                    : isOccurred
                    ? 'bg-neutral-950/50 border-neutral-800/80 hover:bg-neutral-800/50 hover:border-neutral-700'
                    : 'bg-neutral-950/20 border-neutral-900/40 opacity-30 hover:opacity-60'
                } ${!isFilteredIn ? 'opacity-20' : ''}`}
                title={`Jump to ${formatTime(ev.t)} (${ev.event})`}
              >
                {/* Left: Glyph + Entity ID + Event Name */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Event Glyph Badge */}
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-xs border ${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`}
                  >
                    {config.glyph}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-neutral-200 truncate">
                        {formatUserId(ev.user_id, ev.is_bot)}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        ({ev.is_bot ? 'BOT' : 'HUMAN'})
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {config.label}
                    </div>
                  </div>
                </div>

                {/* Right: Timestamp */}
                <div className="flex items-center gap-2 pl-2 flex-shrink-0">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      isActive
                        ? 'bg-orange-500 text-neutral-950'
                        : isOccurred
                        ? 'bg-neutral-800 text-neutral-300'
                        : 'text-neutral-600'
                    }`}
                  >
                    {formatTime(ev.t)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default EventFeed;
