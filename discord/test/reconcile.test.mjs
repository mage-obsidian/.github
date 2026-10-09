import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blueprint, ChannelType, welcomeMessage } from '../src/blueprint.mjs';
import { READ_ONLY } from '../src/permissions.mjs';
import {
  automodBody,
  channelBody,
  channelPatch,
  channelPositions,
  channelsInOrder,
  includesShape,
  guildBody,
  matchChannels,
  matchRoles,
  needsCommunity,
  onboardingBody,
  rolePatch,
  rolePositions,
  rolesInOrder,
  rolesAboveBot,
  welcomeScreenBody,
} from '../src/reconcile.mjs';

const GUILD = blueprint.guildId;
const channelIds = Object.fromEntries(
  blueprint.channels.map((channel, index) => [channel.key, `c${index}`]),
);
const roleIds = {
  maintainer: 'r1',
  contributor: 'r2',
  releasePings: 'r3',
  helpers: 'r4',
  storeOwner: 'r5',
  agency: 'r6',
  extensionDev: 'r7',
  espanol: 'r8',
};
const context = { guildId: GUILD, roleIds, channelIds };
const desired = (key) => blueprint.channels.find((channel) => channel.key === key);

test('matches roles by name and never claims managed roles or @everyone', () => {
  const { matched, extras } = matchRoles(
    [
      { id: GUILD, name: '@everyone' },
      { id: 'a', name: 'maintainer' },
      { id: 'b', name: 'Developers' },
      { id: 'k', name: 'Ko-fi Bot', managed: true },
    ],
    blueprint.roles,
    GUILD,
  );

  assert.equal(matched.maintainer.id, 'a');
  assert.deepEqual(
    extras.map((role) => role.id),
    ['b'],
  );
});

test('patches only the role fields that differ', () => {
  const role = blueprint.roles[0];
  assert.equal(rolePatch({ ...role, permissions: '8' }, role), null);
  assert.deepEqual(rolePatch({ ...role, color: 0, hoist: false }, role), {
    color: role.color,
    hoist: true,
  });
});

test('adopts the channel the permanent invite points at', () => {
  const { matched, extras } = matchChannels(
    [
      { id: '1312693628757610587', name: '🔔・announcements', type: ChannelType.TEXT },
      { id: 'x', name: '📑・information', type: ChannelType.TEXT },
      { id: 'g', name: 'general', type: ChannelType.TEXT },
      { id: 'cat', name: 'community', type: ChannelType.CATEGORY },
    ],
    blueprint.channels,
  );

  assert.equal(matched.announcements.id, '1312693628757610587');
  assert.equal(matched.general.id, 'g');
  assert.equal(matched.community.id, 'cat');
  assert.deepEqual(
    extras.map((channel) => channel.id),
    ['x'],
  );
});

test('never matches a category to a channel of the same name', () => {
  const { matched } = matchChannels(
    [{ id: 'h', name: 'help', type: ChannelType.TEXT }],
    blueprint.channels,
  );
  assert.equal(matched.support, undefined);
});

test('read-only channels deny writing to @everyone', () => {
  const body = channelBody(desired('welcome'), context);

  assert.equal(body.parent_id, channelIds.start);
  assert.deepEqual(body.permission_overwrites, [
    { id: GUILD, type: 0, allow: '0', deny: READ_ONLY },
  ]);
});

test('the help forum requires a tag and keeps the ids of tags that already exist', () => {
  const body = channelBody(desired('help'), context, {
    available_tags: [{ id: 't1', name: 'solved', emoji_name: '✅', moderated: true }],
  });

  assert.equal(body.flags, 16);
  assert.equal(body.available_tags.find((tag) => tag.name === 'solved').id, 't1');
  assert.equal(body.available_tags.find((tag) => tag.name === 'checkout').id, undefined);
  assert.ok(body.available_tags.every((tag) => tag.name.length <= 20));
});

test('a channel already in shape needs no patch', () => {
  const existing = { id: 'w', ...channelBody(desired('welcome'), context) };
  assert.equal(channelPatch(existing, desired('welcome'), context), null);
});

