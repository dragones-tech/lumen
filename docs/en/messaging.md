# Messaging between views

How independent views, models and collections talk to each other — the role Backbone's Radio
played, minus the global singleton. Create an `EventEmitter`, share it by importing it, and let
unrelated views subscribe (each with `this.signal`, so subscriptions auto-clean on unmount).
`Model` and `Collection` already emit events you subscribe to the same way.

## Two channels

The live example (a small shop) coordinates three **independent** views — a catalog, a cart
badge, and toasts — through two shared channels, with zero direct coupling:

- A shared **`Collection`** (`cart`) — its structural events (`add`/`remove`/`reset`) drive the badge.
- A shared **`EventEmitter`** (`bus`) — app-wide notifications drive the toasts.

```js
import { View, Model, Collection, EventEmitter } from 'lumenjs';

const bus  = new EventEmitter();        // app-wide notifications
const cart = new Collection([], Model); // shared cart; emits add/remove/reset

class CartBadge extends View {
  static template = '#bar';
  onMount() {
    this.update();
    cart.on('add',    this.update, { signal: this.signal });  // subscribe straight to the Collection
    cart.on('remove', this.update, { signal: this.signal });
    cart.on('reset',  this.update, { signal: this.signal });
  }
  update = () => { this.ui.count.textContent = String(cart.length); };
}

class Toasts extends View {
  static template = '#toasts';
  onMount() { bus.on('notify', this.show, { signal: this.signal }); }  // listen on the app bus
  show = ({ text }) => { /* append a transient toast */ };
}
```

A `Product` view does both at once when you click *add*: `cart.add(model)` (structural event →
the badge updates) and `bus.emit('notify', …)` (app bus → a toast appears). Neither subscriber
knows the product exists.

## No leaks, no global

- Every subscription is bound to `this.signal`, so it's removed on `unmount()` — no manual `off()`, none of Backbone Radio's classic listener leaks.
- The bus is **explicit**: you create it and share it by importing the module — not a `window`-level global, no side effects on import. For separate concerns, create separate buses.

## When to use it

- **Use a bus** for *cross-cutting, decoupled* reactions: notifications, a theme switch, an "unsaved changes" indicator — things many unrelated views care about.
- **Don't** reach for it for local parent↔child talk: pass a callback in `props`, or use the child's own `events` emitter. A global bus for everything recreates the "who's listening?" tangle Lumen exists to avoid.

See [event-emitter](event-emitter.md), [model](model.md) and [collection](collection.md).
