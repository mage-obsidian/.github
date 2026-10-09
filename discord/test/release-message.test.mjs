import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BRAND_COLOR,
  buildReleaseMessage,
  docsUrl,
  findChangelogSection,
  meaningfulReleaseBody,
  slugify,
  toDiscordMarkdown,
  truncate,
} from '../src/release-message.mjs';

const changelog = readFileSync(new URL('./fixtures/changelog.md', import.meta.url), 'utf8');

const release = (overrides = {}) => ({
  tag_name: '4.0.1',
  html_url: 'https://github.com/mage-obsidian/framework/releases/tag/4.0.1',
  published_at: '2026-10-06T19:32:53Z',
  prerelease: false,
  body: '**Full Changelog**: https://github.com/mage-obsidian/framework/compare/4.0.0...4.0.1',
  ...overrides,
});

test('slugify matches the anchors mkdocs publishes', () => {
  assert.equal(slugify('Framework 4.0.1 — 2026-10-06'), 'framework-401-2026-10-06');
  assert.equal(slugify('Before 4.0'), 'before-40');
});

test('finds the section labelled with the product before a bare version', () => {
  const framework = findChangelogSection(changelog, { labels: ['Framework'], tag: '4.0.1' });
  const storefront = findChangelogSection(changelog, { labels: ['Storefront'], tag: '4.0.1' });

  assert.equal(framework.anchor, 'framework-401-2026-10-06');
  assert.match(framework.body, /theme\.config\.js/);
  assert.doesNotMatch(framework.body, /root\.phtml/);
  assert.equal(storefront.anchor, 'storefront-401-2026-10-06');
  assert.match(storefront.body, /root\.phtml/);
});

test('falls back to a bare version heading and honours its explicit anchor', () => {
  const section = findChangelogSection(changelog, { labels: ['Storefront'], tag: '4.0.0' });

  assert.equal(section.anchor, '4-0-0');
  assert.match(section.body, /^### Highlights/);
  assert.doesNotMatch(section.body, /Before 4\.0/);
});

test('does not mistake a longer version for the tag', () => {
  assert.equal(
    findChangelogSection('## Framework 4.0.10\n\nx', { labels: ['Framework'], tag: '4.0.1' }),
    null,
  );
});

test('returns null when the release is not in the changelog', () => {
  assert.equal(findChangelogSection(changelog, { labels: ['Framework'], tag: '9.9.9' }), null);
});

test('resolves relative docs links to published urls', () => {
  assert.equal(
    docsUrl('../upgrade/3-to-4.md', 'https://d.test/'),
    'https://d.test/upgrade/3-to-4/',
  );
  assert.equal(docsUrl('../guides/index.md#x', 'https://d.test/'), 'https://d.test/guides/#x');
  assert.equal(docsUrl('https://github.com/a', 'https://d.test/'), 'https://github.com/a');
});

test('converts mkdocs markdown into what Discord renders', () => {
  const converted = toDiscordMarkdown(
    [
      '### Upgrade notes',
      'See the [guide](../upgrade/3-to-4.md).',
      '',
      '!!! note "Where this starts"',
      '    Indented admonition body.',
      '',
      '| a | b |',
      '|---|---|',
      '| 1 | 2 |',
      '- after { #anchor }',
      '    - nested item',
    ].join('\n'),
    'https://d.test/',
  );

  assert.equal(
    converted,
    [
      '**Upgrade notes**',
      'See the [guide](https://d.test/upgrade/3-to-4/).',
      '',
      '**Where this starts**',
      'Indented admonition body.',
      '',
      '*(Table: see the full changelog.)*',
      '- after',
      '    - nested item',
    ].join('\n'),
  );
});

test('truncates on a line boundary', () => {
  assert.equal(truncate('aaaa\nbbbb\ncccc', 11), 'aaaa\nbbbb\n…');
  assert.equal(truncate('short', 11), 'short');
});

test('ignores a release body that only links the full changelog', () => {
  assert.equal(meaningfulReleaseBody(release().body), null);
  assert.equal(
    meaningfulReleaseBody('## What changed\n* x\n\n**Full Changelog**: y'),
    '## What changed\n* x',
  );
});

test('builds an announcement from the changelog section', () => {
  const message = buildReleaseMessage({
    repository: 'mage-obsidian/framework',
    release: release(),
    changelog,
    siteUrl: 'https://d.test/',
  });
  const [embed] = message.embeds;

  assert.equal(embed.title, 'MageObsidian Framework 4.0.1');
  assert.equal(embed.url, release().html_url);
  assert.equal(embed.color, BRAND_COLOR);
  assert.equal(embed.timestamp, '2026-10-06T19:32:53Z');
  assert.match(embed.description, /^\*\*Fixed\*\*/);
  assert.match(
    embed.description,
    /\[Changelog\]\(https:\/\/d\.test\/project\/changelog\/#framework-401-2026-10-06\)/,
  );
  assert.equal(message.content, undefined);
  assert.deepEqual(message.allowed_mentions, { parse: [], roles: [] });
});

test('pings only the release role when one is configured', () => {
  const message = buildReleaseMessage({
    repository: 'mage-obsidian/storefront',
    release: release(),
    changelog,
    roleId: '123',
  });

  assert.equal(message.content, '<@&123>');
  assert.deepEqual(message.allowed_mentions, { parse: [], roles: ['123'] });
});

test('falls back to the release body, then to a generic line', () => {
  const withBody = buildReleaseMessage({
    repository: 'mage-obsidian/theme-default',
    release: release({ tag_name: '4.1.0', body: '## What changed\n* Darker footer' }),
    changelog,
  });
  const empty = buildReleaseMessage({
    repository: 'mage-obsidian/theme-default',
    release: release({ tag_name: '4.1.0' }),
    changelog: null,
  });

  assert.equal(withBody.embeds[0].title, 'MageObsidian Theme Default 4.1.0');
  assert.match(withBody.embeds[0].description, /^\*\*What changed\*\*\n\* Darker footer/);
  assert.doesNotMatch(withBody.embeds[0].description, /\[Changelog\]/);
  assert.match(empty.embeds[0].description, /^A new release is out\./);
});

test('marks pre-releases and keeps the description under the embed limit', () => {
  const message = buildReleaseMessage({
    repository: 'mage-obsidian/framework',
    release: release({ prerelease: true, tag_name: '5.0.0-rc1', body: 'x\n'.repeat(5000) }),
    changelog,
  });

  assert.equal(message.embeds[0].title, 'MageObsidian Framework 5.0.0-rc1 (pre-release)');
  assert.ok(message.embeds[0].description.length <= 4096);
});
