export const BOT_ID = 'bot-user';
export const BOT_ROLE = 'bot-role';
export const OWNER_ID = 'owner-user';

export function templateGuild(guildId) {
  const text = (id, name, parent_id, position) => ({
    id,
    name,
    type: 0,
    parent_id,
    position,
    topic: null,
    permission_overwrites: [],
  });
  return {
    guild: {
      id: guildId,
      name: 'Magento - Obsidian',
      owner_id: OWNER_ID,
      features: [],
      verification_level: 0,
      explicit_content_filter: 0,
    },
    roles: [
      { id: guildId, name: '@everyone', position: 0, permissions: '0' },
      { id: 'kofi', name: 'Ko-fi Bot', position: 1, managed: true },
      {
        id: 'dev',
        name: 'Developers',
        position: 2,
        color: 0,
        hoist: false,
        mentionable: false,
        permissions: '0',
      },
      {
        id: 'spn',
        name: 'Sponsor',
        position: 3,
        color: 0,
        hoist: false,
        mentionable: false,
        permissions: '0',
      },
      { id: BOT_ROLE, name: 'MageObsidian', position: 4, managed: true },
    ],
    channels: [
      {
        id: 'cat-important',
        name: '💳 | ==== Important ==== | 💳',
        type: 4,
        position: 0,
        permission_overwrites: [],
      },
      text('info', '📑・information', 'cat-important', 0),
      text('1312693628757610587', '🔔・announcements', 'cat-important', 1),
      text('gen', '💬・general', 'cat-important', 2),
    ],
    members: { [BOT_ID]: { roles: [BOT_ROLE] }, [OWNER_ID]: { roles: [] } },
    messages: {},
    webhooks: [],
    automod: [],
    welcomeScreen: null,
    onboarding: null,
  };
}

