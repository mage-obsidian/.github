import { HIDDEN, READ_ONLY } from './permissions.mjs';

export const ChannelType = Object.freeze({
  TEXT: 0,
  CATEGORY: 4,
  ANNOUNCEMENT: 5,
  FORUM: 15,
});

export const LINKS = Object.freeze({
  docs: 'https://mage-obsidian.jeanmarcos.dev/',
  installation: 'https://mage-obsidian.jeanmarcos.dev/getting-started/installation/',
  demo: 'https://mage-obsidian-demo.jeanmarcos.dev/',
  github: 'https://github.com/mage-obsidian/module-modern-frontend',
  discussions: 'https://github.com/mage-obsidian/module-modern-frontend/discussions',
  frameworkIssues: 'https://github.com/mage-obsidian/framework/issues',
  storefrontIssues: 'https://github.com/mage-obsidian/storefront/issues',
  contributing: 'https://github.com/mage-obsidian/.github/blob/main/CONTRIBUTING.md',
  codeOfConduct: 'https://github.com/mage-obsidian/.github/blob/main/CODE_OF_CONDUCT.md',
  security: 'https://github.com/mage-obsidian/.github/blob/main/SECURITY.md',
  kofi: 'https://ko-fi.com/Q5Q816Z9WN',
});

const SUPPRESS_PREMIUM_SUBSCRIPTIONS = 1 << 1;
const SUPPRESS_GUILD_REMINDER_NOTIFICATIONS = 1 << 2;
const REQUIRE_TAG = 1 << 4;

export const blueprint = {
  guildId: '1312693075293900820',

  guild: {
    name: 'MageObsidian',
    description:
      'The modern frontend for Magento 2: Vite, Tailwind 4 and Vue islands on native layouts.',
    verification_level: 1,
    explicit_content_filter: 2,
    default_message_notifications: 1,
    preferred_locale: 'en-US',
    system_channel_flags: SUPPRESS_PREMIUM_SUBSCRIPTIONS | SUPPRESS_GUILD_REMINDER_NOTIFICATIONS,
    rulesChannel: 'welcome',
    updatesChannel: 'mod-log',
    systemChannel: 'general',
  },

  ownerRoles: ['maintainer'],

  roles: [
    {
      key: 'maintainer',
      name: 'Maintainer',
      color: 0x7fd6c8,
      hoist: true,
      mentionable: false,
      permissions: '8',
    },
    {
      key: 'contributor',
      name: 'Contributor',
      color: 0xd8d3cb,
      hoist: true,
      mentionable: false,
      permissions: '0',
    },
    {
      key: 'releasePings',
      name: 'Release pings',
      color: 0,
      hoist: false,
      mentionable: true,
      permissions: '0',
    },
  ],

  channels: [
    { key: 'start', name: 'Start here', type: ChannelType.CATEGORY },
    {
      key: 'welcome',
      name: 'welcome',
      type: ChannelType.TEXT,
      parent: 'start',
      topic: 'What MageObsidian is, the rules, and where everything lives.',
      overwrites: [{ role: '@everyone', deny: READ_ONLY }],
    },
    {
      key: 'announcements',
      name: 'announcements',
      type: ChannelType.ANNOUNCEMENT,
      parent: 'start',
      adopt: '1312693628757610587',
      topic:
        'Releases and project news, posted automatically. Follow it to get them in your own server.',
      overwrites: [{ role: '@everyone', deny: READ_ONLY }],
    },

    { key: 'community', name: 'Community', type: ChannelType.CATEGORY },
    {
      key: 'general',
      name: 'general',
      type: ChannelType.TEXT,
      parent: 'community',
      topic:
        'MageObsidian, Magento frontend and everything around it. English here; Spanish in #español.',
    },
    {
      key: 'espanol',
      name: 'español',
      type: ChannelType.TEXT,
      parent: 'community',
      topic:
        'La comunidad hispanohablante: preguntas, ideas y charla sobre MageObsidian en español.',
    },
    {
      key: 'showcase',
      name: 'showcase',
      type: ChannelType.TEXT,
      parent: 'community',
      topic:
        'Stores, themes and experiments built with MageObsidian: a link, a screenshot and what you learned.',
    },

    { key: 'support', name: 'Help', type: ChannelType.CATEGORY },
    {
      key: 'help',
      name: 'help',
      type: ChannelType.FORUM,
      parent: 'support',
      flags: REQUIRE_TAG,
      default_sort_order: 0,
      default_forum_layout: 1,
      default_reaction_emoji: { emoji_name: '👍' },
      topic: [
        'One question per post, with a tag. Include:',
        '• Magento or Mage-OS version, and PHP version',
        "• `composer show 'mage-obsidian/*'` and, from vite/, `pnpm list mage-obsidian`",
        '• What you ran, what you expected and what happened: the full error text, not a screenshot',
        '• The output of `bin/magento mage-obsidian:frontend:doctor`',
        '',
        'Tag the post ✅ solved once it is. A confirmed bug becomes a GitHub issue; a security problem is reported privately, never here: ' +
          LINKS.security,
      ].join('\n'),
      tags: [
        { name: 'installation', emoji_name: '📦' },
        { name: 'build / vite', emoji_name: '⚡' },
        { name: 'themes / twig', emoji_name: '🎨' },
        { name: 'checkout', emoji_name: '🛒' },
        { name: 'performance', emoji_name: '🚀' },
        { name: '3rd-party module', emoji_name: '🧩' },
        { name: 'solved', emoji_name: '✅', moderated: true },
      ],
    },

    { key: 'contributing', name: 'Contributing', type: ChannelType.CATEGORY },
    {
      key: 'contributors',
      name: 'contributors',
      type: ChannelType.TEXT,
      parent: 'contributing',
      topic: `Working on MageObsidian itself: pull requests, architecture and roadmap. Start with ${LINKS.contributing}`,
    },
    {
      key: 'github-activity',
      name: 'github-activity',
      type: ChannelType.TEXT,
      parent: 'contributing',
      topic: 'Discussions, issues, pull requests and stars from GitHub, posted automatically.',
      overwrites: [{ role: '@everyone', deny: READ_ONLY }],
    },

    {
      key: 'staff',
      name: 'Staff',
      type: ChannelType.CATEGORY,
      overwrites: [{ role: '@everyone', deny: HIDDEN }],
    },
    {
      key: 'mod-log',
      name: 'mod-log',
      type: ChannelType.TEXT,
      parent: 'staff',
      topic: 'AutoMod alerts and Discord community updates.',
      overwrites: [{ role: '@everyone', deny: HIDDEN }],
    },
  ],

  welcomeScreen: {
    description:
      'The modern frontend for Magento 2: Vite, Tailwind 4 and Vue islands on native layouts.',
    channels: [
      { channel: 'welcome', description: 'Rules and links', emoji_name: '👋' },
      { channel: 'announcements', description: 'Releases and news', emoji_name: '📣' },
      { channel: 'help', description: 'Ask a question', emoji_name: '🛟' },
      { channel: 'general', description: 'Talk with the community', emoji_name: '💬' },
      { channel: 'showcase', description: 'What people are building', emoji_name: '✨' },
    ],
  },

  onboarding: {
    defaultChannels: [
      'welcome',
      'announcements',
      'general',
      'espanol',
      'showcase',
      'help',
      'contributors',
      'github-activity',
    ],
    prompts: [
      {
        title: 'Want a ping when a new version ships?',
        options: [
          {
            title: 'Yes, ping me on releases',
            description: 'Gives you the Release pings role.',
            emoji_name: '🔔',
            roles: ['releasePings'],
          },
          {
            title: "No, I'll read #announcements",
            description: 'You can change this later in Channels & Roles.',
            emoji_name: '🔕',
            channels: ['announcements'],
          },
        ],
      },
    ],
  },

  automod: [
    { name: 'Block spam', trigger_type: 3, alert: false },
    {
      name: 'Block mention spam',
      trigger_type: 5,
      trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true },
      alert: true,
    },
    {
      name: 'Block slurs and sexual content',
      trigger_type: 4,
      trigger_metadata: { presets: [2, 3] },
      alert: false,
    },
    {
      name: 'Block scam links',
      trigger_type: 1,
      trigger_metadata: {
        keyword_filter: [
          'free nitro',
          'nitro for free',
          '*dlscord*',
          '*disc0rd*',
          '*discordgift*',
          '*steamcommunlty*',
          '*steamcomunity*',
          '*airdrop*',
        ],
      },
      alert: true,
    },
  ],

  webhooks: [
    { channel: 'announcements', name: 'MageObsidian Releases', secret: 'DISCORD_RELEASES_WEBHOOK' },
    { channel: 'github-activity', name: 'GitHub', secret: 'DISCORD_GITHUB_WEBHOOK' },
  ],
};

