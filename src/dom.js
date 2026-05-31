// @ts-check

/**
 * DOM helpers — the bridge between your separate HTML (`<template>` elements) and
 * your component classes.
 *
 * There is no magic here: `clone` is `document.importNode` made convenient, `refs`
 * is a single `querySelectorAll` collected into an object, and `$`/`$$` are typed
 * wrappers over `querySelector`/`querySelectorAll`. Importing this module has no
 * side effects — nothing touches `window`, nothing observes the document.
 *
 * The convention: write markup once in a `<template>`, `clone()` it to get a fresh
 * detached node, then `refs()` to grab the handful of elements you will update. That
 * lets a component touch only what changed instead of re-rendering its whole subtree.
 */

/**
 * `querySelector`, typed and scoped.
 *
 * @template {Element} [E=Element]
 * @param {string} selector - A CSS selector.
 * @param {ParentNode} [root=document] - Where to search. Defaults to `document`.
 * @returns {E | null} The first match, or `null`.
 */
export function $(selector, root = document) {
  return /** @type {E | null} */ (root.querySelector(selector));
}

/**
 * `querySelectorAll`, returned as a real array (not a live NodeList).
 *
 * @template {Element} [E=Element]
 * @param {string} selector - A CSS selector.
 * @param {ParentNode} [root=document] - Where to search. Defaults to `document`.
 * @returns {E[]} An array of matches (possibly empty).
 */
export function $$(selector, root = document) {
  return /** @type {E[]} */ ([...root.querySelectorAll(selector)]);
}

/**
 * Clone a `<template>`'s content and return its single root element.
 *
 * The template is expected to wrap one root element (the component's root node).
 * The returned node is a fresh, detached deep copy — clone the same template as many
 * times as you need.
 *
 * @param {string | HTMLTemplateElement} template - A `<template>` element, or a CSS selector for one.
 * @param {ParentNode} [root=document] - Where to look up the selector (ignored if a template is passed).
 * @returns {HTMLElement} A detached copy of the template's first element child.
 * @throws {Error} If no `<template>` is found, or the template has no element child.
 */
export function clone(template, root = document) {
  const tpl = typeof template === 'string' ? $(template, root) : template;
  if (!(tpl instanceof HTMLTemplateElement)) {
    const what = typeof template === 'string' ? `selector "${template}"` : 'value';
    throw new Error(`clone(): no <template> found for ${what}`);
  }
  const first = tpl.content.firstElementChild;
  if (!first) throw new Error('clone(): the <template> has no element child');
  return /** @type {HTMLElement} */ (first.cloneNode(true));
}

/**
 * Collect every `[data-ref]` descendant of `root` into a keyed object.
 *
 * `<input data-ref="email">` becomes `refs.email`. The `root` itself is included if
 * it carries a `[data-ref]`. Use this once per render to grab the nodes a component
 * needs to update later, by reference, without re-rendering everything.
 *
 * Scope it to your own template: `data-ref` is meant for a component's own markup.
 * Child components manage their own refs.
 *
 * @template {Record<string, HTMLElement>} [T=Record<string, HTMLElement>]
 * @param {Element} root - The root element to scan (typically a `clone()`d template).
 * @returns {T} An object mapping each `data-ref` value to its element.
 */
export function refs(root) {
  /** @type {Record<string, HTMLElement>} */
  const map = {};
  if (root instanceof HTMLElement && root.dataset.ref) {
    map[root.dataset.ref] = root;
  }
  for (const node of root.querySelectorAll('[data-ref]')) {
    const el = /** @type {HTMLElement} */ (node);
    const key = el.dataset.ref;
    if (key) map[key] = el;
  }
  return /** @type {T} */ (map);
}
