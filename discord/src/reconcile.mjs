import { ChannelType } from './blueprint.mjs';

export const COMMUNITY_ONLY_TYPES = new Set([ChannelType.ANNOUNCEMENT, ChannelType.FORUM]);

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function matchRoles(existingRoles, desiredRoles, guildId) {
  const candidates = existingRoles.filter((role) => role.id !== guildId && !role.managed);
  const matched = {};
  for (const desired of desiredRoles) {
    const found = candidates.find((role) => sameName(role.name, desired.name));
    if (found) matched[desired.key] = found;
  }
  const used = new Set(Object.values(matched).map((role) => role.id));
  return { matched, extras: candidates.filter((role) => !used.has(role.id)) };
}

export function roleBody(desired) {
  return {
    name: desired.name,
    color: desired.color,
    hoist: desired.hoist,
    mentionable: desired.mentionable,
    permissions: desired.permissions,
  };
}

export function rolePatch(existing, desired) {
  const body = roleBody(desired);
  const changed = Object.entries(body).filter(
    ([field, value]) => String(existing[field]) !== String(value),
  );
  return changed.length ? Object.fromEntries(changed) : null;
}

export function matchChannels(existingChannels, desiredChannels) {
  const matched = {};
  const used = new Set();
  const take = (desired, found) => {
    matched[desired.key] = found;
    used.add(found.id);
  };

  for (const desired of desiredChannels.filter((channel) => channel.adopt)) {
    const found = existingChannels.find((channel) => channel.id === desired.adopt);
    if (found) take(desired, found);
  }
  for (const desired of desiredChannels.filter((channel) => !matched[channel.key])) {
    const isCategory = desired.type === ChannelType.CATEGORY;
    const found = existingChannels.find(
      (channel) =>
        !used.has(channel.id) &&
        sameName(channel.name, desired.name) &&
        (channel.type === ChannelType.CATEGORY) === isCategory,
    );
    if (found) take(desired, found);
  }

  return { matched, extras: existingChannels.filter((channel) => !used.has(channel.id)) };
}

export function overwritesFor(desired, { guildId, roleIds }) {
  return (desired.overwrites ?? []).map((overwrite) => ({
    id: overwrite.role === '@everyone' ? guildId : roleIds[overwrite.role],
    type: 0,
    allow: overwrite.allow ?? '0',
    deny: overwrite.deny ?? '0',
  }));
}

export function forumTags(desired, existing) {
  return desired.tags.map((tag) => {
    const current = existing?.available_tags?.find((candidate) => candidate.name === tag.name);
    return {
      ...(current ? { id: current.id } : {}),
      name: tag.name,
      moderated: tag.moderated ?? false,
      emoji_id: null,
      emoji_name: tag.emoji_name,
    };
  });
}

export function channelBody(desired, context, existing) {
  const body = {
    name: desired.name,
    type: desired.type,
    permission_overwrites: overwritesFor(desired, context),
  };
  if (desired.type !== ChannelType.CATEGORY) {
    body.parent_id = desired.parent ? context.channelIds[desired.parent] : null;
    body.topic = desired.topic ?? null;
  }
  if (desired.type === ChannelType.FORUM) {
    body.flags = desired.flags ?? 0;
    body.default_sort_order = desired.default_sort_order ?? null;
    body.default_forum_layout = desired.default_forum_layout ?? 0;
    body.default_reaction_emoji = desired.default_reaction_emoji ?? null;
    body.available_tags = forumTags(desired, existing);
  }
  return body;
}

function normalizedOverwrites(overwrites = []) {
  return overwrites
    .map(({ id, type, allow, deny }) => `${id}:${type}:${allow}:${deny}`)
    .sort()
    .join('|');
}

function normalizedTags(tags = []) {
  return tags
    .map((tag) => `${tag.name}:${tag.emoji_name ?? ''}:${Boolean(tag.moderated)}`)
    .join('|');
}

export function channelPatch(existing, desired, context) {
  const body = channelBody(desired, context, existing);
  const patch = {};
  for (const [field, value] of Object.entries(body)) {
    const current = existing[field];
    const differs =
      field === 'permission_overwrites'
        ? normalizedOverwrites(current) !== normalizedOverwrites(value)
        : field === 'available_tags'
          ? normalizedTags(current) !== normalizedTags(value)
          : field === 'default_reaction_emoji'
            ? (current?.emoji_name ?? null) !== (value?.emoji_name ?? null)
            : field === 'name'
              ? !sameName(current ?? '', value)
              : (current ?? null) !== (value ?? null);
    if (differs) patch[field] = value;
  }
  return Object.keys(patch).length ? patch : null;
}

export function needsCommunity(desired, existing) {
  return COMMUNITY_ONLY_TYPES.has(desired.type) && (!existing || existing.type !== desired.type);
}

export function guildBody(guildBlueprint, channelIds, currentFeatures = []) {
  const { rulesChannel, updatesChannel, systemChannel, ...settings } = guildBlueprint;
  return {
    ...settings,
    features: [...new Set([...currentFeatures, 'COMMUNITY'])],
    rules_channel_id: channelIds[rulesChannel],
    public_updates_channel_id: channelIds[updatesChannel],
    system_channel_id: channelIds[systemChannel],
  };
}

