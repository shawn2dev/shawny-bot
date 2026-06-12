/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import {
  YA_COMMAND,
  APPROVE_COMMAND,
  BLOCK_COMMAND,
  EMOJI_COMMAND,
} from './commands.js';
import { handleClientHeadersRequest } from './client-headers.js';
import { collectRequestHeaders, postCommandLog } from './command-logger.js';
import { botAuthorizationHeader } from './discord-token.js';
import { getRandomMp4 } from './utils.js';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

/** Whitelist: add user to allowed list (KV key "list" = JSON array of user ids) */
async function approveUser(userId, env) {
  const current = await env.ALLOWED_USERS.get('list');
  const list = current ? JSON.parse(current) : [];
  if (!list.includes(userId)) list.push(userId);
  await env.ALLOWED_USERS.put('list', JSON.stringify(list));
  return list;
}

/** Whitelist: remove user from allowed list */
async function blockUser(userId, env) {
  const current = await env.ALLOWED_USERS.get('list');
  const list = current ? JSON.parse(current) : [];
  const newList = list.filter((id) => id !== userId);
  await env.ALLOWED_USERS.put('list', JSON.stringify(newList));
  return newList;
}

/** Check if user id is on the whitelist */
async function isUserAllowed(userId, env) {
  const current = await env.ALLOWED_USERS.get('list');
  if (!current) return false;
  const list = JSON.parse(current);
  return list.includes(userId);
}

const router = AutoRouter();

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

/** BetterDiscord plugin: encrypted client interaction headers. */
router.post('/client-headers', (request, env) =>
  handleClientHeadersRequest(request, env),
);

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env, ctx) => {
  const requestHeaders = collectRequestHeaders(request);

  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const commandName = interaction.data.name.toLowerCase();
    const user = interaction.member?.user ?? interaction.user;
    const userId = user.id;

    const logTask = postCommandLog(requestHeaders, env, interaction).catch(
      (err) => console.error('postCommandLog failed:', err?.message ?? err),
    );
    if (ctx?.waitUntil) {
      ctx.waitUntil(logTask);
    } else {
      await logTask;
    }

    // Owner-only: approve / block (no whitelist check)
    if (
      commandName === APPROVE_COMMAND.name.toLowerCase() ||
      commandName === BLOCK_COMMAND.name.toLowerCase()
    ) {
      if (userId !== env.OWNER_ID) {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: '권한 없음', flags: 64 },
        });
      }
      if (commandName === APPROVE_COMMAND.name.toLowerCase()) {
        const targetUserId = interaction.data.options?.[0]?.value;
        if (!targetUserId) {
          return new JsonResponse({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '대상 유저를 선택해 주세요.', flags: 64 },
          });
        }
        await approveUser(targetUserId, env);
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `<@${targetUserId}> 승인됨` },
        });
      }
      if (commandName === BLOCK_COMMAND.name.toLowerCase()) {
        const targetUserId = interaction.data.options?.[0]?.value;
        if (!targetUserId) {
          return new JsonResponse({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '대상 유저를 선택해 주세요.', flags: 64 },
          });
        }
        await blockUser(targetUserId, env);
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: `<@${targetUserId}> 제거됨` },
        });
      }
    }

    // Public: emoji enlarge command (no whitelist)
    if (commandName === EMOJI_COMMAND.name.toLowerCase()) {
      const options = interaction.data.options ?? [];
      const emojiMessage = options.find(
        (o) => o.name === 'emoji_message',
      )?.value;
      if (!emojiMessage || typeof emojiMessage !== 'string') {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: '이모지를 입력해 주세요.', flags: 64 },
        });
      }
      // Discord custom emoji format: <:name:id> or <a:name:id> (animated)
      const match = emojiMessage.match(/<a?:(\w+):(\d+)>/);
      if (!match) {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              '커스텀 이모지 형식이 아닙니다. `<:이름:숫자>` 형태로 서버 이모지를 붙여넣어 주세요.',
            flags: 64,
          },
        });
      }
      const emojiId = match[2];
      const isAnimated = emojiMessage.startsWith('<a:');
      const ext = isAnimated ? 'gif' : 'png';
      const cdnUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}`;
      return new JsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: cdnUrl },
      });
    }

    // All other commands: require whitelist
    const allowed = await isUserAllowed(userId, env);
    if (!allowed) {
      return new JsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '사용 권한 없음' },
      });
    }

    // Whitelisted user commands
    switch (commandName) {
      case YA_COMMAND.name.toLowerCase(): {
        const yaUrls = [
          'https://www.twidouga.net/ko/ranking_t1.php',
          'https://www.twidouga.net/ko/ranking_t2.php',
        ];
        const finishYa = (async () => {
          try {
            const randomIndex = Math.floor(Math.random() * yaUrls.length);
            const randomMp4Url = await getRandomMp4(yaUrls[randomIndex], {
              scraperApiKey: env.SCRAPER_API_KEY,
            });
            await patchDiscordInteractionOriginal(env, interaction, {
              content: randomMp4Url,
            });
          } catch (err) {
            console.error('YA_COMMAND getRandomMp4 failed:', err);
            await patchDiscordInteractionOriginal(env, interaction, {
              content: `오류가 났어요. 나중에 다시 시도해 주세요. (${err?.message ?? String(err)})`,
              flags: 64,
            });
          }
        })();
        if (ctx?.waitUntil) {
          ctx.waitUntil(finishYa);
        } else {
          void finishYa.catch((e) =>
            console.error('YA_COMMAND background:', e),
          );
        }
        return new JsonResponse({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });
      }
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }

  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

/** Edit the message for a deferred interaction (slash commands have ~3s to ack). */
async function patchDiscordInteractionOriginal(env, interaction, data) {
  const applicationId =
    interaction.application_id ?? env.DISCORD_APPLICATION_ID;
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interaction.token}/messages/@original`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      Authorization: botAuthorizationHeader(env.DISCORD_TOKEN),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error(
      'Discord interaction PATCH failed:',
      res.status,
      await res.text(),
    );
  }
}

const server = {
  verifyDiscordRequest,
  async fetch(request, env, ctx) {
    return router.fetch(request, env, ctx);
  },
};

export default server;
