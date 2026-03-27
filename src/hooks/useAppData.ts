import { startTransition, useEffect, useState } from 'react';
import { mockAppData } from '../data/mockData.js';
import type { AppData } from '../types.js';

type DataSource = 'demo' | 'neon';

interface BootstrapResponse {
  data: AppData;
}

export function useAppData() {
  const [appData, setAppData] = useState<AppData>(mockAppData);
  const [source, setSource] = useState<DataSource>('demo');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAppData() {
      try {
        const response = await fetch('/api/bootstrap', {
          signal: controller.signal,
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
  }, []);

  return {
    appData,
    source,
    isLoading,
    error,
  };
}
