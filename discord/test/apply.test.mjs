import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blueprint } from '../src/blueprint.mjs';
import { run } from '../src/apply.mjs';
import { BOT_ROLE, fakeDiscord, OWNER_ID, templateGuild } from './fake-discord.mjs';

const INVITE_CHANNEL = '1312693628757610587';

async function apply(state, options = {}) {
  const discord = fakeDiscord(state);
  const logs = [];
  const saved = [];
  const result = await run({
    api: discord.api,
    blueprint,
    dryRun: false,
    prune: true,
    log: (line) => logs.push(line),
    saveSecrets: async (secrets) => saved.push(secrets),
    ...options,
  });
  return { ...discord, logs, saved, result };
}

test('a dry run plans the rebuild without writing anything', async () => {
  const state = templateGuild(blueprint.guildId);
  const { writes, logs } = await apply(state, { dryRun: true });

  assert.deepEqual(writes, []);
  assert.ok(logs.includes('[plan] create role Maintainer'));
  assert.ok(logs.includes('[plan] create channel help'));
  assert.ok(logs.includes('[plan] delete channel 📑・information'));
  assert.ok(logs.some((line) => line.startsWith('[plan] update server settings')));
});

test('applying rebuilds the template into the blueprint', async () => {
  const state = templateGuild(blueprint.guildId);
  const { saved } = await apply(state);

  const names = state.channels.map((channel) => channel.name).sort();
  assert.deepEqual(names, blueprint.channels.map((channel) => channel.name).sort());

  const announcements = state.channels.find((channel) => channel.id === INVITE_CHANNEL);
  assert.equal(announcements.name, 'announcements');
  assert.equal(announcements.type, 5);

  assert.ok(state.guild.features.includes('COMMUNITY'));
  assert.equal(state.guild.name, 'MageObsidian');
  assert.equal(
    state.guild.rules_channel_id,
    state.channels.find((channel) => channel.name === 'welcome').id,
  );

  assert.deepEqual(state.roles.map((role) => role.name).sort(), [
    '@everyone',
    'Agency / freelancer',
    'Contributor',
    'Español',
    'Extension developer',
    'Helpers',
    'Ko-fi Bot',
    'MageObsidian',
    'Maintainer',
    'Release pings',
    'Store owner',
  ]);

  const help = state.channels.find((channel) => channel.name === 'help');
  assert.equal(help.type, 15);
  assert.equal(help.parent_id, state.channels.find((channel) => channel.name === 'Help').id);

  const welcome = state.channels.find((channel) => channel.name === 'welcome');
  assert.equal(state.messages[welcome.id].length, 1);
  assert.equal(state.automod.length, blueprint.automod.length);
  assert.equal(state.onboarding.prompts.length, blueprint.onboarding.prompts.length);
  assert.equal(state.welcomeScreen.welcome_channels.length, 5);

  assert.equal(saved.length, 1);
  assert.deepEqual(Object.keys(saved[0]).sort(), [
    'DISCORD_GITHUB_WEBHOOK',
    'DISCORD_RELEASES_WEBHOOK',
  ]);
  assert.match(
    saved[0].DISCORD_RELEASES_WEBHOOK,
    /^https:\/\/discord\.com\/api\/webhooks\/hook-\d+\/tok-\d+$/,
  );
});

test('a second run changes nothing', async () => {
  const state = templateGuild(blueprint.guildId);
  await apply(state);

  const second = await apply(state);

  assert.deepEqual(second.writes, []);
  assert.deepEqual(
    second.logs.filter((line) => line.startsWith('[apply]')),
    [],
  );
});

test('without --prune the template leftovers are kept and listed', async () => {
  const state = templateGuild(blueprint.guildId);
  const { logs } = await apply(state, { prune: false });

  assert.ok(state.channels.some((channel) => channel.id === 'info'));
  assert.ok(state.roles.some((role) => role.name === 'Developers'));
  assert.ok(
    logs.some(
      (line) =>
        line.startsWith('[keep]') &&
        line.includes('#📑・information') &&
        line.includes('@Developers'),
    ),
  );
});

test('stops before touching anything when the bot role sits too low', async () => {
  const state = templateGuild(blueprint.guildId);
  state.roles.find((role) => role.id === BOT_ROLE).position = 2;
  state.roles.find((role) => role.id === 'dev').position = 4;
  const discord = fakeDiscord(state);

  await assert.rejects(
    run({
      api: discord.api,
      blueprint,
      dryRun: false,
      prune: true,
      log: () => {},
      saveSecrets: async () => {},
    }),
    /Move the bot's role above "Developers", "Sponsor"/,
  );
  assert.deepEqual(discord.writes, []);
});

test('a dry run never reports webhook secrets as saved', async () => {
  const state = templateGuild(blueprint.guildId);
  await apply(state);

  const { result, saved } = await apply(state, { dryRun: true });

  assert.deepEqual(result.secrets, []);
  assert.deepEqual(saved, []);
});

test('orders the new roles and makes the owner a maintainer', async () => {
  const state = templateGuild(blueprint.guildId);
  const { result } = await apply(state);
  const position = (key) => state.roles.find((role) => role.id === result.roleIds[key]).position;

  assert.ok(position('maintainer') > position('contributor'));
  assert.ok(position('contributor') > position('releasePings'));
  assert.ok(state.members[OWNER_ID].roles.includes(result.roleIds.maintainer));
});

test('uploads the icon once and gives new webhooks the same avatar', async () => {
  const state = templateGuild(blueprint.guildId);
  const icon = 'data:image/png;base64,AAAA';

  const first = await apply(state, { iconDataUri: icon });
  const second = await apply(state, { iconDataUri: icon });
  const forced = await apply(state, { iconDataUri: icon, forceIcon: true });

  assert.equal(state.guild.icon, icon);
  assert.equal(state.botAvatar, icon);
  assert.ok(state.webhooks.every((hook) => hook.avatar === icon));
  assert.ok(first.logs.includes('[apply] set the server icon'));
  assert.deepEqual(second.writes, []);
  assert.ok(forced.logs.includes('[apply] set the server icon'));
});

test('places the automation bot under maintainers and lets it publish announcements', async () => {
  const state = templateGuild(blueprint.guildId);
  state.roles.push({ id: 'auto', name: 'MageObsidian Automation', position: 1, managed: true });

  const { result } = await apply(state);
  const position = (id) => state.roles.find((role) => role.id === id).position;
  const announcements = state.channels.find((channel) => channel.name === 'announcements');

  assert.equal(result.roleIds.automation, 'auto');
  assert.ok(position(result.roleIds.maintainer) > position('auto'));
  assert.ok(position('auto') > position(result.roleIds.contributor));
  assert.ok(announcements.permission_overwrites.some((overwrite) => overwrite.id === 'auto'));
  assert.ok(state.roles.some((role) => role.id === 'auto'));
});

test('waits for the automation bot without failing', async () => {
  const state = templateGuild(blueprint.guildId);
  const { logs } = await apply(state);

  assert.ok(
    logs.some((line) => line.startsWith('[wait]') && line.includes('MageObsidian Automation')),
  );
});
