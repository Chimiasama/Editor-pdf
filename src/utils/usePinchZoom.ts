import { useEffect, useRef } from 'react';

interface PinchZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  currentZoom: number;
  onZoomChange: (newZoom: number) => void;
  enabled?: boolean;
}

export function usePinchZoom(
  elementRef: React.RefObject<HTMLElement | null>,
  { minZoom = 0.5, maxZoom = 3.0, currentZoom, onZoomChange, enabled = true }: PinchZoomOptions
) {
  const initialDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(currentZoom);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabled) return;

    function getDistance(t1: Touch, t2: Touch): number {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        initialDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
        initialZoomRef.current = currentZoom;
        lastTapRef.current.time = 0;
      } else if (e.touches.length === 1) {
        if ((e.target as Element).closest('button, input, textarea, [contenteditable], [data-annotation]')) return;
        // A double tap must be on the same reading area, never on editing controls.
        const now = Date.now();
        const touch = e.touches[0];
        if (now - lastTapRef.current.time < 300 && Math.hypot(touch.clientX - lastTapRef.current.x, touch.clientY - lastTapRef.current.y) < 24) {
          // Double tap detected
          const targetZoom = currentZoom > 1.2 ? 1.0 : 1.5;
          onZoomChange(targetZoom);
        }
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && initialDistanceRef.current !== null) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scaleFactor = currentDistance / initialDistanceRef.current;
        let nextZoom = initialZoomRef.current * scaleFactor;
        nextZoom = Math.min(Math.max(nextZoom, minZoom), maxZoom);
        onZoomChange(Number(nextZoom.toFixed(2)));
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        initialDistanceRef.current = null;
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [elementRef, currentZoom, minZoom, maxZoom, onZoomChange, enabled]);
}
