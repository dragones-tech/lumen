# Trade-offs: strengths & limits

Lumen makes a handful of deliberate bets: **no build, no magic, surgical updates,
client-side, zero dependencies.** Every strength *and* every limitation on this page flows
from those bets — they are coherent consequences, not accidental gaps. So the question is
never "does Lumen lack feature X?" but **"do my constraints match its bets?"**

One framing to keep in mind: the axis that limits Lumen is **not app size**. It is
**UI dynamism + SEO needs + ecosystem dependence**. A large server-rendered app with
interactive islands fits beautifully; a medium but highly dynamic editor-style SPA will
fight you.

## Strengths

| Strength | Why it matters |
|---|---|
| **No build, no dependency rot** | Native ES modules — what you write is what runs, today and in five years. Nothing to transpile, nothing to update behind your back. |
| **Load only what you use** | Zero runtime dependencies; the browser fetches just the modules you import. No half-megabyte framework for a dropdown. |
| **Transparent, no magic** | Explicit state (`model.set`), explicit lifecycle, no proxies, no globals. Easy to read, debug, and reason about. |
| **Surgical updates** | You touch only the nodes that changed — focus, scroll, selection and input state are never lost. No re-render, no diffing. |
| **Plays with the platform** | Cleanup via `AbortSignal`, transitions via the View Transitions API, visibility via `IntersectionObserver`, requests via `fetch`. The platform does the heavy lifting. |
| **Built for islands** | `defineElement` exposes any view as a custom element — drop behavior into server-rendered pages or other frameworks. |
| **OOP & longevity** | Plain classes, JSDoc types. A small, stable surface that ages well. |

## Limitations

| Limitation | What it means |
|---|---|
| **No SSR / SSG / hydration** | Views render in the browser, so content isn't in the initial HTML. For SEO-critical pages and fast first paint, let the **server** render the content and use Lumen for interactivity (islands) — Lumen alone is not a page renderer for content sites. This is the biggest gap vs. Next/Nuxt/SvelteKit. |
| **Manual updates don't scale with dynamism** | You are the reconciler. For webs of derived state, complex conditional rendering, or editor/spreadsheet-like UIs, you write a lot of DOM-sync code by hand — and risk state/DOM drift. There is no reactivity/computed-state engine (no signals, no bindings). |
| **No component ecosystem** | There is no off-the-shelf datepicker, data grid, charts or rich-text editor *built for Lumen*. You integrate vanilla JS libraries (the lifecycle hooks make this clean), but you don't get React/Vue's thousands of ready components. |
| **DX & team scale** | No state-preserving HMR (the dev server does a full reload), no static type-checking of template/DOM wiring, no dedicated devtools. And it's bespoke — most developers already know React/Vue, so onboarding has a cost. |
| **Data layer & large lists** | No global store, normalized cache, or data-fetching/caching layer (think React Query/Apollo) — you build those on `EventEmitter`/`Model`/`Http`. `CollectionView` mounts real DOM per model, with **no virtualization**, so huge lists need windowing you write yourself. |
| **Evergreen browsers only** | Lumen leans on modern platform APIs. Supporting legacy browsers would require polyfills and a build step — which contradicts the whole premise. |

## The deciding axis

Don't ask "how big is the app?" Ask three things:

1. **Do I need SEO / server-rendered first paint?** If yes, the server renders content; Lumen is the interactivity layer, not the page.
2. **How dynamic is the UI?** Mostly content + discrete interactions → great. A dense web of derived, interdependent state → you'll miss declarative reactivity.
3. **Do I depend on a component ecosystem to move fast?** If yes, a mainstream framework wins on velocity.

## When to use Lumen — and when not to

> **Use Lumen** when the server (or a static build) already provides the HTML/SEO; the
> interactivity is "islands," an internal tool, or a long-lived dashboard; you control the
> browser; and you value transparency and longevity over ecosystem velocity. Internal apps
> and dashboards can be **large** — size is not the limit.
>
> **Reach for React / Vue / Svelte + a meta-framework** when you need SSR/SEO out of the
> box, the UI is large and highly dynamic with derived state everywhere, you rely on the
> component ecosystem for speed, or a big team already lives in that stack.

## These limits are intentional

Adding SSR, a reactivity engine, or a bundled ecosystem would reintroduce exactly the build
step and the bloat Lumen exists to avoid. The limitations are the *price* of the strengths —
choose by fit, not by feature count. See also [Project structure](structure.md) (how to keep
a growing app clean), [defineElement](element.md) (islands), and [Deployment](deployment.md)
(why no bundler is needed).
