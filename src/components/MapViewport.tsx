/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CANVAS_SIZE } from './CanvasHelpers';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

interface MapViewportProps {
  children: React.ReactNode;
  onTransformChange?: (scale: number, panX: number, panY: number) => void;
}

export const MapViewport: React.FC<MapViewportProps> = ({
  children,
  onTransformChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Transformation states
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Synchronized refs to guarantee non-stale callbacks and avoid dependency re-renders
  const scaleRef = useRef<number>(1);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const fitScaleRef = useRef<number>(1);
  const hasUserInteractedRef = useRef<boolean>(false);

  // Store callback in ref so it never causes effect invalidation
  const onTransformChangeRef = useRef(onTransformChange);
  useEffect(() => {
    onTransformChangeRef.current = onTransformChange;
  });

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  // 1. Calculate & Apply Fit-to-Screen
  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) return;

    const padding = 16;
    const availableWidth = clientWidth - padding * 2;
    const availableHeight = clientHeight - padding * 2;

    const computedFitScale = Math.min(
      availableWidth / CANVAS_SIZE,
      availableHeight / CANVAS_SIZE,
      1.0
    );

    fitScaleRef.current = computedFitScale;

    const initialPanX = (clientWidth - CANVAS_SIZE * computedFitScale) / 2;
    const initialPanY = (clientHeight - CANVAS_SIZE * computedFitScale) / 2;

    scaleRef.current = computedFitScale;
    panRef.current = { x: initialPanX, y: initialPanY };
    hasUserInteractedRef.current = false;

    setScale(computedFitScale);
    setPan({ x: initialPanX, y: initialPanY });
    onTransformChangeRef.current?.(computedFitScale, initialPanX, initialPanY);
  }, []);

  // 2. ResizeObserver: Only auto-refits if user hasn't actively zoomed/panned
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (!hasUserInteractedRef.current) {
        fitToScreen();
      }
    });

    observer.observe(container);
    fitToScreen();

    return () => observer.disconnect();
  }, [fitToScreen]);

  // 3. Native Active Wheel Listener (Bypasses React's passive event restriction)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentScale = scaleRef.current;
      const currentPan = panRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const minScale = fitScaleRef.current * 0.5;
      const maxScale = 5.0;
      const newScale = Math.min(maxScale, Math.max(minScale, currentScale * zoomFactor));

      if (newScale === currentScale) return;

      const newPanX = mouseX - ((mouseX - currentPan.x) * newScale) / currentScale;
      const newPanY = mouseY - ((mouseY - currentPan.y) * newScale) / currentScale;

      hasUserInteractedRef.current = true;
      scaleRef.current = newScale;
      panRef.current = { x: newPanX, y: newPanY };

      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
      onTransformChangeRef.current?.(newScale, newPanX, newPanY);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // 4. Mouse Drag & Pan Handlers (With window listener so mouse never slips out)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;

    setIsDragging(true);
    hasUserInteractedRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const newPanX = dragStartRef.current.panX + dx;
      const newPanY = dragStartRef.current.panY + dy;

      panRef.current = { x: newPanX, y: newPanY };
      setPan({ x: newPanX, y: newPanY });
      onTransformChangeRef.current?.(scaleRef.current, newPanX, newPanY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 5. Button Steppers
  const stepZoom = (factor: number) => {
    const container = containerRef.current;
    if (!container) return;

    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;

    const currentScale = scaleRef.current;
    const currentPan = panRef.current;

    const minScale = fitScaleRef.current * 0.5;
    const maxScale = 5.0;
    const newScale = Math.min(maxScale, Math.max(minScale, currentScale * factor));

    const newPanX = centerX - ((centerX - currentPan.x) * newScale) / currentScale;
    const newPanY = centerY - ((centerY - currentPan.y) * newScale) / currentScale;

    hasUserInteractedRef.current = true;
    scaleRef.current = newScale;
    panRef.current = { x: newPanX, y: newPanY };

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
    onTransformChangeRef.current?.(newScale, newPanX, newPanY);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className={`relative w-full h-full overflow-hidden select-none bg-neutral-950 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* 2D Transformation Canvas Container */}
      <div
        style={{
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
        className="relative"
      >
        {children}
      </div>

      {/* Floating Tactical Zoom & Navigation HUD */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-800 rounded-lg p-1.5 shadow-2xl backdrop-blur-md font-mono text-xs text-neutral-300">
        <button
          onClick={() => stepZoom(1.25)}
          className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors border border-transparent hover:border-neutral-700"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => stepZoom(0.8)}
          className="p-1.5 rounded hover:bg-neutral-800 hover:text-white transition-colors border border-transparent hover:border-neutral-700"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-neutral-800 mx-0.5" />

        <button
          onClick={fitToScreen}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-800 hover:text-emerald-400 transition-colors border border-transparent hover:border-neutral-700 text-[11px] font-semibold"
          title="Fit Map to Viewport"
        >
          <Maximize2 className="w-3 h-3" />
          <span>FIT</span>
        </button>

        <span className="text-[10px] text-neutral-500 font-bold px-1 min-w-[38px] text-right">
          {Math.round((scale / fitScaleRef.current) * 100)}%
        </span>
      </div>

      <div className="absolute top-4 right-4 z-20 pointer-events-none hidden md:flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono bg-neutral-950/70 border border-neutral-800/80 rounded px-2 py-1 backdrop-blur-sm">
        <Move className="w-3 h-3" />
        <span>DRAG TO PAN • SCROLL TO ZOOM</span>
      </div>
    </div>
  );
};

export default MapViewport;