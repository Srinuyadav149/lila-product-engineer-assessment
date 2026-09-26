/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameMap, MAP_CONFIGS, TelemetryEventName } from '../types/telemetry';

export const CANVAS_SIZE = 1024.0;

/**
 * Helper to render a high-contrast rounded pill badge containing centered monospace text.
 */
function drawTextBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  bottomY: number,
  accentColor: string
): void {
  ctx.save();
  ctx.font = '600 10px monospace, "Courier New", Courier, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const paddingX = 5;
  const badgeHeight = 16;
  const badgeWidth = textWidth + paddingX * 2;
  const badgeX = centerX - badgeWidth / 2;
  const badgeY = bottomY - badgeHeight;
  const radius = badgeHeight / 2;

  // Draw pill background
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, radius);
  ctx.fillStyle = 'rgba(10, 10, 10, 0.88)';
  ctx.fill();

  // Pill border
  ctx.lineWidth = 1;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  // Text glyph
  ctx.fillStyle = '#f3f4f6';
  ctx.fillText(text, centerX, badgeY + badgeHeight / 2);
  ctx.restore();
}

/**
 * Draws a solid Emerald Green (#22c55e) upward-pointing triangle (width: 14px, height: 14px)
 * with a dark green border (#14532d).
 * If showLabel is true, renders a high-contrast rounded pill badge with centered monospace text above the triangle.
 */
export function drawHumanHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  showLabel: boolean
): void {
  ctx.save();

  const halfWidth = 7;
  const halfHeight = 7;

  // Upward-pointing triangle: apex at (x, y - halfHeight)
  const topX = x;
  const topY = y - halfHeight;
  const leftX = x - halfWidth;
  const leftY = y + halfHeight;
  const rightX = x + halfWidth;
  const rightY = y + halfHeight;

  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();

  // Fill Emerald Green
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  // Dark green border
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = '#14532d';
  ctx.stroke();

  ctx.restore();

  if (showLabel && label) {
    // Truncate long UUIDs for display aesthetics if needed, e.g. "a3f8..1b4c"
    const displayLabel = label.length > 12 ? `${label.slice(0, 4)}..${label.slice(-4)}` : label;
    drawTextBadge(ctx, displayLabel, x, y - halfHeight - 4, '#22c55e');
  }
}

/**
 * Draws a solid Crimson Red (#ef4444) circle (radius: 5.5px) with a dark red border (#7f1d1d).
 * If showLabel is true, renders the bot ID inside a dark rounded pill badge above the circle.
 */
export function drawBotHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  showLabel: boolean
): void {
  const radius = 5.5;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  // Fill Crimson Red
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  // Dark red border
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = '#7f1d1d';
  ctx.stroke();
  ctx.restore();

  if (showLabel && label) {
    const displayLabel = `BOT-${label}`;
    drawTextBadge(ctx, displayLabel, x, y - radius - 4, '#ef4444');
  }
}

interface EventMarkerStyle {
  bgColor: string;
  borderColor: string;
  glyph: string;
  glyphColor: string;
  fontSize: string;
}

const EVENT_STYLES: Record<string, EventMarkerStyle> = {
  Kill: {
    bgColor: '#f97316',
    borderColor: '#7c2d12',
    glyph: '⚔',
    glyphColor: '#ffffff',
    fontSize: '11px',
  },
  BotKill: {
    bgColor: '#f97316',
    borderColor: '#7c2d12',
    glyph: '⚔',
    glyphColor: '#ffffff',
    fontSize: '11px',
  },
  Killed: {
    bgColor: '#dc2626',
    borderColor: '#450a0a',
    glyph: '☠',
    glyphColor: '#ffffff',
    fontSize: '12px',
  },
  BotKilled: {
    bgColor: '#dc2626',
    borderColor: '#450a0a',
    glyph: '☠',
    glyphColor: '#ffffff',
    fontSize: '12px',
  },
  KilledByStorm: {
    bgColor: '#9333ea',
    borderColor: '#3b0764',
    glyph: '⚡',
    glyphColor: '#ffffff',
    fontSize: '11px',
  },
  Loot: {
    bgColor: '#eab308',
    borderColor: '#713f12',
    glyph: '◆',
    glyphColor: '#ffffff',
    fontSize: '10px',
  },
};

/**
 * Draws a distinct circular vector badge (radius: 9px) centered on (x, y) with an embedded glyph:
 * - Kill / BotKill: Orange (#f97316) circle with sword icon "⚔"
 * - Killed / BotKilled: Dark Red (#dc2626) circle with skull icon "☠"
 * - KilledByStorm: Purple (#9333ea) circle with lightning icon "⚡"
 * - Loot: Amber (#eab308) circle with diamond icon "◆"
 */
export function drawEventMarker(
  ctx: CanvasRenderingContext2D,
  event: TelemetryEventName | string,
  x: number,
  y: number
): void {
  const radius = 9;
  const style = EVENT_STYLES[event] || {
    bgColor: '#64748b',
    borderColor: '#1e293b',
    glyph: '•',
    glyphColor: '#ffffff',
    fontSize: '11px',
  };

  ctx.save();

  // Subtle drop shadow for map contrast
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  // Circular Badge Fill
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = style.bgColor;
  ctx.fill();

  // Reset shadow before border & text
  ctx.shadowColor = 'transparent';

  // Badge Outline
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = style.borderColor;
  ctx.stroke();

  // Embedded Glyph
  ctx.font = `bold ${style.fontSize} sans-serif, "Segoe UI Emoji", "Apple Color Emoji", Symbola`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.glyphColor;

  // Offset slight vertical centering for specific glyph fonts
  const verticalOffset = event === 'Killed' || event === 'BotKilled' ? -0.5 : 0.5;
  ctx.fillText(style.glyph, x, y + verticalOffset);

  ctx.restore();
}

/**
 * Helper to draw player trajectory trail segments:
 * Solid lines for Humans, dashed lines ([4, 4]) for Bots.
 */
export function drawTrajectoryTrail(
  ctx: CanvasRenderingContext2D,
  path: [number, number][],
  isBot: boolean,
  color: string,
  lineWidth = 2.0
): void {
  if (path.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);

  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i][0], path[i][1]);
  }

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (isBot) {
    ctx.setLineDash([4, 4]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.stroke();
  ctx.restore();
}
