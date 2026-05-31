# CollectionView

Renders one child `View` per model in a `Collection`, and keeps them in sync through
**keyed reconciliation**.

> **A `Collection` is best used with a `CollectionView`.** The collection is the data
> layer — it holds models and announces structural changes. The `CollectionView` is what
> turns that into UI: it maps each model to a view and reacts to `add`/`remove`/`reset`
> by mounting or unmounting only the affected child. Using a collection without a
> `CollectionView` means re-rendering lists by hand; pairing them is the intended path.

## Philosophy

- **Incremental, not rebuilt.** On `add`, one child mounts (with its `animateIn`); on `remove`, one child unmounts (its `animateOut` plays first); siblings are never touched. (The old framework recreated every child on each render — and broke on the second pass.)
- **Keyed.** A `Map` from model → child view is the index, so the right child is found in O(1) for removal.
- **Composed from the parts you know.** It is a `View` subclass; children are tracked via `addChild`, so unmounting the list cascades to every child and cleans up.

## Configure with statics

| Static | Required | Description |
|---|---|---|
| `childView` | yes | The `View` subclass to instantiate per model. |
| `template` | no | A `<template>`; children mount into the `container` ref (or the root). |
| `container` | no | The `data-ref` name of the element children mount into. Default: the root element. |
| `tag` | no | When there is no `template`, the tag of the auto-created root. Default `'div'`. |

Pass the collection as a prop: `new TodoList({ collection })`. Each child view receives
`{ model }` plus anything you return from `childProps(model)`.

## Example

```html
<template id="todo-list">
  <div>
    <form data-ref="form"><input data-ref="input" placeholder="New todo…" /></form>
    <ul data-ref="items"></ul>
  </div>
</template>
<template id="todo-item">
  <li><label><input type="checkbox" data-ref="check"> <span data-ref="text"></span></label>
      <button data-ref="remove">×</button></li>
</template>
```

```js
import { Collection, Model, View, CollectionView, slideIn, slideOut } from 'lumen';

class Todo extends Model {}

class TodoItem extends View {
  static template = '#todo-item';
  onMount() {
    const { model } = this.props;
    this.ui.text.textContent = model.get('text');
    this.ui.check.checked = model.get('done');
    this.listen(this.ui.check, 'change', this.toggle);
    this.listen(this.ui.remove, 'click', this.remove);
  }
  toggle = () => this.props.model.set('done', this.ui.check.checked);
  remove = () => this.props.onRemove();           // provided by the list's childProps
  animateIn()  { return slideIn(this.el); }
  animateOut() { return slideOut(this.el); }
}

class TodoList extends CollectionView {
  static template  = '#todo-list';
  static childView = TodoItem;
  static container = 'items';                      // children mount into ui.items
  onMount() {
    super.onMount();                               // sets up reconciliation
    this.listen(this.ui.form, 'submit', this.onSubmit);
  }
  onSubmit = (e) => {
    e.preventDefault();
    const text = this.ui.input.value.trim();
    if (text) this.collection.add({ text, done: false });
    this.ui.input.value = '';
  };
  childProps(model) {
    return { onRemove: () => this.collection.remove(model) };
  }
}

const todos = new Collection([], Todo);
new TodoList({ collection: todos }).mount(document.body);
```

Adding a todo appends a model → the list mounts one new `TodoItem` (sliding in). Removing
calls `collection.remove` → the list unmounts that one child (sliding out first). Nothing
else re-renders.

## Design notes

- `CollectionView` overrides `View.render()` to clone `template` or create a `tag` element; everything else (lifecycle, cascade unmount, signal cleanup) is inherited.
- Subscriptions to the collection use `this.signal`, so they are removed when the list unmounts.
- `childProps(model)` is the seam for passing per-child callbacks or shared dependencies without coupling the child to the collection.
- The collection currently appends on `add`, so children append in order. Reordering is a query (`sort` returns a copy) and does not emit, so the rendered order follows insertion; render from a sorted array if you need a different order.
