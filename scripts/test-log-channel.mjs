/**
 * Test whether the bot can post to the log channel.
 * Usage: DISCORD_TOKEN=xxx node scripts/test-log-channel.mjs
 */
const token = process.env.DISCORD_TOKEN;
const channelId = process.env.LOG_CHANNEL_ID ?? '1514661938766811409';

if (!token) {
  console.error('Set DISCORD_TOKEN env var first.');
  process.exit(1);
}

const formData = new FormData();
formData.append(
  'payload_json',
  JSON.stringify({ content: '✅ log channel test (multipart)' }),
);
formData.append(
  'files[0]',
  new Blob(['{"test":true}'], { type: 'application/json' }),
  'headers.json',
);

const res = await fetch(
  `https://discord.com/api/v10/channels/${channelId}/messages`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
    },
    body: formData,
  },
);

const body = await res.text();
console.log(`Status: ${res.status}`);
console.log(body);

if (!res.ok) {
  process.exit(1);
}
