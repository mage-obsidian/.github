<p align="center">
  <img src="https://raw.githubusercontent.com/mage-obsidian/.github/main/profile/assets/storefront-home.png" alt="MageObsidian storefront — a modern frontend for Magento" width="840">
</p>

<h1 align="center">MageObsidian</h1>

<p align="center">
  <strong>A modern frontend for Magento 2 — Vite, Tailwind CSS 4, Vue islands and Twig, built on the native Layouts, Blocks and Templates you already know.</strong>
</p>

<p align="center">
  <a href="https://mage-obsidian.jeanmarcos.dev/">📚 Documentation</a> ·
  <a href="https://mage-obsidian-demo.jeanmarcos.dev/">🚀 Live demo</a> ·
  <a href="https://mage-obsidian.jeanmarcos.dev/getting-started/requirements/">⚡ Getting started</a> ·
  <a href="https://github.com/mage-obsidian/module-modern-frontend/discussions">💬 Discussions</a>
</p>

---

## Why MageObsidian?

Magento's stock frontend still ships LESS, RequireJS and jQuery from 2012. MageObsidian replaces that layer with a modern toolchain — **native ESM, Vite dev server with HMR, Tailwind CSS 4 and Vue 3 islands** — without throwing away Magento itself: layouts, blocks, templates, theme inheritance and the module system all keep working exactly as you know them.

No headless rewrite. No parallel stack to maintain. Your PHP developers keep their workflow; your frontend developers finally get theirs.

<p align="center">
  <a href="https://mage-obsidian-demo.jeanmarcos.dev/">
    <img src="https://raw.githubusercontent.com/mage-obsidian/.github/main/profile/assets/lighthouse-100.png" alt="Lighthouse report: 100 in Performance, Accessibility, Best Practices and SEO" width="840">
  </a>
</p>
<p align="center"><em>The live demo scores 100/100/100/100 on Lighthouse.</em></p>

## Highlights

- ⚡ **Vite + HMR inside Magento** — instant feedback while editing themes and modules.
- 🎨 **Tailwind CSS 4** with per-theme extension and full theme-inheritance support.
- 🏝️ **Vue 3 islands** — interactive components mounted lazily over server-rendered pages.
- 🌿 **Optional Twig engine** — write `.twig` templates alongside `.phtml`.
- 🧩 **JS interceptors** — a JS port of Magento's plugin system (`before`/`around`/`after`) so modules can customize each other's JavaScript without patching source.
- 📦 **Luma-parity storefront** — compatibility modules for catalog, checkout, customer, wishlist, reviews and more.

## Repositories

| Repository | Role |
|---|---|
| [module-modern-frontend](https://github.com/mage-obsidian/module-modern-frontend) | Core Magento 2 module — start here |
| [module-modern-frontend-cli](https://github.com/mage-obsidian/module-modern-frontend-cli) | `bin/magento` CLI commands |
| [component-modern-frontend](https://github.com/mage-obsidian/component-modern-frontend) | Vite build harness mapped into the Magento root |
| [js-package-utils](https://github.com/mage-obsidian/js-package-utils) | The JS build engine (npm: [`mage-obsidian`](https://www.npmjs.com/package/mage-obsidian)) |
| [module-modern-frontend-twig](https://github.com/mage-obsidian/module-modern-frontend-twig) | Optional Twig template engine |
| [module-storefront](https://github.com/mage-obsidian/module-storefront) | Storefront foundation (Vue islands + Twig components) |
| [theme-default](https://github.com/mage-obsidian/theme-default) | OBSIDIAN — the default theme ([live demo](https://mage-obsidian-demo.jeanmarcos.dev/)) |
| [docs](https://github.com/mage-obsidian/docs) | Documentation site (EN/ES) |
| `module-*` | Domain compatibility modules: catalog, checkout, customer, sales, wishlist, reviews… |

## Quick start

```bash
composer require mage-obsidian/component-modern-frontend
pnpm --prefix vite install
bin/magento setup:upgrade
bin/magento mage-obsidian:frontend:config --generate
```

Full instructions in the [installation guide](https://mage-obsidian.jeanmarcos.dev/getting-started/installation/).

## Community

- 💬 [GitHub Discussions](https://github.com/mage-obsidian/module-modern-frontend/discussions) — questions, ideas, show &amp; tell
- 🐛 Issues on each repository — bug reports with templates
- 🤝 [Contributing guide](https://mage-obsidian.jeanmarcos.dev/support/)
- ❤️ [Support the project](https://ko-fi.com/Q5Q816Z9WN)
