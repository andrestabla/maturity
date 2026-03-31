import { startTransition, useEffect, useState } from 'react';
import { createEmptyAppData } from '../data/platformDefaults.js';
import type { AppData } from '../types.js';

type DataSource = 'bootstrap' | 'neon';

interface BootstrapResponse {
  data: AppData;
}

export function useAppData(enabled: boolean) {
  const [appData, setAppData] = useState<AppData>(() => createEmptyAppData());
  const [source, setSource] = useState<DataSource>('bootstrap');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshAppData = () => setRefreshKey((current) => current + 1);

  // Sync between tabs
  useEffect(() => {
    const channel = new BroadcastChannel('maturity_app_sync');
    channel.onmessage = (event) => {
      if (event.data === 'refresh') {
        refreshAppData();
      }
    };
    return () => channel.close();
  }, []);

  const broadcastRefresh = () => {
    const channel = new BroadcastChannel('maturity_app_sync');
    channel.postMessage('refresh');
    channel.close();
  };

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadAppData(silent = false) {
      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch('/api/bootstrap', {
          signal: controller.signal,
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`bootstrap_failed_${response.status}`);
        }

        const payload = (await response.json()) as BootstrapResponse;

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
            ? requestError.message
            : 'No fue posible leer la API de datos.';
        setError(message);
        
        if (!silent) {
          setAppData(createEmptyAppData());
          setSource('bootstrap');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadAppData(refreshKey > 0);

    // Polling every 30 seconds
    const interval = setInterval(() => {
      void loadAppData(true);
    }, 30000);

    // Revalidate on focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadAppData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, refreshKey]);

  return {
    appData,
    source,
    isLoading,
    isRefreshing,
    error,
    refreshAppData: () => {
      refreshAppData();
      broadcastRefresh();
    },
    mutateAppData: (nextData: AppData | ((current: AppData) => AppData)) => {
      startTransition(() => {
        setAppData((current) => (typeof nextData === 'function' ? nextData(current) : nextData));
      });
    },
  };
}
