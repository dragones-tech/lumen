// @ts-check

/**
 * A tiny, transparent, typed event emitter.
 *
 * This is the foundation of Lumen's messaging. There is no global singleton —
 * you create as many emitters as you need and pass them around explicitly. Nothing
 * happens on import; there are no side effects.
 *
 * Cleanup is symmetric and leak-free: every `on()` call returns an unsubscribe
 * function, and you can also pass an `AbortSignal` so that aborting a single
 * controller removes every listener bound to it at once.
 *
 * Pass an events map as the generic parameter to get autocomplete and payload
 * checking on every method. See `docs/en/event-emitter.md` for a typed example.
 *
 * @template {Record<string, any>} [Events=Record<string, any>]
 */
export class EventEmitter {
  constructor() {
    /**
     * Registered handlers, keyed by event name.
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this._handlers = new Map();
  }

  /**
   * Subscribe to an event.
   *
   * @template {keyof Events & string} K
   * @param {K} event - The event name.
   * @param {(payload: Events[K]) => void} handler - Called with the emitted payload.
   * @param {{ signal?: AbortSignal }} [options] - Optional `AbortSignal`; aborting it removes this listener.
   * @returns {() => void} An unsubscribe function. Calling it removes this exact handler.
   */
  on(event, handler, options) {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);

    const off = () => this.off(event, handler);

    const signal = options?.signal;
    if (signal) {
      if (signal.aborted) off();
      else signal.addEventListener('abort', off, { once: true });
    }

    return off;
  }

  /**
   * Subscribe to an event for a single emission, then auto-unsubscribe.
   *
   * @template {keyof Events & string} K
   * @param {K} event - The event name.
   * @param {(payload: Events[K]) => void} handler - Called once with the next emitted payload.
   * @param {{ signal?: AbortSignal }} [options] - Optional `AbortSignal` to cancel before it fires.
   * @returns {() => void} An unsubscribe function (useful to cancel before the event fires).
   */
  once(event, handler, options) {
    /** @param {Events[K]} payload */
    const wrapper = (payload) => {
      this.off(event, /** @type {any} */ (wrapper));
      handler(payload);
    };
    return this.on(event, /** @type {any} */ (wrapper), options);
  }

  /**
   * Unsubscribe a specific handler from an event.
   *
   * Safe to call even if the event or handler was never registered — it is a no-op,
   * never a crash. (The old framework's `off` threw a TypeError in this case.)
   *
   * @template {keyof Events & string} K
   * @param {K} event - The event name.
   * @param {(payload: Events[K]) => void} handler - The exact handler reference passed to `on`/`once`.
   * @returns {void}
   */
  off(event, handler) {
    const set = this._handlers.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._handlers.delete(event);
  }

  /**
   * Emit an event, synchronously calling every subscribed handler.
   *
   * Handlers are copied before iteration, so a handler may safely call `off` (or `on`)
   * during emission without disturbing the current pass.
   *
   * @template {keyof Events & string} K
   * @param {K} event - The event name.
   * @param {Events[K]} payload - The payload passed to every handler. For events with no
   *   data, type the payload as `void` and pass `undefined`.
   * @returns {void}
   */
  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  /**
   * Remove all handlers for one event, or every handler if no event is given.
   *
   * @param {string} [event] - The event to clear. Omit to clear everything.
   * @returns {void}
   */
  clear(event) {
    if (event === undefined) this._handlers.clear();
    else this._handlers.delete(event);
  }

  /**
   * Count the handlers currently registered for an event.
   *
   * @param {string} event - The event name.
   * @returns {number} The number of registered handlers (0 if none).
   */
  listenerCount(event) {
    return this._handlers.get(event)?.size ?? 0;
  }
}
