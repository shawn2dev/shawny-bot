import {
  decryptClientPayload,
  isTimestampValid,
  verifyClientSignature,
} from './client-log-crypto.js';

const KV_PREFIX = 'client-h:';
const KV_TTL_SECONDS = 60;

function normId(value) {
  return value == null || value === '' ? null : String(value);
}

function normCommand(name) {
  return name == null || name === '' ? null : String(name).toLowerCase();
}

function buildMatchKey(guildId, channelId, command) {
  const guild = normId(guildId);
  const channel = normId(channelId);
  const cmd = normCommand(command);
  if (!guild || !channel || !cmd) return null;
  return `${KV_PREFIX}match:${guild}:${channel}:${cmd}`;
}

function buildStorageKeys(payload) {
  const keys = new Set();
  if (payload.nonce) keys.add(`${KV_PREFIX}${String(payload.nonce)}`);
  const sessionId = normId(payload.session_id);
  if (sessionId) keys.add(`${KV_PREFIX}session:${sessionId}`);
  const matchKey = buildMatchKey(
    payload.guild_id,
    payload.channel_id,
    payload.command,
  );
  if (matchKey) keys.add(matchKey);
  return [...keys];
}

function buildLookupKeys(interaction) {
  const keys = new Set();
  if (interaction.nonce) keys.add(`${KV_PREFIX}${String(interaction.nonce)}`);
  const sessionId = normId(interaction.session_id);
  if (sessionId) keys.add(`${KV_PREFIX}session:${sessionId}`);
  const matchKey = buildMatchKey(
    interaction.guild_id,
    interaction.channel_id,
    interaction.data?.name,
  );
  if (matchKey) keys.add(matchKey);
  return [...keys];
}

export async function storeClientHeaders(env, payload, headers) {
  if (!env.ALLOWED_USERS) {
    throw new Error('ALLOWED_USERS KV binding is not configured');
  }

  const record = JSON.stringify({
    headers,
    guild_id: payload.guild_id ?? null,
    channel_id: payload.channel_id ?? null,
    command: payload.command ?? null,
    received_at: Date.now(),
  });
  const ttl = { expirationTtl: KV_TTL_SECONDS };
  const keys = buildStorageKeys(payload);

  await Promise.all(
    keys.map((key) => env.ALLOWED_USERS.put(key, record, ttl)),
  );
}

/** Poll KV for client headers (plugin may arrive slightly after the webhook). */
export async function findClientHeaders(
  env,
  interaction,
  { maxWaitMs = 15000, intervalMs = 250 } = {},
) {
  const lookupKeys = buildLookupKeys(interaction);
  if (!lookupKeys.length || !env.ALLOWED_USERS) return null;

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() <= deadline) {
    for (const key of lookupKeys) {
      const stored = await env.ALLOWED_USERS.get(key);
      if (stored) {
        await Promise.all(
          lookupKeys.map((k) => env.ALLOWED_USERS.delete(k)),
        );
        return JSON.parse(stored);
      }
    }
    if (Date.now() + intervalMs > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.log('client-headers miss', lookupKeys);
  return null;
}

export async function handleClientHeadersRequest(request, env) {
  if (!env.CLIENT_LOG_AUTH_KEY) {
    return new Response('Client logging is not configured.', { status: 503 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const { encrypted, nonce, timestamp, signature } = payload;
  if (!encrypted || !nonce || !timestamp || !signature) {
    return new Response('Missing required fields.', { status: 400 });
  }

  if (!isTimestampValid(timestamp)) {
    return new Response('Timestamp is too old or invalid.', { status: 401 });
  }

  const validSignature = await verifyClientSignature(
    payload,
    env.CLIENT_LOG_AUTH_KEY,
  );
  if (!validSignature) {
    return new Response('Invalid signature.', { status: 401 });
  }

  let headers;
  try {
    headers = await decryptClientPayload(encrypted, env.CLIENT_LOG_AUTH_KEY);
  } catch (err) {
    console.error('decryptClientPayload failed:', err);
    return new Response('Invalid encrypted payload.', { status: 400 });
  }

  await storeClientHeaders(env, payload, headers);
  console.log('client-headers stored', buildStorageKeys(payload));

  return Response.json({ ok: true });
}
