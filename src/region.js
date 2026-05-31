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
 * @template {import('./view.js').View<any>} [V=import('./view.js').View<any>]
 */
export class Region {
  /**
   * @param {string | Element} target - The slot element, or a CSS selector for it.
   */
  constructor(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) {
      throw new Error(`Region: target not found (${typeof target === 'string' ? target : 'element'})`);
    }
    /** @type {Element} */
    this.el = el;
    /** @type {V | null} The view currently shown, or `null` when empty. */
    this.current = null;
  }

  /**
   * Swap in a view: unmount the current one (its `animateOut` finishes first), then
   * mount the new one (its `animateIn` plays). Showing the view that is already current
   * is a no-op.
   * @param {V} view - The view to show.
   * @returns {Promise<V>} The shown view, once its entrance has finished.
   */
  async show(view) {
    if (this.current === view) return view;
    if (this.current) await this.current.unmount();
    this.current = view;
    await view.mount(this.el);
    return view;
  }

  /**
   * Unmount whatever is shown (its `animateOut` finishes first), leaving the region empty.
   * @returns {Promise<void>}
   */
  async empty() {
    if (!this.current) return;
    await this.current.unmount();
    this.current = null;
  }
}
