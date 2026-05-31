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
   * @private
   * @param {any} model
   * @returns {View<any>}
   */
  _addView(model) {
    const Ctor = /** @type {typeof CollectionView} */ (this.constructor);
    const ChildView = Ctor.childView;
    if (!ChildView) throw new Error(`${Ctor.name}: set a static childView`);
    const view = new ChildView({ model, ...this.childProps(model) });
    this._views.set(model, view);
    this.addChild(view, this.container);
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
    this.removeChild(view);
  }

  /** @private */
  async _resetViews() {
    for (const view of [...this._views.values()]) await view.unmount();
    this._views.clear();
    this.children.clear();
    this.collection.forEach((model) => this._addView(model));
  }
}
