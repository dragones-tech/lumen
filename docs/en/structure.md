# Project structure

Lumen separates **behavior** (classes) from **markup** (`<template>`). That separation is
easy in the small; the question this page answers is how to keep it as an app grows — so
each section (header, customers, contact…) owns its own thing, and you never end up with
one giant file holding everything.

## The unit: one View per file

A view is a class, so its natural home is its own module. A section maps to a file:

```text
views/
  app-layout.js     # the shell (regions)
  header.js
  customers.js
  contact.js
```

Each file owns one view's behavior. Its markup lives in a `<template>` — never as an HTML
string inside the JS (you'd lose the editor's HTML support: highlighting, auto-close,
Emmet, format-on-save). Keep HTML as HTML.

## Where the markup lives (the key decision)

`clone('#id')` resolves the selector against the **document**, so every `<template>` a view
uses must be present in the page. That's fine — what you want to avoid is hand-maintaining
one monolithic `index.html` with every section's markup. The clean answer depends on whether
you have a server.

### With a server (Rails, FastAPI, any templating) — recommended

Each section owns its own partial; the server composes them. On disk you get true single
responsibility; the browser still receives one document with all the templates — exactly
what `clone('#id')` needs. The assembled page is **generated output**, not a file you edit.

**Rails**

```erb
<%# app/views/site/_header.html.erb %>
<template id="header"><header data-ref="root">…</header></template>

<%# app/views/site/index.html.erb %>
<%= render "header" %>
<%= render "customers" %>
<%= render "contact" %>
<div id="app"></div>
<%= javascript_import_module_tag "app" %>
```

**FastAPI / Jinja**

```django
{# templates/index.html #}
{% include "_header.html" %}    {# each holds its own <template id> #}
{% include "_customers.html" %}
{% include "_contact.html" %}
<div id="app"></div>
<script type="module" src="/static/app.js"></script>
```

**Express / EJS** (the Node flavor — Lumen is a UI library, so it needs a server like this for SEO)

```js
// server.js
import express from 'express';
const app = express();
app.set('view engine', 'ejs');
app.use('/static', express.static('static'));   // your JS: copied src/ or a CDN import map

app.get('/', async (req, res) => {
  res.render('index', { customers: await db.customers() });  // server renders the content → SEO
});
app.listen(3000);
```

```html
<%# views/index.ejs %>
<%- include('_header') %>      <!-- each partial holds its own <template id> -->
<%- include('_customers') %>
<%- include('_contact') %>
<div id="app"></div>
<script type="module" src="/static/app.js"></script>
```

**Hono** (modern, Web-Standards, runs on Node/Bun/Deno/edge — same ADN as Lumen)

```js
// server.js
import { Hono } from 'hono';
import { html } from 'hono/html';
import { serveStatic } from '@hono/node-server/serve-static'; // edge: 'hono/cloudflare-workers'

const app = new Hono();
app.use('/static/*', serveStatic({ root: './' }));  // your JS: copied src/ or a CDN import map

app.get('/', async (c) => {
  const customers = await db.customers();
  return c.html(html`<!doctype html>
    <body>
      <ul>${customers.map((x) => html`<li>${x.name}</li>`)}</ul>  <!-- server-rendered → indexed -->
      <template id="customers">…</template>
      <div id="app"></div>
      <script type="module" src="/static/app.js"></script>
    </body>`);
});

export default app;
```

> On edge runtimes (Cloudflare Workers) there's no filesystem — serve the JS via the
> platform's static assets, or just point an import map at a CDN for `lumenjs`.

> Whatever you need **indexed** must be rendered into this server HTML; Lumen then adds the
> interactivity. Content that only appears after client-side `fetch` is not crawled.

### Static (no server templating)

The platform has no native HTML include (HTML Modules aren't Baseline), so you can't compose
`.html` files at load time without machinery. Two honest choices:

1. **One organized `index.html`** — keep all `<template id>` in the page, grouped and
   commented by section. The JS still lives in per-section files. For most static sites this
   is the pragmatic sweet spot: the markup is in one file, but each *behavior* is separate.
2. **A partial loader** — ship per-section `.html` and `fetch` + inject their `<template>`s
   before mounting. You get per-file markup at the cost of async ordering and extra requests.
   Only worth it for large static apps.

Either way: **don't inline markup as JS strings** to "separate" the files — that trades a
markup-organization problem for a worse editor-ergonomics one.

## Wiring it together: the entry

One small entry imports the section views and mounts the shell. Compose with a layout's
`static regions` (one region per section) or the `Router` — never a god-file:

```js
// app.js — the entry
import { View } from 'lumenjs';
import { Header } from './views/header.js';
import { Customers } from './views/customers.js';
import { Contact } from './views/contact.js';

class AppLayout extends View {
  static template = '#app-shell';
  static regions = { header: 'header', main: 'main', contact: 'contact' };
  onMount() {
    this.regions.header.show(new Header());
    this.regions.main.show(new Customers());
    this.regions.contact.show(new Contact());
  }
}

new AppLayout().mount(document.querySelector('#app'));
```

Each section view, in its own file, stays tiny and focused:

```js
// views/contact.js
import { View } from 'lumenjs';
export class Contact extends View {
  static template = '#contact';
  onMount() { /* wire this section's listeners */ }
}
```

## A suggested layout (server-backed)

```text
app/
  views/site/
    index.html.erb        # <div id="app"></div> + asset tags
    _header.html.erb      # <template id="header">…
    _customers.html.erb   # <template id="customers">…
    _contact.html.erb
  javascript/
    app.js                # entry: mounts AppLayout
    views/                # one View per section
      app-layout.js  header.js  customers.js  contact.js
    models/               # Model / Collection subclasses
    api.js                # a single Http instance, imported where needed
```

## Rules of thumb

- **One View per file**; the filename names the section.
- **Markup in `<template>`**, never as a string in JS.
- **Sections own their markup** — server partials when you have a server; one organized
  `index.html` when you don't.
- **Compose, don't centralize** — a layout's `static regions` (see [View → Regions](view.md))
  or the [Router](router.md) wire sections together; the entry just mounts the shell.
- **One `Http` per API**, imported explicitly — no globals.
