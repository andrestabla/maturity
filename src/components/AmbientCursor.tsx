import { useEffect, useEffectEvent, useRef } from 'react';

const interactiveSelector = 'a, button, input, select, textarea, label, [role="button"]';

export function AmbientCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pointRef = useRef({
    x: -120,
    y: -120,
    interactive: false,
  });

  const commitCursor = useEffectEvent(() => {
    frameRef.current = null;

    const cursor = cursorRef.current;
    if (!cursor) {
      return;
    }

    cursor.style.transform = `translate3d(${pointRef.current.x}px, ${pointRef.current.y}px, 0)`;
    cursor.dataset.visible = 'true';
    cursor.dataset.interactive = pointRef.current.interactive ? 'true' : 'false';
  });

  const queueCommit = useEffectEvent(() => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(commitCursor);
  });

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : null;

    pointRef.current = {
      x: event.clientX,
      y: event.clientY,
      interactive: Boolean(target?.closest(interactiveSelector)),
    };

    queueCommit();
  });

  const hideCursor = useEffectEvent(() => {
    const cursor = cursorRef.current;
    if (!cursor) {
      return;
    }

    cursor.dataset.visible = 'false';
    cursor.dataset.interactive = 'false';
  });

  const handleWindowMouseOut = useEffectEvent((event: MouseEvent) => {
    if (event.relatedTarget === null) {
      hideCursor();
    }
  });

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      return undefined;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    document.documentElement.classList.add('has-ambient-cursor');

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerMove, { passive: true });
    window.addEventListener('mouseout', handleWindowMouseOut);
    window.addEventListener('blur', hideCursor);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerMove);
      window.removeEventListener('mouseout', handleWindowMouseOut);
      window.removeEventListener('blur', hideCursor);
      document.documentElement.classList.remove('has-ambient-cursor');

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return <div ref={cursorRef} className="ambient-cursor" data-visible="false" data-interactive="false" aria-hidden />;
}
