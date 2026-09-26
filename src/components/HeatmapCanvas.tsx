/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { GameMap, MapAggregateHeatmap, MAP_CONFIGS } from '../types/telemetry';
import { CANVAS_SIZE } from './CanvasHelpers';

export interface HeatmapLayersState {
  combat: boolean;
  storm: boolean;
  traffic: boolean;
}

export interface HeatmapCanvasProps {
  mapId: GameMap;
  heatmapData?: MapAggregateHeatmap | null;
  activeLayers: HeatmapLayersState;
  intensity: number;
}

function createColorPalette(
  stops: Array<{ stop: number; r: number; g: number; b: number; a: number }>
): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8ClampedArray(256 * 4);

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  for (const s of stops) {
    grad.addColorStop(s.stop, `rgba(${s.r}, ${s.g}, ${s.b}, ${s.a})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);

  const imgData = ctx.getImageData(0, 0, 256, 1);
  return imgData.data;
}

const STANDARD_PALETTE = createColorPalette([
  { stop: 0.0, r: 0, g: 0, b: 255, a: 0.0 },
  { stop: 0.03, r: 37, g: 99, b: 235, a: 0.35 },
  { stop: 0.15, r: 6, g: 182, b: 212, a: 0.55 },
  { stop: 0.45, r: 34, g: 197, b: 94, a: 0.75 },
  { stop: 0.75, r: 234, g: 179, b: 8, a: 0.9 },
  { stop: 1.0, r: 239, g: 68, b: 68, a: 1.0 },
]);

const STORM_PALETTE = createColorPalette([
  { stop: 0.0, r: 59, g: 7, b: 100, a: 0.0 },
  { stop: 0.2, r: 109, g: 40, b: 217, a: 0.4 },
  { stop: 0.5, r: 147, g: 51, b: 234, a: 0.7 },
  { stop: 0.8, r: 217, g: 70, b: 239, a: 0.9 },
  { stop: 1.0, r: 244, g: 63, b: 94, a: 0.98 },
]);

export const HeatmapCanvas: React.FC<HeatmapCanvasProps> = ({
  mapId,
  heatmapData,
  activeLayers,
  intensity,
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Background map drawing
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;
    const mapConfig = MAP_CONFIGS[mapId];
    const ext = mapConfig?.ext ?? 'png';
    const imageSrc = `/minimaps/${mapId}_Minimap.${ext}`;

    const renderFallbackGrid = () => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= CANVAS_SIZE; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_SIZE);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_SIZE; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_SIZE, y);
        ctx.stroke();
      }
    };

    renderFallbackGrid();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      if (isCancelled) return;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    };

    img.onerror = () => {
      if (!isCancelled) renderFallbackGrid();
    };

    return () => {
      isCancelled = true;
    };
  }, [mapId]);

  // Main Heatmap Rendering: Offscreen Alpha-Stamping & Palette Transfer
  useEffect(() => {
    const heatCanvas = heatCanvasRef.current;
    if (!heatCanvas) return;
    const heatCtx = heatCanvas.getContext('2d');
    if (!heatCtx) return;

    heatCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (!heatmapData || !heatmapData.points || heatmapData.points.length === 0) {
      return;
    }

    const offscreenStd = document.createElement('canvas');
    offscreenStd.width = CANVAS_SIZE;
    offscreenStd.height = CANVAS_SIZE;
    const stdCtx = offscreenStd.getContext('2d', { willReadFrequently: true });

    const offscreenStorm = document.createElement('canvas');
    offscreenStorm.width = CANVAS_SIZE;
    offscreenStorm.height = CANVAS_SIZE;
    const stormCtx = offscreenStorm.getContext('2d', { willReadFrequently: true });

    if (!stdCtx || !stormCtx) return;

    const drawStamp = (
      ctx: CanvasRenderingContext2D,
      px: number,
      py: number,
      radius: number,
      weight: number
    ) => {
      const boostedWeight = Math.pow(Math.max(0.01, weight), 0.35);
      const centerAlpha = Math.min(
        1.0,
        Math.max(0.08, boostedWeight * 0.5 * intensity)
      );

      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, `rgba(0, 0, 0, ${centerAlpha})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    let hasStdPoints = false;
    let hasStormPoints = false;

    for (const point of heatmapData.points) {
      if (point.type === 'combat' && activeLayers.combat) {
        drawStamp(stdCtx, point.px, point.py, 28, point.weight);
        hasStdPoints = true;
      } else if (point.type === 'traffic' && activeLayers.traffic) {
        drawStamp(stdCtx, point.px, point.py, 16, point.weight);
        hasStdPoints = true;
      } else if (point.type === 'storm' && activeLayers.storm) {
        drawStamp(stormCtx, point.px, point.py, 36, point.weight);
        hasStormPoints = true;
      }
    }

    const transferPalette = (
      sourceCtx: CanvasRenderingContext2D,
      palette: Uint8ClampedArray
    ): ImageData => {
      const imgData = sourceCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const data = imgData.data;
      const totalPixels = CANVAS_SIZE * CANVAS_SIZE;

      for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        const alpha = data[offset + 3];

        if (alpha > 0) {
          const palOffset = alpha * 4;
          data[offset] = palette[palOffset];
          data[offset + 1] = palette[palOffset + 1];
          data[offset + 2] = palette[palOffset + 2];
          data[offset + 3] = palette[palOffset + 3];
        }
      }

      return imgData;
    };

    if (hasStdPoints) {
      const coloredStd = transferPalette(stdCtx, STANDARD_PALETTE);
      stdCtx.putImageData(coloredStd, 0, 0);
      heatCtx.drawImage(offscreenStd, 0, 0);
    }

    if (hasStormPoints) {
      const coloredStorm = transferPalette(stormCtx, STORM_PALETTE);
      stormCtx.putImageData(coloredStorm, 0, 0);
      heatCtx.save();
      heatCtx.globalCompositeOperation = 'screen';
      heatCtx.drawImage(offscreenStorm, 0, 0);
      heatCtx.restore();
    }
  }, [heatmapData, activeLayers, intensity]);

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
        ref={heatCanvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};

export default HeatmapCanvas;