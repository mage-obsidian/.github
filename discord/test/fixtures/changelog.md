---
description: 'What changed in each MageObsidian release, followed across the packages that carry it.'
---

# Changelog

From 4.0.0 on, the framework and the storefront each release all their packages under one version.
Before 4.0, packages were independently versioned; that history is kept below. Features rarely live in
just one package: a cacheable checkout is a core flag, a compatibility module and a theme template
landing together. This page follows the **stack**, so you can read what changed without having to
recompose it from a dozen release feeds.

Each entry names the packages and versions that carry it. For the commit-level history of a single
package, see its releases on [GitHub](https://github.com/mage-obsidian).

---

## Framework 4.0.1 — 2026-10-06

### Fixed

- **js-package-utils** (`mage-obsidian` on npm) — a child theme inherits its parents' `theme.config.js` values. The defaults are applied after the merge, so a parent's `vue.runtimeOnly: true` or `ignoredCssFromModules: "all"` is no longer reset in the child.
- **js-package-utils** — the ancestor themes' CSS sources stop at the nearest ancestor that sets `includeCssSourceFromParentThemes: false`, instead of always reaching the root theme.
- **module-modern-frontend** — a contract regenerated with `mage-obsidian:frontend:config --generate` takes effect without reloading PHP-FPM, also with `opcache.validate_timestamps=0`.
- **module-modern-frontend-cli** — `mage-obsidian:generate:theme` writes `includeCssSourceFromParentThemes`, the key the engine reads, instead of `includeParentThemes`, which nothing read.

### Upgrade notes

`^4.0` already resolves the PHP packages to 4.0.1. The Vite harness still installs engine 3.2, so the two engine fixes reach a build once the harness requires engine 4.0.1.

---

## Storefront 4.0.1 — 2026-10-06

### Fixed

- **theme-base** — nine templates failed with a fatal error on PHP 8.3 and 8.4, because the license header sat in a closed PHP block before `declare(strict_types=1)`.
- **theme-base** — `root.phtml` read `$headAssets`, which Magento 2.4.7 never assigns, so every page returned HTTP 500 on 2.4.7.

### Upgrade notes

Nothing to do: `^4.0` already resolves to 4.0.1.

---

## 4.0.0 — 2026-10-06 { #4-0-0 }

### Highlights

- **Stable.** 4.0.0 is the first stable release of the monorepo era.
- **Two release trains.** The framework and the storefront each release all their packages under one version.
- **Monorepos.** The framework and the storefront now live in one repository each.

### Upgrade notes

See the [upgrade guide from 3.x to 4.0](../upgrade/3-to-4.md).

### Deprecated

Nothing.

### Version map

Last version of each package before 4.0, and the 4.0.0 release.

| Package                                   | Last before 4.0 | 4.0.0 |
| ----------------------------------------- | --------------- | ----- |
| mage-obsidian/module-modern-frontend      | 2.22.0          | 4.0.0 |
| mage-obsidian/module-modern-frontend-cli  | 2.9.0           | 4.0.0 |
| mage-obsidian/module-modern-frontend-twig | 2.7.1           | 4.0.0 |
| mage-obsidian/component-modern-frontend   | 2.7.0           | 4.0.0 |
| mage-obsidian (npm)                       | 3.2.0           | 4.0.0 |
| mage-obsidian/module-catalog              | 3.12.0          | 4.0.0 |
| mage-obsidian/module-catalog-search       | 2.2.0           | 4.0.0 |
| mage-obsidian/module-checkout             | 3.12.1          | 4.0.0 |
| mage-obsidian/module-customer             | 2.4.1           | 4.0.0 |
| mage-obsidian/module-downloadable         | 2.2.0           | 4.0.0 |
| mage-obsidian/module-gift-message         | 2.2.0           | 4.0.0 |
| mage-obsidian/module-instant-purchase     | 2.2.0           | 4.0.0 |
| mage-obsidian/module-multishipping        | 2.1.0           | 4.0.0 |
| mage-obsidian/module-persistent           | 2.1.0           | 4.0.0 |
| mage-obsidian/module-product-alert        | 2.1.0           | 4.0.0 |
| mage-obsidian/module-review               | 2.3.0           | 4.0.0 |
| mage-obsidian/module-sales                | 2.4.0           | 4.0.0 |
| mage-obsidian/module-search               | 1.3.0           | 4.0.0 |
| mage-obsidian/module-send-friend          | 2.2.0           | 4.0.0 |
| mage-obsidian/module-showcase             | 1.5.0           | 4.0.0 |
| mage-obsidian/module-storefront           | 3.23.0          | 4.0.0 |
| mage-obsidian/module-vault                | 2.3.0           | 4.0.0 |
| mage-obsidian/module-wishlist             | 2.3.0           | 4.0.0 |
| mage-obsidian/theme-base                  | 3.13.1          | 4.0.0 |
| mage-obsidian/theme-default               | 3.21.3          | 4.0.0 |

---

## Before 4.0

!!! note "Where this starts"
The whole stack was cut to `2.0.0` together on **22 June 2026**, and that is where this log
begins. Anything older predates the current line.

---
