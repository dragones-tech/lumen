# AGENTS.md — building with Lumen

Conventions for AI coding agents (Codex, Claude, Cursor, …) working in this repo or
generating apps that use **Lumen**. Full API: [`llms-full.txt`](https://dragones-tech.github.io/lumen/llms-full.txt).

## What Lumen is

A transparent, no-magic, no-build vanilla-JS OOP UI framework (lineage: Backbone +
Marionette). Native ES modules, plain classes, separate HTML in `<template>`, JSDoc types,
zero runtime dependencies.

## Hard rules

- **OOP-first.** A *view* is a class that `extends View`. Never model a view as a factory function. Stateless helpers (`clone`, `refs`, `fadeIn`, rule factories) are functions — that's fine.
- **No build.** Native ES modules only. Do not add a bundler, JSX, or a transpile step. Serve as static files.
- **No magic.** No global singletons, no side effects on import, no hidden proxies. State changes are explicit (`model.set(...)`), updates are surgical (touch `this.ui.*`) — never re-render the whole view.
- **HTML in `<template>`.** Markup lives in `<template id="…">`; the view's `static template = '#id'`. Reference nodes with `data-ref="name"` → `this.ui.name`.
- **Style-agnostic.** Ship no CSS assumptions; plain CSS / `@scope` / Tailwind are all fine.
- **Types via JSDoc.** Annotate with JSDoc; check with `npm run check` (`tsc --noEmit`). No `.ts` files.
- **Cleanup via signal.** Bind listeners with `this.listen(...)` or `{ signal: this.signal }`; they auto-remove on unmount.

## Cheat-sheet

```js
import { View, Model, Collection, CollectionView, Region, Router,
         Http, I18n, defineElement, required, email } from '@dragones-tech/lumenjs';

class Todo extends Model { static rules = { text: [required()] }; }

class TodoItem extends View {
  static template = '#todo-item';
  onMount() {
    this.ui.text.textContent = this.props.model.get('text');
    this.listen(this.ui.remove, 'click', this.remove);
  }
  remove = () => this.props.onRemove(this.props.model);
  animateIn()  { return slideIn(this.el); }
  animateOut() { return slideOut(this.el); }
}

class TodoList extends CollectionView {
  static template = '#todo-list';
  static childView = TodoItem;
  static container = 'list';
  childProps(model) { return { onRemove: (m) => this.collection.remove(m) }; }
}
```

- **View** lifecycle: `onCreate` (once) → `onMount` (each mount) → `onUnmount`; `animateIn`/`animateOut` return Promises. `static regions = { main: 'dataRefName' }` for layouts (`this.regions.main.show(view)`), cleaned up in cascade.
- **Model**: `get`/`set`, emits `change:<key>` and `change`; `validate()` against `static rules`; `isValid()`.
- **Collection**: `add`/`remove`/`reset` (events); `find`/`where`/`sort` are non-mutating.
- **Region**: `show(view)` animates the old out, then mounts the new. `empty()`.
- **Router**: `new Router().add('/users/:id', ({id}) => region.show(...)).start()` — hash mode by default.
- **Http**: `new Http({baseURL}).get('/x', { signal: this.signal })`; throws `HttpError` on non-2xx.
- **defineElement(tag, ViewClass)**: expose a View as `<tag>` (interop only — `animateOut` won't play on removal).

## Handler styles (any is fine)

```js
// 1) auto-bound arrow field        2) bound once in onCreate        3) wiring arrow
onClick = () => {...}                this.onClick = this.onClick.bind(this)   () => this.onClick()
```
Never pass an unbound method reference (`this.listen(el,'click',this.onClick)`) — `this` is lost.

## Commands

```bash
npm run check     # type-check (JSDoc via tsc --noEmit)
npm run llms      # regenerate llms.txt / llms-full.txt after editing docs
npm run serve   # zero-dep Node static server with live reload (examples at /examples, docs site at /site)
```
