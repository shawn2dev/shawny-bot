const MAX_AGE_MS = 5 * 60 * 1000;

async function deriveAesKey(secret) {
  const keyMaterial = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret.trim()),
  );
  return crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

function bytesFromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64FromBytes(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function decryptClientPayload(encryptedB64, secret) {
  const combined = bytesFromBase64(encryptedB64);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await deriveAesKey(secret);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export function buildSignatureMessage({ nonce, timestamp, encrypted }) {
  return `${nonce}:${timestamp}:${encrypted}`;
}

export async function verifyClientSignature(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const message = buildSignatureMessage(payload);
  const signature = bytesFromBase64(payload.signature);
  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(message),
  );
}

export function isTimestampValid(timestamp) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= MAX_AGE_MS;
}
