// @ts-check

/**
 * Error thrown for non-2xx responses. Carries the status, the `Response`, and the
 * already-parsed body so callers can inspect server error payloads.
 */
export class HttpError extends Error {
  /**
   * @param {Response} response
   * @param {any} body - The parsed response body (JSON or text).
   */
  constructor(response, body) {
    super(`HTTP ${response.status} ${response.statusText}`);
    this.name = 'HttpError';
    /** @type {number} */
    this.status = response.status;
    /** @type {Response} */
    this.response = response;
    /** @type {any} */
    this.body = body;
  }
}

/**
 * @typedef {Object} RequestOptions
 * @property {any} [body] - Request body. Plain objects are JSON-encoded; strings and `FormData` are sent as-is.
 * @property {Record<string, string>} [headers] - Extra headers for this request.
 * @property {AbortSignal} [signal] - Cancel this request (e.g. pass `view.signal`).
 * @property {Record<string, string | number | boolean>} [query] - Query params appended to the URL.
 * @property {number} [timeout] - Abort after this many milliseconds. Composed with `signal` via
 *   `AbortSignal.any`, so either cancelling the view OR the timeout aborts the request. A timeout
 *   rejects with a `TimeoutError` (not `AbortError`).
 */

/**
 * A small, transparent `fetch` wrapper.
 *
 * No magic: it sets sensible defaults (JSON encode/decode, throw on non-2xx) and nothing
 * else. Create one with a `baseURL` and default `headers`, then call `get`/`post`/etc.
 * Pass a `signal` (such as a view's `this.signal`) to cancel a request automatically when
 * the view unmounts.
 *
 * ```js
 * const api = new Http({ baseURL: 'https://api.example.com' });
 * const users = await api.get('/users', { signal: this.signal });
 * await api.post('/users', { name: 'Ada' });
 * ```
 */
export class Http {
  /**
   * @param {{ baseURL?: string, headers?: Record<string, string>, signal?: AbortSignal, timeout?: number }} [options]
   *   `timeout` (ms) is the default applied to every request; a per-request `timeout` overrides it.
   */
  constructor(options = {}) {
    /** @type {string} */
    this.baseURL = options.baseURL ?? '';
    /** @type {Record<string, string>} */
    this.headers = options.headers ?? {};
    /** @type {AbortSignal | undefined} */
    this.signal = options.signal;
    /** @type {number | undefined} Default per-request timeout in milliseconds. */
    this.timeout = options.timeout;
  }

  /**
   * Perform a request. Resolves to the parsed body (JSON when the response is JSON,
   * otherwise text, or `null` for empty responses). Throws {@link HttpError} on non-2xx.
   *
   * @param {string} method - HTTP method.
   * @param {string} path - Appended to `baseURL`.
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  async request(method, path, options = {}) {
    let url = this.baseURL + path;
    if (options.query) {
      const usp = new URLSearchParams();
      for (const [k, v] of Object.entries(options.query)) usp.set(k, String(v));
      const qs = usp.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    /** @type {Record<string, string>} */
    const headers = { ...this.headers, ...options.headers };
    /** @type {RequestInit} */
    const init = { method, headers, signal: this._signal(options) };

    const { body } = options;
    if (body !== undefined) {
      if (body instanceof FormData || typeof body === 'string') {
        init.body = body;
      } else {
        init.body = JSON.stringify(body);
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      }
    }

    const res = await fetch(url, init);
    const data = await parseBody(res);
    if (!res.ok) throw new HttpError(res, data);
    return data;
  }

  /**
   * Build the effective `AbortSignal` for a request: the caller's `signal` (or the client
   * default), optionally combined with a timeout via `AbortSignal.any`.
   * @private
   * @param {RequestOptions} options
   * @returns {AbortSignal | undefined}
   */
  _signal(options) {
    const base = options.signal ?? this.signal;
    const ms = options.timeout ?? this.timeout;
    if (!ms) return base;
    const timeout = AbortSignal.timeout(ms);
    return base ? AbortSignal.any([base, timeout]) : timeout;
  }

  /** @param {string} path @param {RequestOptions} [options] @returns {Promise<any>} */
  get(path, options) { return this.request('GET', path, options); }

  /** @param {string} path @param {any} [body] @param {RequestOptions} [options] @returns {Promise<any>} */
  post(path, body, options) { return this.request('POST', path, { ...options, body }); }

  /** @param {string} path @param {any} [body] @param {RequestOptions} [options] @returns {Promise<any>} */
  put(path, body, options) { return this.request('PUT', path, { ...options, body }); }

  /** @param {string} path @param {any} [body] @param {RequestOptions} [options] @returns {Promise<any>} */
  patch(path, body, options) { return this.request('PATCH', path, { ...options, body }); }

  /** @param {string} path @param {RequestOptions} [options] @returns {Promise<any>} */
  delete(path, options) { return this.request('DELETE', path, options); }
}

/**
 * Parse a response body by content type.
 * @param {Response} res
 * @returns {Promise<any>}
 */
async function parseBody(res) {
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) return res.json().catch(() => null);
  return res.text();
}
