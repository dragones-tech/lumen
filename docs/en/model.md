# Model

Observable data for a single entity (a user, a todo, a setting). It pairs with
`Collection` (a list of models, module 6).

## Philosophy

- **Explicit state.** Read with `get`, write with `set`. `set` emits events; direct mutation of `model.data.x` does **not** notify — on purpose, so every notification has a visible cause. No proxies, no hidden interception.
- **Granular, not total.** A change emits `change:<key>`, so a view updates only the node that changed. There is no forced full re-render (the old framework re-rendered the whole view on any change).
- **No crashes on new keys.** Setting a key that wasn't in the initial data is fine. (The old `AbstractModel` threw a `TypeError` in this case.)
- **No-op on equal values.** `set` compares with strict `!==` and stays silent when nothing actually changed.

## Events

| Event | Payload | When |
|---|---|---|
| `change:<key>` | `{ value, previous, model }` | A specific attribute changed. |
| `change` | `{ keys, model }` | Once per `set`, listing the changed keys. |

## API

| Method | Description |
|---|---|
| `new Model(data)` | Create with initial attributes (copied, not referenced). |
| `get(key)` / `get('a.b.c')` | Read an attribute, or a nested value by dot-path (missing branch → `undefined`). |
| `set(key, value)` / `set('a.b.c', value)` / `set(patch)` | Write one attribute, a nested dot-path (immutable, creates missing branches), or merge a partial object. Returns `this`. |
| `on(event, handler, { signal? })` | Subscribe. Returns an unsubscribe function. |
| `once(event, handler, { signal? })` | Subscribe for a single emission. |
| `off(event, handler)` | Unsubscribe. |
| `isDirty(key?)` | Whether attributes differ from the last committed baseline (unsaved edits). With a `key`, checks just that attribute. |
| `changedKeys()` | The attribute names that differ from the baseline. |
| `changes()` | A `{ key: { value, baseline } }` map of every changed attribute (`{}` = clean). |
| `commit()` | Adopt the current attributes as the new clean baseline (call after a save). Returns `this`. |
| `revert(key?)` | Discard unsaved edits back to the baseline — fires `change` events. With a `key`, reverts just that attribute. Returns `this`. |
| `validate()` | Validate the attributes against `static rules`. Returns errors keyed by field (`{}` = valid). |
| `isValid()` | Whether the attributes pass validation. |
| `toJSON()` | A shallow copy of the attributes. |

## Example: one model, observed surgically

```js
import { Model } from 'lumenjs/model';

const profile = new Model({ name: 'Ada', color: '#2563eb' });

// A view subscribes with its signal, so this cleans up on unmount,
// and updates ONLY the node that changed.
profile.on('change:name',  ({ value }) => badge.textContent = value, { signal: view.signal });
profile.on('change:color', ({ value }) => badge.style.color = value, { signal: view.signal });

profile.set('name', 'Grace');   // fires change:name + change
profile.set('name', 'Grace');   // no-op — value unchanged, silent
profile.set({ color: '#dc2626', role: 'admin' }); // new key 'role' is fine
```

## Using a model inside a View

Subscribe in `onMount` with `this.signal`:

```js
class Badge extends View {
  static template = '#badge';
  onMount() {
    const { model } = this.props;
    const paint = () => {
      this.ui.name.textContent = model.get('name');
      this.ui.name.style.color = model.get('color');
    };
    paint();
    model.on('change', paint, { signal: this.signal }); // auto-removed on unmount
  }
}
```

## Type your data

```js
/** @type {Model<{ name: string, color: string }>} */
const profile = new Model({ name: 'Ada', color: '#2563eb' });
profile.get('name'); // string
```

## Validation

A model is the single source of truth for whether its data is valid. Declare `static rules`
and call `validate()`; the UI renders the returned errors. See the [validation guide](validate.md).

```js
import { Model, required, email } from 'lumenjs';

class User extends Model {
  static rules = { email: [required(), email()] };
}
new User({ email: 'bad' }).validate(); // { email: ['must be a valid email'] }
```

## Nested attributes — dot-paths

API responses are rarely flat. When your JSON nests (`{ user: { address: { city } } }`),
read and write deep with a **dot-path** instead of pulling the branch out by hand:

```js
const m = new Model({ user: { name: 'Ada', address: { city: 'London' } } });

m.get('user.name');             // 'Ada'
m.get('user.address.city');     // 'London'
m.get('user.phone.work');       // undefined — a missing branch never throws
m.get('tags.0');                // array indices work too

m.set('user.address.city', 'Oslo');   // writes deep
m.set('user.contact.email', 'a@x.io'); // creates the missing `contact` branch
```

**Writes are immutable.** `set` clones every branch along the path (and creates any missing
one), so the top-level reference changes and the usual `!==` change-detection still fires —
untouched siblings keep their identity. The event is keyed to the **root** of the path:

```js
m.on('change:user', ({ value }) => render(value));  // fires for ANY edit under `user`
m.set('user.address.city', 'Oslo');                 // → change:user + change
```

So a view observes the whole branch it cares about (`change:user`) without subscribing to a
combinatorial set of deep paths. Because writes are immutable, [dirty tracking](#dirty-tracking--unsaved-edits)
works through nesting unchanged — `revert()` restores the deep value, `commit()` re-baselines it.

> Dot-paths apply to the `get(path)` / `set(path, value)` forms. Keys of a **patch object**
> (`set({ 'a.b': 1 })`) are taken **literally** — that creates a key named `'a.b'`, by design.

## Dirty tracking — unsaved edits

A model remembers a **baseline**: its last committed clean state. Editing makes it *dirty*;
`commit()` adopts the current values as the new baseline; `revert()` throws the edits away.
Nothing is bookkept inside `set` — dirtiness is derived by comparison, so it stays honest.

```js
const draft = new Model({ title: 'Untitled', body: '' });

draft.isDirty();            // false — matches baseline
draft.set('title', 'Lumen 1.0');
draft.isDirty();            // true
draft.isDirty('body');     // false — only `title` changed
draft.changes();           // { title: { value: 'Lumen 1.0', baseline: 'Untitled' } }

draft.revert();            // restore baseline — fires change:title, so views update surgically
draft.isDirty();           // false

// After a successful save, make the current values the new clean baseline:
await api.save(draft.toJSON());
draft.commit();            // isDirty() === false again, no events emitted
```

This is exactly what a form needs: enable the **Save** button only `while (model.isDirty())`,
wire **Discard** to `revert()`, and `commit()` once the server confirms. Because `revert()`
goes through `set`, every observing view reacts through the same `change` path as any edit.

## Design notes

- Notification carries `previous` and `value`, so observers can diff without keeping their own copy.
- `change` fires once per `set`, even for a multi-key patch, so a "something changed, recompute" listener runs a single time.
- Built directly on `EventEmitter`; subscriptions accept an `AbortSignal`, which is what makes the View integration leak-free.
