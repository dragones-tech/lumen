# Lumen

> A transparent, no-magic, no-build vanilla-JS OOP UI framework. **What you write is what runs.**
>
> Un framework de UI en JS vanilla, OOP, transparente, sin magia y sin build. **Lo que escribes es lo que corre.**

**📖 Live docs & examples · Documentación y ejemplos en vivo:** https://dragones-tech.github.io/lumen/site/

## Principles · Principios

- **No build.** Native ES modules. The only thing you need is a static file server (ES module imports are blocked on `file://`). Your `.js` reaches the browser untouched.
- **No magic.** No global side effects on import, no hidden proxies, no compiler rewriting your code. Explicit OOP with a lifecycle you can read.
- **No Web Components.** Plain classes (not `extends HTMLElement`), so you keep full control of `animate`/`unmount`. A Custom Element adapter is an opt-in escape hatch.
- **Separate HTML.** Markup lives in native `<template>` elements — real HTML, full editor autocomplete.
- **Style-agnostic.** Ships zero CSS. Bring plain CSS, native `@scope`, Tailwind — whatever you like.
- **Typed without a build.** Plain `.js` + JSDoc types, checked with `tsc --noEmit`.

## Run the examples · Correr los ejemplos

```bash
# from the repo root — zero-dep Node static server (any static server works)
npm run serve
# then open http://localhost:8000/examples/event-emitter/
```

## Docs site · Sitio de docs

A bilingual (EN/ES) documentation site **built with Lumen itself** — sidebar + router +
each page's live example embedded. Un sitio de documentación bilingüe **hecho con Lumen**.

```bash
npm run serve
# open http://localhost:8000/site/
```

## Type-check · Verificar tipos

```bash
npm install   # dev-only: TypeScript, for checking JSDoc types (never runs in the browser)
npm run check
```

## Modules · Módulos

| Module | Status | Docs |
|---|---|---|
| `event-emitter` | ✅ done | [en](docs/en/event-emitter.md) · [es](docs/es/event-emitter.md) |
| `dom` | ✅ done | [en](docs/en/dom.md) · [es](docs/es/dom.md) |
| `animate` | ✅ done | [en](docs/en/animate.md) · [es](docs/es/animate.md) |
| `view` | ✅ done | [en](docs/en/view.md) · [es](docs/es/view.md) — abstract base class you extend |
| `model` | ✅ done | [en](docs/en/model.md) · [es](docs/es/model.md) |
| `collection` | ✅ done | [en](docs/en/collection.md) · [es](docs/es/collection.md) |
| `collection-view` | ✅ done | [en](docs/en/collection-view.md) · [es](docs/es/collection-view.md) |
| `region` | ✅ done | [en](docs/en/region.md) · [es](docs/es/region.md) |
| `router` | ✅ done | [en](docs/en/router.md) · [es](docs/es/router.md) |
| `http` | ✅ done | [en](docs/en/http.md) · [es](docs/es/http.md) — `fetch` wrapper |
| `i18n` | ✅ done | [en](docs/en/i18n.md) · [es](docs/es/i18n.md) — translations |
| `validate` | ✅ done | [en](docs/en/validate.md) · [es](docs/es/validate.md) — model + UI validation |
| `element` | ✅ done | [en](docs/en/element.md) · [es](docs/es/element.md) — use a View as a Custom Element (`defineElement`) |

## Guides · Guías

- **Styling** (Lumen is style-agnostic; plain CSS, `@scope`, Tailwind): [en](docs/en/styling.md) · [es](docs/es/styling.md) — runnable [Tailwind example](examples/tailwind/).
- **Deployment & loading** (HTTP/2, import maps, `modulepreload` — no bundler needed): [en](docs/en/deployment.md) · [es](docs/es/deployment.md).
- **For AI agents** (llms.txt, AGENTS.md): [en](docs/en/llms.md) · [es](docs/es/llms.md).
- **Credits & lineage** (homage to Backbone & Marionette): [en](docs/en/credits.md) · [es](docs/es/credits.md).

## For AI agents · Para agentes de IA

Machine-readable docs so an assistant (Claude, Codex, Cursor…) writes idiomatic Lumen:

- [`llms.txt`](https://dragones-tech.github.io/lumen/llms.txt) — index of all docs ([llmstxt.org](https://llmstxt.org) convention).
- [`llms-full.txt`](https://dragones-tech.github.io/lumen/llms-full.txt) — every page in one file; paste it into your assistant.
- [`AGENTS.md`](AGENTS.md) — project conventions for coding agents (and `CLAUDE.md` for Claude Code).

Regenerate the `llms.*` files after editing docs with `npm run llms`.

## Credits · Créditos

Lumen is a respectful, modernized homage to **[Backbone.js](https://backbonejs.org/)**
(Model, Collection, events-first) and **[Marionette.js](https://marionette.js.org/)**
(View, Region, CollectionView, layouts). The patterns are theirs; the implementation is
rebuilt on the modern platform — no jQuery, no Underscore, no build. No Backbone/Marionette
code is used; these are conceptual inspirations. See [credits](docs/en/credits.md).
