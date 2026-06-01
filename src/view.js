// @ts-check
import { clone, refs } from './dom.js';
import { EventEmitter } from './event-emitter.js';
import { Region } from './region.js';

/**
 * The abstract base class for everything you see. **A view is a class; you extend
 * this one.** It wraps the `dom` primitives (`clone` + `refs`), an explicit lifecycle,
 * and leak-free cleanup — so you never wire that plumbing by hand.
 *
 * It is a plain class, NOT a Custom Element. That is deliberate: you keep full control
 * of the lifecycle, so `animateOut()` can finish *before* the node leaves the DOM
 * (a Custom Element's `disconnectedCallback` only fires after removal).
 *
 * ### Minimal view
 * ```js
 * class Hello extends View {
 *   static template = '#hello';      // a <template> selector
 *   onMount() { this.ui.name.textContent = this.props.name; }
 * }
 * await new Hello({ name: 'Ada' }).mount(document.body);
 * ```
 *
 * ### Lifecycle, in order
 * 1. `new View(props)` — cheap; nothing is built or touched yet.
 * 2. `build()` (called by `mount`) — `render()` makes `el`, `refs()` fills `ui`, then `onCreate()`. Runs once.
 * 3. `mount(parent)` — inserts `el`, sets `mounted`, calls `onMount()`, awaits `animateIn()`.
 * 4. `unmount()` — awaits `animateOut()`, unmounts children, calls `onUnmount()`, aborts `signal`, removes `el`.
 *
 * Updates are manual and surgical: change the nodes in `this.ui` directly. There is no
 * full re-render, so focus, scroll and input state are never lost.
 *
 * To type `this.ui`, extend with a generic (see docs/en/view.md for the exact form).
 *
 * @template {Record<string, HTMLElement>} [Refs=Record<string, HTMLElement>]
 */
export class View {
  /**
   * A `<template>` selector (e.g. `'#card'`) or element used by the default `render()`.
   * Subclasses set this, or override `render()` to build the node another way.
   * @type {string | HTMLTemplateElement | null}
   */
  static template = null;

  /**
   * Declarative named regions for layouts: a map of region name → the `data-ref` of its
   * slot element. Declared regions are created on `build()` (as `this.regions.<name>`)
   * and emptied automatically on `unmount()`, so nested layouts tear down in cascade.
   * @type {Record<string, string> | null}
   */
  static regions = null;

  /**
   * @param {Record<string, any>} [props] - Arbitrary data/handlers passed in by the parent.
   */
  constructor(props = {}) {
    /** @type {Record<string, any>} */
    this.props = props;

    /**
     * The view's root element. `null` until `build()`/`mount()` runs.
     * @type {HTMLElement | null}
     */
    this.el = null;

    /**
     * The `[data-ref]` elements of this view's template, keyed by name.
     * Populated by `build()`.
     * @type {Refs}
     */
    this.ui = /** @type {Refs} */ ({});

    /**
     * Child views, tracked so `unmount()` can tear them down in cascade.
     * @type {Set<View<any>>}
     */
    this.children = new Set();

    /**
     * Named regions declared via `static regions`, keyed by name (empty if none declared).
     * @type {Record<string, Region>}
     */
    this.regions = {};

    /**
     * Per-view event bus for talking to a parent (e.g. `this.events.emit('save', data)`).
     * @type {EventEmitter}
     */
    this.events = new EventEmitter();

    /** @private */
    this._mounted = false;
    /** @private */
    this._ac = new AbortController();
  }

  /**
   * An `AbortSignal` tied to this view's mounted lifetime. Bind DOM listeners or
   * emitter subscriptions with it (or via {@link View#listen}) and they are removed
   * automatically on `unmount()` — no manual bookkeeping, no leaks.
   * @returns {AbortSignal}
   */
  get signal() {
    return this._ac.signal;
  }

  /** Whether the view is currently in the DOM. @returns {boolean} */
  get mounted() {
    return this._mounted;
  }

  /**
   * Build the root element. Default: clone the static `template`. Override to build
   * the node another way (it must return a single root element).
   * @returns {HTMLElement}
   */
  render() {
    const tpl = /** @type {typeof View} */ (this.constructor).template;
    if (!tpl) {
      throw new Error(
        `${this.constructor.name}: set a static \`template\` (e.g. "#id") or override render()`,
      );
    }
    return clone(tpl);
  }

  /**
   * Create `el` and `ui` (idempotent). Useful if you need the element before mounting;
   * otherwise `mount()` calls it for you.
   * @returns {HTMLElement}
   */
  build() {
    if (this.el) return this.el;
    this.el = this.render();
    this.ui = refs(this.el);
    this._initRegions();
    this.onCreate();
    return this.el;
  }

