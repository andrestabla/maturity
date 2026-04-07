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

type RequestLike =
  | Request
  | {
      body?: unknown;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
    };

function parseJsonPayload<T>(value: string) {
  if (!value.trim()) {
    return {} as T;
  }
  return JSON.parse(value) as T;
}

export async function readJson<T>(request: RequestLike) {
  const maybeRequest = request as Request;
  if (typeof maybeRequest?.json === 'function') {
    return (await maybeRequest.json()) as T;
  }

  const withBody = request as { body?: unknown };
  if (withBody?.body !== undefined && withBody.body !== null) {
    if (typeof withBody.body === 'string') {
      return parseJsonPayload<T>(withBody.body);
    }

    if (
      typeof withBody.body === 'object' &&
      !(withBody.body instanceof ArrayBuffer) &&
      !(withBody.body instanceof Uint8Array)
    ) {
      return withBody.body as T;
    }

    if (withBody.body instanceof ArrayBuffer) {
      return parseJsonPayload<T>(Buffer.from(withBody.body).toString('utf-8'));
    }

    if (withBody.body instanceof Uint8Array) {
      return parseJsonPayload<T>(Buffer.from(withBody.body).toString('utf-8'));
    }
  }

  const maybeStream = request as {
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
  };

  if (typeof maybeStream.on === 'function') {
    const rawBody = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      maybeStream.on?.('data', (chunk: unknown) => {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
          return;
        }

        if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        }
      });
      maybeStream.on?.('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
      maybeStream.on?.('error', (error: unknown) => {
        reject(error);
      });
    });

    return parseJsonPayload<T>(rawBody);
  }

  throw new Error('No fue posible leer el body JSON de la solicitud.');
}
