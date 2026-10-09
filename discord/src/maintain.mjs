import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { blueprint as defaultBlueprint, HELP_CHECKLIST, LINKS } from './blueprint.mjs';
import { createClient, DiscordError } from './discord-api.mjs';
import {
  announcementsToPublish,
  contributorsToPromote,
  helpWelcomeMessage,
  needsWelcome,
  recentHelpPosts,
  solvedPostsToArchive,
} from './maintenance.mjs';

export const TASKS = ['publish', 'help', 'archive', 'contributors'];
export const CONTRIBUTORS_FILE = new URL('../contributors.json', import.meta.url);

function roleNamed(roles, blueprint, key) {
  const name = blueprint.roles.find((role) => role.key === key)?.name;
  return roles.find((role) => role.name === name)?.id;
}

export function createGithub({ token, fetchImpl = fetch, org = 'mage-obsidian' }) {
  return {
    async hasMergedPullRequest(login) {
      const query = encodeURIComponent(`is:pr is:merged org:${org} author:${login}`);
      const response = await fetchImpl(
        `https://api.github.com/search/issues?q=${query}&per_page=1`,
        {
          headers: {
            accept: 'application/vnd.github+json',
            'x-github-api-version': '2022-11-28',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!response.ok)
        throw new Error(`GitHub search for ${login} failed (HTTP ${response.status})`);
      return (await response.json()).total_count > 0;
    },
  };
}

export async function maintain({
  api,
  github,
  blueprint = defaultBlueprint,
  tasks,
  mapping = {},
  dryRun,
  now = Date.now(),
  log,
}) {
  const guildPath = `/guilds/${blueprint.guildId}`;
  const write = async (method, path, body, summary) => {
    log(`${dryRun ? '[plan]' : '[apply]'} ${summary}`);
    if (!dryRun) await api[method](path, body);
  };

  const me = await api.get('/users/@me');
  const channels = await api.get(`${guildPath}/channels`);
  const roles = await api.get(`${guildPath}/roles`);
  const announcements = channels.find((channel) => channel.name === 'announcements');
  const help = channels.find((channel) => channel.name === 'help' && channel.type === 15);
  const solvedTagId = help?.available_tags?.find((tag) => tag.name === 'solved')?.id;
  const done = { published: 0, welcomed: 0, archived: 0, promoted: 0 };

  if (tasks.includes('publish') && announcements) {
    const messages = await api.get(`/channels/${announcements.id}/messages?limit=20`);
    for (const id of announcementsToPublish(messages)) {
      await write(
        'post',
        `/channels/${announcements.id}/messages/${id}/crosspost`,
        undefined,
        `publish announcement ${id}`,
      );
      done.published++;
    }
  }

  const needsThreads = tasks.includes('help') || tasks.includes('archive');
  const { threads = [] } = needsThreads && help ? await api.get(`${guildPath}/threads/active`) : {};

  if (tasks.includes('help') && help) {
    const helpersRoleId = roleNamed(roles, blueprint, 'helpers');
    for (const post of recentHelpPosts(threads, { forumId: help.id, now })) {
      const messages = await api.get(`/channels/${post.id}/messages?limit=50`);
      if (!needsWelcome(messages, me.id)) continue;
      await write(
        'post',
        `/channels/${post.id}/messages`,
        helpWelcomeMessage({
          helpersRoleId,
          checklist: HELP_CHECKLIST,
          issuesUrl: LINKS.frameworkIssues,
        }),
        `welcome help post "${post.name}"`,
      );
      done.welcomed++;
    }
  }

  if (tasks.includes('archive') && help && solvedTagId) {
    for (const post of solvedPostsToArchive(threads, { forumId: help.id, solvedTagId, now })) {
      await write(
        'patch',
        `/channels/${post.id}`,
        { archived: true },
        `archive solved post "${post.name}"`,
      );
      done.archived++;
    }
  }

  if (tasks.includes('contributors')) {
    const roleId = roleNamed(roles, blueprint, 'contributor');
    const mergedLogins = new Set();
    const members = {};
    for (const [login, discordId] of Object.entries(mapping)) {
      if (await github.hasMergedPullRequest(login)) mergedLogins.add(login.toLowerCase());
      try {
        members[discordId] = await api.get(`${guildPath}/members/${discordId}`);
      } catch (error) {
        if (!(error instanceof DiscordError && error.status === 404)) throw error;
      }
    }
    for (const { login, discordId } of contributorsToPromote({
      mapping,
      mergedLogins,
      members,
      roleId,
    })) {
      await write(
        'put',
        `${guildPath}/members/${discordId}/roles/${roleId}`,
        undefined,
        `give ${login} the Contributor role`,
      );
      done.promoted++;
    }
  }

  log(
    `published ${done.published}, welcomed ${done.welcomed}, archived ${done.archived}, promoted ${done.promoted}`,
  );
  return done;
}

export function parseTasks(value) {
  const tasks = (value || TASKS.filter((task) => task !== 'contributors').join(','))
    .split(',')
    .map((task) => task.trim())
    .filter(Boolean);
  const unknown = tasks.filter((task) => !TASKS.includes(task));
  if (unknown.length)
    throw new Error(`Unknown task: ${unknown.join(', ')} (known: ${TASKS.join(', ')})`);
  return tasks;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const env = process.env;
  Promise.resolve()
    .then(async () => {
      const token = env.DISCORD_AUTOMATION_TOKEN?.trim();
      if (!token) throw new Error('DISCORD_AUTOMATION_TOKEN is not set');
      const tasks = parseTasks(env.TASKS);
      const mapping = tasks.includes('contributors')
        ? JSON.parse(await readFile(CONTRIBUTORS_FILE, 'utf8'))
        : {};
      return maintain({
        api: createClient({ token }),
        github: createGithub({ token: env.GITHUB_TOKEN }),
        tasks,
        mapping,
        dryRun: env.DRY_RUN === '1' || env.DRY_RUN === 'true',
        log: console.log,
      });
    })
    .catch((error) => {
      console.error(`::error::${error.message}`);
      process.exitCode = 1;
    });
}
