export const SITE_URL = 'https://mage-obsidian.jeanmarcos.dev/';
export const CHANGELOG_PATH = 'project/changelog.md';
export const BRAND_COLOR = 0x7fd6c8;
export const DESCRIPTION_LIMIT = 3500;

const PRODUCTS = {
  'mage-obsidian/framework': { name: 'MageObsidian Framework', labels: ['Framework'] },
  'mage-obsidian/storefront': { name: 'MageObsidian Storefront', labels: ['Storefront'] },
  'mage-obsidian/theme-default': {
    name: 'MageObsidian Theme Default',
    labels: ['Theme Default', 'theme-default'],
  },
};

export function productFor(repository) {
  const shortName = repository.split('/').pop();
  return PRODUCTS[repository] ?? { name: shortName, labels: [shortName] };
}

export function slugify(heading) {
  return heading
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseHeading(line) {
  const match = line.match(/^##\s+(.*?)\s*(?:\{\s*#([\w-]+)\s*\})?\s*$/);
  if (!match) return null;
  return { text: match[1], anchor: match[2] ?? slugify(match[1]) };
}

export function findChangelogSection(markdown, { labels, tag }) {
  const lines = markdown.split('\n');
  const version = escapeRegExp(tag);
  const labelled = new RegExp(
    `^(?:${labels.map(escapeRegExp).join('|')})\\s+${version}(?:\\s|$)`,
    'i',
  );
  const bare = new RegExp(`^${version}(?:\\s|$)`);

  const headings = lines
    .map((line, index) => ({ index, heading: parseHeading(line) }))
    .filter(({ heading }) => heading);

  const pick =
    headings.find(({ heading }) => labelled.test(heading.text)) ??
    headings.find(({ heading }) => bare.test(heading.text));
  if (!pick) return null;

  const body = [];
  for (const line of lines.slice(pick.index + 1)) {
    if (/^##\s/.test(line) || /^---\s*$/.test(line)) break;
    body.push(line);
  }

  return { heading: pick.heading.text, anchor: pick.heading.anchor, body: body.join('\n').trim() };
}

export function docsUrl(href, siteUrl = SITE_URL, pagePath = CHANGELOG_PATH) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  const resolved = new URL(href, `https://docs.invalid/${pagePath}`);
  let path = resolved.pathname.replace(/^\//, '');
  if (path.endsWith('.md')) {
    path = path.slice(0, -'.md'.length);
    path =
      path === 'index' || path.endsWith('/index') ? path.slice(0, -'index'.length) : `${path}/`;
  }
  return `${siteUrl}${path}${resolved.hash}`;
}

function convertLine(line, siteUrl) {
  const admonition = line.match(/^(?:!!!|\?\?\?\+?)\s+(\w+)(?:\s+"(.*)")?\s*$/);
  if (admonition)
    return `**${admonition[2] || admonition[1][0].toUpperCase() + admonition[1].slice(1)}**`;

  const heading = line.match(/^#{1,6}\s+(.*?)\s*$/);
  const text = heading ? `**${heading[1]}**` : line;

  return text
    .replace(/\s*\{\s*[#.][^}]*\}/g, '')
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_, label, href) => `[${label}](${docsUrl(href, siteUrl)})`,
    );
}

export function toDiscordMarkdown(markdown, siteUrl = SITE_URL) {
  const output = [];
  let inTable = false;
  let inAdmonition = false;
  for (const rawLine of markdown.split('\n')) {
    if (inAdmonition && rawLine.trim() !== '' && !rawLine.startsWith('    ')) inAdmonition = false;
    const line = inAdmonition ? rawLine.replace(/^ {4}/, '') : rawLine;
    if (/^(?:!!!|\?\?\?)/.test(line)) inAdmonition = true;
    if (/^\s*\|/.test(line)) {
      if (!inTable) output.push('*(Table: see the full changelog.)*');
      inTable = true;
      continue;
    }
    inTable = false;
    output.push(convertLine(line, siteUrl));
  }
  return output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncate(text, limit = DESCRIPTION_LIMIT) {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf('\n', limit);
  return `${text.slice(0, cut > 0 ? cut : limit).trimEnd()}\n…`;
}

export function meaningfulReleaseBody(body) {
  const cleaned = (body ?? '')
    .split('\n')
    .filter((line) => !/^\*\*Full Changelog\*\*:/.test(line.trim()))
    .join('\n')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function buildReleaseMessage({
  repository,
  release,
  changelog,
  roleId,
  siteUrl = SITE_URL,
}) {
  const product = productFor(repository);
  const tag = release.tag_name;
  const section = changelog
    ? findChangelogSection(changelog, { labels: product.labels, tag })
    : null;
  const changelogUrl = section
    ? `${siteUrl}${CHANGELOG_PATH.replace(/\.md$/, '/')}#${section.anchor}`
    : null;

  const summarySource = section?.body || meaningfulReleaseBody(release.body);
  const summary = summarySource
    ? truncate(toDiscordMarkdown(summarySource, siteUrl))
    : 'A new release is out.';

  const links = [
    `[Release notes](${release.html_url})`,
    changelogUrl && `[Changelog](${changelogUrl})`,
    `[Docs](${siteUrl})`,
  ].filter(Boolean);

  const title = `${product.name} ${tag}${release.prerelease ? ' (pre-release)' : ''}`;

  return {
    username: 'MageObsidian Releases',
    avatar_url: `${siteUrl}assets/favicon.png`,
    ...(roleId ? { content: `<@&${roleId}>` } : {}),
    allowed_mentions: { parse: [], roles: roleId ? [roleId] : [] },
    embeds: [
      {
        title,
        url: release.html_url,
        description: `${summary}\n\n${links.join(' · ')}`,
        color: BRAND_COLOR,
        timestamp: release.published_at,
        footer: { text: repository },
      },
    ],
  };
}
