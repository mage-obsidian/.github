export const API_BASE = 'https://discord.com/api/v10';
const MAX_ATTEMPTS = 5;

export class DiscordError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} failed with HTTP ${status}: ${body}`);
    this.status = status;
  }
}

export function createClient({
  token,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  async function request(method, path, body) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await fetchImpl(`${API_BASE}${path}`, {
        method,
        headers: {
          authorization: `Bot ${token}`,
          'content-type': 'application/json',
          'user-agent': 'DiscordBot (https://github.com/mage-obsidian/.github, 1.0)',
          'x-audit-log-reason': 'mage-obsidian discord blueprint',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (response.status === 429) {
        const { retry_after: retryAfter = 1 } = await response.json();
        await sleep(Math.ceil(retryAfter * 1000));
        continue;
      }
      const text = await response.text();
      if (!response.ok) throw new DiscordError(method, path, response.status, text);
      return text ? JSON.parse(text) : null;
    }
    throw new DiscordError(method, path, 429, `still rate limited after ${MAX_ATTEMPTS} attempts`);
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
  };
}
