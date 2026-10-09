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

## Development

```bash
npm test
npm run format
```
