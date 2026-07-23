# svg

SVG as a **third projection** of your state — alongside DOM (`View`) and canvas (`Node2D`). One `Collection` can drive a DOM legend, a canvas chart and an SVG chart at once: one source of truth, three renderers.

## Philosophy

- **SVG is retained-mode DOM — so `View` already handles it.** A view's whole lifecycle (`onMount`, `signal`, `listen`, `refs` via `data-ref`, `regions`, `animate`) runs over SVG nodes unchanged, because they *are* DOM. Hit-testing, hover, focus and accessibility come for free — no manual render loop, no `hitTest`.
- **Model-driven SVG is just `CollectionView`.** Mount the child views into a `<g data-ref="…">` inside an `<svg>` and each model gets its own SVG view, kept in sync by the same keyed reconciliation as the DOM. No `SvgLayer` — you reuse what exists.
- **The only gap is namespacing.** A whole `<svg>…</svg>` in a `<template>` parses correctly, so a `View` with an `<svg>` root works today. But a *bare* `<circle>`/`<g>` in a template lands in the wrong namespace and never renders. `svg()` closes that gap — it is to SVG what `clone` is to an HTML `<template>`.
- **The `math` generators feed SVG unchanged.** `polygonPoints`/`arcPoints`/`plotPoints` produce `[x,y][]`; `toPoints`/`toPath` turn those into `points`/`d` attributes — the same points you'd hand a canvas `Line`.

## When SVG, when canvas?

| | SVG (this module) | Canvas (`canvas`) |
|---|---|---|
| Model | Retained DOM nodes | Immediate-mode redraw |
| Interaction / a11y | Free (DOM events, `<title>`) | Manual (`hitTest`) |
| Styling / glow | CSS (`filter: drop-shadow`, classes) | Hand-painted |
| Crispness | Vector at any zoom | Raster |
| Scale ceiling | Hundreds of nodes | Thousands (particles) |

Reach for **SVG** for crisp, interactive, styleable geometry (charts, diagrams, HUDs); **canvas** when you have thousands of moving things.

## API

| Function | Description |
|---|---|
| `svg(tag, attrs?, ...children)` | Create a namespaced SVG element, set `attrs`, append children. Returns `SVGElement`. |
| `toPoints(points)` | `[x,y][]` → a `points` string (`"x,y x,y …"`) for `<polyline>`/`<polygon>`. |
| `toPath(points, closed?)` | `[x,y][]` → a path `d` string (`"M x y L x y …"`), optionally closed with `Z`. |

**`svg(tag, attrs, …children)`** — attribute values are stringified; `true` sets a bare attribute, `false`/`null`/`undefined` skip it (so `cond && svg(...)` and optional attributes just work). Children may be nodes or text, passed individually or as arrays; falsy children are skipped. Set a `data-ref` in `attrs` and `refs()` picks the node up like any other.

## Example — a bar per model, in SVG

The SVG root lives in a `<template>` (so it parses in the SVG namespace); children mount into its `<g>`:

```html
<template id="chart">
  <svg viewBox="0 0 560 280">
    <g data-ref="bars"></g>
    <polyline data-ref="trend" fill="none" stroke="#888" points="" />
  </svg>
</template>
```

```js
import { View, CollectionView, svg, toPoints } from 'lumenjs';

// each model → a <rect>, built with svg() and updated surgically
class SVGBar extends View {
  render() { return svg('rect', { rx: 3 }); }
  onMount() {
    const { model, collection } = this.props;
    const paint = () => {
      const i = collection.models.indexOf(model);
      const h = model.get('value') * 2;
      this.el.setAttribute('x', 46 + i * 96);
      this.el.setAttribute('y', 250 - h);
      this.el.setAttribute('width', 56);
      this.el.setAttribute('height', h);
      this.el.setAttribute('fill', model.color);
    };
    paint();
    model.on('change', paint, { signal: this.signal });
    this.listen(this.el, 'click', () => model.set('value', model.get('value') + 12)); // free hit-test
  }
}

class Chart extends CollectionView {
  static template = '#chart';
  static childView = SVGBar;
  static container = 'bars';
  childProps() { return { collection: this.collection }; }
}

new Chart({ collection: data }).mount(document.querySelector('#app'));
```

A `<path>`/`<polyline>` fed by `math` is one line — the same points you'd give a canvas `Line`:

```js
import { plotPoints, wave } from 'lumenjs';
import { svg, toPath } from 'lumenjs';

const curve = svg('path', {
  d: toPath(plotPoints((x) => 120 + wave(x, { freq: 1 / 140, amp: 30 }), 0, 560, 4)),
  fill: 'none', stroke: '#38e0c8', 'stroke-width': 2,
});
```

See the [`svg` example](https://dragones-tech.github.io/lumen/examples/svg/) — one `Collection` as an SVG chart **and** a DOM legend, the SVG sibling of the [canvas spike](./canvas.md).

## Design notes

- **A View that renders SVG.** Override `render()` to return `svg(...)` (a child shape), or set `static template` to a `<template>` whose root is `<svg>` (a whole diagram). Both flow through the normal lifecycle. In a type-checked project, `render()`'s base return is `HTMLElement`; an `SVGElement` is a DOM node and works at runtime — cast if your `tsc` config is strict about the return.
- **Namespacing, once.** `svg()` is the only place `createElementNS` appears. Anything you build through it — and any `data-ref` inside it — behaves like the rest of your DOM.
- **Not a wrapper over `View`.** There is no `SvgView` class, on purpose: SVG needed no new lifecycle, only a namespaced element factory. That is the whole module.
- **Watch for `id` collisions.** SVG references (`filter`, `clipPath`, `mask`, `linearGradient`, a `<use>` target…) resolve by `id` via `url(#id)`, which — like `getElementById` — picks the **first** element with that id in document order. If a DOM control shares the id (a `<button id="glow">` next to a `<filter id="glow">`), the reference silently binds to the wrong element and the effect just doesn't apply. Give SVG defs their own namespaced ids (`#glow-fx`, `#trace-mask`) so they never clash with page controls.
