// @ts-check

/**
 * The one missing brick for **SVG as a third projection** of your state.
 *
 * SVG is retained-mode DOM, so a `View` already runs its whole lifecycle over SVG nodes —
 * `signal`, `listen`, `refs` (via `data-ref`), regions and `animate` all work unchanged — and a
 * `CollectionView` already projects a `Collection` into an `<svg>` (mount the children into a
 * `<g data-ref="…">`). One `Collection` can feed a DOM legend, a canvas chart and an SVG chart at
 * once: one source of truth, three projections.
 *
 * The single gap the platform leaves is **namespacing**. A whole `<svg>…</svg>` inside a
 * `<template>` parses correctly, so a `View` with an `<svg>` root works today. But a *bare*
 * `<circle>`/`<g>` in a template is parsed as an unknown HTML element (wrong namespace) and never
 * renders — so per-shape child views must build their node with `createElementNS`. That is exactly
 * what {@link svg} does: it is to SVG what `clone` is to an HTML `<template>` — the bridge that
 * turns markup intent into a live node.
 *
 * Importing this module has no side effects.
 */

/** The SVG namespace URI — the reason a bare `<circle>` in a `<template>` won't render. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an SVG element in the correct namespace, set its attributes, and append its children —
 * the SVG-namespace counterpart of `clone`. Use it inside a view's `render()` to build a shape
 * (`return svg('rect', { width: 40, height: h, fill })`) or to assemble a small tree.
 *
 * - **Attributes** come from `attrs`: values are stringified; `true` sets a bare attribute; `false`
 *   / `null` / `undefined` skip it. Set a `data-ref` here and `refs()` picks the node up as usual.
 * - **Children** may be nodes or strings (text), passed individually or as arrays; falsy children
 *   are skipped, so conditional content (`cond && svg(...)`) just works.
 *
 * ```js
 * const bar = svg('g', { 'data-ref': 'bar', transform: `translate(${x},0)` },
 *   svg('rect', { width: 40, height: h, rx: 3, fill }),
 *   label && svg('text', { y: -6, 'text-anchor': 'middle' }, label),
 * );
 * ```
 *
 * @param {string} tag - An SVG tag name, e.g. `'rect'`, `'circle'`, `'path'`, `'g'`, `'svg'`.
 * @param {Record<string, string | number | boolean | null | undefined>} [attrs] - Attribute map.
 * @param {...(Node | string | null | undefined | false | Array<Node | string>)} children - Child nodes/text.
 * @returns {SVGElement}
 */
export function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(/** @type {Node | string} */ (child));
  }
  return el;
}

/**
 * Turn a math `[x, y][]` point list into a `points` attribute string (`"x,y x,y …"`) for a
 * `<polyline>` or `<polygon>`. The SVG counterpart of feeding the same points to a canvas `Line` —
 * so `circlePoints`/`polygonPoints`/`plotPoints` from `math` draw on SVG unchanged.
 * @param {[number, number][]} points
 * @returns {string}
 */
export function toPoints(points) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

/**
 * Turn a math `[x, y][]` point list into a path `d` string (`"M x y L x y …"`), optionally
 * `closed` with a trailing `Z`. Pair it with `plotPoints`/`arcPoints` to stroke a curve as a
 * `<path>`. Returns `''` for an empty list.
 * @param {[number, number][]} points
 * @param {boolean} [closed=false]
 * @returns {string}
 */
export function toPath(points, closed = false) {
  if (!points.length) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i][0]} ${points[i][1]}`;
  return closed ? d + ' Z' : d;
}
