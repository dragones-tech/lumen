# defineElement (Custom Element adapter)

Register a `View` as a Custom Element, so it can be used as `<tag-name>` in plain HTML
— or consumed inside React/Vue/Angular. This is the **escape hatch** for distributing a
widget; your class stays a normal `View`.

## Why an adapter (and not Custom Elements everywhere)

Lumen views are plain classes by default precisely so you keep control of the lifecycle —
e.g. `animateOut()` can finish before a node is removed. Custom Elements can't do that
(`disconnectedCallback` fires *after* removal). So Lumen inverts the usual choice: classes by
default, Custom Element only when you need interop — via this thin adapter.

## API

```js
defineElement(tagName, ViewClass, { attributes? })
```

| Param | Description |
|---|---|
| `tagName` | A custom element name (must contain a hyphen), e.g. `'hello-widget'`. |
| `ViewClass` | The `View` subclass to wrap. |
| `options.attributes` | Attribute names to keep synced into `props` after mount (`observedAttributes`). |

## Example

```js
import { View, defineElement } from 'lumenjs';

class Hello extends View {
  static template = '#hello';
  onMount() { this.ui.name.textContent = this.props.name; }
}

defineElement('hello-widget', Hello);
```

```html
<hello-widget name="Ada"></hello-widget>
<hello-widget name="Grace"></hello-widget>   <!-- independent instances -->
```

- **Attributes → props.** On connect, every attribute is read into `props` (string values).
- **Complex data → `.props`.** For objects or callbacks, set the element's `.props` property before inserting it: `el.props = { onSave }`.
- **Lifecycle.** Connect mounts the view into the host; disconnect unmounts it (cleanup runs).

## Caveat: no leave animation

The browser removes the node *before* `disconnectedCallback`, so `animateOut()` cannot play
when the host element is removed — cleanup (signal abort, `onUnmount`) still runs. This is
the exact limitation that keeps plain classes the default; the adapter is for interop, where
leave-animations aren't expected.

## Design notes

- `element.js` imports nothing — it wraps any object with `mount`/`unmount`/`props` (duck-typed), so it adds no coupling to the framework graph.
- `defineElement` is idempotent (a second call for the same tag is a no-op).
