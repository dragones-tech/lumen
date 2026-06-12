# Collection

An ordered list of `Model`s with structural events. It pairs with `CollectionView`
(module 7), which renders one view per model.

## Philosophy

- **Mutations are announced.** `add`, `remove` and `reset` change the list and emit an event.
- **Queries never mutate.** `find`, `where`, `filter`, `map` and `sort` return results and leave the collection's contents and order untouched. (The old framework's `find`/`where`/`sort` *overwrote* the visible list as a side effect of querying — this fixes that trap.)
- **Changes bubble.** A model's `change` re-emits as a collection-level `change` — react to "anything in the list changed" without a sub-view per row. Subscriptions are managed for you (added on `add`/`reset`, dropped on `remove`/`reset`), so removed models leak nothing. For per-row UI, prefer a `CollectionView` — each model gets its own view subscribed to its own model, keeping reactions granular.

## Events

| Event | Payload | When |
|---|---|---|
| `add` | `{ model, index, collection }` | A model was appended. |
| `remove` | `{ model, index, collection }` | A model was removed. |
| `reset` | `{ models, collection }` | The whole list was replaced. |
| `change` | `{ model, keys, collection }` | A model in the list changed (bubbled). `keys` are the changed attributes. |

## API

| Member | Description |
|---|---|
| `new Collection(items?, Model?)` | Wrap plain data with `Model` (a subclass), or pass `Model` instances. |
| `length` / `at(i)` / `get(id)` | Size, index access, **O(1)** lookup by `id` attribute (indexed). |
| `add(item)` | Append (wrapping data). Emits `add`. Returns the model. |
| `remove(model)` | Remove. Emits `remove`. No-op if absent. |
| `reset(items?)` | Replace all. Emits `reset`. |
| `find(fn)` | First match, or `undefined`. |
| `where(attrs)` | New array of models matching all attributes. |
| `filter(fn)` / `map(fn)` / `forEach(fn)` | Standard, non-mutating. |
| `sort(compare)` | A **sorted copy** — does not reorder the collection. |
| `isDirty()` / `changed()` | Whether any model has unsaved edits / the array of models that do. |
| `commitAll()` / `revertAll()` | `commit()` / `revert()` every model (batch save / discard). Returns `this`. |
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

// `change` bubbles from any model — handy for a "Save all" button or a live total:
todos.on('change', ({ model, keys }) => console.log(model.get('id'), 'changed', keys));
todos.at(0).set('done', false);                     // → change { model: a, keys: ['done'] }

todos.add({ id: 3, text: 'c', done: false });

// Queries return results WITHOUT changing the collection's order:
todos.where({ done: false });                       // [model b, model c]
todos.sort((a, b) => a.get('text') < b.get('text') ? -1 : 1); // a sorted COPY
todos.map((m) => m.get('text'));                    // still ['a','b','c'] — unchanged
```

## Editable list — aggregate dirty tracking

Building on each model's [dirty tracking](model.md#dirty-tracking--unsaved-edits) and the bubbled
`change`, the collection answers "does the whole list have unsaved edits?" and saves/discards in
batch — exactly what an editable table needs:

```js
todos.isDirty();        // true if ANY model has unsaved edits
todos.changed();        // the models that changed — for per-row markers

// One handler keeps the Save-all button honest as the user edits or discards:
todos.on('change', () => saveAllBtn.disabled = !todos.isDirty());

todos.revertAll();      // discard — each revert bubbles change, so the button updates
await api.saveAll(todos.toJSON());
todos.commitAll();      // re-baseline the whole list — isDirty() is false again
```

`revertAll()` reverts through each model's `set`, so it bubbles `change` and views react;
`commitAll()` emits nothing (no observable value changed) — recompute right after the call.

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
- `change` bubbling uses one shared handler reference subscribed to each model, so the collection drops a removed model's subscription with a single `off` — no per-model bookkeeping, no leaks.
- `get(id)` is **O(1)**: the collection keeps an `id → model` index in sync with `add`/`remove`/`reset` (first-wins, matching `find` order) and rebuilds it if a model changes its own `id`. Models without an `id` simply aren't indexed.
