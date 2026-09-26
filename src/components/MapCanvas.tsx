/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { MatchData, MAP_CONFIGS, isHumanPlayer } from '../types/telemetry';
import {
  drawHumanHead,
  drawBotHead,
  drawEventMarker,
  CANVAS_SIZE,
} from './CanvasHelpers';

export interface MapCanvasProps {
  matchData: MatchData;
  currentTime: number;
  selectedPlayerIds: Set<string>;
  showLabels: boolean;
  viewMode?: 'PLAYBACK' | 'HEATMAP';
  zoom?: number;
}

interface EntityLifecycle {
  userId: string;
  isBot: boolean;
  tStart: number;
  tEnd: number;
  isEliminated: boolean;
  eliminationType?: 'Killed' | 'BotKilled' | 'KilledByStorm';
  spawnPos: [number, number];
  terminalPos: [number, number];
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  matchData,
  currentTime,
  selectedPlayerIds,
  showLabels,
  viewMode = 'PLAYBACK',
  zoom = 1.0,
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dynamic icon scaling factor: keeps markers legible without ballooning at high zooms
  const iconScale = useMemo(() => {
    return Math.max(0.65, Math.min(2.2, Math.pow(Math.max(0.2, zoom), 0.45)));
  }, [zoom]);

  // 1. Analyze Entity Lifecycles (Spawn, End, Elimination vs Extraction)
  const entityLifecycles = useMemo(() => {
    const lifecycles = new Map<string, EntityLifecycle>();

    for (const [userId, player] of Object.entries(matchData.players)) {
      const path = player.path;
      if (!path || path.length === 0) continue;

      const tStart = path[0][0];
      const spawnPos: [number, number] = [path[0][1], path[0][2]];
      const finalSample = path[path.length - 1];
      let terminalPos: [number, number] = [finalSample[1], finalSample[2]];
      let tEnd = finalSample[0];
      let isEliminated = false;
      let eliminationType: 'Killed' | 'BotKilled' | 'KilledByStorm' | undefined;

      for (const ev of matchData.events) {
        if (
          ev.user_id === userId &&
          (ev.event === 'Killed' ||
            ev.event === 'BotKilled' ||
            ev.event === 'KilledByStorm')
        ) {
          isEliminated = true;
          eliminationType = ev.event;
          tEnd = ev.t;
          terminalPos = [ev.px, ev.py];
          break;
        }
      }

      lifecycles.set(userId, {
        userId,
        isBot: typeof player.is_bot === 'boolean' ? player.is_bot : !isHumanPlayer(userId),
        tStart,
        tEnd,
        isEliminated,
        eliminationType,
        spawnPos,
        terminalPos,
      });
    }

    return lifecycles;
  }, [matchData]);

  // Layer 1: Static Background Canvas
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;
    const mapConfig = MAP_CONFIGS[matchData.map_id];
    const ext = mapConfig?.ext ?? 'png';
    const imageSrc = `/minimaps/${matchData.map_id}_Minimap.${ext}`;

    const renderFallbackGrid = () => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 1;
      const step = 64;
      for (let x = 0; x <= CANVAS_SIZE; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_SIZE);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_SIZE; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_SIZE, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.lineWidth = 1.5;
      const center = CANVAS_SIZE / 2;
      [128, 256, 384, 480].forEach((r) => {
        ctx.beginPath();
        ctx.arc(center, center, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.textAlign = 'center';
      ctx.fillText(`TACTICAL GRID: ${matchData.map_id.toUpperCase()}`, center, center);
    };

    renderFallbackGrid();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      if (isCancelled) return;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const gradient = ctx.createRadialGradient(
        CANVAS_SIZE / 2,
        CANVAS_SIZE / 2,
        CANVAS_SIZE * 0.35,
        CANVAS_SIZE / 2,
        CANVAS_SIZE / 2,
        CANVAS_SIZE * 0.72
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    };

    img.onerror = () => {
      if (!isCancelled) renderFallbackGrid();
    };

    return () => {
      isCancelled = true;
    };
  }, [matchData.map_id]);

