// @ts-check
import { EventEmitter } from './event-emitter.js';

/**
 * Minimal internationalization (phase 2). Replaces the old framework's `translate`.
 *
 * You hold message dictionaries per locale, read with `t(key, params)`, and switch with
 * `setLocale`. It emits `change` so views can re-render their text — subscribe with a
 * view's `this.signal` and the subscription cleans up on unmount. No global, no magic:
 * if a key is missing it falls back to the fallback locale, then to the key itself.
 *
 * Keys may be nested with dots (`'home.title'`) and messages may interpolate `{name}`.
 *
 * ```js
 * const i18n = new I18n({
 *   locale: 'en',
 *   messages: {
 *     en: { greeting: 'Hello, {name}', home: { title: 'Home' } },
 *     es: { greeting: 'Hola, {name}',  home: { title: 'Inicio' } },
 *   },
 * });
 * i18n.t('greeting', { name: 'Ada' }); // "Hello, Ada"
 * i18n.setLocale('es');
 * i18n.t('home.title');                // "Inicio"
 * ```
 */
export class I18n {
  /**
   * @param {{ locale?: string, fallback?: string, messages?: Record<string, any> }} [options]
   */
  constructor(options = {}) {
    /** @type {string} */
    this.locale = options.locale ?? 'en';
    /** @type {string} */
    this.fallback = options.fallback ?? this.locale;
    /** @type {Record<string, any>} Per-locale message trees. */
    this.messages = options.messages ?? {};
    /** @private */
    this._events = new EventEmitter();
  }

  /**
   * Switch the active locale. Emits `change` only if it actually changed.
   * @param {string} locale
   * @returns {void}
   */
  setLocale(locale) {
    if (locale === this.locale) return;
    this.locale = locale;
    this._events.emit('change', { locale });
  }

  /**
   * Translate a key. Falls back to the fallback locale, then to the key itself.
   * @param {string} key - A message key, optionally dotted (`'home.title'`).
   * @param {Record<string, string | number>} [params] - Values for `{placeholders}`.
   * @returns {string}
   */
  t(key, params) {
    const msg = this._lookup(this.locale, key) ?? this._lookup(this.fallback, key) ?? key;
    return params ? interpolate(msg, params) : msg;
  }

  /**
   * Subscribe to locale changes.
   * @param {(payload: { locale: string }) => void} handler
   * @param {{ signal?: AbortSignal }} [options] - Pass a view's `signal` for auto-cleanup.
   * @returns {() => void} Unsubscribe.
   */
  onChange(handler, options) {
    return this._events.on('change', handler, options);
  }

  /**
   * @private
   * @param {string} locale
   * @param {string} key
   * @returns {string | undefined}
   */
  _lookup(locale, key) {
    const tree = this.messages[locale];
    if (!tree) return undefined;
    const value = key.split('.').reduce(
      (node, part) => (node == null ? undefined : node[part]),
      /** @type {any} */ (tree),
    );
    return typeof value === 'string' ? value : undefined;
  }
}

/**
 * Replace `{name}` placeholders with values; unknown placeholders are left intact.
 * @param {string} msg
 * @param {Record<string, string | number>} params
 * @returns {string}
 */
function interpolate(msg, params) {
  return msg.replace(/\{(\w+)\}/g, (whole, k) => (k in params ? String(params[k]) : whole));
}