test('the adopted text channel is renamed, moved and converted to announcements', () => {
  const patch = channelPatch(
    {
      id: 'a',
      name: '🔔・announcements',
      type: ChannelType.TEXT,
      parent_id: 'old',
      topic: null,
      permission_overwrites: [],
    },
    desired('announcements'),
    context,
  );

  assert.equal(patch.name, 'announcements');
  assert.equal(patch.type, ChannelType.ANNOUNCEMENT);
  assert.equal(patch.parent_id, channelIds.start);
  assert.ok(patch.permission_overwrites.length === 1);
});

test('announcement and forum channels wait for the community feature', () => {
  assert.equal(needsCommunity(desired('announcements'), { type: ChannelType.TEXT }), true);
  assert.equal(needsCommunity(desired('announcements'), { type: ChannelType.ANNOUNCEMENT }), false);
  assert.equal(needsCommunity(desired('help'), undefined), true);
  assert.equal(needsCommunity(desired('general'), undefined), false);
});

test('enables the community feature without dropping existing ones', () => {
  const body = guildBody(blueprint.guild, channelIds, ['NEWS']);

  assert.deepEqual(body.features, ['NEWS', 'COMMUNITY']);
  assert.equal(body.rules_channel_id, channelIds.welcome);
  assert.equal(body.public_updates_channel_id, channelIds['mod-log']);
  assert.equal(body.system_channel_id, channelIds.general);
  assert.equal(body.rulesChannel, undefined);
});

test('orders categories, then each channel inside its category', () => {
  const positions = channelPositions(blueprint.channels, channelIds);
  const help = positions.find((entry) => entry.id === channelIds.help);
  const staff = positions.find((entry) => entry.id === channelIds.staff);

  assert.deepEqual(help, { id: channelIds.help, position: 0 });
  assert.ok(positions.every((entry) => !('parent_id' in entry)));
  assert.equal(staff.position, 4);
  assert.equal(positions.length, blueprint.channels.length);
});

test('the welcome screen lists at most five channels with short descriptions', () => {
  const body = welcomeScreenBody(blueprint.welcomeScreen, channelIds);

  assert.ok(body.welcome_channels.length <= 5);
  assert.ok(body.description.length <= 140);
  assert.ok(body.welcome_channels.every((entry) => entry.description.length <= 42));
});

test('onboarding meets Discord minimums and reuses prompt ids', () => {
  let next = 100;
  const body = onboardingBody(blueprint.onboarding, {
    channelIds,
    roleIds,
    existing: {
      prompts: [{ id: 'p1', title: blueprint.onboarding.prompts[0].title, options: [] }],
    },
    newId: () => String(next++),
  });
  const writable = blueprint.onboarding.defaultChannels.filter(
    (key) => !(desired(key).overwrites ?? []).some((overwrite) => overwrite.deny === READ_ONLY),
  );

  assert.ok(body.default_channel_ids.length >= 7);
  assert.ok(writable.length >= 5);
  assert.equal(body.prompts[0].id, 'p1');
  assert.equal(body.prompts[0].single_select, false);
  assert.deepEqual(body.prompts[0].options[0].role_ids, ['r5']);
  assert.deepEqual(
    body.prompts[1].options.map((option) => option.role_ids),
    [['r3'], ['r4']],
  );
  assert.equal(body.prompts[2].single_select, true);
  assert.deepEqual(body.prompts[2].options[1], {
    ...body.prompts[2].options[1],
    role_ids: ['r8'],
    channel_ids: [channelIds.espanol],
  });
  assert.ok(
    body.prompts.every((prompt) =>
      prompt.options.every(
        (option) =>
          option.title.length <= 50 &&
          option.description.length <= 100 &&
          option.role_ids.length + option.channel_ids.length > 0,
      ),
    ),
  );
});

test('managed bot roles are found by name but never created, edited or pruned', () => {
  const { matched, extras } = matchRoles(
    [
      { id: 'auto', name: 'MageObsidian Automation', managed: true },
      { id: 'fake', name: 'MageObsidian Automation', managed: false },
    ],
    blueprint.roles,
    GUILD,
  );

  assert.equal(matched.automation.id, 'auto');
  assert.deepEqual(
    extras.map((role) => role.id),
    ['fake'],
  );
});

test('overwrites for a role that does not exist yet are left out', () => {
  const announcements = desired('announcements');

  assert.equal(channelBody(announcements, context).permission_overwrites.length, 1);
  assert.equal(
    channelBody(announcements, { ...context, roleIds: { ...roleIds, automation: 'bot' } })
      .permission_overwrites.length,
    2,
  );
});

