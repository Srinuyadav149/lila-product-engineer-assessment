/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export type PlaybackSpeed = 1 | 2 | 5;

export interface UsePlaybackResult {
  currentTime: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  seek: (time: number) => void;
  togglePlay: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  reset: () => void;
}

/**
 * Custom hook to manage match telemetry playback timing using requestAnimationFrame.
 * Provides microsecond-precise frame delta advancement and seamless scrubber control.
 */
export function usePlayback(duration: number): UsePlaybackResult {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);

  // References for uninterrupted, closure-safe requestAnimationFrame loop
  const rAfIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const speedRef = useRef<PlaybackSpeed>(1);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(duration);

  // Keep mutable references in sync with state & props
  useEffect(() => {
    durationRef.current = duration;
    // If duration shrinks below currentTime, clamp it
    if (currentTimeRef.current > duration) {
      const clamped = Math.max(0, duration);
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
    }
  }, [duration]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Main Precision Animation Frame Loop
  useEffect(() => {
    if (!isPlaying) {
      if (rAfIdRef.current !== null) {
        cancelAnimationFrame(rAfIdRef.current);
        rAfIdRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;

      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }

      // Delta in seconds, clamped to 0.25s max to prevent huge jumps when switching browser tabs
      const deltaSec = Math.min((now - lastTimeRef.current) / 1000, 0.25);
      lastTimeRef.current = now;

      const current = currentTimeRef.current;
      const targetDuration = durationRef.current;
      const nextTime = current + deltaSec * speedRef.current;

      if (nextTime >= targetDuration) {
        currentTimeRef.current = targetDuration;
        setCurrentTime(targetDuration);
        setIsPlaying(false);
        isPlayingRef.current = false;
        rAfIdRef.current = null;
        lastTimeRef.current = null;
        return;
      }

      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      rAfIdRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    rAfIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rAfIdRef.current !== null) {
        cancelAnimationFrame(rAfIdRef.current);
        rAfIdRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [isPlaying]);

  // Exported Action: seek
  const seek = useCallback((time: number) => {
    const clamped = Math.min(Math.max(0, time), durationRef.current);
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
  }, []);

  // Exported Action: togglePlay
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const willPlay = !prev;
      if (willPlay) {
        // If restarting at or beyond duration, loop back to start
        if (currentTimeRef.current >= durationRef.current) {
          currentTimeRef.current = 0;
          setCurrentTime(0);
        }
        lastTimeRef.current = performance.now();
      }
      isPlayingRef.current = willPlay;
      return willPlay;
    });
  }, []);

  // Exported Action: setSpeed
  const setSpeed = useCallback((newSpeed: PlaybackSpeed) => {
    speedRef.current = newSpeed;
    setSpeedState(newSpeed);
  }, []);

  // Exported Action: reset
  const reset = useCallback(() => {
    if (rAfIdRef.current !== null) {
      cancelAnimationFrame(rAfIdRef.current);
      rAfIdRef.current = null;
    }
    lastTimeRef.current = null;
    isPlayingRef.current = false;
    setIsPlaying(false);
    currentTimeRef.current = 0;
    setCurrentTime(0);
  }, []);

  return {
    currentTime,
    isPlaying,
    speed,
    seek,
    togglePlay,
    setSpeed,
    reset,
  };
}

export default usePlayback;
