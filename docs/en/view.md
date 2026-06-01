# View

The abstract base class for everything you see. **A view is a class — you extend `View`.**
It wraps the `dom` primitives (`clone` + `refs`), an explicit lifecycle, and leak-free
cleanup, so you never wire that plumbing by hand.

## Philosophy

- **OOP, not functions.** A view is a class with behavior and a lifecycle. The stateless helpers (`clone`, `refs`, `fadeIn`…) are the primitives it uses internally.
- **A plain class, not a Custom Element.** You keep full control of the lifecycle, so `animateOut()` finishes *before* the node leaves the DOM. (A Custom Element's `disconnectedCallback` only fires *after* removal — too late to animate out.)
- **Surgical updates, no re-render.** You change nodes in `this.ui` directly. Focus, scroll and input state are never lost. (The old framework re-ran `innerHTML = ''` on every change; Lumen never does.)
- **Symmetric, automatic cleanup.** Listeners bound with `this.signal` (or `this.listen(...)`) are removed on `unmount()` — no leaks, and none of the old framework's "listener re-subscribed on every update" bug.

## Lifecycle, in order

1. `new View(props)` — cheap; nothing is built or touched yet.
2. `build()` (called by `mount`) — `render()` makes `el`, `refs()` fills `ui`, then `onCreate()`. Runs once.
3. `mount(parent)` — inserts `el`, sets `mounted`, calls `onMount()`, awaits `animateIn()`.
4. `unmount()` — awaits `animateOut()`, unmounts children, calls `onUnmount()`, aborts `signal`, removes `el`.

Wire listeners in `onMount()` (it re-runs on remount); do one-time setup in `onCreate()`.

## API

| Member | Description |
|---|---|
| `static template` | A `<template>` selector (e.g. `'#card'`) or element used by the default `render()`. |
| `props` | The data/handlers passed to the constructor. |
| `el` | The root element (`null` until `build()`/`mount()`). |
| `ui` | The `[data-ref]` elements, keyed by name. |
| `events` | A per-view `EventEmitter` for talking to a parent. |
| `signal` | An `AbortSignal` tied to the mounted lifetime — bind listeners with it for auto-cleanup. |
| `mounted` | Whether the view is in the DOM. |
| `render()` | Build the root node. Default clones `static template`; override to build differently. |
| `build()` | Create `el` + `ui` (idempotent). |
| `mount(parent)` | Insert and run the mount lifecycle. Returns `Promise<this>`. |
| `unmount()` | Animate out, tear down children, clean up, remove. Returns `Promise<void>`. |
| `addChild(child, parent?)` | Mount a child (default parent: `this.el`) and track it for cascade unmount. |
| `removeChild(child)` | Untrack and unmount a child. |
| `listen(target, type, handler, options?)` | `addEventListener` bound to `signal` (auto-removed on unmount). |
| `observe(target, callback, options?)` | `IntersectionObserver` bound to `signal` (auto-disconnected on unmount). |
| `mount(parent, { animate? })` | `animate: false` skips `animateIn()` (used by `Region`'s View-Transition path). |
| `unmount({ animate? })` | `animate: false` skips `animateOut()`; propagates through the cascade. |
| `onCreate / onMount / onUnmount` | Lifecycle hooks (override). |
| `animateIn / animateOut` | Transition hooks; return a Promise (override). |

## Example

```html
<template id="note">
  <div class="note">
    <span data-ref="text"></span>
    <button data-ref="remove">×</button>
  </div>
</template>
```

```js
import { View } from 'lumenjs/view';
import { slideIn, slideOut } from 'lumenjs/animate';

class Note extends View {
  static template = '#note';

  onMount() {
    this.ui.text.textContent = this.props.text;
    // Bound to signal → removed automatically on unmount.
    this.listen(this.ui.remove, 'click', () => this.props.onRemove(this));
  }
  onUnmount() { /* timers/subscriptions are cleaned automatically via signal */ }

  animateIn()  { return slideIn(this.el); }
  animateOut() { return slideOut(this.el); } // plays fully BEFORE removal
}

await new Note({ text: 'Hello', onRemove: (n) => n.unmount() }).mount(document.body);
```

## Typing your refs

Extend with a generic so `this.ui` is typed:

```js
/** @extends {View<{ text: HTMLElement, remove: HTMLButtonElement }>} */
class Note extends View {
  static template = '#note';
  onMount() {
    this.ui.text;   // HTMLElement
    this.ui.remove; // HTMLButtonElement
  }
}
```

## Event handler styles

Lumen does not force a handler style — any standard approach works. The framework's only
job is to keep `this` correct and clean up on unmount (that's `listen` + `signal`). Pick
whichever your team prefers. Three common ones, with trade-offs:

**1. Auto-bound arrow field** — the handler is a class field; reference it directly.
```js
onMount() { this.listen(this.ui.name, 'input', this.onNameInput); }
onNameInput = () => this.props.model.set('name', this.ui.name.value);
```
No inline arrow, no `bind`, `this` always correct. Lives per-instance (not on the prototype), so it isn't overridable via `super`.

**2. Method bound once** — the `@boundMethod` idea without a decorator; bind in `onCreate`.
```js
onCreate() { this.onNameInput = this.onNameInput.bind(this); }
onMount()  { this.listen(this.ui.name, 'input', this.onNameInput); }
onNameInput() { this.props.model.set('name', this.ui.name.value); }
```
The method stays on the prototype (shared, overridable), at the cost of one bind line.

**3. Method + wiring arrow** — reference the method through a thin arrow.
```js
onMount() { this.listen(this.ui.name, 'input', () => this.onNameInput()); }
onNameInput() { this.props.model.set('name', this.ui.name.value); }
```
Method on the prototype; the arrow keeps `this`, at the cost of an inline function at the wiring site.

> Never pass a raw, unbound method reference (`this.listen(el, 'input', this.onNameInput)`) — `this` is lost inside it.

The examples use styles 1 and 3; neither is "the" way.

## Observing visibility (`observe`)

`observe()` is to `IntersectionObserver` what `listen()` is to `addEventListener`: it wires
the native observer and disconnects it automatically on `unmount()` (via `signal`). The
observer has no `signal` option of its own, so the view bridges it for you — no manual
`disconnect()` in `onUnmount`, no leak.

Use it for *viewport-driven* behavior: reveal-on-scroll, lazy-loading, infinite scroll
sentinels. It is a third trigger source alongside the model (data) and the lifecycle
(mount/unmount) — and it composes with both.

```js
class Card extends View {
  static template = '#card';
  onMount() {
    // Reveal once, the first time the card scrolls into view.
    this.observe(this.el, ([entry], io) => {
      if (!entry.isIntersecting) return;
      this.animateIn();          // or fadeIn(this.el), or this.props.model.set('seen', true)
      io.unobserve(this.el);     // one-shot: don't fire again
    }, { threshold: 0.2 });
  }
  animateIn() { return slideIn(this.el); }
}
```

The callback receives the standard `(entries, observer)` arguments, so `threshold`,
`rootMargin` and `observer.unobserve()` all work exactly as on the platform. No magic, no
global document scanner — each view observes only what it asks to. See the
[live example](../../examples/observe/).

## Regions (layouts)

Declare `static regions` — a map of region name → the `data-ref` of its slot — and a
`Region` is created for each as `this.regions.<name>`. They are emptied automatically on
`unmount()`, so **nested layouts tear down in cascade**.

```html
<template id="app-layout">
  <div class="app">
    <header data-ref="header"></header>
    <aside  data-ref="sidebar"></aside>
    <main   data-ref="main"></main>
  </div>
</template>
```

```js
class AppLayout extends View {
  static template = '#app-layout';
  static regions = { header: 'header', sidebar: 'sidebar', main: 'main' };
  onMount() {
    this.regions.header.show(new NavBar());
    this.regions.sidebar.show(new Menu());
    this.regions.main.show(new Dashboard());   // Dashboard can declare its OWN regions
  }
}
```

A view shown in a region can itself have regions, all the way down. When `AppLayout`
unmounts, it empties its regions → each shown view unmounts → that view empties *its*
regions → and so on. You write no teardown code.

> `View` (content) vs `Region` (a slot that swaps which view is shown). A layout is a
> View whose slots are Regions filled with other Views. See [region](region.md).

## Talking to a parent

Two patterns, both explicit:

- **Props callbacks** (simplest): pass `onRemove` in, call `this.props.onRemove(this)`.
- **Per-view events**: `this.events.emit('remove', this)`; the parent does
  `child.events.on('remove', handler, { signal: child.signal })`.

## Design notes

- `build()` runs `render()`/`refs()` *after* the subclass is fully constructed (it is called by `mount`, not the constructor), so overridden `render()` and `onCreate()` can safely use subclass fields — no constructor field-ordering footgun.
- `unmount()` recreates a fresh `AbortController` at the end, so a view can be unmounted and mounted again; listeners rebind in `onMount()`.
- Composition is explicit: `addChild` mounts and tracks; `unmount` cascades to children. There is no hidden parent/child registry.
