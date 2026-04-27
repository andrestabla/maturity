import { useCallback, useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

const TIMEOUT_MS = 15 * 60 * 1000;     // 15 minutes total
const WARN_BEFORE_MS = 2 * 60 * 1000;  // warn 2 minutes before expiry

interface Options {
  enabled: boolean;
  onWarn: (secondsLeft: number) => void;
  onExpire: () => void;
}

export function useInactivityTimeout({ enabled, onWarn, onExpire }: Options) {
  const onWarnRef = useRef(onWarn);
  const onExpireRef = useRef(onExpire);
  onWarnRef.current = onWarn;
  onExpireRef.current = onExpire;

  const warnTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownId = useRef<ReturnType<typeof setInterval> | null>(null);
  const isWarning = useRef(false);

  const clearAll = useCallback(() => {
    if (warnTimerId.current) { clearTimeout(warnTimerId.current); warnTimerId.current = null; }
    if (expireTimerId.current) { clearTimeout(expireTimerId.current); expireTimerId.current = null; }
    if (countdownId.current) { clearInterval(countdownId.current); countdownId.current = null; }
    isWarning.current = false;
  }, []);

  const arm = useCallback(() => {
    clearAll();

    warnTimerId.current = setTimeout(() => {
      isWarning.current = true;
      let secs = Math.round(WARN_BEFORE_MS / 1000);
      onWarnRef.current(secs);
      countdownId.current = setInterval(() => {
        secs -= 1;
        if (secs > 0) onWarnRef.current(secs);
      }, 1000);
    }, TIMEOUT_MS - WARN_BEFORE_MS);

    expireTimerId.current = setTimeout(() => {
      clearAll();
      onExpireRef.current();
    }, TIMEOUT_MS);
  }, [clearAll]);

  // Reset on user activity only if not already in the warning period
  useEffect(() => {
    if (!enabled) { clearAll(); return; }

    arm();

    const onActivity = () => { if (!isWarning.current) arm(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [enabled, arm, clearAll]);

  return { extendSession: arm };
}
