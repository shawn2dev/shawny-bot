import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import sinon from 'sinon';
import {
  collectRequestHeaders,
  postCommandLog,
  LOG_CHANNEL_ID,
} from '../src/command-logger.js';

describe('command-logger', () => {
  let fetchStub;

  afterEach(() => {
    fetchStub?.restore();
  });

  describe('collectRequestHeaders', () => {
    it('returns all request headers', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-signature-ed25519': 'abc123',
          'x-signature-timestamp': '1234567890',
          'content-type': 'application/json',
        },
      });

      const headers = collectRequestHeaders(request);

      expect(headers).to.deep.equal({
        'x-signature-ed25519': 'abc123',
        'x-signature-timestamp': '1234567890',
        'content-type': 'application/json',
      });
    });
  });

  describe('postCommandLog', () => {
    it('posts summary and headers file to the configured channel', async () => {
      const headers = { 'x-test-header': 'value' };
      const interaction = {
        data: { name: 'approve' },
        guild_id: '999',
        channel_id: '888',
        guild: { id: '999', name: 'Test Server' },
        channel: { id: '888', name: 'general', type: 0 },
        member: { user: { id: '111', username: 'tester' } },
      };
      const env = { DISCORD_TOKEN: 'bot-token' };

      fetchStub = sinon.stub(global, 'fetch').resolves({ ok: true });

      await postCommandLog(headers, env, interaction);

      expect(fetchStub.calledOnce).to.be.true;
      const [url, options] = fetchStub.firstCall.args;
      expect(url).to.equal(
        `https://discord.com/api/v10/channels/${LOG_CHANNEL_ID}/messages`,
      );
      expect(options.method).to.equal('POST');
      expect(options.headers.Authorization).to.equal('Bot bot-token');
      expect(options.body).to.be.instanceOf(FormData);

      const payloadJson = options.body.get('payload_json');
      const payload = JSON.parse(
        typeof payloadJson === 'string'
          ? payloadJson
          : await payloadJson.text(),
      );
      expect(payload.content).to.include('Guild: Test Server (999)');
      expect(payload.content).to.include(
        'Channel: [#general](https://discord.com/channels/999/888)',
      );
      expect(payload.content).to.include('Server headers: server-headers.json');
    });

    it('fetches guild name from Discord API when not in interaction', async () => {
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub
        .withArgs('https://discord.com/api/v10/guilds/999', sinon.match.any)
        .resolves({
          ok: true,
          json: sinon.fake.resolves({ name: 'Fetched Server' }),
        });
      fetchStub
        .withArgs('https://discord.com/api/v10/channels/888', sinon.match.any)
        .resolves({
          ok: true,
          json: sinon.fake.resolves({ name: 'bot-commands', type: 0 }),
        });
      fetchStub
        .withArgs(
          `https://discord.com/api/v10/channels/${LOG_CHANNEL_ID}/messages`,
          sinon.match.any,
        )
        .resolves({ ok: true });

      await postCommandLog(
        {},
        { DISCORD_TOKEN: 'bot-token' },
        {
          data: { name: 'test' },
          guild_id: '999',
          channel_id: '888',
          member: { user: { id: '1', username: 'u' } },
        },
      );

      const postCall = fetchStub
        .getCalls()
        .find((c) =>
          c.args[0].includes(`/channels/${LOG_CHANNEL_ID}/messages`),
        );
      const payloadJson = postCall.args[1].body.get('payload_json');
      const payload = JSON.parse(
        typeof payloadJson === 'string'
          ? payloadJson
          : await payloadJson.text(),
      );
      expect(payload.content).to.include('Guild: Fetched Server (999)');
      expect(payload.content).to.include(
        'Channel: [#bot-commands](https://discord.com/channels/999/888)',
      );
    });

    it('throws when DISCORD_TOKEN is missing', async () => {
      fetchStub = sinon.stub(global, 'fetch');

      try {
        await postCommandLog({}, {}, { data: { name: 'test' } });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('DISCORD_TOKEN is not set');
      }

      expect(fetchStub.called).to.be.false;
    });

    it('uses LOG_WEBHOOK_URL when set', async () => {
      fetchStub = sinon.stub(global, 'fetch').resolves({ ok: true });

      await postCommandLog(
        { 'x-test': '1' },
        { LOG_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/token' },
        { data: { name: 'test' }, member: { user: { id: '1', username: 'u' } } },
      );

      expect(fetchStub.calledOnce).to.be.true;
      expect(fetchStub.firstCall.args[0]).to.equal(
        'https://discord.com/api/webhooks/1/token',
      );
      expect(fetchStub.firstCall.args[1].headers).to.be.undefined;
    });
  });
});
