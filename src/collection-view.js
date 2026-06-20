// @ts-check
import { View } from './view.js';
import { clone } from './dom.js';

/**
 * Renders one child {@link View} per model in a {@link Collection}, and keeps them in
 * sync through **keyed reconciliation**: when the collection emits `add`/`remove`/`reset`,
 * only the affected child view is mounted or unmounted — the rest are untouched (no
 * full rebuild). A `Map` from model → child view is the key index.
 *
 * This is the intended way to render a `Collection`: the collection holds the data and
 * announces structural changes; the `CollectionView` turns each model into a view and
 * reconciles incrementally. (The old framework's collection view recreated every child
 * on each render and broke on the second pass — this fixes both.)
 *
 * Configure a subclass with statics:
 * - `childView` — the `View` subclass to instantiate per model (required).
 * - `template` — optional `<template>`; children mount into the `container` ref (or the root).
 * - `container` — the `data-ref` name of the element children mount into (default: the root element).
 * - `tag` — when there is no `template`, the tag of the auto-created root (default `'div'`).
 *
 * Pass the collection as a prop: `new TodoList({ collection })`.
 */
export class CollectionView extends View {
  /** @type {(new (props?: any) => View<any>) | null} The view class for each model. */
  static childView = null;

  /** @type {string} Tag of the auto-created root when there is no `template`. */
  static tag = 'div';

  /** @type {string | null} `data-ref` of the element children mount into. `null` = the root element. */
  static container = null;

  /** @param {{ collection: import('./collection.js').Collection<any, any> } & Record<string, any>} props */
  constructor(props) {
    super(props);
    /** @type {import('./collection.js').Collection<any, any>} */
    this.collection = props.collection;
    /** @private @type {Map<any, View<any>>} model → child view */
    this._views = new Map();
    /**
     * Tail of the reconciliation queue. `addChild`/`removeChild` are async (they await the
     * child's `animateIn`/`animateOut`), so we chain them here — a mount always finishes before
     * the next op runs, keeping order stable and never overlapping a child's enter/leave.
     * @private @type {Promise<any>}
     */
    this._tail = Promise.resolve();
  }

  /**
   * Build the root: clone `static template` if set, otherwise create a `static tag` element.
   * @returns {HTMLElement}
   */
  render() {
    const Ctor = /** @type {typeof CollectionView} */ (this.constructor);
    return Ctor.template ? clone(Ctor.template) : document.createElement(Ctor.tag);
  }

  /**
   * The element child views are mounted into.
   * @returns {HTMLElement}
   */
  get container() {
    const Ctor = /** @type {typeof CollectionView} */ (this.constructor);
    return Ctor.container
      ? /** @type {HTMLElement} */ (this.ui[Ctor.container])
      : /** @type {HTMLElement} */ (this.el);
  }

  /**
   * Override to pass extra props (e.g. callbacks) to every child view. Receives the model.
   * @param {any} _model
   * @returns {Record<string, any>}
   */
  childProps(_model) {
    return {};
  }

  /** Render existing models, then reconcile on collection changes (auto-cleaned via `signal`). */
  onMount() {
    this.collection.forEach((model) => this._addView(model));
    this.collection.on('add', this._onAdd, { signal: this.signal });
    this.collection.on('remove', this._onRemove, { signal: this.signal });
    this.collection.on('reset', this._onReset, { signal: this.signal });
  }

  onUnmount() {
    this._views.clear();
  }

  /** @private */
  _onAdd = (/** @type {{ model: any }} */ { model }) => this._addView(model);
  /** @private */
  _onRemove = (/** @type {{ model: any }} */ { model }) => this._removeView(model);
  /** @private */
  _onReset = () => this._resetViews();

  /**
   * Queue a reconciliation step after any in-flight one. Continues even if a prior step rejects,
   * so one failed mount/unmount can't wedge the queue.
   * @private
   * @param {() => Promise<any>} step
   * @returns {Promise<any>}
   */
  _serialize(step) {
    this._tail = this._tail.then(step, step);
    return this._tail;
  }

  /**
   * Instantiate the child view for a model and record it in the index (synchronous, so `_views`
   * always reflects the latest desired state — the DOM mount is queued separately).
   * @private
   * @param {any} model
   * @returns {View<any>}
   */
  _create(model) {
    const Ctor = /** @type {typeof CollectionView} */ (this.constructor);
    const ChildView = Ctor.childView;
    if (!ChildView) throw new Error(`${Ctor.name}: set a static childView`);
    const view = new ChildView({ model, ...this.childProps(model) });
    this._views.set(model, view);
    return view;
  }

  /**
   * @private
   * @param {any} model
   * @returns {View<any>}
   */
  _addView(model) {
    const view = this._create(model);
    this._serialize(() => this.addChild(view, this.container));
    return view;
  }

  /**
   * @private
   * @param {any} model
   */
  _removeView(model) {
    const view = this._views.get(model);
    if (!view) return;
    this._views.delete(model);
    this._serialize(() => this.removeChild(view));
  }

  /** @private */
  _resetViews() {
    const old = [...this._views.values()];
    this._views.clear();
    // Build the new views now so `_views` is correct immediately; defer the DOM swap to the queue.
    const fresh = this.collection.map((model) => this._create(model));
    this._serialize(async () => {
      for (const view of old) await view.unmount();
      this.children.clear();
      for (const view of fresh) await this.addChild(view, this.container);
    });
  }
}
