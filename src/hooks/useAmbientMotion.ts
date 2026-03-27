import { useEffect, useEffectEvent, useRef } from 'react';

export function useAmbientMotion(enabled = true) {
  const frameRef = useRef<number | null>(null);

  const writeMotion = useEffectEvent(() => {
    frameRef.current = null;

    const scroll = window.scrollY;
    const root = document.documentElement;

    root.style.setProperty('--scroll-shift', `${Math.min(scroll * 0.08, 48).toFixed(2)}px`);
    root.style.setProperty('--scroll-float', `${Math.min(scroll * 0.035, 18).toFixed(2)}px`);
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.setProperty('--scroll-shift', '0px');
      document.documentElement.style.setProperty('--scroll-float', '0px');
      return undefined;
    }

    const handleScroll = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(writeMotion);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      document.documentElement.style.setProperty('--scroll-shift', '0px');
      document.documentElement.style.setProperty('--scroll-float', '0px');
    };
  }, [enabled]);
}
