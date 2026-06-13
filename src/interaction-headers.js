const KV_PREFIX = 'ih:';
const KV_TTL_SECONDS = 60;
const DEFAULT_APP_ID = '1337358598673797141';

function normId(value) {
  return value == null || value === '' ? null : String(value);
}

function normGuildId(guildId) {
  return normId(guildId) ?? 'dm';
}

function normCommand(name) {
  return name == null || name === '' ? null : String(name).toLowerCase();
}

export function buildStorageKey(guildId, channelId, command) {
  const guild = normGuildId(guildId);
  const channel = normId(channelId);
  const cmd = normCommand(command);
  if (!channel || !cmd) return null;
  return `${KV_PREFIX}${guild}:${channel}:${cmd}`;
}

function expectedApplicationId(env) {
  return String(env.DISCORD_APPLICATION_ID ?? DEFAULT_APP_ID);
}

function isAuthorized(request, env) {
  const provided = request.headers.get('x-shawny-key');
  const expected = env.CLIENT_LOG_AUTH_KEY?.trim();
  return Boolean(provided && expected && provided === expected);
}

export const CLIENT_LOG_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Shawny-Key',
};

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: CLIENT_LOG_CORS,
  });
}

/** POST /interaction-headers — plugin ingests client request headers. */
export async function handleInteractionHeadersPost(request, env) {
  if (!env.CLIENT_LOG_AUTH_KEY) {
    return jsonResponse({ error: 'Client logging is not configured.' }, 503);
  }
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }
  if (!env.ALLOWED_USERS) {
    return jsonResponse({ error: 'KV is not configured.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const applicationId = normId(body.application_id);
  if (!applicationId || applicationId !== expectedApplicationId(env)) {
    return jsonResponse({ error: 'Unsupported application_id.' }, 403);
  }

  const channelId = normId(body.channel_id);
  const command = normCommand(body.command ?? body.data?.name);
  const headers = body.headers;

  if (!channelId || !command) {
    return jsonResponse({ error: 'Missing channel_id or command.' }, 400);
  }
  if (!headers || typeof headers !== 'object') {
    return jsonResponse({ error: 'Missing headers object.' }, 400);
  }

  const key = buildStorageKey(body.guild_id, channelId, command);
  if (!key) {
    return jsonResponse({ error: 'Could not build storage key.' }, 400);
  }

  await env.ALLOWED_USERS.put(
    key,
    JSON.stringify({
      headers,
      guild_id: normGuildId(body.guild_id),
      channel_id: channelId,
      command,
      received_at: Date.now(),
    }),
    { expirationTtl: KV_TTL_SECONDS },
  );

  console.log('interaction-headers stored', key);
  return jsonResponse({ ok: true, key });
}

/** Poll KV until plugin headers arrive (usually before the Discord webhook). */
export async function findInteractionHeaders(
  env,
  interaction,
  { maxWaitMs = 15000, intervalMs = 250 } = {},
) {
  const key = buildStorageKey(
    interaction.guild_id,
    interaction.channel_id,
    interaction.data?.name,
  );
  if (!key || !env.ALLOWED_USERS) return null;

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() <= deadline) {
    const stored = await env.ALLOWED_USERS.get(key);
    if (stored) {
      await env.ALLOWED_USERS.delete(key);
      return JSON.parse(stored);
    }
    if (Date.now() + intervalMs > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

export function handleInteractionHeadersOptions() {
  return new Response(null, { status: 204, headers: CLIENT_LOG_CORS });
}
