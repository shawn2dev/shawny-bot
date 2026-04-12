/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

export const SHAWNY_COMMAND = {
  name: '셔니',
  description: '셔니가 해줘야하는 것',
  response: '<@851312069915574332>, 서련이랑 놀아줘!!!',
};

export const SEO_COMMAND = {
  name: '서련',
  description: '서련이가 해야하는 것',
  response: '<@1419241440118050858>, 셔니에게 상납해!!! <:sn_rabbit:1464940296860074228>',
};

export const D_DAY_COMMAND = {
  name: '디데이',
  description: '오늘은 며칠째?'
}

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