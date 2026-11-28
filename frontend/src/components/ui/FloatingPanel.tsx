import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const MARGIN = 8;

/**
 * A dropdown panel anchored to its parent element but rendered on <body>, so modal
 * `overflow-hidden` never clips it. Opens below the anchor, flips above when there is
 * not enough room, and always stays inside the viewport.
 */
export function FloatingPanel({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  /** Which edge of the anchor the panel lines up with. */
  align?: 'left' | 'right';
  className?: string;
}) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const anchor = markerRef.current?.parentElement;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const w = panel.offsetWidth;
      const h = panel.scrollHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const below = vh - a.bottom - GAP - MARGIN;
      const above = a.top - GAP - MARGIN;
      let top: number;
      if (h <= below) top = a.bottom + GAP;
      else if (h <= above) top = a.top - GAP - h;
      else top = Math.max(MARGIN, vh - MARGIN - h); // taller than both sides: pin to the bottom edge

      let left = align === 'right' ? a.right - w : a.left;
      left = Math.min(Math.max(MARGIN, left), vw - MARGIN - w);

      setPos({ top, left, maxHeight: vh - MARGIN * 2 });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const observer = new ResizeObserver(place);
    if (panelRef.current) observer.observe(panelRef.current);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      observer.disconnect();
    };
  }, [align]);

  return (
    <>
      <span ref={markerRef} className="hidden" aria-hidden="true" />
      {createPortal(
        <div
          ref={panelRef}
          className={`fixed z-[70] overflow-y-auto ${className}`}
          style={pos ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight } : { top: 0, left: 0, visibility: 'hidden' }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
