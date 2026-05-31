# Styling

Lumen ships **zero CSS** and imposes nothing. You bring whatever you like. Because views
render into the **Light DOM** (no Shadow DOM), any global stylesheet or utility classes
apply directly to the nodes cloned from your `<template>` — there is nothing to pierce or
configure.

## Your options

| Approach | When |
|---|---|
| **Plain CSS** + a naming convention | Simplest; total control. |
| Native **`@scope`** | Component-scoped styles without Shadow DOM and without a build. Recommended for isolation. |
| **Tailwind** (or any utility framework) | Utilities in your template markup. |
| Any CSS framework via CDN/build | It's just global CSS; Lumen doesn't get in the way. |

## Scoped styles without a build: `@scope`

`@scope` (Chrome/Edge 118+, Safari 17.4+, Firefox 2024+) gives real isolation in the Light
DOM — no Shadow DOM, no build:

```css
@scope (.card) {
  :scope { padding: 1rem; border-radius: var(--radius); }
  h3 { font-size: 1.1rem; }   /* only h3 inside .card */
}
```

Global design tokens (`:root { --radius: 8px }`) still reach everything, so theming stays simple.

## Tailwind

Write utilities right in the `<template>`; `clone` copies them and they apply because the
view is Light DOM:

```html
<template id="card">
  <div class="rounded-xl border border-slate-200 shadow-sm p-4 bg-white" data-ref="root">
    <h3 class="font-semibold" data-ref="title"></h3>
  </div>
</template>
```

```js
class Card extends View {
  static template = '#card';            // Tailwind handles the look
  onMount() { this.ui.title.textContent = this.props.title; }
}
```

No integration code is needed — Lumen manages behavior and lifecycle, Tailwind manages the look.
See the runnable [Tailwind example](../../examples/tailwind/).

For prototyping you can use the Tailwind **Play CDN** (`<script src="https://cdn.tailwindcss.com"></script>`),
which JITs in the browser with no build. For production, use Tailwind's build or a prebuilt
stylesheet.

## Third-party JS widgets (e.g. Bootstrap components)

For CSS frameworks that also ship JavaScript widgets (modals, dropdowns), instantiate the
widget in `onMount` and dispose it in `onUnmount` — Lumen's lifecycle gives you the exact
hooks:

```js
class Modal extends View {
  static template = '#modal';
  onMount()   { this.widget = new SomeLib.Modal(this.el); this.widget.show(); }
  onUnmount() { this.widget.dispose(); }   // clean teardown
}
```

## Optional: per-component styles

A view can declare a `static styles` string and inject it once if you want self-contained
components — but it is opt-in and off by default. Most apps are better served by a global
stylesheet, `@scope`, or utilities.
