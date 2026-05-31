# Region

Manages a single DOM slot that holds at most one `View` at a time, with an animated swap.

## Philosophy

- **Ordered transitions.** `show(view)` plays the current view's `animateOut()` to completion, unmounts it, then mounts the new view and plays its `animateIn()`. Out, then in — predictable.
- **What Custom Elements can't do.** Because a `View` is a plain class, the region controls removal timing, so the leave animation always finishes before the node goes. A Custom Element's `disconnectedCallback` fires only *after* removal.
- **The base for navigation.** Point a region at an "outlet" element and call `show()` as routes change. The router (module 9) is built on this.

## API

| Member | Description |
|---|---|
| `new Region(target)` | `target` is an element or a CSS selector for the slot. |
| `el` | The slot element. |
| `current` | The view currently shown, or `null`. |
| `show(view)` | Animated swap. Returns `Promise<view>` (resolves after the entrance). No-op if already current. |
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

## Named regions in a layout

A layout usually has several regions (header, sidebar, main, modal). You don't create them
by hand — declare them on a `View` with `static regions` and each is created and emptied
for you, cascading through nested layouts. See [View → Regions (layouts)](view.md). The
example below is a nested layout built that way.

## Design notes

- `show` awaits `unmount()` (which awaits `animateOut`) before mounting the next view, so transitions never overlap. If you want a crossfade, mount into two stacked regions instead.
- A region holds exactly one view; for lists use `CollectionView`.
- `show` returning the view (after `animateIn`) lets callers `await` a completed transition — handy for sequencing navigation.
