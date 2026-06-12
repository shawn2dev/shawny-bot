/** Normalize bot token from secrets (trim whitespace, strip duplicate "Bot " prefix). */
export function botAuthorizationHeader(token) {
  const normalized = token.trim().replace(/^Bot\s+/i, '');
  return `Bot ${normalized}`;
}
