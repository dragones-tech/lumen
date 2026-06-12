// @ts-check
import { EventEmitter } from './event-emitter.js';
import { runRules } from './validate.js';

/**
 * Observable data for a single entity (a user, a todo, a setting).
 *
 * State is explicit: you read with `get`, write with `set`, and `set` emits events so
 * observers can react. There are no proxies and no hidden interception — assigning to
 * `model.data.x` directly will NOT notify; that is deliberate, so every notification
 * has a visible cause.
 *
 * Two events fire on a real change:
 * - `change:<key>` with `{ value, previous, model }` — for surgical updates.
 * - `change` with `{ keys, model }` — once per `set`, listing the keys that changed.
 *
 * Views subscribe with their `signal` so subscriptions clean up on unmount, and react
 * granularly — there is no forced full re-render (the old framework re-rendered the
 * whole view on any change).
 *
 * @template {Record<string, any>} [Data=Record<string, any>]
 */
export class Model {
  /**
   * Validation rules keyed by field — the single source of truth for "is this valid".
   * `validate()` runs them; the UI renders the returned errors. Override `validate()`
   * instead for custom logic.
   * @type {Record<string, import('./validate.js').Rule[]> | null}
   */
  static rules = null;

  /**
   * @param {Data} data - Initial attributes. Copied, not referenced.
   */
  constructor(data) {
    /** @type {Data} */
    this.data = { ...data };
    /**
     * The last committed snapshot — the baseline that `isDirty`/`changes`/`revert`
     * compare against. Starts equal to the initial data, advances on `commit()`.
     * @private @type {Data}
     */
    this._baseline = { ...data };
    /** @private */
    this._events = new EventEmitter();
  }

  /**
   * Read one attribute.
   * @template {keyof Data} K
   * @param {K} key
   * @returns {Data[K]}
   */
  get(key) {
    return this.data[key];
  }

  /**
   * Set one attribute, or merge a partial object. Only keys whose value actually
   * changed (strict `!==`) are written and announced. New keys are fine — unlike the
   * old framework, setting a key that wasn't in the initial data never throws.
   *
   * @param {keyof Data | Partial<Data>} keyOrPatch - An attribute name, or a patch object.
   * @param {any} [value] - The new value (when the first argument is a key).
   * @returns {this}
   */
  set(keyOrPatch, value) {
    const patch =
      typeof keyOrPatch === 'object' && keyOrPatch !== null
        ? /** @type {Partial<Data>} */ (keyOrPatch)
        : /** @type {Partial<Data>} */ ({ [keyOrPatch]: value });

    /** @type {string[]} */
    const changed = [];
    for (const key of /** @type {(keyof Data & string)[]} */ (Object.keys(patch))) {
      const next = patch[key];
      const previous = this.data[key];
      if (previous !== next) {
        /** @type {Record<string, any>} */ (this.data)[key] = next;
        changed.push(key);
        this._events.emit(`change:${key}`, { value: next, previous, model: this });
      }
    }
    if (changed.length) this._events.emit('change', { keys: changed, model: this });
    return this;
  }

  // ---- Dirty tracking (against the committed baseline) ----

  /**
   * Whether attributes differ from the last committed baseline — i.e. there are unsaved
   * edits. The baseline starts as the initial data and advances on {@link commit}. With a
   * `key`, reports only that attribute. Comparison is strict (`!==`), like `set`.
   *
   * Derived purely by comparison — nothing is bookkept in `set`, so it stays honest even
   * if you reach past the API and assign to `model.data.x` directly.
   *
   * @param {keyof Data} [key] - Limit the check to one attribute.
   * @returns {boolean}
   */
  isDirty(key) {
    if (key !== undefined) return this.data[key] !== this._baseline[key];
    return this.changedKeys().length > 0;
  }

  /**
   * The attribute names that differ from the committed baseline.
   * @returns {(keyof Data & string)[]}
   */
  changedKeys() {
    const keys = new Set([...Object.keys(this.data), ...Object.keys(this._baseline)]);
    return /** @type {(keyof Data & string)[]} */ (
      [...keys].filter((k) => /** @type {any} */ (this.data)[k] !== /** @type {any} */ (this._baseline)[k])
    );
  }

  /**
   * A map of every changed attribute to its `{ value, baseline }` pair — empty `{}` when
   * the model is clean. Handy for "you have unsaved changes" UI or building a PATCH body.
   * @returns {Record<string, { value: any, baseline: any }>}
   */
  changes() {
    /** @type {Record<string, { value: any, baseline: any }>} */
    const out = {};
    for (const k of this.changedKeys()) {
      out[k] = { value: /** @type {any} */ (this.data)[k], baseline: /** @type {any} */ (this._baseline)[k] };
    }
    return out;
  }

  /**
   * Adopt the current attributes as the new clean baseline — call after a successful save,
   * so the model reports `isDirty() === false` until the next edit. Does not touch `data`
   * and emits nothing (no observable value changed). Returns `this`.
   * @returns {this}
   */
  commit() {
    this._baseline = { ...this.data };
    return this;
  }

  /**
   * Discard unsaved edits, restoring attribute(s) to the committed baseline. Goes through
   * `set`, so the usual `change:<key>` / `change` events fire for whatever reverts — views
   * update surgically, exactly as they would for any other change. With a `key`, reverts
   * just that attribute. Returns `this`.
   * @param {keyof Data} [key] - Limit the revert to one attribute.
   * @returns {this}
   */
  revert(key) {
    if (key !== undefined) return this.set(key, this._baseline[key]);
    /** @type {Partial<Data>} */
    const patch = {};
    for (const k of this.changedKeys()) patch[k] = this._baseline[k];
    return this.set(patch);
  }

  /**
   * Subscribe to `'change'` or a `` `change:${key}` `` event.
   * @param {string} event - `'change'`, or `'change:' + key`.
   * @param {(payload: any) => void} handler - Receives the event payload.
   * @param {{ signal?: AbortSignal }} [options] - Pass a view's `signal` for auto-cleanup.
   * @returns {() => void} An unsubscribe function.
   */
  on(event, handler, options) {
    return this._events.on(event, handler, options);
  }

  /**
   * Subscribe for a single emission, then auto-unsubscribe.
   * @param {string} event
   * @param {(payload: any) => void} handler
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {() => void}
   */
  once(event, handler, options) {
    return this._events.once(event, handler, options);
  }

  /**
   * Unsubscribe a specific handler.
   * @param {string} event
   * @param {(payload: any) => void} handler
   * @returns {void}
   */
  off(event, handler) {
    this._events.off(event, handler);
  }

  /**
   * Validate the current attributes against `static rules`. Returns errors keyed by field
   * — an empty object means valid. Override for custom logic. This is the single source of
   * truth: the model decides validity, the UI renders the result.
   * @returns {Record<string, string[]>}
   */
  validate() {
    const rules = /** @type {typeof Model} */ (this.constructor).rules;
    return rules ? runRules(this.data, rules) : {};
  }

  /**
   * Whether the current attributes pass validation.
   * @returns {boolean}
   */
  isValid() {
    return Object.keys(this.validate()).length === 0;
  }

  /**
   * A shallow copy of the attributes — handy for serializing or snapshotting.
   * @returns {Data}
   */
  toJSON() {
    return { ...this.data };
  }
}
