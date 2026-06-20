// @ts-check
import { EventEmitter } from './event-emitter.js';

/**
 * The observable state of one cached key. `data`/`error` are the last known values;
 * `isLoading` is the *first* load (no data yet, a fetch in flight) — render a skeleton;
 * `isValidating` is *any* fetch in flight, including a background revalidation over
 * existing data — render a subtle spinner.
 * @typedef {{ data: any, error: any, isLoading: boolean, isValidating: boolean }} ResourceState
 */

/**
 * @typedef {Object} MutateOptions
 * @property {boolean} [revalidate] - Refetch from the server after the local write (default `true`).
 * @property {any} [optimisticData] - Value to show immediately while a passed `Promise` resolves.
 * @property {boolean} [rollbackOnError] - Restore the previous data if the `Promise` rejects (default `true`).
 */

/**
 * Server state as a first-class, observable primitive — the **stale-while-revalidate**
 * pattern (SWR / TanStack Query), kept small and transparent.
 *
 * `Resource` is a **peer** of `Model`/`Collection`, not a wrapper bolted onto `Http`: it
 * *consumes* a plain `fetcher` (often `(key) => http.get(key)`) and adds the lifecycle that
 * every data-loading view otherwise re-implements by hand — a cache keyed by a string,
 * request **dedupe**, background **revalidation**, and **mutations** (optimistic, with
 * rollback). One instance is a cache shared **explicitly**, exactly like an `EventEmitter`
 * bus or an `Http` client — there is no global singleton.
 *
 * Views read and subscribe; the resource serves cached data instantly and revalidates in
 * the background, emitting a new {@link ResourceState} whenever it changes:
 *
 * ```js
 * const resource = new Resource({ fetcher: (key) => http.get(key) }); // app creates one, shares it
 *
 * class UserCard extends View {
 *   onMount() {
 *     const s = this.props.resource.read('/users/1', (state) => this.render(state), { signal: this.signal });
 *     this.render(s); // cached snapshot now; the handler fires on every later change
 *   }
 *   render({ data, error, isLoading }) {  ...  }
 * }
 *
 * // after editing — optimistic update, server write, then revalidate:
 * resource.mutate('/users/1', http.patch('/users/1', patch), { optimisticData: { ...patch } });
 * ```
 */
export class Resource {
  /**
   * @param {Object} options
   * @param {(key: any) => Promise<any>} options.fetcher - Loads the data for a key. Receives the
   *   original (un-serialized) key, so an array key like `['users', id]` arrives intact.
   * @param {number} [options.dedupe] - Window in ms within which a `read` of an already-fresh key
   *   skips refetching (default `2000`). In-flight requests are always deduped regardless.
   */
  constructor(options) {
    /** @type {(key: any) => Promise<any>} */
    this.fetcher = options.fetcher;
    /** @type {number} */
    this.dedupe = options.dedupe ?? 2000;
    /**
     * Cache entries keyed by the serialized key.
     * @private
     * @type {Map<string, { data: any, error: any, isValidating: boolean, promise: Promise<void> | null, ts: number }>}
     */
    this._cache = new Map();
    /** @private */
    this._events = new EventEmitter();
  }

  /**
   * The current cached state for a key **without** triggering a fetch — handy for reading a
   * value you know is already loaded.
   * @param {any} key
   * @returns {ResourceState}
   */
  get(key) {
    return this._snapshot(this._cache.get(this._key(key)));
  }

  /**
   * Read a key the stale-while-revalidate way: return the cached snapshot **now**, kick off a
   * background fetch if the data is missing or stale, and (if a `handler` is given) subscribe to
   * every later state change. This is the main entry a view uses in `onMount()`.
   *
   * @param {any} key
   * @param {(state: ResourceState) => void} [handler] - Notified on every subsequent change for this key.
   * @param {{ signal?: AbortSignal }} [options] - Pass the view's `signal` so the subscription cleans up on unmount.
   * @returns {ResourceState} The snapshot available right now.
   */
  read(key, handler, options) {
    const k = this._key(key);
    const entry = this._ensure(k);
    if (handler) this._events.on(k, handler, options);
    const fresh = entry.ts !== 0 && Date.now() - entry.ts < this.dedupe;
    if (!entry.isValidating && !fresh) this.revalidate(key);
    return this._snapshot(entry);
  }

  /**
   * Subscribe to a key's state changes without triggering a fetch (use {@link Resource#read}
   * when you also want the SWR fetch). Returns an unsubscribe function.
   * @param {any} key
   * @param {(state: ResourceState) => void} handler
   * @param {{ signal?: AbortSignal }} [options] - Pass a `signal` for auto-cleanup.
   * @returns {() => void}
   */
  subscribe(key, handler, options) {
    return this._events.on(this._key(key), handler, options);
  }

