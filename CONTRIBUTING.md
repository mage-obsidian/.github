# Contributing to MageObsidian

Thanks for your interest in improving MageObsidian! 🖤

## Where things live

MageObsidian is split across several repositories — please open issues and PRs against the one that owns the code:

| Area | Repository |
|---|---|
| Core module (PHP), config contract, deploy plugins | [module-modern-frontend](https://github.com/mage-obsidian/module-modern-frontend) |
| JS build engine (inheritance, precompile, interceptors) | [js-package-utils](https://github.com/mage-obsidian/js-package-utils) |
| Vite harness (`vite.config.js`) | [component-modern-frontend](https://github.com/mage-obsidian/component-modern-frontend) |
| CLI commands | [module-modern-frontend-cli](https://github.com/mage-obsidian/module-modern-frontend-cli) |
| Twig engine | [module-modern-frontend-twig](https://github.com/mage-obsidian/module-modern-frontend-twig) |
| Storefront, themes and domain modules | [module-storefront](https://github.com/mage-obsidian/module-storefront) and `module-*` / `theme-*` repos |
| Documentation | [docs](https://github.com/mage-obsidian/docs) |

Not sure where something belongs? Ask in [Discussions](https://github.com/mage-obsidian/module-modern-frontend/discussions).

## How to contribute

1. **Bugs** — open an issue using the bug template. Include Magento version, PHP/Node versions and reproduction steps.
2. **Features** — open an issue first so we can discuss the design before you invest time in a PR.
3. **Pull requests** — fork, branch from the default branch, keep the change focused, and include tests where the repo has a test suite (`js-package-utils` uses Jest; PHP modules target Magento 2.4.7+ / PHP 8.x with `declare(strict_types=1)`).
4. **Docs** — the site is bilingual: every page has an English `.md` and a Spanish `.es.md`. Updating only the English page is fine — mention it in the PR so the translation can follow.

See the full guide at [mage-obsidian.jeanmarcos.dev/support](https://mage-obsidian.jeanmarcos.dev/support/).

## Code style

- PHP: Magento 2 coding standards, constructor property promotion, typed constants.
- JS: ESM only (no CommonJS), internal imports via `#utils/*` / `#config/*` / `#service/*` subpaths.
- Comments in English, and only where they explain a *why* the code cannot.
