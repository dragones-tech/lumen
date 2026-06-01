# Deployment & loading

Lumen ships unbundled native ES modules. Thanks to **HTTP/2** (and HTTP/3), that is not a
trade-off — it's an advantage. This page covers how to serve it well.

## Why no bundler is needed

Under HTTP/1.1, many small files were slow (≈6 connections, per-request overhead) — which
is why bundling existed. Under HTTP/2 that penalty is gone:

- **Multiplexing** — many requests share one connection with no head-of-line blocking, so loading Lumen's small modules costs about the same as one file.
- **Header compression (HPACK)** — cheap per-request overhead.
- **Per-file caching** — change `view.js` and only that file's cache is invalidated; a bundle would bust the whole thing.

Almost every modern static host serves HTTP/2 by default (Netlify, Vercel, Cloudflare,
nginx, Caddy). So: **deploy the files as-is.** A bundler is optional, not required.

## Flatten the ESM waterfall: `modulepreload`

The one downside of native modules is the *discovery waterfall*: the browser loads
`index.js`, parses it, sees its imports, fetches those, parses them, and so on — one round
trip per level. Tell the browser to fetch the whole graph up front, in parallel:

```html
<link rel="modulepreload" href="/src/index.js" />
<link rel="modulepreload" href="/src/view.js" />
<link rel="modulepreload" href="/src/dom.js" />
<!-- …one per module your page actually uses -->
```

Combined with HTTP/2 multiplexing, this gives a **bundle's load performance without a
bundle**. (Server-side, `103 Early Hints` can send these preloads even earlier.)

## Clean imports: import maps

An import map lets you write `import { View } from 'lumenjs'` instead of relative paths, and
keeps your URLs in one place:

```html
<script type="importmap">
  { "imports": { "lumenjs": "/src/index.js", "lumenjs/": "/src/" } }
</script>
```

Then: `import { View } from 'lumenjs'` or `import { clone } from 'lumenjs/dom.js'`. Import maps
are supported in all current browsers; this docs site uses one.

## Caching headers

Because files are independent, cache them aggressively and let the URL change on deploy:

```text
Cache-Control: public, max-age=31536000, immutable   # for versioned/hashed asset URLs
Cache-Control: no-cache                               # for index.html
```

If you don't hash filenames, use a shorter max-age or `must-revalidate` so updates are
picked up.

## Don't rely on HTTP/2 Server Push

Server Push was **removed** from Chrome (2022). Its replacement is exactly the
`modulepreload` / `preload` hints above (optionally delivered via `103 Early Hints`).

## The Http module

The `http` module needs nothing special: `fetch` uses HTTP/2 automatically when the server
supports it. One practical consequence — concurrency is cheap, so firing several requests at
once is fine:

```js
const [user, posts] = await Promise.all([
  api.get('/user', { signal }),
  api.get('/posts', { signal }),
]);
```
