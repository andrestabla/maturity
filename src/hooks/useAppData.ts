import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { createEmptyAppData } from '../data/platformDefaults.js';
import type { AppData } from '../types.js';

type DataSource = 'bootstrap' | 'neon';

interface BootstrapResponse {
  data: AppData;
}

interface SyncMessage {
  type: 'refresh';
  senderId: string;
  at: number;
}

const APP_DATA_SNAPSHOT_PREFIX = 'maturity_app_snapshot_v2';
const REQUEST_TIMEOUT_MS = 8000;

function isAppDataSnapshot(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AppData>;
  return (
    Array.isArray(candidate.courses) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.alerts) &&
    Array.isArray(candidate.libraryResources) &&
    Array.isArray(candidate.users)
  );
}

function normalizeAppDataSnapshot(value: unknown): AppData | null {
  if (!isAppDataSnapshot(value)) {
    return null;
  }

  return {
    ...value,
    helpdeskTickets: Array.isArray(value.helpdeskTickets) ? value.helpdeskTickets : [],
    libraryAssets: Array.isArray(value.libraryAssets) ? value.libraryAssets : [],
    libraryCourseLinks: Array.isArray(value.libraryCourseLinks) ? value.libraryCourseLinks : [],
  };
}

function getSnapshotKey(scope: string) {
  return `${APP_DATA_SNAPSHOT_PREFIX}:${scope}`;
}

function readAppDataSnapshot(scope: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getSnapshotKey(scope));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { data?: unknown };
    return normalizeAppDataSnapshot(parsed.data);
  } catch {
    return null;
  }
}

function persistAppDataSnapshot(scope: string, data: AppData) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      getSnapshotKey(scope),
      JSON.stringify({
        savedAt: Date.now(),
        data,
      }),
    );
  } catch {
    /* noop */
  }
}

function clearAppDataSnapshot(scope: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(getSnapshotKey(scope));
  } catch {
    /* noop */
  }
}

export function useAppData(enabled: boolean, cacheScope = 'anonymous') {
  const initialSnapshot = readAppDataSnapshot(cacheScope);
  const [appData, setAppData] = useState<AppData>(() => initialSnapshot ?? createEmptyAppData());
  const [source, setSource] = useState<DataSource>('bootstrap');
  const [isLoading, setIsLoading] = useState(enabled && !initialSnapshot);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const clientIdRef = useRef(`maturity-${Math.random().toString(36).slice(2, 10)}`);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const requestSequenceRef = useRef(0);
  const latestAppliedSequenceRef = useRef(0);
  const hasSuccessfulLoadRef = useRef(Boolean(initialSnapshot));
  const cacheScopeRef = useRef(cacheScope);

  const queueRefresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const broadcastRefresh = useCallback(() => {
    const payload: SyncMessage = {
      type: 'refresh',
      senderId: clientIdRef.current,
      at: Date.now(),
    };

    syncChannelRef.current?.postMessage(payload);

    try {
      window.localStorage.setItem('maturity_app_sync', JSON.stringify(payload));
      window.localStorage.removeItem('maturity_app_sync');
    } catch {
      /* noop */
    }
  }, []);

  // Sync between tabs and browser contexts
  useEffect(() => {
    const handleSyncPayload = (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('type' in payload) ||
        !('senderId' in payload)
      ) {
        return;
      }

      const message = payload as SyncMessage;

      if (message.type !== 'refresh' || message.senderId === clientIdRef.current) {
        return;
      }

      queueRefresh();
    };

    if ('BroadcastChannel' in window) {
      syncChannelRef.current = new BroadcastChannel('maturity_app_sync');
      syncChannelRef.current.onmessage = (event) => {
        handleSyncPayload(event.data);
      };
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'maturity_app_sync' || !event.newValue) {
        return;
      }

      try {
        handleSyncPayload(JSON.parse(event.newValue));
      } catch {
        /* noop */
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      syncChannelRef.current?.close();
      syncChannelRef.current = null;
      window.removeEventListener('storage', handleStorage);
    };
  }, [queueRefresh]);

  useEffect(() => {
    if (cacheScopeRef.current === cacheScope) {
      return;
    }

    cacheScopeRef.current = cacheScope;
    const snapshot = readAppDataSnapshot(cacheScope);
    hasSuccessfulLoadRef.current = Boolean(snapshot);
    latestAppliedSequenceRef.current = 0;
    requestSequenceRef.current = 0;
    setError(null);
    setSource(snapshot ? 'neon' : 'bootstrap');
    setAppData(snapshot ?? createEmptyAppData());
    setIsLoading(enabled && !snapshot);
  }, [cacheScope, enabled]);

  useEffect(() => {
    if (!enabled) {
      hasSuccessfulLoadRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
      setError(null);
      setSource('bootstrap');
      setAppData(createEmptyAppData());
      return;
    }

    const controller = new AbortController();

    async function loadAppData(silent = false) {
      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;
      const showBlockingLoader = !silent && !hasSuccessfulLoadRef.current;

      if (showBlockingLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const requestController = new AbortController();
      const abortRequest = () => requestController.abort();
      const timeout = window.setTimeout(abortRequest, REQUEST_TIMEOUT_MS);

      controller.signal.addEventListener('abort', abortRequest);

      try {
        const response = await fetch('/api/bootstrap', {
          signal: requestController.signal,
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`bootstrap_failed_${response.status}`);
        }

        const payload = (await response.json()) as BootstrapResponse;

        if (requestSequence < latestAppliedSequenceRef.current) {
          return;
        }

        latestAppliedSequenceRef.current = requestSequence;
        hasSuccessfulLoadRef.current = true;
        persistAppDataSnapshot(cacheScopeRef.current, payload.data);

        startTransition(() => {
          setAppData(payload.data);
          setSource('neon');
          setError(null);
        });
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          requestError instanceof Error
            ? requestError.name === 'AbortError'
              ? 'bootstrap_timeout'
              : requestError.message
            : 'No fue posible leer la API de datos.';
        setError(message);

        if (!hasSuccessfulLoadRef.current) {
          setSource('bootstrap');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }

        window.clearTimeout(timeout);
        controller.signal.removeEventListener('abort', abortRequest);
      }
    }

    void loadAppData(refreshKey > 0);

    // Fast revalidation while the workspace is visible.
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void loadAppData(true);
    }, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadAppData(true);
      }
    };

    const handleWindowFocus = () => {
      void loadAppData(true);
    };

    const handlePageShow = () => {
      void loadAppData(true);
    };

    const handleOnline = () => {
      void loadAppData(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', handleOnline);

    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, refreshKey]);

  return {
    appData,
    source,
    isLoading,
    isRefreshing,
    error,
    refreshAppData: () => {
      queueRefresh();
      broadcastRefresh();
    },
    mutateAppData: (nextData: AppData | ((current: AppData) => AppData)) => {
      startTransition(() => {
        setAppData((current) => {
          const resolved = typeof nextData === 'function' ? nextData(current) : nextData;
          persistAppDataSnapshot(cacheScopeRef.current, resolved);
          return resolved;
        });
      });
    },
    clearCachedAppData: () => {
      clearAppDataSnapshot(cacheScopeRef.current);
    },
  };
}