test('automod alerts land in the mod log and spare maintainers', () => {
  const [spam, mentions] = blueprint.automod.map((rule) =>
    automodBody(rule, {
      channelIds,
      roleIds,
      alertChannel: 'mod-log',
      exemptRoles: ['maintainer'],
    }),
  );

  assert.deepEqual(spam.actions, [{ type: 1, metadata: {} }]);
  assert.deepEqual(mentions.actions[1], {
    type: 2,
    metadata: { channel_id: channelIds['mod-log'] },
  });
  assert.deepEqual(mentions.exempt_roles, ['r1']);
});

test('reports every role the bot cannot manage', () => {
  const roles = [
    { id: GUILD, position: 0 },
    { id: 'tpl', name: 'Developers', position: 9 },
    { id: 'bot', name: 'MageObsidian', position: 5, managed: true },
    { id: 'low', name: 'Sponsor', position: 2 },
  ];
  assert.deepEqual(
    rolesAboveBot(roles, ['bot'], GUILD).map((role) => role.id),
    ['tpl'],
  );
});

test('the welcome message links channels and stays within embed limits', () => {
  const message = welcomeMessage(channelIds);
  const total = message.embeds.reduce(
    (sum, embed) => sum + embed.title.length + embed.description.length,
    0,
  );

  assert.match(message.embeds[1].description, new RegExp(`<#${channelIds.help}>`));
  assert.ok(message.embeds.every((embed) => embed.description.length <= 4096));
  assert.ok(total <= 6000);
  assert.deepEqual(message.allowed_mentions, { parse: [] });
});

test('includesShape ignores fields Discord adds but compares arrays exactly', () => {
  assert.equal(
    includesShape({ a: 1, extra: true, list: [{ x: 1, y: 2 }] }, { a: 1, list: [{ x: 1 }] }),
    true,
  );
  assert.equal(includesShape({ list: [1, 2] }, { list: [1] }), false);
  assert.equal(includesShape(null, { a: 1 }), false);
});

test('channel order is judged by sequence, not by absolute positions', () => {
  const current = blueprint.channels.map((channel, index) => ({
    id: channelIds[channel.key],
    type: channel.type,
    parent_id: channel.parent ? channelIds[channel.parent] : null,
    position: index * 10,
  }));
  assert.equal(channelsInOrder(current, blueprint.channels, channelIds), true);

  const swapped = current.map((channel) =>
    channel.id === channelIds.general ? { ...channel, position: 9999 } : channel,
  );
  assert.equal(channelsInOrder(swapped, blueprint.channels, channelIds), false);
});

test('role order is dense, keeps the bot on top and other roles right below it', () => {
  const current = [
    { id: GUILD, position: 0 },
    { id: 'bot', position: 5, managed: true },
    { id: 'kofi', position: 4, managed: true },
    { id: 'r1', position: 3 },
    { id: 'r2', position: 1 },
    { id: 'r3', position: 1 },
  ];
  const positions = rolePositions(
    current,
    blueprint.roles,
    { maintainer: 'r1', contributor: 'r2', releasePings: 'r3', automation: 'auto' },
    {
      guildId: GUILD,
      botRoleIds: ['bot'],
    },
  );

  assert.deepEqual(positions, [
    { id: 'bot', position: 6 },
    { id: 'kofi', position: 5 },
    { id: 'r1', position: 4 },
    { id: 'auto', position: 3 },
    { id: 'r2', position: 2 },
    { id: 'r3', position: 1 },
  ]);

  const descending = ['r1', 'r2', 'r4', 'r3', 'r5', 'r6', 'r7', 'r8'].map((id, index) => ({
    id,
    position: 20 - index,
  }));
  const swapped = descending.map((role) => (role.id === 'r4' ? { ...role, position: 30 } : role));
  const tied = descending.map((role) => ({ ...role, position: 1 }));

  assert.equal(rolesInOrder(descending, blueprint.roles, roleIds), true);
  assert.equal(rolesInOrder(swapped, blueprint.roles, roleIds), false);
  assert.equal(rolesInOrder(tied, blueprint.roles, roleIds), false);
});