  /**
   * Create the regions declared in `static regions` from the template's slots.
   * @private
   * @returns {void}
   */
  _initRegions() {
    const Ctor = /** @type {typeof View} */ (this.constructor);
    if (!Ctor.regions) return;
    for (const [name, ref] of Object.entries(Ctor.regions)) {
      const slot = this.ui[ref];
      if (!slot) {
        throw new Error(`${Ctor.name}: region "${name}" needs [data-ref="${ref}"] in the template`);
      }
      this.regions[name] = new Region(slot);
    }
  }

  // ---- Lifecycle hooks (override as needed; all optional) ----

  /** Called once, after `el`/`ui` exist but before the view is in the DOM. */
  onCreate() {}

  /** Called every time the view enters the DOM. Wire listeners here (they rebind on remount). */
  onMount() {}

  /** Called just before cleanup, while the view is still in the DOM. */
  onUnmount() {}

  /** Entrance transition; awaited after mounting. Override to return a Promise. @returns {Promise<void> | void} */
  animateIn() {}

  /** Leave transition; awaited *before* removal. Override to return a Promise. @returns {Promise<void> | void} */
  animateOut() {}

  // ---- Mounting ----

  /**
   * Insert this view into a parent and run the mount lifecycle.
   * @param {ParentNode} parent - Where to append the view's root element.
   * @param {{ animate?: boolean }} [options] - Pass `animate: false` to skip `animateIn()`
   *   (used by `Region`'s View-Transition path, where the browser plays the crossfade instead).
   * @returns {Promise<this>} Resolves once `animateIn()` has finished (immediately if skipped).
   */
  async mount(parent, options) {
    this.build();
    parent.appendChild(/** @type {HTMLElement} */ (this.el));
    this._mounted = true;
    this.onMount();
    if (options?.animate !== false) await this.animateIn();
    return this;
  }

  /**
   * Mount a child view under this one and track it for cascade unmount.
   * @template {View<any>} C
   * @param {C} child - The child view.
   * @param {ParentNode} [parent] - Where to mount it. Defaults to this view's root element.
   * @returns {Promise<C>} The mounted child.
   */
  async addChild(child, parent) {
    this.children.add(child);
    await child.mount(parent ?? /** @type {HTMLElement} */ (this.build()));
    return child;
  }

  /**
   * Unmount a tracked child: removes it from `children` and unmounts it (with its
   * leave animation).
   * @param {View<any>} child
   * @returns {Promise<void>}
   */
  async removeChild(child) {
    this.children.delete(child);
    await child.unmount();
  }

  /**
   * Play the leave animation, tear down children, clean up listeners, and remove the
   * element from the DOM — in that order, so the exit animation always completes first.
   * After this, the view can be mounted again (a fresh `signal` is created).
   * @param {{ animate?: boolean }} [options] - Pass `animate: false` to skip `animateOut()`
   *   (used by `Region`'s View-Transition path). Propagates to children and regions, so the
   *   whole cascade tears down without JS animations.
   * @returns {Promise<void>}
   */
  async unmount(options) {
    if (!this.el) return;
    if (options?.animate !== false) await this.animateOut();
    for (const child of [...this.children]) await child.unmount(options);
    for (const region of Object.values(this.regions)) await region.empty(options);
    this.children.clear();
    this.onUnmount();
    this._ac.abort(); // fire signal → every listener bound to it is removed
    this.el.remove();
    this._mounted = false;
    this._ac = new AbortController(); // ready for a possible remount
  }

  /**
   * Add a DOM event listener bound to this view's lifecycle `signal`, so it is removed
   * automatically on `unmount()`. Call inside `onMount()`.
   * @param {EventTarget} target - The element (or other target) to listen on.
   * @param {string} type - The event type, e.g. `'click'`.
   * @param {EventListenerOrEventListenerObject} handler - The listener.
   * @param {AddEventListenerOptions} [options] - Extra listener options (a `signal` here is overridden).
   * @returns {void}
   */
  listen(target, type, handler, options) {
    target.addEventListener(type, handler, { ...options, signal: this.signal });
  }

  /**
   * Observe an element's visibility with an `IntersectionObserver`, automatically
   * disconnected on `unmount()` (it is bound to this view's `signal`). Call inside
   * `onMount()`. The callback gets the standard `(entries, observer)` arguments, so a
   * one-shot reveal is just `observer.unobserve(target)` after the first intersection.
   *
   * This is to `IntersectionObserver` what {@link View#listen} is to `addEventListener`:
   * the observer has no `signal` option of its own, so the view bridges it to the mounted
   * lifetime — no manual `disconnect()` in `onUnmount`, no leak.
   *
   * @param {Element} target - The element to watch (often `this.el`).
   * @param {IntersectionObserverCallback} callback - Runs when `target`'s intersection changes.
   * @param {IntersectionObserverInit} [options] - `root`, `rootMargin`, `threshold`.
   * @returns {IntersectionObserver} The observer, already observing `target`.
   */
  observe(target, callback, options) {
    const io = new IntersectionObserver(callback, options);
    io.observe(target);
    this.signal.addEventListener('abort', () => io.disconnect(), { once: true });
    return io;
  }
}
