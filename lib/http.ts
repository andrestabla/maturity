export function jsonResponse(payload: unknown, init?: ResponseInit) {
  return Response.json(payload, init);
}

export function errorResponse(status: number, message: string) {
  return jsonResponse(
    {
      error: message,
    },
    {
      status,
    },
  );
}

export async function readJson<T>(request: Request) {
  return (await request.json()) as T;
}
