# Discord

The MageObsidian Discord server, kept as code, and the release announcements that post to it.

## Release announcements

When a release is published, `#announcements` gets an embed built from that release's section of
the [changelog](https://mage-obsidian.jeanmarcos.dev/project/changelog/). Without a changelog
section it falls back to the GitHub release notes.

- `framework` and `storefront` call [`discord-release.yml`](../.github/workflows/discord-release.yml)
  from `announce.yml` once their `Release` workflow succeeds. Their releases are created with
  `github.token`, which never triggers `release: published` in another workflow.
- `theme-default` calls it on `release: published`, because its releases are created by hand.
- Every caller also has a manual run (`workflow_dispatch`) that takes the tag to announce again.

Configuration, set at organisation level:

| Name                       | Kind     | Value                                           |
| -------------------------- | -------- | ----------------------------------------------- |
| `DISCORD_RELEASES_WEBHOOK` | secret   | webhook of `#announcements`                     |
| `DISCORD_RELEASE_ROLE_ID`  | variable | id of the `Release pings` role; empty = no ping |

Preview an announcement without posting it:

```bash
REPOSITORY=mage-obsidian/framework TAG=4.0.1 DRY_RUN=1 npm run announce
```

## The server

[`src/blueprint.mjs`](src/blueprint.mjs) describes the server: roles, channels, permissions, the
help forum and its tags, the welcome message and screen, onboarding, AutoMod rules and webhooks.
`apply` makes the server match it, and running it again changes nothing.

It needs a bot that sits in the server with Administrator, whose role is above every role it has
to edit or delete. Put its token in `~/.config/mage-obsidian/discord-bot-token` (mode 600), or
in `DISCORD_BOT_TOKEN`.

```bash
npm run plan              # print what would change
npm run apply             # change it
npm run apply -- --prune  # also delete channels and roles the blueprint does not list
```

The URLs of the webhooks it creates are written to `~/.config/mage-obsidian/discord-webhooks.json`
(mode 600), never to the terminal.

The server icon is [`assets/icon.svg`](assets/icon.svg), rendered to `assets/icon.png`
(`rsvg-convert -w 512 -h 512 assets/icon.svg -o assets/icon.png`). `apply` uploads it when the
server, the bot or a webhook has no image yet; `--force-icon` replaces them after a redesign.

## Automation

[`discord-maintenance.yml`](../.github/workflows/discord-maintenance.yml) runs a second bot,
`MageObsidian Automation`, every 15 minutes. It has no Administrator and its role sits below
`Maintainer`, so its token cannot grant `Maintainer` or delete anything structural.

| Task           | What it does                                                                   |
| -------------- | ------------------------------------------------------------------------------ |
| `publish`      | Publishes new `#announcements` messages to the servers that follow the channel |
| `help`         | Answers each new `#help` post with the checklist and pings `@Helpers`          |
| `archive`      | Archives posts tagged ✅ solved after 24 hours without activity                |
| `contributors` | Once a day, gives `Contributor` to mapped people with a merged pull request    |

Its token is the `DISCORD_AUTOMATION_TOKEN` secret of this repository. Preview a run with
`DISCORD_AUTOMATION_TOKEN=… TASKS=publish,help,archive DRY_RUN=1 npm run maintain`.

### Contributors

[`contributors.json`](contributors.json) maps GitHub logins to Discord user ids:

```json
{ "octocat": "123456789012345678" }
```

A maintainer adds the entry; the daily run gives the role once that login has a merged pull
request anywhere in `mage-obsidian`.

## Development

```bash
npm test
npm run format
```
