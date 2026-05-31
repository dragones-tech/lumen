# Installation

Lumen is no-build, native ES modules, with zero runtime dependencies — so "installing" can
be as light as pointing at a CDN or copying a folder. Pick what fits your setup.

## Option 1 — CDN, no install (quickest)

Add an import map and load from a CDN (jsDelivr serves the GitHub repo directly):

```html
<script type="importmap">
{
  "imports": {
    "lumen": "https://cdn.jsdelivr.net/gh/dragones-tech/lumen@main/src/index.js",
    "lumen/": "https://cdn.jsdelivr.net/gh/dragones-tech/lumen@main/src/"
  }
}
</script>

<script type="module">
  import { View } from 'lumen';
  // …your app
</script>
```

Pin a tag or commit for production instead of `@main` (e.g. `@v0.1.0`) so it can't change under you.

## Option 2 — copy `src/` (most transparent)

Lumen is just plain `.js` files. Copy the repo's `src/` into your project (e.g.
`vendor/lumen/`) and import it — relatively or via an import map:

```html
<script type="importmap">
{ "imports": { "lumen": "/vendor/lumen/index.js", "lumen/": "/vendor/lumen/" } }
</script>
```

You own the code, no package manager, nothing to update behind your back. Very on-brand.

## Option 3 — npm / GitHub

```bash
npm i @universidad-carolina/lumen     # once published to npm
# or straight from GitHub today:
npm i github:dragones-tech/lumen
```

Bundlers and Node resolve `@universidad-carolina/lumen` via the package's `exports`. In the
browser **without** a bundler, still add an import map pointing the specifier at the
installed files (e.g. `node_modules/@universidad-carolina/lumen/src/index.js`), since browsers
don't resolve bare specifiers on their own.

## Serve it

Any static server works (ES module imports are blocked on `file://`). The repo ships a
zero-dep one with live reload:

```bash
npm run serve   # → http://localhost:8000
```

## Type-checking (optional)

Types are JSDoc; check them with TypeScript (dev-only, never runs in the browser):

```bash
npm i -D typescript
npm run check   # tsc --noEmit
```

> Status: published on GitHub (`dragones-tech/lumen`); the CDN and `github:` install work
> today. The npm package name is `@universidad-carolina/lumen` (publish pending).