export function welcomeMessage(channelIds) {
  const channel = (key) => `<#${channelIds[key]}>`;
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: 'Welcome to MageObsidian',
        url: LINKS.docs,
        color: 0x7fd6c8,
        description: [
          "MageObsidian replaces Magento 2's legacy frontend (Luma, LESS, RequireJS) with **Vite, Tailwind 4, Vue islands and native ESM**, while keeping Magento's own layouts, blocks and templates.",
          '',
          `📚 [Documentation](${LINKS.docs}) · 🚀 [Installation](${LINKS.installation}) · 🛍️ [Live demo](${LINKS.demo})`,
          `⭐ [GitHub](${LINKS.github}) · 💬 [Discussions](${LINKS.discussions}) · ☕ [Ko-fi](${LINKS.kofi})`,
        ].join('\n'),
      },
      {
        title: 'Rules',
        color: 0x7fd6c8,
        description: [
          `1. Be kind and assume good intent. The [Code of Conduct](${LINKS.codeOfConduct}) applies here too.`,
          `2. Questions go to ${channel('help')}, one post per question, so the answer stays findable.`,
          '3. Do not DM maintainers for support: answers given in public help the next person.',
          `4. Self-promotion belongs in ${channel('showcase')}, and only when it was built with MageObsidian.`,
          `5. Security problems are reported privately, never in a channel: [security policy](${LINKS.security}).`,
          '6. English in most channels; Spanish is welcome in ' + channel('espanol') + '.',
        ].join('\n'),
      },
      {
        title: 'Where things are',
        color: 0x7fd6c8,
        description: [
          `📣 ${channel('announcements')}: new releases, posted the moment they ship. Follow the channel to get them in your own server.`,
          `🛟 ${channel('help')}: ask a question, and include the versions the post guidelines ask for.`,
          `💬 ${channel('general')} and ${channel('espanol')}: talk with the community.`,
          `✨ ${channel('showcase')}: what people are building.`,
          `🛠️ ${channel('contributors')} and ${channel('github-activity')}: working on MageObsidian itself.`,
          `🐞 Found a bug? Open an issue on [framework](${LINKS.frameworkIssues}) or [storefront](${LINKS.storefrontIssues}).`,
          '',
          'Want a ping on every release? Pick it in **Channels & Roles** at the top of the channel list.',
        ].join('\n'),
      },
    ],
  };
}
