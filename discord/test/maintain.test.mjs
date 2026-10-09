import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blueprint } from '../src/blueprint.mjs';
import { DiscordError } from '../src/discord-api.mjs';
import { createGithub, maintain, parseTasks } from '../src/maintain.mjs';
import { CROSSPOSTED, DISCORD_EPOCH, HOUR } from '../src/maintenance.mjs';

const at = (ms) => String((BigInt(ms) - DISCORD_EPOCH) << 22n);
const NOW = Date.UTC(2026, 9, 9, 12);
const G = `/guilds/${blueprint.guildId}`;

function server() {
  const writes = [];
  const recent = at(NOW - HOUR);
  const answered = at(NOW - 2 * HOUR);
  const solved = at(NOW - 72 * HOUR);
  const responses = {
    '/users/@me': { id: 'automation' },
    [`${G}/channels`]: [
      { id: 'ann', name: 'announcements', type: 5 },
      {
        id: 'help',
        name: 'help',
        type: 15,
        available_tags: [
          { id: 't-solved', name: 'solved' },
          { id: 't-vite', name: 'build / vite' },
        ],
      },
    ],
    [`${G}/roles`]: [
      { id: 'r-helpers', name: 'Helpers' },
      { id: 'r-contrib', name: 'Contributor' },
    ],
    '/channels/ann/messages?limit=20': [
      { id: at(NOW - HOUR), type: 0, flags: 0 },
      { id: at(NOW - 2 * HOUR), type: 0, flags: CROSSPOSTED },
    ],
    [`${G}/threads/active`]: {
      threads: [
        { id: recent, name: 'Vite fails', parent_id: 'help', thread_metadata: {} },
        { id: answered, name: 'Old', parent_id: 'help', thread_metadata: {} },
        {
          id: solved,
          name: 'Solved one',
          parent_id: 'help',
          applied_tags: ['t-solved'],
          last_message_id: at(NOW - 30 * HOUR),
          thread_metadata: {},
        },
      ],
    },
    [`/channels/${recent}/messages?limit=50`]: [{ author: { id: 'user' } }],
    [`/channels/${answered}/messages?limit=50`]: [{ author: { id: 'automation' } }],
    [`${G}/members/111`]: { roles: [] },
    [`${G}/members/222`]: { roles: ['r-contrib'] },
  };

  const record = (method) => async (path, body) => {
    writes.push({ method, path, body });
    return null;
  };
  return {
    writes,
    ids: { recent, solved },
    api: {
      get: async (path) => {
        if (!(path in responses)) throw new DiscordError('GET', path, 404, 'Unknown');
        return structuredClone(responses[path]);
      },
      post: record('post'),
      patch: record('patch'),
      put: record('put'),
    },
  };
}

const github = (merged) => ({ hasMergedPullRequest: async (login) => merged.includes(login) });

test('runs every task against the live state', async () => {
  const { api, writes, ids } = server();
  const logs = [];

  const done = await maintain({
    api,
    github: github(['alice', 'bob', 'ghost']),
    tasks: ['publish', 'help', 'archive', 'contributors'],
    mapping: { alice: '111', bob: '222', ghost: '999' },
    dryRun: false,
    now: NOW,
    log: (line) => logs.push(line),
  });

  assert.deepEqual(done, { published: 1, welcomed: 1, archived: 1, promoted: 1 });
  assert.deepEqual(
    writes.map(({ method, path }) => `${method} ${path}`),
    [
      `post /channels/ann/messages/${at(NOW - HOUR)}/crosspost`,
      `post /channels/${ids.recent}/messages`,
      `patch /channels/${ids.solved}`,
      `put ${G}/members/111/roles/r-contrib`,
    ],
  );
  assert.equal(writes[1].body.content, '<@&r-helpers> a new question is waiting.');
  assert.deepEqual(writes[2].body, { archived: true });
  assert.equal(logs.at(-1), 'published 1, welcomed 1, archived 1, promoted 1');
});

test('a dry run plans the same work without writing', async () => {
  const { api, writes } = server();
  const logs = [];

  await maintain({
    api,
    github: github([]),
    tasks: ['publish', 'help', 'archive'],
    dryRun: true,
    now: NOW,
    log: (line) => logs.push(line),
  });

  assert.deepEqual(writes, []);
  assert.ok(logs.some((line) => line.startsWith('[plan] publish announcement')));
  assert.ok(logs.includes('[plan] welcome help post "Vite fails"'));
  assert.ok(logs.includes('[plan] archive solved post "Solved one"'));
});

test('only runs the tasks it is given', async () => {
  const { api, writes } = server();

  await maintain({
    api,
    github: github([]),
    tasks: ['publish'],
    dryRun: false,
    now: NOW,
    log: () => {},
  });

  assert.deepEqual(
    writes.map(({ path }) => path),
    [`/channels/ann/messages/${at(NOW - HOUR)}/crosspost`],
  );
});

test('parses the task list and rejects unknown tasks', () => {
  assert.deepEqual(parseTasks(''), ['publish', 'help', 'archive']);
  assert.deepEqual(parseTasks('contributors'), ['contributors']);
  assert.throws(() => parseTasks('publish,dance'), /Unknown task: dance/);
});

test('asks GitHub search for merged pull requests in the org', async () => {
  const calls = [];
  const client = createGithub({
    token: 'gh',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ total_count: 2 }) };
    },
  });

  assert.equal(await client.hasMergedPullRequest('alice'), true);
  assert.equal(
    decodeURIComponent(calls[0].url),
    'https://api.github.com/search/issues?q=is:pr is:merged org:mage-obsidian author:alice&per_page=1',
  );
  assert.equal(calls[0].init.headers.authorization, 'Bearer gh');
});
