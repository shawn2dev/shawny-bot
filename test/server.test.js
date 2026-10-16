import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { InteractionResponseType, InteractionType } from 'discord-interactions';
import sinon from 'sinon';
import server from '../src/server.js';

describe('Server', () => {
  describe('GET /', () => {
    it('should return a greeting message with the Discord application ID', async () => {
      const request = {
        method: 'GET',
        url: new URL('/', 'http://discordo.example'),
      };
      const env = { DISCORD_APPLICATION_ID: '123456789' };

      const response = await server.fetch(request, env);
      const body = await response.text();

      expect(body).to.equal('👋 123456789');
    });
  });

  describe('POST /', () => {
    let verifyDiscordRequestStub;

    beforeEach(() => {
      verifyDiscordRequestStub = sinon.stub(server, 'verifyDiscordRequest');
    });

    afterEach(() => {
      verifyDiscordRequestStub.restore();
    });

    it('should handle a PING interaction', async () => {
      const interaction = {
        type: InteractionType.PING,
      };

      const request = new Request('http://discordo.example/', {
        method: 'POST',
      });

      const env = {};

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(body.type).to.equal(InteractionResponseType.PONG);
    });

    it('should handle an unknown command interaction', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: 'unknown',
        },
        user: { id: '123456789' },
      };

      const request = new Request('http://discordo.example/', {
        method: 'POST',
      });

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const env = {
        ALLOWED_USERS: {
          get: sinon.stub().resolves(JSON.stringify(['123456789'])),
        },
      };
      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(response.status).to.equal(400);
      expect(body.error).to.equal('Unknown Type');
    });
  });

  describe('All other routes', () => {
    it('should return a "Not Found" response', async () => {
      const request = {
        method: 'GET',
        url: new URL('/unknown', 'http://discordo.example'),
      };
      const response = await server.fetch(request, {});
      expect(response.status).to.equal(404);
      const body = await response.text();
      expect(body).to.equal('Not Found.');
    });
  });
});
