import { pathToFileURL } from 'node:url';
import { buildReleaseMessage } from './release-message.mjs';

export const DEFAULT_CHANGELOG_URL =
  'https://raw.githubusercontent.com/mage-obsidian/docs/master/docs/project/changelog.md';

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function fetchRelease(fetchImpl, { repository, tag, token }) {
  const response = await fetchImpl(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub has no release ${tag} in ${repository} (HTTP ${response.status})`);
  }
  return response.json();
}

async function fetchChangelog(fetchImpl, url, log) {
  try {
    const response = await fetchImpl(url);
    if (response.ok) return await response.text();
    log(`Changelog unavailable (HTTP ${response.status}); announcing from the release body.`);
  } catch (error) {
    log(`Changelog unavailable (${error.message}); announcing from the release body.`);
  }
  return null;
}

export async function announce({ env, fetchImpl = fetch, log = console.log }) {
  const repository = required(env, 'REPOSITORY');
  const tag = required(env, 'TAG');
  const dryRun = env.DRY_RUN === '1' || env.DRY_RUN === 'true';
  const webhookUrl = dryRun ? env.DISCORD_WEBHOOK_URL : required(env, 'DISCORD_WEBHOOK_URL');

  const release = await fetchRelease(fetchImpl, { repository, tag, token: env.GITHUB_TOKEN });
  if (release.draft) throw new Error(`Release ${tag} in ${repository} is still a draft`);

  const changelog = await fetchChangelog(
    fetchImpl,
    env.CHANGELOG_URL || DEFAULT_CHANGELOG_URL,
    log,
  );
  const message = buildReleaseMessage({
    repository,
    release,
    changelog,
    roleId: env.DISCORD_RELEASE_ROLE_ID?.trim() || undefined,
  });

  if (dryRun) {
    log(JSON.stringify(message, null, 2));
    return message;
  }

  const response = await fetchImpl(`${webhookUrl}?wait=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(
      `Discord rejected the announcement (HTTP ${response.status}): ${await response.text()}`,
    );
  }
  const posted = await response.json();
  log(`Announced ${repository} ${tag} as message ${posted.id}.`);
  return message;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  announce({ env: process.env }).catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
