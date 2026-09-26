/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PlaybackSpeed } from '../hooks/usePlayback';
import { Play, Pause, RotateCcw } from 'lucide-react';

export interface PlaybackControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  onRestart: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  currentTime,
  duration,
  isPlaying,
  speed,
  onSeek,
  onTogglePlay,
  onSetSpeed,
  onRestart,
}) => {
  const formatTime = (timeInSec: number): string => {
    const clamped = Math.max(0, timeInSec);
    const m = Math.floor(clamped / 60);
    const s = Math.floor(clamped % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. Strictly clamp between 0% and 100% to prevent edge-drift
  const progressPercent =
    duration > 0
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0;

  return (
    <div className="w-full bg-neutral-950/80 border-b border-neutral-800 p-3 font-mono select-none">
      {/* Scrubber Header */}
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 font-bold text-sm tracking-wider">
            {formatTime(currentTime)}
          </span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-400 text-xs">{formatTime(duration)}</span>
        </div>

        <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
          {progressPercent.toFixed(0)}%
        </div>
      </div>

      {/* Scrubber Track Container */}
      <div className="relative flex items-center h-4 group cursor-pointer mb-2">
        {/* Track Background */}
        <div className="absolute left-0 right-0 h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 pointer-events-none">
          {/* Synchronized Fill Bar: NO CSS TRANSITION DELAY */}
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Invisible Native Range Input for Flawless Click & Drag Hit-testing */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(duration, Math.max(0, currentTime))}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
          aria-label="Timeline scrubber"
        />

        {/* Synchronized Thumb Dot: Updates in lockstep with the fill bar */}
        <div
          className="absolute w-3 h-3 rounded-full bg-white border-2 border-emerald-500 shadow pointer-events-none -translate-x-1/2 will-change-transform"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Control Buttons Row */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800/40">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all shadow-sm ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>

          <button
            onClick={onRestart}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors"
            title="Restart playback"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
          {([1, 2, 5] as PlaybackSpeed[]).map((val) => (
            <button
              key={val}
              onClick={() => onSetSpeed(val)}
              className={`px-2 py-0.5 rounded font-semibold transition-all ${
                speed === val
                  ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {val}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaybackControls;