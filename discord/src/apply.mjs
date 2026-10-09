import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { blueprint as defaultBlueprint, welcomeMessage } from './blueprint.mjs';
import { createClient } from './discord-api.mjs';
import {
  automodBody,
  channelBody,
  channelPatch,
  channelPositions,
  channelsInOrder,
  guildBody,
  includesShape,
  matchChannels,
  matchRoles,
  needsCommunity,
  onboardingBody,
  roleBody,
  rolePatch,
  rolePositions,
  rolesInOrder,
  rolesAboveBot,
  welcomeScreenBody,
} from './reconcile.mjs';

export const CONFIG_DIR = join(homedir(), '.config', 'mage-obsidian');
export const TOKEN_FILE = join(CONFIG_DIR, 'discord-bot-token');
export const SECRETS_FILE = join(CONFIG_DIR, 'discord-webhooks.json');

const isPlaceholder = (id) => String(id).startsWith('new:');
const pick = (object, fields) =>
  Object.fromEntries(fields.map((field) => [field, object?.[field]]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function snowflakeFactory() {
  let sequence = 0n;
  return () => String(((BigInt(Date.now()) - 1420070400000n) << 22n) + sequence++);
}

export async function run({
  api,
  blueprint = defaultBlueprint,
  dryRun,
  prune,
  forceIcon = false,
  iconDataUri,
  log,
  saveSecrets,
}) {
  const guildPath = `/guilds/${blueprint.guildId}`;
  const write = async (method, path, body, summary, placeholder) => {
    log(`${dryRun ? '[plan]' : '[apply]'} ${summary}`);
    if (dryRun) return placeholder ?? null;
    return api[method](path, body);
  };

  const me = await api.get('/users/@me');
  const guild = await api.get(guildPath);
  const roles = await api.get(`${guildPath}/roles`);
  const member = await api.get(`${guildPath}/members/${me.id}`);
  const channels = await api.get(`${guildPath}/channels`);

  const roleMatch = matchRoles(roles, blueprint.roles, blueprint.guildId);
  const touched = new Set([
    ...Object.values(roleMatch.matched).map((role) => role.id),
    ...(prune ? roleMatch.extras.map((role) => role.id) : []),
  ]);
  const blocked = rolesAboveBot(roles, member.roles, blueprint.guildId).filter((role) =>
    touched.has(role.id),
  );
  if (blocked.length) {
    throw new Error(
      `Move the bot's role above ${blocked.map((role) => `"${role.name}"`).join(', ')} in Server Settings → Roles, then run again.`,
    );
  }

  const roleIds = {};
  for (const desired of blueprint.roles) {
    const existing = roleMatch.matched[desired.key];
    if (desired.managed) {
      if (existing) roleIds[desired.key] = existing.id;
      else log(`[wait] the "${desired.managed}" bot is not in the server yet; its role is skipped`);
      continue;
    }
    if (!existing) {
      const created = await write(
        'post',
        `${guildPath}/roles`,
        roleBody(desired),
        `create role ${desired.name}`,
        {
          id: `new:${desired.key}`,
        },
      );
      roleIds[desired.key] = created.id;
      continue;
    }
    roleIds[desired.key] = existing.id;
    const patch = rolePatch(existing, desired);
    if (patch)
      await write(
        'patch',
        `${guildPath}/roles/${existing.id}`,
        patch,
        `update role ${desired.name}`,
      );
  }

  const currentRoles = dryRun ? roles : await api.get(`${guildPath}/roles`);
  if (!rolesInOrder(currentRoles, blueprint.roles, roleIds)) {
    await write(
      'patch',
      `${guildPath}/roles`,
      rolePositions(currentRoles, blueprint.roles, roleIds, {
        guildId: blueprint.guildId,
        botRoleIds: member.roles,
      }),
      'reorder roles',
    );
  }

  const owner = await api.get(`${guildPath}/members/${guild.owner_id}`);
  for (const key of blueprint.ownerRoles ?? []) {
    if (!owner.roles.includes(roleIds[key])) {
      await write(
        'put',
        `${guildPath}/members/${guild.owner_id}/roles/${roleIds[key]}`,
        undefined,
        `give the server owner the ${key} role`,
      );
    }
  }

  const channelMatch = matchChannels(channels, blueprint.channels);
  const channelIds = Object.fromEntries(
    Object.entries(channelMatch.matched).map(([key, channel]) => [key, channel.id]),
  );
  const context = () => ({ guildId: blueprint.guildId, roleIds, channelIds });
  const deferred = [];

  for (const desired of blueprint.channels) {
    const existing = channelMatch.matched[desired.key];
    if (!existing && needsCommunity(desired)) {
      deferred.push(desired);
      continue;
    }
    if (!existing) {
      const created = await write(
        'post',
        `${guildPath}/channels`,
        channelBody(desired, context()),
        `create channel ${desired.name}`,
        { id: `new:${desired.key}` },
      );
      channelIds[desired.key] = created.id;
      continue;
    }
    const patch = channelPatch(existing, desired, context());
    if (!patch) continue;
    if (needsCommunity(desired, existing)) {
      delete patch.type;
      deferred.push(desired);
    }
    if (Object.keys(patch).length) {
      await write(
        'patch',
        `/channels/${existing.id}`,
        patch,
        `update channel ${desired.name} (${Object.keys(patch).join(', ')})`,
      );
    }
  }

  if (iconDataUri && (forceIcon || !me.avatar)) {
    await write('patch', '/users/@me', { avatar: iconDataUri }, 'set the bot avatar');
  }
  if (iconDataUri && (forceIcon || !guild.icon)) {
    await write('patch', guildPath, { icon: iconDataUri }, 'set the server icon');
  }

  const desiredGuild = guildBody(blueprint.guild, channelIds, guild.features);
  const guildPatch = Object.fromEntries(
    Object.entries(desiredGuild).filter(([field, value]) =>
      field === 'features'
        ? !guild.features.includes('COMMUNITY')
        : !same(guild[field] ?? null, value ?? null),
    ),
  );
  if (Object.keys(guildPatch).length) {
    await write(
      'patch',
      guildPath,
      guildPatch,
      `update server settings (${Object.keys(guildPatch).join(', ')})`,
    );
  }

  for (const desired of deferred) {
    const existing = channelMatch.matched[desired.key];
    if (existing) {
      await write(
        'patch',
        `/channels/${existing.id}`,
        { type: desired.type },
        `convert ${desired.name} to type ${desired.type}`,
      );
      continue;
    }
    const created = await write(
      'post',
      `${guildPath}/channels`,
      channelBody(desired, context()),
      `create channel ${desired.name}`,
      {
        id: `new:${desired.key}`,
      },
    );
    channelIds[desired.key] = created.id;
  }

  if (prune) {
    for (const channel of channelMatch.extras) {
      await write('delete', `/channels/${channel.id}`, undefined, `delete channel ${channel.name}`);
    }
    for (const role of roleMatch.extras) {
      await write('delete', `${guildPath}/roles/${role.id}`, undefined, `delete role ${role.name}`);
    }
  } else if (channelMatch.extras.length || roleMatch.extras.length) {
    log(
      `[keep] not in the blueprint (run with --prune to delete): ${[
        ...channelMatch.extras.map((channel) => `#${channel.name}`),
        ...roleMatch.extras.map((role) => `@${role.name}`),
      ].join(', ')}`,
    );
  }

  const current = dryRun ? channels : await api.get(`${guildPath}/channels`);
  if (!channelsInOrder(current, blueprint.channels, channelIds)) {
    await write(
      'patch',
      `${guildPath}/channels`,
      channelPositions(blueprint.channels, channelIds),
      'reorder channels',
    );
  }

  const welcome = welcomeMessage(channelIds);
  const history = isPlaceholder(channelIds.welcome)
    ? []
    : await api.get(`/channels/${channelIds.welcome}/messages?limit=50`);
  const posted = history.find((message) => message.author?.id === me.id);
  if (!posted) {
    await write(
      'post',
      `/channels/${channelIds.welcome}/messages`,
      welcome,
      'post the welcome message',
    );
  } else if (
    !same(
      posted.embeds.map((embed) => pick(embed, ['title', 'description'])),
      welcome.embeds.map((embed) => pick(embed, ['title', 'description'])),
    )
  ) {
    await write(
      'patch',
      `/channels/${channelIds.welcome}/messages/${posted.id}`,
      welcome,
      'update the welcome message',
    );
  }

  const screen = welcomeScreenBody(blueprint.welcomeScreen, channelIds);
  const currentScreen =
    dryRun && !guild.features.includes('COMMUNITY')
      ? null
      : await api.get(`${guildPath}/welcome-screen`).catch(() => null);
  if (!includesShape(currentScreen, pick(screen, ['description', 'welcome_channels']))) {
    await write('patch', `${guildPath}/welcome-screen`, screen, 'set the welcome screen');
  }

  const currentOnboarding = await api.get(`${guildPath}/onboarding`).catch(() => null);
  const onboarding = onboardingBody(blueprint.onboarding, {
    channelIds,
    roleIds,
    existing: currentOnboarding,
    newId: snowflakeFactory(),
  });
  const onboardingShape = (body) => ({
    enabled: body?.enabled,
    default_channel_ids: [...(body?.default_channel_ids ?? [])].sort(),
    prompts: (body?.prompts ?? []).map((prompt) => ({
      title: prompt.title,
      options: prompt.options.map((option) =>
        pick(option, ['title', 'description', 'role_ids', 'channel_ids']),
      ),
    })),
  });
  if (!same(onboardingShape(currentOnboarding), onboardingShape(onboarding))) {
    await write('put', `${guildPath}/onboarding`, onboarding, 'set up onboarding');
  }

  const rules = await api.get(`${guildPath}/auto-moderation/rules`);
  for (const rule of blueprint.automod) {
    const body = automodBody(rule, {
      channelIds,
      roleIds,
      alertChannel: 'mod-log',
      exemptRoles: ['maintainer'],
    });
    const existing = rules.find((candidate) => candidate.name === rule.name);
    if (!existing) {
      await write(
        'post',
        `${guildPath}/auto-moderation/rules`,
        body,
        `create AutoMod rule "${rule.name}"`,
      );
      continue;
    }
    const { trigger_type: _type, ...patch } = body;
    if (!includesShape(existing, patch)) {
      await write(
        'patch',
        `${guildPath}/auto-moderation/rules/${existing.id}`,
        patch,
        `update AutoMod rule "${rule.name}"`,
      );
    }
  }

  const secrets = {};
  for (const hook of blueprint.webhooks) {
    const channelId = channelIds[hook.channel];
    const existing = isPlaceholder(channelId)
      ? undefined
      : (await api.get(`/channels/${channelId}/webhooks`)).find(
          (candidate) => candidate.name === hook.name,
        );
    const webhook =
      existing ??
      (await write(
        'post',
        `/channels/${channelId}/webhooks`,
        { name: hook.name, ...(iconDataUri ? { avatar: iconDataUri } : {}) },
        `create webhook "${hook.name}" in #${hook.channel}`,
      ));
    if (existing && iconDataUri && (forceIcon || !existing.avatar)) {
      await write(
        'patch',
        `/webhooks/${existing.id}`,
        { avatar: iconDataUri },
        `set the avatar of webhook "${hook.name}"`,
      );
    }
    if (webhook?.token)
      secrets[hook.secret] = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;
  }
  if (!dryRun && Object.keys(secrets).length) await saveSecrets(secrets);

  log(`Release pings role id: ${roleIds.releasePings}`);
  return { roleIds, channelIds, secrets: dryRun ? [] : Object.keys(secrets) };
}

