// @ts-check
import { EventEmitter } from './event-emitter.js';
import { Model } from './model.js';

/**
 * An ordered list of {@link Model}s, with structural events.
 *
 * Mutations are explicit and announced: `add`, `remove` and `reset` change the list and
 * emit an event. **Queries never mutate** — `find`, `where`, `filter`, `map` and `sort`
 * return results and leave the collection's contents and order untouched. (The old
 * framework's `find`/`where`/`sort` destructively overwrote the visible list as a side
 * effect of querying — a surprising trap this fixes.)
 *
 * Per-model changes are not bubbled here. In a `CollectionView` each model gets its own
 * view that subscribes to its own model, so reactions stay local and granular.
 *
 * @template {Record<string, any>} [Data=Record<string, any>]
 * @template {Model<Data>} [M=Model<Data>]
 */
export class Collection {
  /**
   * @param {(Data | M)[]} [items] - Initial items: plain data (wrapped via `model`) or `Model` instances.
   * @param {new (data: Data) => M} [model] - Model subclass used to wrap plain data. Defaults to `Model`.
   */
  constructor(items = [], model) {
    /** @private @type {new (data: any) => M} */
    this._Model = model ?? /** @type {any} */ (Model);
    /** @type {M[]} */
    this.models = [];
    /** @private */
    this._events = new EventEmitter();
    for (const item of items) this.models.push(this._wrap(item));
  }

  /**
   * @private
   * @param {Data | M} item
   * @returns {M}
   */
  _wrap(item) {
    return item instanceof Model ? /** @type {M} */ (item) : new this._Model(/** @type {Data} */ (item));
  }

  /** Number of models. @returns {number} */
  get length() {
    return this.models.length;
  }

  /**
   * The model at an index.
   * @param {number} index
   * @returns {M | undefined}
   */
  at(index) {
    return this.models[index];
  }

  /**
   * Find a model by its `id` attribute.
   * @param {any} id
   * @returns {M | undefined}
   */
  get(id) {
    return this.models.find((m) => m.get('id') === id);
  }

  // ---- Mutations (announced) ----

  /**
   * Append a model (wrapping plain data). Emits `add`.
   * @param {Data | M} item
   * @returns {M} The added model.
   */
  add(item) {
    const model = this._wrap(item);
    const index = this.models.push(model) - 1;
    this._events.emit('add', { model, index, collection: this });
    return model;
  }

  /**
   * Remove a model. Emits `remove`. No-op if the model isn't present.
   * @param {M} model
   * @returns {M | undefined} The removed model, or `undefined`.
   */
  remove(model) {
    const index = this.models.indexOf(model);
    if (index === -1) return undefined;
    this.models.splice(index, 1);
    this._events.emit('remove', { model, index, collection: this });
    return model;
  }

  /**
   * Replace all models. Emits `reset`.
   * @param {(Data | M)[]} [items]
   * @returns {this}
   */
  reset(items = []) {
    this.models = items.map((item) => this._wrap(item));
    this._events.emit('reset', { models: this.models, collection: this });
    return this;
  }

  // ---- Queries (never mutate; return results) ----

  /**
   * The first model matching a predicate.
   * @param {(model: M, index: number) => boolean} predicate
   * @returns {M | undefined}
   */
  find(predicate) {
    return this.models.find(predicate);
  }

  /**
   * Models whose attributes match every entry of `attrs`. Returns a new array.
   * @param {Partial<Data>} attrs
   * @returns {M[]}
   */
  where(attrs) {
    const entries = Object.entries(attrs);
    return this.models.filter((m) =>
      entries.every(([k, v]) => m.get(/** @type {keyof Data} */ (k)) === v),
    );
  }

  /**
   * Models matching a predicate. Returns a new array.
   * @param {(model: M, index: number) => boolean} predicate
   * @returns {M[]}
   */
  filter(predicate) {
    return this.models.filter(predicate);
  }

  /**
   * Map each model to a value. Returns a new array.
   * @template T
   * @param {(model: M, index: number) => T} fn
   * @returns {T[]}
   */
  map(fn) {
    return this.models.map(fn);
  }

  /**
   * Run a function for each model.
   * @param {(model: M, index: number) => void} fn
   * @returns {void}
   */
  forEach(fn) {
    this.models.forEach(fn);
  }

  /**
   * A sorted **copy** of the models. Does NOT reorder the collection — returns a new
   * array, so querying never changes what observers see.
   * @param {(a: M, b: M) => number} compare
   * @returns {M[]}
   */
  sort(compare) {
    return [...this.models].sort(compare);
  }

  // ---- Events ----

  /**
   * Subscribe to `add`, `remove` or `reset`.
   * @param {'add' | 'remove' | 'reset'} event
   * @param {(payload: any) => void} handler
   * @param {{ signal?: AbortSignal }} [options] - Pass a view's `signal` for auto-cleanup.
   * @returns {() => void} Unsubscribe.
   */
  on(event, handler, options) {
    return this._events.on(event, handler, options);
  }

  /**
   * Subscribe for a single emission.
   * @param {'add' | 'remove' | 'reset'} event
   * @param {(payload: any) => void} handler
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {() => void}
   */
  once(event, handler, options) {
    return this._events.once(event, handler, options);
  }

  /**
   * Unsubscribe a handler.
   * @param {'add' | 'remove' | 'reset'} event
   * @param {(payload: any) => void} handler
   * @returns {void}
   */
  off(event, handler) {
    this._events.off(event, handler);
  }

  /**
   * The models as plain data (each model's `toJSON`).
   * @returns {Data[]}
   */
  toJSON() {
    return this.models.map((m) => m.toJSON());
  }

  /** Iterate the models directly: `for (const m of collection)`. */
  [Symbol.iterator]() {
    return this.models[Symbol.iterator]();
  }
}
