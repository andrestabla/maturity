import { loadAppData } from '../lib/store.js';

export const config = {
  runtime: 'edge',
};

export default async function handler() {
  try {
    const data = await loadAppData();

    return Response.json(
      {
        data,
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected error while loading data';

    return Response.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
