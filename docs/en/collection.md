# Collection

An ordered list of `Model`s with structural events. It pairs with `CollectionView`
(module 7), which renders one view per model.

## Philosophy

- **Mutations are announced.** `add`, `remove` and `reset` change the list and emit an event.
- **Queries never mutate.** `find`, `where`, `filter`, `map` and `sort` return results and leave the collection's contents and order untouched. (The old framework's `find`/`where`/`sort` *overwrote* the visible list as a side effect of querying — this fixes that trap.)
- **Local reactions.** Per-model changes aren't bubbled here; in a `CollectionView` each model gets its own view subscribed to its own model, so reactions stay granular.

## Events

| Event | Payload | When |
|---|---|---|
| `add` | `{ model, index, collection }` | A model was appended. |
| `remove` | `{ model, index, collection }` | A model was removed. |
| `reset` | `{ models, collection }` | The whole list was replaced. |

## API

| Member | Description |
|---|---|
| `new Collection(items?, Model?)` | Wrap plain data with `Model` (a subclass), or pass `Model` instances. |
| `length` / `at(i)` / `get(id)` | Size, index access, lookup by `id` attribute. |
| `add(item)` | Append (wrapping data). Emits `add`. Returns the model. |
| `remove(model)` | Remove. Emits `remove`. No-op if absent. |
| `reset(items?)` | Replace all. Emits `reset`. |
| `find(fn)` | First match, or `undefined`. |
| `where(attrs)` | New array of models matching all attributes. |
| `filter(fn)` / `map(fn)` / `forEach(fn)` | Standard, non-mutating. |
| `sort(compare)` | A **sorted copy** — does not reorder the collection. |
| `on/once/off(event, handler, { signal? })` | Subscribe / unsubscribe. |
| `toJSON()` | Array of each model's data. |
| `for…of` | Iterates the models. |

## Example

```js
import { Collection } from 'lumenjs/collection';
import { Model } from 'lumenjs/model';

class Todo extends Model {}

const todos = new Collection([
  { id: 1, text: 'a', done: true },
  { id: 2, text: 'b', done: false },
], Todo);

todos.on('add',    ({ model }) => console.log('added', model.get('text')));
todos.on('remove', ({ model }) => console.log('removed', model.get('text')));

todos.add({ id: 3, text: 'c', done: false });

// Queries return results WITHOUT changing the collection's order:
todos.where({ done: false });                       // [model b, model c]
todos.sort((a, b) => a.get('text') < b.get('text') ? -1 : 1); // a sorted COPY
todos.map((m) => m.get('text'));                    // still ['a','b','c'] — unchanged
```

## Type it

```js
/** @typedef {{ id: number, text: string, done: boolean }} TodoData */
/** @type {Collection<TodoData, Todo>} */
const todos = new Collection([], Todo);
```

## Design notes

- `sort` returns a copy rather than sorting in place, so a query can never reorder what observers see. To present a different order, render from the returned array (or, later, feed it to a `CollectionView`).
- Built on `EventEmitter`; subscriptions accept an `AbortSignal`, so a view can subscribe with `this.signal` and clean up on unmount.
- `add`/`remove` carry the `index`, which `CollectionView` will use to insert or remove a single child view without rebuilding the list.
