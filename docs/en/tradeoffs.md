# Trade-offs: strengths & limits

Lumen makes a handful of deliberate bets: **no build, no magic, surgical updates,
client-side, zero dependencies.** Every strength *and* every limitation on this page flows
from those bets — they are coherent consequences, not accidental gaps. So the question is
never "does Lumen lack feature X?" but **"do my constraints match its bets?"**

**Lumen is a UI library, not a server.** It builds and manages views in the browser; it does
not serve HTTP or render pages server-side. When you need SEO or a server-rendered first
paint, pair it with a server (Express, Rails, FastAPI…) that renders the content — Lumen adds
the interactivity on top. See [Project structure](structure.md).

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
| **Ideal host for imperative libraries** | `onMount`/`onUnmount`/`signal` are the exact integration seam for three.js, pixi, CodeMirror, maps, charts — often cleaner than the `useRef` + `useEffect` dance, with no re-render to fight. See [Libraries vs. components](#libraries-vs-components). |
| **OOP & longevity** | Plain classes, JSDoc types. A small, stable surface that ages well. |

## Limitations

| Limitation | What it means |
|---|---|
| **No SSR / SSG / hydration** | Views render in the browser, so content isn't in the initial HTML. For SEO-critical pages and fast first paint, let the **server** render the content and use Lumen for interactivity (islands) — Lumen alone is not a page renderer for content sites. This is the biggest gap vs. Next/Nuxt/SvelteKit. |
| **Manual updates don't scale with dynamism** | You are the reconciler. For webs of derived state, complex conditional rendering, or editor/spreadsheet-like UIs, you write a lot of DOM-sync code by hand — and risk state/DOM drift. There is no reactivity/computed-state engine (no signals, no bindings). |
| **No framework-coupled component kits** | You don't inherit React/Vue's thousands of ready components (a React date picker, a Vue data table, MUI) — those are bound to their framework's render model. So standard product-UI velocity is lower. Note this is only *half* a limitation: framework-agnostic libraries integrate cleanly — see [Libraries vs. components](#libraries-vs-components). |
| **DX & team scale** | No state-preserving HMR (the dev server does a full reload), no static type-checking of template/DOM wiring, no dedicated devtools. And it's bespoke — most developers already know React/Vue, so onboarding has a cost. |
| **Data layer & large lists** | No global store, normalized cache, or data-fetching/caching layer (think React Query/Apollo) — you build those on `EventEmitter`/`Model`/`Http`. `CollectionView` mounts real DOM per model, with **no virtualization**, so huge lists need windowing you write yourself. |
| **Evergreen browsers only** | Lumen leans on modern platform APIs. Supporting legacy browsers would require polyfills and a build step — which contradicts the whole premise. |

## Libraries vs. components

"No ecosystem" needs a sharper line, because it's only half a limitation:

- **Framework-agnostic libraries** — three.js, pixi.js, CodeMirror, Chart.js, MapLibre,
  ProseMirror, D3 — own a DOM node and render themselves. Lumen is an *ideal* host:
  instantiate the library in `onMount`, dispose it in `onUnmount`. The imperative library and
  the imperative lifecycle match naturally — often cleaner than React's `useRef` +
  `useEffect` + cleanup dance, with no re-render to fight and no `StrictMode` double-invoke.

  ```js
  import * as THREE from 'three'; // ESM — importable via a CDN/import map (still no build)

  class Scene extends View {
    static template = '#scene';                 // e.g. <canvas data-ref="canvas"></canvas>
    onMount() {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.canvas });
      // …build the scene, then start the render loop
      this.tick();
    }
    tick = () => {
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(this.tick);
    };
    onUnmount() {
      cancelAnimationFrame(this._raf);
      this.renderer.dispose();                  // free GPU resources — clean teardown
    }
  }
  ```

  The library owns its subtree; Lumen just hosts the root node and the lifecycle. For
  creative-coding, dataviz, maps and editors this is a genuine **strength**, not a gap.

- **Framework-coupled component kits** — a React date picker, a Vue data table, MUI — are
  bound to their framework's render model and can't be dropped into Lumen. *This* is the real
  gap. Many needs are still covered by agnostic vanilla libraries; what you don't get is the
  framework-bound kits.

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
