import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, DiscordError } from '../src/discord-api.mjs';

function respond(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => (payload === undefined ? '' : JSON.stringify(payload)),
  };
}

test('authenticates as the bot and sends json', async () => {
  const calls = [];
  const api = createClient({
    token: 'secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return respond(200, { id: '1' });
    },
  });

  assert.deepEqual(await api.post('/guilds/1/roles', { name: 'x' }), { id: '1' });
  assert.equal(calls[0].url, 'https://discord.com/api/v10/guilds/1/roles');
  assert.equal(calls[0].init.headers.authorization, 'Bot secret');
  assert.equal(calls[0].init.body, '{"name":"x"}');
});

test('waits out a rate limit and retries', async () => {
  const waits = [];
  const responses = [respond(429, { retry_after: 0.25 }), respond(204)];
  const api = createClient({
    token: 't',
    fetchImpl: async () => responses.shift(),
    sleep: async (ms) => waits.push(ms),
  });

  assert.equal(await api.delete('/channels/1'), null);
  assert.deepEqual(waits, [250]);
});

test('raises the Discord error body', async () => {
  const api = createClient({
    token: 't',
    fetchImpl: async () => respond(403, { message: 'Missing Permissions' }),
  });

  await assert.rejects(api.get('/guilds/1'), (error) => {
    assert.ok(error instanceof DiscordError);
    assert.equal(error.status, 403);
    assert.match(error.message, /GET \/guilds\/1 failed with HTTP 403: .*Missing Permissions/);
    return true;
  });
});

test('gives up after repeated rate limits', async () => {
  const api = createClient({
    token: 't',
    fetchImpl: async () => respond(429, { retry_after: 0 }),
    sleep: async () => {},
  });

  await assert.rejects(api.get('/x'), /still rate limited/);
});