  /**
   * Force a refetch for a key, deduped: a fetch already in flight is reused rather than doubled.
   * Never rejects — failures land in the key's `error` state (SWR-style), so a background call
   * from `read` can't throw unhandled. Resolves once the fetch settles.
   * @param {any} key
   * @returns {Promise<void>}
   */
  revalidate(key) {
    const k = this._key(key);
    const entry = this._ensure(k);
    if (entry.promise) return entry.promise; // dedupe the in-flight request
    entry.isValidating = true;
    this._emit(k, entry);
    entry.promise = Promise.resolve()
      .then(() => this.fetcher(key))
      .then(
        (data) => {
          entry.data = data;
          entry.error = undefined;
        },
        (err) => {
          entry.error = err;
        },
      )
      .finally(() => {
        entry.isValidating = false;
        entry.promise = null;
        entry.ts = Date.now();
        this._emit(k, entry);
      });
    return entry.promise;
  }

  /**
   * Update a key's cached data, then (by default) revalidate from the server. Four shapes,
   * one method:
   * - `mutate(key)` — **invalidate**: just refetch.
   * - `mutate(key, value)` — write `value` into the cache.
   * - `mutate(key, (prev) => next)` — derive the next value from the current one.
   * - `mutate(key, promise, { optimisticData })` — **optimistic**: show `optimisticData` now, write
   *   the promise's result when it resolves, and (with `rollbackOnError`) restore the old data if
   *   it rejects — then revalidate. Pass the server write itself, e.g. `http.patch(...)`.
   *
   * @param {any} key
   * @param {any | ((prev: any) => any) | Promise<any>} [data]
   * @param {MutateOptions} [options]
   * @returns {Promise<any>} Resolves to the freshest data (after revalidation, if any).
   */
  async mutate(key, data, options = {}) {
    const { revalidate = true, optimisticData, rollbackOnError = true } = options;
    const k = this._key(key);
    const entry = this._ensure(k);

    if (data instanceof Promise) {
      const rollback = entry.data;
      if (optimisticData !== undefined) {
        entry.data = optimisticData;
        this._emit(k, entry);
      }
      try {
        const result = await data;
        if (result !== undefined) entry.data = result;
        entry.error = undefined;
        this._emit(k, entry);
      } catch (err) {
        if (rollbackOnError) {
          entry.data = rollback;
          this._emit(k, entry);
        }
        throw err;
      }
    } else if (data !== undefined) {
      entry.data = typeof data === 'function' ? data(entry.data) : data;
      entry.error = undefined;
      this._emit(k, entry);
    }

    if (revalidate) {
      await this.revalidate(key);
    }
    return entry.data;
  }

  /**
   * Drop one cached key, or the whole cache when called with no argument. Subscribers stay
   * subscribed and receive a reset (empty) state, so a logout can wipe everything without
   * tearing down live views.
   * @param {any} [key]
   * @returns {void}
   */
  clear(key) {
    if (key === undefined) {
      const keys = [...this._cache.keys()];
      this._cache.clear();
      for (const k of keys) this._events.emit(k, this._snapshot(undefined));
      return;
    }
    const k = this._key(key);
    this._cache.delete(k);
    this._events.emit(k, this._snapshot(undefined));
  }

  /**
   * Get or create the cache entry for a serialized key.
   * @private
   * @param {string} k
   */
  _ensure(k) {
    let entry = this._cache.get(k);
    if (!entry) {
      entry = { data: undefined, error: undefined, isValidating: false, promise: null, ts: 0 };
      this._cache.set(k, entry);
    }
    return entry;
  }

  /**
   * Build the public, immutable state snapshot from a (possibly absent) entry.
   * @private
   * @param {{ data: any, error: any, isValidating: boolean } | undefined} entry
   * @returns {ResourceState}
   */
  _snapshot(entry) {
    const isValidating = entry?.isValidating ?? false;
    return {
      data: entry?.data,
      error: entry?.error,
      isValidating,
      isLoading: isValidating && entry?.data === undefined,
    };
  }

  /**
   * Emit the current snapshot for a key to its subscribers.
   * @private
   * @param {string} k
   * @param {{ data: any, error: any, isValidating: boolean }} entry
   */
  _emit(k, entry) {
    this._events.emit(k, this._snapshot(entry));
  }

  /**
   * Serialize a key for cache/event use. Strings pass through; anything else (e.g. an array
   * `['users', id]`) is JSON-stringified — keep the parts in a stable order.
   * @private
   * @param {any} key
   * @returns {string}
   */
  _key(key) {
    return typeof key === 'string' ? key : JSON.stringify(key);
  }
}