export function fakeDiscord(state) {
  let sequence = 1;
  const writes = [];
  const nextId = (prefix) => `${prefix}-${sequence++}`;
  const guildPath = `/guilds/${state.guild.id}`;

  const routes = [
    ['GET', /^\/users\/@me$/, () => ({ id: BOT_ID })],
    ['GET', new RegExp(`^${guildPath}$`), () => state.guild],
    ['PATCH', new RegExp(`^${guildPath}$`), (_, body) => Object.assign(state.guild, body)],
    ['GET', new RegExp(`^${guildPath}/roles$`), () => state.roles],
    ['GET', new RegExp(`^${guildPath}/members/([^/]+)$`), ([id]) => state.members[id]],
    [
      'PUT',
      new RegExp(`^${guildPath}/members/([^/]+)/roles/([^/]+)$`),
      ([id, roleId]) => {
        state.members[id].roles = [...new Set([...state.members[id].roles, roleId])];
        return null;
      },
    ],
    [
      'PATCH',
      new RegExp(`^${guildPath}/roles$`),
      (_, positions) => {
        for (const { id, position } of positions) {
          state.roles.find((role) => role.id === id).position = position;
        }
        return state.roles;
      },
    ],
    [
      'POST',
      new RegExp(`^${guildPath}/roles$`),
      (_, body) => {
        const role = { id: nextId('role'), position: 1, managed: false, ...body };
        state.roles.push(role);
        return role;
      },
    ],
    [
      'PATCH',
      new RegExp(`^${guildPath}/roles/(.+)$`),
      ([id], body) =>
        Object.assign(
          state.roles.find((role) => role.id === id),
          body,
        ),
    ],
    [
      'DELETE',
      new RegExp(`^${guildPath}/roles/(.+)$`),
      ([id]) => {
        state.roles = state.roles.filter((role) => role.id !== id);
        return null;
      },
    ],
    ['GET', new RegExp(`^${guildPath}/channels$`), () => state.channels],
    [
      'POST',
      new RegExp(`^${guildPath}/channels$`),
      (_, body) => {
        if ([5, 15].includes(body.type) && !state.guild.features.includes('COMMUNITY')) {
          throw Object.assign(new Error('community required'), { status: 400 });
        }
        const channel = {
          id: nextId('chan'),
          position: 99,
          ...body,
          available_tags: body.available_tags?.map((tag) => ({ id: nextId('tag'), ...tag })),
        };
        state.channels.push(channel);
        return channel;
      },
    ],
    [
      'PATCH',
      new RegExp(`^${guildPath}/channels$`),
      (_, positions) => {
        const reparented = positions.filter((entry) => 'parent_id' in entry);
        if (reparented.length > 1) {
          throw Object.assign(
            new Error('Only one channel can have a parent_id modified at a time'),
            {
              status: 400,
            },
          );
        }
        for (const { id, ...change } of positions) {
          Object.assign(
            state.channels.find((channel) => channel.id === id),
            change,
          );
        }
        return null;
      },
    ],
    [
      'PATCH',
      /^\/channels\/([^/]+)$/,
      ([id], body) => {
        if (body.type === 5 && !state.guild.features.includes('COMMUNITY')) {
          throw Object.assign(new Error('community required'), { status: 400 });
        }
        const channel = state.channels.find((candidate) => candidate.id === id);
        const tags = body.available_tags?.map((tag) => ({ id: tag.id ?? nextId('tag'), ...tag }));
        return Object.assign(channel, body, tags ? { available_tags: tags } : {});
      },
    ],
    [
      'DELETE',
      /^\/channels\/([^/]+)$/,
      ([id]) => {
        state.channels = state.channels.filter((channel) => channel.id !== id);
        return null;
      },
    ],
    ['GET', /^\/channels\/([^/]+)\/messages\?limit=50$/, ([id]) => state.messages[id] ?? []],
    [
      'POST',
      /^\/channels\/([^/]+)\/messages$/,
      ([id], body) => {
        const message = { id: nextId('msg'), author: { id: BOT_ID }, ...body };
        state.messages[id] = [...(state.messages[id] ?? []), message];
        return message;
      },
    ],
    [
      'PATCH',
      /^\/channels\/([^/]+)\/messages\/(.+)$/,
      ([id, messageId], body) =>
        Object.assign(
          state.messages[id].find((message) => message.id === messageId),
          body,
        ),
    ],
    ['GET', new RegExp(`^${guildPath}/welcome-screen$`), () => state.welcomeScreen],
    [
      'PATCH',
      new RegExp(`^${guildPath}/welcome-screen$`),
      (_, body) => (state.welcomeScreen = body),
    ],
    [
      'GET',
      new RegExp(`^${guildPath}/onboarding$`),
      () => {
        if (!state.onboarding)
          throw Object.assign(new Error('unknown onboarding'), { status: 404 });
        return state.onboarding;
      },
    ],
    ['PUT', new RegExp(`^${guildPath}/onboarding$`), (_, body) => (state.onboarding = body)],
    ['GET', new RegExp(`^${guildPath}/auto-moderation/rules$`), () => state.automod],
    [
      'POST',
      new RegExp(`^${guildPath}/auto-moderation/rules$`),
      (_, body) => {
        const rule = {
          id: nextId('rule'),
          ...body,
          trigger_metadata: { regex_patterns: [], allow_list: [], ...body.trigger_metadata },
        };
        state.automod.push(rule);
        return rule;
      },
    ],
    [
      'PATCH',
      new RegExp(`^${guildPath}/auto-moderation/rules/(.+)$`),
      ([id], body) =>
        Object.assign(
          state.automod.find((rule) => rule.id === id),
          body,
        ),
    ],
    [
      'GET',
      /^\/channels\/([^/]+)\/webhooks$/,
      ([id]) => state.webhooks.filter((hook) => hook.channel_id === id),
    ],
    [
      'POST',
      /^\/channels\/([^/]+)\/webhooks$/,
      ([id], body) => {
        const hook = { id: nextId('hook'), token: `tok-${sequence}`, channel_id: id, ...body };
        state.webhooks.push(hook);
        return hook;
      },
    ],
  ];

  const handle = (method) => async (path, body) => {
    const route = routes.find(([verb, pattern]) => verb === method && pattern.test(path));
    if (!route) throw new Error(`fake Discord has no route for ${method} ${path}`);
    if (method !== 'GET') writes.push(`${method} ${path}`);
    const result = route[2](
      path.match(route[1]).slice(1),
      body === undefined ? undefined : structuredClone(body),
    );
    return structuredClone(result);
  };

  return {
    api: {
      get: handle('GET'),
      post: handle('POST'),
      patch: handle('PATCH'),
      put: handle('PUT'),
      delete: handle('DELETE'),
    },
    writes,
  };
}
