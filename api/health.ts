import { prepareDatabase } from '../lib/store.js';

export const config = {
  runtime: 'edge',
};

export default async function handler() {
  try {
    const state = await prepareDatabase();

    return Response.json({
      ok: true,
      seeded: state.seeded,
      courses: state.courses,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected error while preparing database';

    return Response.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
