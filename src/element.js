// @ts-check

/**
 * @typedef {{ mount(parent: Element): any, unmount(): any, props: Record<string, any> }} ViewLike
 */

/**
 * Register a `View` as a Custom Element, so it can be used as `<tag-name>` in plain
 * HTML — or consumed inside React/Vue/Angular. This is the **escape hatch** for
 * distributing a widget: your class stays a normal `View`; this wraps it.
 *
 * On connect it reads the element's attributes into `props` (plus anything assigned to the
 * element's `.props` property beforehand, for complex data), instantiates the view, and
 * mounts it into the host. On disconnect it unmounts the view (running cleanup).
 *
 * ```js
 * class Hello extends View { static template = '#hello'; onMount(){ this.ui.name.textContent = this.props.name; } }
 * defineElement('hello-widget', Hello);
 * // then in HTML:  <hello-widget name="Ada"></hello-widget>
 * ```
 *
 * **Caveat:** the browser fires `disconnectedCallback` *after* removing the node, so a
 * view's `animateOut()` cannot play when the host is removed — cleanup still runs. This is
 * the exact limitation that made plain classes (not Custom Elements) the default in Lumen;
 * this adapter is for interop/distribution, where leave-animations aren't expected.
 *
 * @param {string} tagName - A valid custom element name (must contain a hyphen).
 * @param {new (props?: any) => ViewLike} ViewClass - The `View` subclass to wrap.
 * @param {{ attributes?: string[] }} [options] - Attributes to keep in sync with `props` after mount.
 * @returns {void}
 */
export function defineElement(tagName, ViewClass, options = {}) {
  if (customElements.get(tagName)) return; // idempotent

  const observed = options.attributes ?? [];

  class RawElement extends HTMLElement {
    static get observedAttributes() {
      return observed;
    }

    constructor() {
      super();
      /** @type {ViewLike | null} @private */
      this._view = null;
      /** @type {Record<string, any>} @private */
      this._props = {};
    }

    /** Assign complex props (objects, callbacks) before the element is inserted. */
    set props(value) {
      this._props = value || {};
    }
    get props() {
      return this._view ? this._view.props : this._props;
    }

    connectedCallback() {
      if (this._view) return; // guard against repeated connects
      /** @type {Record<string, string>} */
      const attrs = {};
      for (const a of Array.from(this.attributes)) attrs[a.name] = a.value;
      this._view = new ViewClass({ ...attrs, ...this._props });
      this._view.mount(this);
    }

    disconnectedCallback() {
      // animateOut cannot play here (node is already removed); unmount still cleans up.
      this._view?.unmount();
      this._view = null;
    }

    /**
     * @param {string} name
     * @param {string | null} _old
     * @param {string | null} value
     */
    attributeChangedCallback(name, _old, value) {
      if (this._view) this._view.props[name] = value;
    }
  }

  customElements.define(tagName, RawElement);
}
