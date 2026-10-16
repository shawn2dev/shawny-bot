import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import sinon from 'sinon';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
} from 'discord-interactions';
import { APPROVED_COMMAND } from '../src/commands.js';
import server from '../src/server.js';

describe('Approved command', () => {
  let verifyStub;
  let env;

  beforeEach(() => {
    verifyStub = sinon.stub(server, 'verifyDiscordRequest');
    env = {
      OWNER_ID: 'owner',
      ALLOWED_USERS: {
        get: sinon.stub().resolves(JSON.stringify(['123', '456'])),
        put: sinon.stub(),
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  async function runCommand(userId, inGuild = false) {
    const user = { id: userId };
    verifyStub.resolves({
      isValid: true,
      interaction: {
        type: InteractionType.APPLICATION_COMMAND,
        data: { name: APPROVED_COMMAND.name },
        ...(inGuild ? { member: { user } } : { user }),
      },
    });
    const response = await server.fetch(
      new Request('https://example.com/', { method: 'POST' }),
      env,
    );
    return response.json();
  }

  it('defines an owner-only command without user options', () => {
    expect(APPROVED_COMMAND.name).to.equal('approved');
    expect(APPROVED_COMMAND.description).to.include('owner only');
    expect(APPROVED_COMMAND.options).to.equal(undefined);
  });

  for (const inGuild of [false, true]) {
    it(`lists approved users for the owner in ${inGuild ? 'a guild' : 'DMs'}`, async () => {
      const body = await runCommand('owner', inGuild);

      expect(body.type).to.equal(
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      );
      expect(body.data.content).to.equal('<@123>, <@456>');
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
      expect(body.data.allowed_mentions).to.deep.equal({ parse: [] });
      sinon.assert.calledOnceWithExactly(env.ALLOWED_USERS.get, 'list');
      sinon.assert.notCalled(env.ALLOWED_USERS.put);
    });
  }

  for (const storedValue of [null, '[]']) {
    it(`handles an empty approval list stored as ${storedValue}`, async () => {
      env.ALLOWED_USERS.get.resolves(storedValue);

      const body = await runCommand('owner');

      expect(body.data.content).to.equal('No approved users.');
      expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
    });
  }

  it('rejects non-owners before reading the approval list', async () => {
    const body = await runCommand('123');

    expect(body.data.flags).to.equal(InteractionResponseFlags.EPHEMERAL);
    expect(body.data.content).not.to.include('<@');
    sinon.assert.notCalled(env.ALLOWED_USERS.get);
    sinon.assert.notCalled(env.ALLOWED_USERS.put);
  });
});
