import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  buildStorageKey,
  findInteractionHeaders,
  handleInteractionHeadersPost,
} from '../src/interaction-headers.js';

describe('interaction-headers', () => {
  it('stores and retrieves headers by guild, channel, and command', async () => {
    const kv = new Map();
    const env = {
      CLIENT_LOG_AUTH_KEY: 'test-key',
      DISCORD_APPLICATION_ID: '1337358598673797141',
      ALLOWED_USERS: {
        put: async (key, value, opts) => kv.set(key, { value, opts }),
        get: async (key) => kv.get(key)?.value ?? null,
        delete: async (key) => kv.delete(key),
      },
    };

    const response = await handleInteractionHeadersPost(
      new Request('https://example.com/interaction-headers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shawny-Key': 'test-key',
        },
        body: JSON.stringify({
          application_id: '1337358598673797141',
          guild_id: '858648961811873824',
          channel_id: '1514661938766811409',
          command: 'TestCmd',
          headers: { authorization: 'token', 'x-discord-locale': 'ko' },
        }),
      }),
      env,
    );

    expect(response.status).to.equal(200);
    expect(buildStorageKey('858648961811873824', '1514661938766811409', 'testcmd')).to.equal(
      'ih:858648961811873824:1514661938766811409:testcmd',
    );

    const stored = await findInteractionHeaders(
      env,
      {
        guild_id: '858648961811873824',
        channel_id: '1514661938766811409',
        data: { name: 'testcmd' },
      },
      { maxWaitMs: 0, intervalMs: 0 },
    );
    expect(stored.headers).to.deep.equal({
      authorization: 'token',
      'x-discord-locale': 'ko',
    });
  });

  it('rejects wrong application_id', async () => {
    const env = {
      CLIENT_LOG_AUTH_KEY: 'test-key',
      DISCORD_APPLICATION_ID: '1337358598673797141',
      ALLOWED_USERS: { put: async () => {}, get: async () => null },
    };

    const response = await handleInteractionHeadersPost(
      new Request('https://example.com/interaction-headers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shawny-Key': 'test-key',
        },
        body: JSON.stringify({
          application_id: '999',
          channel_id: '1',
          command: 'test',
          headers: {},
        }),
      }),
      env,
    );

    expect(response.status).to.equal(403);
  });
});
