import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  buildSignatureMessage,
  decryptClientPayload,
} from '../src/client-log-crypto.js';
import {
  handleClientHeadersRequest,
  findClientHeaders,
} from '../src/client-headers.js';

async function encryptJson(payload, secret) {
  const keyMaterial = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret.trim()),
  );
  const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const message = buildSignatureMessage(payload);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

describe('client-headers', () => {
  it('stores and retrieves client headers by nonce', async () => {
    const kv = new Map();
    const env = {
      CLIENT_LOG_AUTH_KEY: 'test-secret',
      ALLOWED_USERS: {
        put: async (key, value, opts) => kv.set(key, { value, opts }),
        get: async (key) => kv.get(key)?.value ?? null,
        delete: async (key) => kv.delete(key),
      },
    };

    const headers = { authorization: 'token', cookie: 'abc' };
    const encrypted = await encryptJson(headers, env.CLIENT_LOG_AUTH_KEY);
    const timestamp = Date.now();
    const body = {
      encrypted,
      nonce: 'nonce-123',
      guild_id: '1',
      channel_id: '2',
      command: 'test',
      timestamp,
      signature: await signPayload(
        { nonce: 'nonce-123', timestamp, encrypted },
        env.CLIENT_LOG_AUTH_KEY,
      ),
    };

    const response = await handleClientHeadersRequest(
      new Request('https://example.com/client-headers', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
    );

    expect(response.status).to.equal(200);
    const stored = await findClientHeaders(
      env,
      {
        nonce: 'nonce-123',
        guild_id: '1',
        channel_id: '2',
        data: { name: 'test' },
      },
      { maxWaitMs: 0, intervalMs: 0 },
    );
    expect(stored.headers).to.deep.equal(headers);
    expect(stored.command).to.equal('test');
  });

  it('matches command names case-insensitively', async () => {
    const kv = new Map();
    const env = {
      CLIENT_LOG_AUTH_KEY: 'test-secret',
      ALLOWED_USERS: {
        put: async (key, value, opts) => kv.set(key, { value, opts }),
        get: async (key) => kv.get(key)?.value ?? null,
        delete: async (key) => kv.delete(key),
      },
    };

    const headers = { authorization: 'token' };
    const encrypted = await encryptJson(headers, env.CLIENT_LOG_AUTH_KEY);
    const timestamp = Date.now();
    const nonce = 'nonce-type-test';
    const body = {
      encrypted,
      nonce,
      guild_id: '858648961811873824',
      channel_id: '1514661938766811409',
      command: 'TestCmd',
      timestamp,
      signature: await signPayload({ nonce, timestamp, encrypted }, env.CLIENT_LOG_AUTH_KEY),
    };

    const response = await handleClientHeadersRequest(
      new Request('https://example.com/client-headers', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
    );

    expect(response.status).to.equal(200);
    const stored = await findClientHeaders(
      env,
      {
        guild_id: '858648961811873824',
        channel_id: '1514661938766811409',
        data: { name: 'testcmd' },
      },
      { maxWaitMs: 0, intervalMs: 0 },
    );
    expect(stored.headers).to.deep.equal(headers);
  });

  it('decrypts encrypted payload', async () => {
    const secret = 'another-secret';
    const payload = { 'x-test': 'value' };
    const encrypted = await encryptJson(payload, secret);
    const decrypted = await decryptClientPayload(encrypted, secret);
    expect(decrypted).to.deep.equal(payload);
  });
});
