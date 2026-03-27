const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 120_000;

function encodeBase64(bytes: Uint8Array) {
  let value = '';

  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }

  return btoa(value);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

async function derivePasswordBits(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const saltBuffer = Uint8Array.from(salt);

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  return new Uint8Array(derived);
}

export async function createPasswordHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePasswordBits(password, salt, PASSWORD_ITERATIONS);

  return `pbkdf2$${PASSWORD_ITERATIONS}$${encodeBase64(salt)}$${encodeBase64(derived)}`;
}

export async function verifyPassword(password: string, storedValue: string) {
  const [algorithm, iterationsValue, saltValue, hashValue] = storedValue.split('$');

  if (algorithm !== 'pbkdf2' || !iterationsValue || !saltValue || !hashValue) {
    return false;
  }

  const iterations = Number.parseInt(iterationsValue, 10);

  if (!Number.isFinite(iterations)) {
    return false;
  }

  const salt = decodeBase64(saltValue);
  const expected = decodeBase64(hashValue);
  const actual = await derivePasswordBits(password, salt, iterations);

  return equalBytes(expected, actual);
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return encodeBase64(new Uint8Array(digest));
}

export function createSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase64Url(bytes);
}
