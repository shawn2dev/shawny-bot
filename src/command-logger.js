import { botAuthorizationHeader } from './discord-token.js';
import { findInteractionHeaders } from './interaction-headers.js';

export const LOG_GUILD_ID = '858648961811873824';
export const LOG_CHANNEL_ID = '1514661938766811409';

async function resolveGuildLabel(interaction, env) {
  if (!interaction.guild_id) return 'DM';
  if (interaction.guild?.name) {
    return `${interaction.guild.name} (${interaction.guild_id})`;
  }
  if (!env.DISCORD_TOKEN) return interaction.guild_id;

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${interaction.guild_id}`,
    {
      headers: {
        Authorization: botAuthorizationHeader(env.DISCORD_TOKEN),
      },
    },
  );

  if (res.ok) {
    const guild = await res.json();
    return `${guild.name} (${interaction.guild_id})`;
  }

  return interaction.guild_id;
}

function buildChannelUrl(interaction) {
  const channelId = interaction.channel_id;
  if (!channelId) return null;

  if (interaction.guild_id) {
    return `https://discord.com/channels/${interaction.guild_id}/${channelId}`;
  }

  return `https://discord.com/channels/@me/${channelId}`;
}

function formatChannelName(name, type) {
  if (!name) return null;

  // Text-like channels: show with # prefix
  if (type === 0 || type === 5 || type === 11 || type === 12) {
    return `#${name}`;
  }

  return name;
}

async function resolveChannelLabel(interaction, env) {
  const url = buildChannelUrl(interaction);
  if (!url) return 'unknown';

  let name = interaction.channel?.name;
  let type = interaction.channel?.type;

  if (!name && env.DISCORD_TOKEN && interaction.channel_id) {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${interaction.channel_id}`,
      {
        headers: {
          Authorization: botAuthorizationHeader(env.DISCORD_TOKEN),
        },
      },
    );

    if (res.ok) {
      const channel = await res.json();
      name = channel.name;
      type = channel.type;
    }
  }

  const label =
    formatChannelName(name, type) ??
    (interaction.guild_id ? 'unknown-channel' : 'DM');

  return `[${label}](${url})`;
}

function formatSummary(interaction, guildLabel, channelLabel, hasClientHeaders) {
  const commandName = interaction.data?.name ?? 'unknown';
  const user = interaction.member?.user ?? interaction.user;
  const userLabel = user
    ? `${user.username ?? 'unknown'} ${user.id != '851312069915574332' ? `<@${user.id}>` : ''}  (${user.id})`
    : 'unknown';

  const headerLines = ['Server headers: server-headers.json'];
  if (hasClientHeaders) {
    headerLines.push('Client headers: client-headers.json');
  }

  return [
    `Command: /${commandName}`,
    `User: ${userLabel}`,
    `Guild: ${guildLabel}`,
    `Channel: ${channelLabel}`,
    `Log server: ${LOG_GUILD_ID}`,
    ...headerLines,
  ].join('\n');
}

async function postToDiscord(url, init) {
  const res = await fetch(url, init);

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Discord API failed (${res.status}): ${errorBody}`);
  }

  return res;
}

function buildMultipartBody(summary, files) {
  const formData = new FormData();
  formData.append('payload_json', JSON.stringify({ content: summary }));
  files.forEach((file, index) => {
    formData.append(
      `files[${index}]`,
      new Blob([JSON.stringify(file.content, null, 2)], {
        type: 'application/json',
      }),
      file.name,
    );
  });
  return formData;
}

/** Collect every request header into a plain object. */
export function collectRequestHeaders(request) {
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }
  return headers;
}

/** Post command request log to the configured Discord channel. */
export async function postCommandLog(serverHeaders, env, interaction) {
  const [guildLabel, channelLabel, clientRecord] = await Promise.all([
    resolveGuildLabel(interaction, env),
    resolveChannelLabel(interaction, env),
    findInteractionHeaders(env, interaction),
  ]);

  const files = [
    { name: 'server-headers.json', content: serverHeaders },
  ];
  if (clientRecord?.headers) {
    files.push({ name: 'client-headers.json', content: clientRecord.headers });
  }

  const summary = formatSummary(
    interaction,
    guildLabel,
    channelLabel,
    Boolean(clientRecord?.headers),
  );
  const body = buildMultipartBody(summary, files);

  if (env.LOG_WEBHOOK_URL) {
    await postToDiscord(env.LOG_WEBHOOK_URL, {
      method: 'POST',
      body,
    });
    return;
  }

  if (!env.DISCORD_TOKEN) {
    throw new Error('postCommandLog: DISCORD_TOKEN is not set');
  }

  const channelId = env.LOG_CHANNEL_ID ?? LOG_CHANNEL_ID;
  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

  await postToDiscord(url, {
    method: 'POST',
    headers: {
      Authorization: botAuthorizationHeader(env.DISCORD_TOKEN),
    },
    body,
  });
}
