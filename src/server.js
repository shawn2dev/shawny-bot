/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { SHAWNY_COMMAND, SEO_COMMAND, D_DAY_COMMAND, YA_COMMAND, APPROVE_COMMAND, BLOCK_COMMAND } from './commands.js';
import { getContentUrl } from './reddit.js';
import { daysSinceTargetDate, getRandomMp4 } from './utils.js';

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

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env) => {
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

    // Owner-only: approve / block (no whitelist check)
    if (commandName === APPROVE_COMMAND.name.toLowerCase() || commandName === BLOCK_COMMAND.name.toLowerCase()) {
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
          data: { content: `<@${targetUserId}> 차단됨` },
        });
      }
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
      case SHAWNY_COMMAND.name.toLowerCase(): {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: SHAWNY_COMMAND.response,
          },
        });
      }
      case SEO_COMMAND.name.toLowerCase(): {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: SEO_COMMAND.response,
          },
        });
      }
      case D_DAY_COMMAND.name.toLowerCase(): {
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `${daysSinceTargetDate('2026-01-08', 'Asia/Seoul')}일째 ❤️`,
          },
        });
      }
      case YA_COMMAND.name.toLowerCase(): {
        try {
          const yaUrls = ['https://www.twidouga.net/ko/ranking_t1.php', 'https://www.twidouga.net/ko/ranking_t2.php'];
          const randomIndex = Math.floor(Math.random() * yaUrls.length);
          const randomMp4Url = await getRandomMp4(yaUrls[randomIndex]);
          return new JsonResponse({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: randomMp4Url,
            },
          });
        } catch (err) {
          console.error('YA_COMMAND getRandomMp4 failed:', err);
          return new JsonResponse({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `오류가 났어요. 나중에 다시 시도해 주세요. (${err?.message ?? String(err)})`,
              flags: 64,
            },
          });
        }
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

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default server;
