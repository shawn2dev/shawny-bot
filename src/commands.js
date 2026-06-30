/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 *
 * integration_types: where the app can be installed (guild, user, or both)
 * contexts: where the command can be invoked (server, bot DM, other DMs/GDMs)
 *
 * @see https://discord.com/developers/docs/interactions/application-commands#contexts
 */

/** GUILD_INSTALL */
const INTEGRATION_GUILD = 0;
/** USER_INSTALL */
const INTEGRATION_USER = 1;

/** GUILD */
const CONTEXT_GUILD = 0;
/** BOT_DM — DM with this app's bot user */
const CONTEXT_BOT_DM = 1;
/** PRIVATE_CHANNEL — other DMs and group DMs (requires USER_INSTALL) */
const CONTEXT_PRIVATE_CHANNEL = 2;

const userAndGuildInstall = {
  integration_types: [INTEGRATION_GUILD, INTEGRATION_USER],
  contexts: [CONTEXT_GUILD, CONTEXT_BOT_DM, CONTEXT_PRIVATE_CHANNEL],
};

export const YA_COMMAND = {
  name: '오늘의야동',
  description: '오늘의 야동 가챠 — 랜덤 야동 가져오기!',
  ...userAndGuildInstall,
};

const userOption = {
  name: 'user',
  description: 'User to allow or block',
  type: 6,
  required: true,
};

export const APPROVE_COMMAND = {
  name: 'approve',
  description: 'Allow a user to use this bot (owner only)',
  options: [userOption],
  ...userAndGuildInstall,
};

export const BLOCK_COMMAND = {
  name: 'block',
  description: 'Block a user from using this bot (owner only)',
  options: [userOption],
  ...userAndGuildInstall,
};
export const EMOJI_COMMAND = {
  name: '이모지확대',
  description: '이모지를 크게 보여줍니다.',
  options: [
    {
      name: 'emoji_message',
      description: '이모지를 넣으면 됩니다.',
      type: 3,
      required: true,
    },
  ],
  ...userAndGuildInstall,
};
