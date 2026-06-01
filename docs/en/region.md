# Region

Manages a single DOM slot that holds at most one `View` at a time, with an animated swap.

## Philosophy

- **Ordered transitions.** `show(view)` plays the current view's `animateOut()` to completion, unmounts it, then mounts the new view and plays its `animateIn()`. Out, then in — predictable.
- **What Custom Elements can't do.** Because a `View` is a plain class, the region controls removal timing, so the leave animation always finishes before the node goes. A Custom Element's `disconnectedCallback` fires only *after* removal.
- **The base for navigation.** Point a region at an "outlet" element and call `show()` as routes change. The router (module 9) is built on this.

## API

| Member | Description |
|---|---|
| `new Region(target, { transition? })` | `target` is an element or a CSS selector for the slot. `transition: true` opts into native View Transitions. |
| `el` | The slot element. |
| `current` | The view currently shown, or `null`. |
| `show(view, { transition? })` | Animated swap. Returns `Promise<view>` (resolves after the entrance). No-op if already current. |
| `empty()` | Unmount whatever is shown (animating out first). Returns `Promise<void>`. |

## Example

```js
import { Region, View, fadeIn, fadeOut } from 'lumenjs';

class Screen extends View {
  static template = '#screen';
  onMount()   { this.ui.title.textContent = this.props.title; }
  onUnmount() { console.log('left', this.props.title); }
  animateIn()  { return fadeIn(this.el); }
  animateOut() { return fadeOut(this.el); }
}

const main = new Region('#outlet');
await main.show(new Screen({ title: 'Home' }));
await main.show(new Screen({ title: 'About' })); // Home fades out, then About fades in
```

## Native View Transitions (opt-in)

By default a swap is two JS animations: the old view's `animateOut()`, then the new view's
`animateIn()`. Opt into the native [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
and the browser does the work instead — a crossfade out of the box, and *shared-element*
morphs for anything you tag with `view-transition-name`.

```js
const main = new Region('#outlet', { transition: true });   // default for this region
await main.show(new Home());
await main.show(new About());     // browser crossfades; views' animateIn/animateOut are skipped

// or per-swap:
await main.show(new About(), { transition: true });
```

This is **pure progressive enhancement**:

- Off by default — existing regions behave exactly as before.
- On browsers without `document.startViewTransition`, it **falls back** to the normal
  JS-animated swap. Nothing breaks; you just don't get the native crossfade.
- Inside a transition the views' `animateIn`/`animateOut` are skipped (the browser plays the
  visual), so you never double-animate. The lifecycle (`onMount`/`onUnmount`, cascade cleanup,
  `signal`) runs exactly as always.

Shared-element morph: give the same `view-transition-name` to an element in the outgoing and
incoming views (in your CSS) and the browser animates it from one position to the other.

> Same-document View Transitions are Baseline (widely supported). Cross-document transitions
> are not yet — Lumen only uses the same-document API, which is all an SPA needs.

## Named regions in a layout

A layout usually has several regions (header, sidebar, main, modal). You don't create them
by hand — declare them on a `View` with `static regions` and each is created and emptied
for you, cascading through nested layouts. See [View → Regions (layouts)](view.md). The
example below is a nested layout built that way.

## Design notes

- `show` awaits `unmount()` (which awaits `animateOut`) before mounting the next view, so transitions never overlap. For a crossfade, either enable `{ transition: true }` (native) or mount into two stacked regions.
- A region holds exactly one view; for lists use `CollectionView`.
- `show` returning the view (after `animateIn`) lets callers `await` a completed transition — handy for sequencing navigation.