async function saveSecretsFile(secrets) {
  await mkdir(dirname(SECRETS_FILE), { recursive: true, mode: 0o700 });
  await writeFile(SECRETS_FILE, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
  await chmod(SECRETS_FILE, 0o600);
}

async function readIcon(url) {
  return `data:image/png;base64,${(await readFile(url)).toString('base64')}`;
}

async function readToken(env) {
  if (env.DISCORD_BOT_TOKEN?.trim()) return env.DISCORD_BOT_TOKEN.trim();
  try {
    return (await readFile(TOKEN_FILE, 'utf8')).trim();
  } catch {
    throw new Error(`No bot token: set DISCORD_BOT_TOKEN or write it to ${TOKEN_FILE}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = new Set(process.argv.slice(2));
  Promise.all([readToken(process.env), readIcon(defaultBlueprint.icon)])
    .then(([token, iconDataUri]) =>
      run({
        api: createClient({ token }),
        dryRun: !args.has('--apply'),
        prune: args.has('--prune'),
        forceIcon: args.has('--force-icon'),
        iconDataUri,
        log: console.log,
        saveSecrets: saveSecretsFile,
      }),
    )
    .then(({ secrets }) => {
      if (secrets.length)
        console.log(`Webhook URLs saved to ${SECRETS_FILE}: ${secrets.join(', ')}`);
      if (!args.has('--apply'))
        console.log('Dry run: nothing changed. Re-run with --apply to make these changes.');
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