  // Layer 2: Dynamic 60 FPS Telemetry Overlay Layer
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (viewMode === 'HEATMAP') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (const [userId, player] of Object.entries(matchData.players)) {
        if (!selectedPlayerIds.has(userId)) continue;
        const path = player.path;
        if (!path) continue;

        ctx.strokeStyle = player.is_bot
          ? 'rgba(239, 68, 68, 0.12)'
          : 'rgba(34, 197, 94, 0.18)';
        ctx.lineWidth = 6 * iconScale;
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
          const [, px, py] = path[i];
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      for (const ev of matchData.events) {
        if (!selectedPlayerIds.has(ev.user_id)) continue;

        const isDeath =
          ev.event === 'Killed' ||
          ev.event === 'BotKilled' ||
          ev.event === 'KilledByStorm';
        const isKill = ev.event === 'Kill' || ev.event === 'BotKill';

        const radius = (isDeath ? 48 : isKill ? 40 : 28) * iconScale;
        const radGrad = ctx.createRadialGradient(
          ev.px,
          ev.py,
          0,
          ev.px,
          ev.py,
          radius
        );

        if (isDeath) {
          radGrad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
          radGrad.addColorStop(0.3, 'rgba(220, 38, 38, 0.55)');
          radGrad.addColorStop(0.7, 'rgba(185, 28, 28, 0.25)');
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else if (isKill) {
          radGrad.addColorStop(0, 'rgba(249, 115, 22, 0.85)');
          radGrad.addColorStop(0.4, 'rgba(234, 88, 12, 0.5)');
          radGrad.addColorStop(0.8, 'rgba(194, 65, 12, 0.2)');
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          radGrad.addColorStop(0, 'rgba(234, 179, 8, 0.65)');
          radGrad.addColorStop(0.5, 'rgba(202, 138, 4, 0.3)');
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(ev.px, ev.py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      for (const ev of matchData.events) {
        if (selectedPlayerIds.has(ev.user_id)) {
          ctx.save();
          ctx.translate(ev.px, ev.py);
          ctx.scale(iconScale, iconScale);
          ctx.translate(-ev.px, -ev.py);
          drawEventMarker(ctx, ev.event, ev.px, ev.py);
          ctx.restore();
        }
      }
      return;
    }

    // PLAYBACK VIEW
    const headsToRender: Array<{
      userId: string;
      isBot: boolean;
      px: number;
      py: number;
      state: 'ACTIVE' | 'ELIMINATED' | 'EXTRACTED';
      eliminationType?: string;
    }> = [];

    for (const [userId, player] of Object.entries(matchData.players)) {
      if (!selectedPlayerIds.has(userId)) continue;
      const path = player.path;
      if (!path || path.length === 0) continue;

      const lifecycle = entityLifecycles.get(userId);
      if (!lifecycle) continue;

      const { tStart, tEnd, isEliminated, eliminationType, spawnPos, terminalPos } =
        lifecycle;

      let curX = spawnPos[0];
      let curY = spawnPos[1];
      let entityState: 'ACTIVE' | 'ELIMINATED' | 'EXTRACTED' = 'ACTIVE';

      if (currentTime < tStart) {
        curX = spawnPos[0];
        curY = spawnPos[1];
        entityState = 'ACTIVE';
      } else if (currentTime >= tEnd) {
        curX = terminalPos[0];
        curY = terminalPos[1];
        entityState = isEliminated ? 'ELIMINATED' : 'EXTRACTED';
      } else {
        let p0 = path[0];
        let p1 = path[0];

        for (let i = 0; i < path.length; i++) {
          if (path[i][0] <= currentTime) {
            p0 = path[i];
            p1 = path[i + 1] || path[i];
          } else {
            break;
          }
        }

        const t0 = p0[0];
        const t1 = p1[0];
        const x0 = p0[1];
        const y0 = p0[2];
        const x1 = p1[1];
        const y1 = p1[2];

        if (t0 === t1 || currentTime === t0) {
          curX = x0;
          curY = y0;
        } else if (t1 - t0 > 5.0) {
          curX = x0;
          curY = y0;
        } else {
          const alpha = (currentTime - t0) / (t1 - t0);
          curX = x0 + alpha * (x1 - x0);
          curY = y0 + alpha * (y1 - y0);
        }
        entityState = 'ACTIVE';
      }

      const trailPoints: [number, number][] = [];
      for (let i = 0; i < path.length; i++) {
        if (path[i][0] <= currentTime) {
          trailPoints.push([path[i][1], path[i][2]]);
        } else {
          break;
        }
      }

      if (entityState === 'ACTIVE' && currentTime >= tStart) {
        trailPoints.push([curX, curY]);
      } else if (currentTime >= tEnd) {
        trailPoints.push([terminalPos[0], terminalPos[1]]);
      }

      if (trailPoints.length >= 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(trailPoints[0][0], trailPoints[0][1]);
        for (let j = 1; j < trailPoints.length; j++) {
          ctx.lineTo(trailPoints[j][0], trailPoints[j][1]);
        }

        if (player.is_bot) {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#ef4444';
          ctx.setLineDash([4, 4]);
        } else {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#22c55e';
          ctx.setLineDash([]);
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      headsToRender.push({
        userId,
        isBot: player.is_bot,
        px: curX,
        py: curY,
        state: entityState,
        eliminationType,
      });
    }

    // Event Pins with Dynamic Icon Scale
    for (const ev of matchData.events) {
      if (ev.t <= currentTime && selectedPlayerIds.has(ev.user_id)) {
        ctx.save();
        ctx.translate(ev.px, ev.py);
        ctx.scale(iconScale, iconScale);
        ctx.translate(-ev.px, -ev.py);
        drawEventMarker(ctx, ev.event, ev.px, ev.py);
        ctx.restore();
      }
    }

    // Render Heads and Terminal Markers with Dynamic Icon Scale
    for (const head of headsToRender) {
      if (head.state === 'ACTIVE') {
        ctx.save();
        ctx.translate(head.px, head.py);
        ctx.scale(iconScale, iconScale);
        ctx.translate(-head.px, -head.py);
        if (head.isBot) {
          drawBotHead(ctx, head.px, head.py, head.userId, showLabels);
        } else {
          drawHumanHead(ctx, head.px, head.py, head.userId, showLabels);
        }
        ctx.restore();
      } else if (head.state === 'ELIMINATED') {
        const markerRadius = 8 * iconScale;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 4 * iconScale;

        ctx.beginPath();
        ctx.arc(head.px, head.py, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = head.eliminationType === 'KilledByStorm' ? '#7e22ce' : '#991b1b';
        ctx.fill();

        ctx.lineWidth = 1.5 * iconScale;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(10 * iconScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠', head.px, head.py - 0.5 * iconScale);
        ctx.restore();

        if (showLabels) {
          const shortId =
            head.userId.length > 8
              ? `${head.userId.slice(0, 4)}..${head.userId.slice(-4)}`
              : head.userId;
          const displayLabel = `${head.isBot ? 'BOT' : ''} ${shortId} [KIA]`;

          const fontSize = Math.round(9 * iconScale);
          ctx.save();
          ctx.font = `600 ${fontSize}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const metrics = ctx.measureText(displayLabel);
          const badgeW = metrics.width + 8 * iconScale;
          const badgeH = 14 * iconScale;
          const badgeX = head.px - badgeW / 2;
          const badgeY = head.py - 12 * iconScale - badgeH;

          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3 * iconScale);
          ctx.fillStyle = 'rgba(15, 15, 15, 0.9)';
          ctx.fill();
          ctx.lineWidth = 1 * iconScale;
          ctx.strokeStyle = '#ef4444';
          ctx.stroke();

          ctx.fillStyle = '#fca5a5';
          ctx.fillText(displayLabel, head.px, badgeY + badgeH / 2);
          ctx.restore();
        }
      } else if (head.state === 'EXTRACTED') {
        const markerRadius = 7 * iconScale;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 4 * iconScale;

        ctx.beginPath();
        ctx.arc(head.px, head.py, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#15803d';
        ctx.fill();

        ctx.lineWidth = 1.5 * iconScale;
        ctx.strokeStyle = '#4ade80';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(9 * iconScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', head.px, head.py);
        ctx.restore();

        if (showLabels) {
          const shortId =
            head.userId.length > 8
              ? `${head.userId.slice(0, 4)}..${head.userId.slice(-4)}`
              : head.userId;
          const displayLabel = `${shortId} [EXTRACTED]`;

          const fontSize = Math.round(9 * iconScale);
          ctx.save();
          ctx.font = `600 ${fontSize}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const metrics = ctx.measureText(displayLabel);
          const badgeW = metrics.width + 8 * iconScale;
          const badgeH = 14 * iconScale;
          const badgeX = head.px - badgeW / 2;
          const badgeY = head.py - 12 * iconScale - badgeH;

          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3 * iconScale);
          ctx.fillStyle = 'rgba(15, 15, 15, 0.9)';
          ctx.fill();
          ctx.lineWidth = 1 * iconScale;
          ctx.strokeStyle = '#22c55e';
          ctx.stroke();

          ctx.fillStyle = '#86efac';
          ctx.fillText(displayLabel, head.px, badgeY + badgeH / 2);
          ctx.restore();
        }
      }
    }
  }, [
    currentTime,
    selectedPlayerIds,
    showLabels,
    viewMode,
    matchData,
    entityLifecycles,
    iconScale,
  ]);

  return (
    <div
      style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      className="relative select-none"
    >
      <canvas
        ref={bgCanvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <canvas
        ref={overlayCanvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};

export default MapCanvas;