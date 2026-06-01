// @ts-check
import { $ } from './dom.js';

/**
 * Manages a single DOM slot that holds at most one {@link View} at a time.
 *
 * `show(view)` performs an animated swap: the current view's `animateOut()` plays and
 * finishes, the view is unmounted and removed, then the new view is mounted and its
 * `animateIn()` plays. This ordered out-then-in transition is exactly what a Custom
 * Element cannot do on its own (its `disconnectedCallback` fires only after removal).
 *
 * A `Region` is the foundation for screen swapping and the router: point one at an
 * element (your "outlet") and call `show()` as navigation changes.
 *
 * ```js
 * const main = new Region('#outlet');
 * await main.show(new HomeView());
 * await main.show(new AboutView()); // HomeView animates out, then AboutView animates in
 * ```
 *
 * ### Native View Transitions (opt-in)
 * Pass `{ transition: true }` and, on browsers that support the
 * [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API),
 * the swap is wrapped in `document.startViewTransition()` — the browser crossfades (and can
 * morph shared elements tagged with `view-transition-name`) instead of running the views'
 * `animateIn`/`animateOut`. Where it is unsupported, it falls back to the normal JS-animated
 * swap. Pure progressive enhancement: off by default, never required.
 *
 * @template {import('./view.js').View<any>} [V=import('./view.js').View<any>]
 */
export class Region {
  /**
   * @param {string | Element} target - The slot element, or a CSS selector for it.
   * @param {{ transition?: boolean }} [options] - `transition: true` prefers a native View
   *   Transition for `show()` (falls back to JS animation where unsupported).
   */
  constructor(target, options = {}) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) {
      throw new Error(`Region: target not found (${typeof target === 'string' ? target : 'element'})`);
    }
    /** @type {Element} */
    this.el = el;
    /** @type {V | null} The view currently shown, or `null` when empty. */
    this.current = null;
    /** @type {boolean} Default for `show()`: prefer a native View Transition when supported. */
    this.transition = options.transition ?? false;
  }

  /**
   * Swap in a view: unmount the current one (its `animateOut` finishes first), then
   * mount the new one (its `animateIn` plays). Showing the view that is already current
   * is a no-op.
   *
   * When transitions are enabled (per-call `options.transition`, else the region default)
   * and supported, the swap runs inside a native View Transition instead — the browser
   * plays the crossfade, so the views' JS `animateIn`/`animateOut` are skipped.
   *
   * @param {V} view - The view to show.
   * @param {{ transition?: boolean }} [options] - Override the region's transition default for this swap.
   * @returns {Promise<V>} The shown view, once its entrance (or the transition) has finished.
   */
  async show(view, options) {
    if (this.current === view) return view;

    const start = this._viewTransition(options);
    if (start) {
      const old = this.current;
      this.current = view;
      // Inside the transition: a plain DOM swap with no JS animation — the browser crossfades.
      await start(async () => {
        if (old) await old.unmount({ animate: false });
        await view.mount(this.el, { animate: false });
      }).finished;
      return view;
    }

    if (this.current) await this.current.unmount();
    this.current = view;
    await view.mount(this.el);
    return view;
  }

  /**
   * Unmount whatever is shown (its `animateOut` finishes first), leaving the region empty.
   * @param {{ animate?: boolean }} [options] - Forwarded to the view's `unmount()` (e.g. the
   *   cascade teardown passes `animate: false`).
   * @returns {Promise<void>}
   */
  async empty(options) {
    if (!this.current) return;
    await this.current.unmount(options);
    this.current = null;
  }

  /**
   * Resolve `document.startViewTransition` (bound) when transitions are wanted and supported,
   * else `null`. Kept defensive: the API may be absent (older browsers, SSR, tests).
   * @private
   * @param {{ transition?: boolean }} [options]
   * @returns {((cb: () => any) => { finished: Promise<any> }) | null}
   */
  _viewTransition(options) {
    const want = options?.transition ?? this.transition;
    if (!want || typeof document === 'undefined') return null;
    const start = /** @type {any} */ (document).startViewTransition;
    return typeof start === 'function' ? start.bind(document) : null;
  }
}
