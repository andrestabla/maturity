import { startTransition, useEffect, useState } from 'react';
import { mockAppData } from '../data/mockData.js';
import type { AppData } from '../types.js';

type DataSource = 'demo' | 'neon';

interface BootstrapResponse {
  data: AppData;
}

export function useAppData(enabled: boolean) {
  const [appData, setAppData] = useState<AppData>(mockAppData);
  const [source, setSource] = useState<DataSource>('demo');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadAppData() {
      setIsLoading(true);

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
        setSource('demo');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadAppData();

    return () => controller.abort();
  }, [enabled, refreshKey]);

  return {
    appData,
    source,
    isLoading,
    error,
    refreshAppData: () => setRefreshKey((current) => current + 1),
  };
}