export function channelPositions(desiredChannels, channelIds) {
  const positions = [];
  const categories = desiredChannels.filter((channel) => channel.type === ChannelType.CATEGORY);
  categories.forEach((category, index) => {
    positions.push({ id: channelIds[category.key], position: index });
  });
  const byParent = new Map();
  for (const channel of desiredChannels.filter(
    (candidate) => candidate.type !== ChannelType.CATEGORY,
  )) {
    const siblings = byParent.get(channel.parent) ?? [];
    siblings.push(channel);
    byParent.set(channel.parent, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.forEach((channel, index) => {
      positions.push({ id: channelIds[channel.key], position: index });
    });
  }
  return positions;
}

export function welcomeScreenBody(screen, channelIds) {
  return {
    enabled: true,
    description: screen.description,
    welcome_channels: screen.channels.map((entry) => ({
      channel_id: channelIds[entry.channel],
      description: entry.description,
      emoji_id: null,
      emoji_name: entry.emoji_name,
    })),
  };
}

export function onboardingBody(onboarding, { channelIds, roleIds, existing, newId }) {
  return {
    enabled: true,
    mode: 0,
    default_channel_ids: onboarding.defaultChannels.map((key) => channelIds[key]),
    prompts: onboarding.prompts.map((prompt) => {
      const current = existing?.prompts?.find((candidate) => candidate.title === prompt.title);
      return {
        id: current?.id ?? newId(),
        type: 0,
        title: prompt.title,
        single_select: true,
        required: false,
        in_onboarding: true,
        options: prompt.options.map((option) => {
          const currentOption = current?.options?.find(
            (candidate) => candidate.title === option.title,
          );
          return {
            id: currentOption?.id ?? newId(),
            title: option.title,
            description: option.description,
            emoji_name: option.emoji_name,
            role_ids: (option.roles ?? []).map((key) => roleIds[key]),
            channel_ids: (option.channels ?? []).map((key) => channelIds[key]),
          };
        }),
      };
    }),
  };
}

export function automodBody(rule, { channelIds, roleIds, alertChannel, exemptRoles }) {
  const actions = [{ type: 1, metadata: {} }];
  if (rule.alert) actions.push({ type: 2, metadata: { channel_id: channelIds[alertChannel] } });
  return {
    name: rule.name,
    event_type: 1,
    trigger_type: rule.trigger_type,
    ...(rule.trigger_metadata ? { trigger_metadata: rule.trigger_metadata } : {}),
    actions,
    enabled: true,
    exempt_roles: exemptRoles.map((key) => roleIds[key]),
    exempt_channels: [],
  };
}

export function rolesAboveBot(roles, botUserRoleIds, guildId) {
  const botTop = Math.max(
    ...roles.filter((role) => botUserRoleIds.includes(role.id)).map((role) => role.position),
  );
  return roles.filter(
    (role) => role.id !== guildId && !botUserRoleIds.includes(role.id) && role.position >= botTop,
  );
}

export function includesShape(actual, expected) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item, index) => includesShape(actual[index], item))
    );
  }
  if (expected && typeof expected === 'object') {
    return (
      Boolean(actual) &&
      typeof actual === 'object' &&
      Object.entries(expected).every(([key, value]) => includesShape(actual[key], value))
    );
  }
  return actual === expected;
}

export function channelsInOrder(currentChannels, desiredChannels, channelIds) {
  const byPosition = (a, b) => a.position - b.position || String(a.id).localeCompare(String(b.id));
  const ids = (channels) => channels.sort(byPosition).map((channel) => channel.id);
  const wantedIds = new Set(desiredChannels.map((channel) => channelIds[channel.key]));
  const current = currentChannels.filter((channel) => wantedIds.has(channel.id));

  const groups = [
    [null, desiredChannels.filter((channel) => channel.type === ChannelType.CATEGORY)],
    ...desiredChannels
      .filter((channel) => channel.type === ChannelType.CATEGORY)
      .map((category) => [
        category.key,
        desiredChannels.filter((channel) => channel.parent === category.key),
      ]),
  ];

  return groups.every(([parent, desired]) => {
    const actual = current.filter((channel) =>
      parent === null
        ? channel.type === ChannelType.CATEGORY
        : channel.parent_id === channelIds[parent] && channel.type !== ChannelType.CATEGORY,
    );
    return (
      JSON.stringify(ids(actual)) ===
      JSON.stringify(desired.map((channel) => channelIds[channel.key]))
    );
  });
}

export function rolePositions(desiredRoles, roleIds) {
  return desiredRoles.map((role, index) => ({
    id: roleIds[role.key],
    position: desiredRoles.length - index,
  }));
}

export function rolesInOrder(roles, desiredRoles, roleIds) {
  const positions = desiredRoles.map(
    (role) => roles.find((candidate) => candidate.id === roleIds[role.key])?.position,
  );
  return positions.every((position, index) => index === 0 || position < positions[index - 1]);
}
