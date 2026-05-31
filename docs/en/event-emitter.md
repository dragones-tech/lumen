# EventEmitter

A tiny, typed, leak-free event emitter. It is the foundation of messaging in Lumen.

## Philosophy

- **No global singleton.** You create emitters with `new` and pass them around explicitly. Importing the module has *no side effects* — nothing is registered, nothing touches `window`.
- **Symmetric cleanup.** Every `on()` returns an unsubscribe function. You can also pass an `AbortSignal`, so aborting one controller removes every listener bound to it at once. (This is how `View` will tear listeners down on unmount, without leaks.)
- **Safe by default.** `off()` on an event that was never registered is a no-op, not a crash.

## API

| Method | Returns | Description |
|---|---|---|
| `on(event, handler, { signal? })` | `() => void` | Subscribe. Returns an unsubscribe function. |
| `once(event, handler, { signal? })` | `() => void` | Subscribe for a single emission, then auto-remove. |
| `off(event, handler)` | `void` | Remove a specific handler. No-op if absent. |
| `emit(event, payload)` | `void` | Call every handler synchronously with `payload`. |
| `clear(event?)` | `void` | Remove all handlers for `event`, or all events if omitted. |
| `listenerCount(event)` | `number` | How many handlers are registered for `event`. |

## Typing your events

Pass an events map as the generic to get autocomplete and payload checking:

```js
/** @typedef {{ 'todo:add': { text: string }, 'todo:clear': void }} TodoEvents */

/** @type {EventEmitter<TodoEvents>} */
const bus = new EventEmitter();

bus.on('todo:add', (p) => console.log(p.text)); // p is { text: string }
bus.emit('todo:add', { text: 'milk' });          // payload checked
```

For events with no data, type the payload as `void` and pass `undefined`.

## Example

```js
import { EventEmitter } from 'lumenjs/event-emitter';

const bus = new EventEmitter();

// Subscribe; keep the unsubscribe handle.
const off = bus.on('ping', (n) => console.log('ping', n));
bus.emit('ping', 1); // logs: ping 1
off();
bus.emit('ping', 2); // nothing — already unsubscribed

// Group cleanup with an AbortController.
const ac = new AbortController();
bus.on('tick', () => console.log('tick'), { signal: ac.signal });
bus.on('tock', () => console.log('tock'), { signal: ac.signal });
ac.abort(); // removes BOTH listeners at once
```

## Design notes

- Handlers are stored in a `Map<string, Set<Function>>`. The `Set` dedupes the same handler reference and makes `off()` O(1).
- `emit()` iterates over a **copy** of the handler set, so a handler may call `on()`/`off()` during emission without disturbing the current pass.
- This replaces the old framework's `eventing` package, fixing two bugs: the global frozen singleton (now instantiable) and `off()` throwing when the event was never registered (now guarded).
