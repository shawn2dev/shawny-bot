/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

export const YA_COMMAND = {
  name: '오늘의야동',
  description: '오늘의 야동 가챠 — 랜덤 야동 가져오기!',
};

const userOption = { name: 'user', description: 'User to allow or block', type: 6, required: true };

export const APPROVE_COMMAND = {
  name: 'approve',
  description: 'Allow a user to use this bot (owner only)',
  options: [userOption],
};

export const BLOCK_COMMAND = {
  name: 'block',
  description: 'Block a user from using this bot (owner only)',
  options: [userOption],
};
export const EMOJI_COMMAND = {
  name: '이모지확대',
  description: '이모지를 크게 보여줍니다.',
  options: [
    { name: 'emoji_message', description: '이모지를 넣으면 됩니다.', type: 3, required: true },
  ],
};
