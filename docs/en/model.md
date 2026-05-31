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
| `get(key)` | Read an attribute. |
| `set(key, value)` / `set(patch)` | Write one attribute or merge a partial object. Returns `this`. |
| `on(event, handler, { signal? })` | Subscribe. Returns an unsubscribe function. |
| `once(event, handler, { signal? })` | Subscribe for a single emission. |
| `off(event, handler)` | Unsubscribe. |
| `validate()` | Validate the attributes against `static rules`. Returns errors keyed by field (`{}` = valid). |
| `isValid()` | Whether the attributes pass validation. |
| `toJSON()` | A shallow copy of the attributes. |

## Example: one model, observed surgically

```js
import { Model } from 'lumen/model';

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
import { Model, required, email } from 'lumen';

class User extends Model {
  static rules = { email: [required(), email()] };
}
new User({ email: 'bad' }).validate(); // { email: ['must be a valid email'] }
```

## Design notes

- Notification carries `previous` and `value`, so observers can diff without keeping their own copy.
- `change` fires once per `set`, even for a multi-key patch, so a "something changed, recompute" listener runs a single time.
- Built directly on `EventEmitter`; subscriptions accept an `AbortSignal`, which is what makes the View integration leak-free.
