import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  announcementsToPublish,
  contributorsToPromote,
  CROSSPOSTED,
  DISCORD_EPOCH,
  helpWelcomeMessage,
  HOUR,
  IS_CROSSPOST,
  needsWelcome,
  recentHelpPosts,
  snowflakeTime,
  solvedPostsToArchive,
} from '../src/maintenance.mjs';

const at = (ms) => String((BigInt(ms) - DISCORD_EPOCH) << 22n);
const NOW = Date.UTC(2026, 9, 9, 12);
const FORUM = 'forum';
const SOLVED = 'tag-solved';

test('reads the creation time out of a snowflake', () => {
  assert.equal(snowflakeTime(at(NOW)), NOW);
  assert.equal(snowflakeTime('1558111037490729071'), Date.parse('2026-10-09T13:36:59.641Z'));
});

test('publishes only plain messages that were not published yet, oldest first', () => {
  const messages = [
    { id: at(NOW), type: 0, flags: 0 },
    { id: at(NOW - HOUR), type: 0, flags: 0 },
    { id: at(NOW - 2 * HOUR), type: 0, flags: CROSSPOSTED },
    { id: at(NOW - 3 * HOUR), type: 0, flags: IS_CROSSPOST },
    { id: at(NOW - 4 * HOUR), type: 18, flags: 0 },
  ];

  assert.deepEqual(announcementsToPublish(messages), [at(NOW - HOUR), at(NOW)]);
});

test('picks open posts of the help forum from the last two days', () => {
  const threads = [
    { id: at(NOW - HOUR), parent_id: FORUM, thread_metadata: { archived: false } },
    { id: at(NOW - 72 * HOUR), parent_id: FORUM, thread_metadata: { archived: false } },
    { id: at(NOW - HOUR), parent_id: 'general', thread_metadata: { archived: false } },
    { id: at(NOW - HOUR), parent_id: FORUM, thread_metadata: { archived: true } },
  ];

  assert.deepEqual(
    recentHelpPosts(threads, { forumId: FORUM, now: NOW }).map((thread) => thread.id),
    [at(NOW - HOUR)],
  );
});

test('welcomes a post only once', () => {
  assert.equal(needsWelcome([{ author: { id: 'user' } }], 'bot'), true);
  assert.equal(needsWelcome([{ author: { id: 'user' } }, { author: { id: 'bot' } }], 'bot'), false);
});

test('archives solved posts after a day without activity', () => {
  const thread = (overrides) => ({
    id: at(NOW - 72 * HOUR),
    parent_id: FORUM,
    applied_tags: [SOLVED],
    thread_metadata: { archived: false },
    ...overrides,
  });
  const threads = [
    thread({ last_message_id: at(NOW - 25 * HOUR) }),
    thread({ last_message_id: at(NOW - 2 * HOUR) }),
    thread({ last_message_id: at(NOW - 30 * HOUR), applied_tags: ['tag-checkout'] }),
    thread({ last_message_id: null }),
  ];

  const archived = solvedPostsToArchive(threads, { forumId: FORUM, solvedTagId: SOLVED, now: NOW });

  assert.deepEqual(archived, [threads[0], threads[3]]);
});

test('the help welcome pings only the helpers role', () => {
  const message = helpWelcomeMessage({
    helpersRoleId: '42',
    checklist: '• versions',
    issuesUrl: 'https://github.test/issues',
  });

  assert.equal(message.content, '<@&42> a new question is waiting.');
  assert.deepEqual(message.allowed_mentions, { parse: [], roles: ['42'] });
  assert.match(message.embeds[0].description, /• versions/);
  assert.match(message.embeds[0].description, /\[GitHub issue\]\(https:\/\/github\.test\/issues\)/);

  const silent = helpWelcomeMessage({ checklist: 'x', issuesUrl: 'u' });
  assert.equal(silent.content, undefined);
  assert.deepEqual(silent.allowed_mentions, { parse: [], roles: [] });
});

test('promotes mapped members with a merged pull request who lack the role', () => {
  const promoted = contributorsToPromote({
    mapping: { Alice: '1', bob: '2', carol: '3', dave: '4' },
    mergedLogins: new Set(['alice', 'bob', 'dave']),
    members: { 1: { roles: [] }, 2: { roles: ['contrib'] }, 3: { roles: [] } },
    roleId: 'contrib',
  });

  assert.deepEqual(promoted, [{ login: 'Alice', discordId: '1' }]);
});
