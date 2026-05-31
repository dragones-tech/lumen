# dom

DOM helpers — the bridge between your separate HTML (`<template>` elements) and your component classes.

## Philosophy

- **No magic.** `clone` is a convenient deep-clone of a `<template>`, `refs` is one `querySelectorAll` collected into an object, `$`/`$$` are typed wrappers. Importing the module has **no side effects** — nothing touches `window`, nothing observes the document. (The old framework installed a global `window.createElement` and a document-wide `MutationObserver` on import; Lumen does neither.)
- **The pattern:** write markup once in a `<template>` → `clone()` a fresh node → `refs()` the elements you'll update. A component then touches only what changed, instead of re-rendering its whole subtree.

## API

| Function | Returns | Description |
|---|---|---|
| `$(selector, root?)` | `Element \| null` | `querySelector`, typed and scoped (default root `document`). |
| `$$(selector, root?)` | `Element[]` | `querySelectorAll` as a real array, not a live NodeList. |
| `clone(template, root?)` | `HTMLElement` | Deep-clone a `<template>`'s single root element. Accepts a `<template>` or a selector. |
| `refs(root)` | `Record<string, HTMLElement>` | Collect every `[data-ref]` descendant into a keyed object. |

## Conventions

- **One root per template.** `clone()` returns the template's first element child. Wrap each component's markup in a single root element.
- **`data-ref` for references.** `<button data-ref="save">` → `refs.save`. The root element is included if it has a `data-ref`. `data-ref` is for a component's *own* markup — child components manage their own.

## Example

```html
<template id="card">
  <article class="card">
    <h2 data-ref="title"></h2>
    <button data-ref="save">Save</button>
  </article>
</template>
```

```js
import { clone, refs } from 'lumen/dom';

const el = clone('#card');          // fresh detached <article>
const ui = refs(el);                // { title, save }

ui.title.textContent = 'Hello';
ui.save.onclick = () => console.log('saved');

document.body.appendChild(el);
```

Typing the refs map (optional) gives you autocomplete:

```js
/** @type {{ title: HTMLElement, save: HTMLButtonElement }} */
const ui = refs(el);
```

## Design notes

- `$$` spreads the NodeList into an array so you can `map`/`filter` directly and so it is not live.
- `clone` throws a clear error if the template is missing or empty — failures are loud, not silent.
- `clone` deliberately returns a single element (not a fragment): a component's root is one node, which makes `mount`/`unmount` and animations straightforward.
- No `el()`/hyperscript helper is included by default — markup lives in `<template>`. One can be added later if a use case needs purely programmatic nodes.
