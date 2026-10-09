export const DISCORD_EPOCH = 1420070400000n;
export const CROSSPOSTED = 1 << 0;
export const IS_CROSSPOST = 1 << 1;
export const DEFAULT_MESSAGE = 0;
export const HOUR = 60 * 60 * 1000;

export function snowflakeTime(id) {
  return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
}

export function announcementsToPublish(messages) {
  return messages
    .filter(
      (message) =>
        message.type === DEFAULT_MESSAGE && !(message.flags & (CROSSPOSTED | IS_CROSSPOST)),
    )
    .sort((a, b) => snowflakeTime(a.id) - snowflakeTime(b.id))
    .map((message) => message.id);
}

const isOpenPostIn = (forumId) => (thread) =>
  thread.parent_id === forumId && !thread.thread_metadata?.archived;

export function recentHelpPosts(threads, { forumId, now, windowMs = 48 * HOUR }) {
  return threads
    .filter(isOpenPostIn(forumId))
    .filter((thread) => now - snowflakeTime(thread.id) <= windowMs);
}

export function needsWelcome(messages, botId) {
  return !messages.some((message) => message.author?.id === botId);
}

export function solvedPostsToArchive(threads, { forumId, solvedTagId, now, idleMs = 24 * HOUR }) {
  return threads
    .filter(isOpenPostIn(forumId))
    .filter((thread) => (thread.applied_tags ?? []).includes(solvedTagId))
    .filter((thread) => now - snowflakeTime(thread.last_message_id ?? thread.id) >= idleMs);
}

export function helpWelcomeMessage({ helpersRoleId, checklist, issuesUrl }) {
  return {
    ...(helpersRoleId ? { content: `<@&${helpersRoleId}> a new question is waiting.` } : {}),
    allowed_mentions: { parse: [], roles: helpersRoleId ? [helpersRoleId] : [] },
    embeds: [
      {
        title: 'Thanks for asking!',
        color: 0x7fd6c8,
        description: [
          'While someone picks this up, make sure the post has everything needed to answer it:',
          '',
          checklist,
          '',
          `Once it is solved, add the ✅ **solved** tag. If it turns out to be a bug, it belongs in a [GitHub issue](${issuesUrl}).`,
        ].join('\n'),
      },
    ],
  };
}

export function contributorsToPromote({ mapping, mergedLogins, members, roleId }) {
  return Object.entries(mapping)
    .filter(([login]) => mergedLogins.has(login.toLowerCase()))
    .filter(([, discordId]) => members[discordId] && !members[discordId].roles.includes(roleId))
    .map(([login, discordId]) => ({ login, discordId }));
}
