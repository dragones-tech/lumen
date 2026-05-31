# animate

Promise-based animation helpers built on the native Web Animations API. These are the primitives a `View` uses to coordinate enter/leave transitions.

## Philosophy

- **Promises, not callbacks.** Every helper returns `Promise<void>` that resolves when the animation finishes. This is what makes `animateOut` possible: a `View` can `await view.animateOut()` *before* removing the node, so the leave animation always plays fully.
- **No side effects on import.** `prefers-reduced-motion` is checked lazily, per call.
- **Accessible by default.** When the user prefers reduced motion (or `duration` is `0`), helpers resolve immediately without animating.
- **Never rejects.** A cancelled animation resolves rather than throwing, so an interrupted transition can't crash an unmount.

## API

| Function | Description |
|---|---|
| `play(el, keyframes, options?)` | Run any keyframes; resolve when done. The primitive below the rest. |
| `fadeIn(el, options?)` | Opacity 0 → 1. |
| `fadeOut(el, options?)` | Opacity 1 → 0. |
| `slideIn(el, options?)` | Rise into place while fading in. |
| `slideOut(el, options?)` | Sink slightly while fading out. |

### `AnimateOptions`

| Option | Default | Description |
|---|---|---|
| `duration` | `200` | Milliseconds. `0` skips the animation. |
| `easing` | `'ease'` | A CSS easing keyword or `cubic-bezier(...)`. |
| `delay` | `0` | Milliseconds before starting. |

## Example

```js
import { fadeIn, slideOut } from 'lumenjs/animate';

// Enter: append, then play the in animation.
document.body.appendChild(el);
await fadeIn(el, { duration: 250 });

// Leave: play the out animation, THEN remove.
await slideOut(el, { duration: 200 });
el.remove();
```

Inside a `View` (module 4) this becomes:

```js
class Toast extends View {
  animateIn()  { return slideIn(this.el); }
  animateOut() { return slideOut(this.el); } // awaited before the node leaves the DOM
}
```

## Custom keyframes

`play` accepts any Web Animations keyframes, so you are never boxed in:

```js
import { play } from 'lumenjs/animate';

await play(el, [
  { transform: 'scale(0.8)', opacity: 0 },
  { transform: 'scale(1)',   opacity: 1 },
], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
```

## Design notes

- Helpers don't use `fill`/`commitStyles`: each animation's end state equals the element's natural resting style (opacity 1, no transform), so nothing needs to be pinned and no inline styles are left behind.
- `play` resolves on both fulfillment and rejection of `Animation.finished`, collapsing "finished" and "cancelled" into one safe outcome.
