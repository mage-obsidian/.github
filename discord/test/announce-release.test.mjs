import { test } from 'node:test';
import assert from 'node:assert/strict';
import { announce, DEFAULT_CHANGELOG_URL } from '../src/announce-release.mjs';

const RELEASE = {
  tag_name: '4.0.2',
  draft: false,
  prerelease: false,
  html_url: 'https://github.com/mage-obsidian/framework/releases/tag/4.0.2',
  published_at: '2026-10-07T20:02:32Z',
  body: '## What changed\n* Harness requires engine 4.0.1',
};

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    const route = routes.find(([matcher]) => url.startsWith(matcher));
    if (!route) throw new Error(`unexpected request to ${url}`);
    const [, status, payload] = route;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
    };
  };
  return { impl, calls };
}

const env = {
  REPOSITORY: 'mage-obsidian/framework',
  TAG: '4.0.2',
  GITHUB_TOKEN: 'gh-test',
  DISCORD_WEBHOOK_URL: 'https://discord.test/api/webhooks/1/abc',
};

test('posts the announcement to the webhook and waits for the message', async () => {
  const { impl, calls } = fakeFetch([
    ['https://api.github.com/', 200, RELEASE],
    [DEFAULT_CHANGELOG_URL, 200, '## Framework 4.0.2 — 2026-10-07\n\n- Harness on engine 4.0.1\n'],
    ['https://discord.test/', 200, { id: '999' }],
  ]);
  const logs = [];

  await announce({ env, fetchImpl: impl, log: (line) => logs.push(line) });

  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/mage-obsidian/framework/releases/tags/4.0.2',
  );
  assert.equal(calls[0].init.headers.authorization, 'Bearer gh-test');
  const post = calls.at(-1);
  assert.equal(post.url, 'https://discord.test/api/webhooks/1/abc?wait=true');
  assert.equal(post.init.method, 'POST');
  const body = JSON.parse(post.init.body);
  assert.match(body.embeds[0].description, /Harness on engine 4\.0\.1/);
  assert.deepEqual(logs, ['Announced mage-obsidian/framework 4.0.2 as message 999.']);
});

test('announces from the release body when the changelog cannot be read', async () => {
  const { impl, calls } = fakeFetch([
    ['https://api.github.com/', 200, RELEASE],
    [DEFAULT_CHANGELOG_URL, 404, 'Not Found'],
    ['https://discord.test/', 200, { id: '1' }],
  ]);
  const logs = [];

  await announce({ env, fetchImpl: impl, log: (line) => logs.push(line) });

  const body = JSON.parse(calls.at(-1).init.body);
  assert.match(body.embeds[0].description, /Harness requires engine 4\.0\.1/);
  assert.match(logs[0], /Changelog unavailable \(HTTP 404\)/);
});

test('dry run prints the payload and never calls Discord', async () => {
  const { impl, calls } = fakeFetch([
    ['https://api.github.com/', 200, RELEASE],
    [DEFAULT_CHANGELOG_URL, 404, ''],
  ]);
  const logs = [];

  const message = await announce({
    env: { ...env, DISCORD_WEBHOOK_URL: '', DRY_RUN: '1', DISCORD_RELEASE_ROLE_ID: '42' },
    fetchImpl: impl,
    log: (line) => logs.push(line),
  });

  assert.equal(calls.length, 2);
  assert.equal(message.content, '<@&42>');
  assert.deepEqual(JSON.parse(logs.at(-1)), message);
});

test('refuses drafts, missing releases and missing configuration', async () => {
  const draft = fakeFetch([['https://api.github.com/', 200, { ...RELEASE, draft: true }]]);
  const missing = fakeFetch([['https://api.github.com/', 404, { message: 'Not Found' }]]);

  await assert.rejects(announce({ env, fetchImpl: draft.impl, log: () => {} }), /still a draft/);
  await assert.rejects(
    announce({ env, fetchImpl: missing.impl, log: () => {} }),
    /no release 4\.0\.2.*HTTP 404/,
  );
  await assert.rejects(
    announce({ env: { ...env, DISCORD_WEBHOOK_URL: ' ' }, fetchImpl: draft.impl, log: () => {} }),
    /DISCORD_WEBHOOK_URL is not set/,
  );
});

test('surfaces a webhook rejection', async () => {
  const { impl } = fakeFetch([
    ['https://api.github.com/', 200, RELEASE],
    [DEFAULT_CHANGELOG_URL, 404, ''],
    ['https://discord.test/', 400, { message: 'Invalid Form Body' }],
  ]);

  await assert.rejects(
    announce({ env, fetchImpl: impl, log: () => {} }),
    /HTTP 400.*Invalid Form Body/,
  );
});
