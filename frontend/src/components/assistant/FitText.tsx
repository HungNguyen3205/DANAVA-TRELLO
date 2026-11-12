import { useLayoutEffect, useRef } from 'react';

/**
 * Single-line text that never wraps and never gets cut: when the box is too narrow
 * for the text at its normal size, the font shrinks just enough to fit (down to 10px).
 */
export function FitText({ text, className = '' }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = textRef.current;
    if (!box || !inner) return;
    const fit = () => {
      inner.style.fontSize = '';
      const base = parseFloat(getComputedStyle(inner).fontSize);
      const avail = box.clientWidth;
      const need = inner.scrollWidth;
      if (avail > 0 && need > avail) {
        inner.style.fontSize = `${Math.max(10, Math.floor(((base * avail) / need) * 10) / 10)}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={boxRef} className={`min-w-0 overflow-hidden whitespace-nowrap ${className}`} title={text}>
      <span ref={textRef} className="inline-block">{text}</span>
    </div>
  );
}
