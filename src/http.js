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
 * @typedef {Object} RetryOptions
 * @property {number} retries - How many extra attempts after the first (so `2` means up to 3 tries).
 * @property {number} [delay] - Base backoff in ms before the first retry (default `300`).
 * @property {number} [factor] - Exponential multiplier between attempts (default `2`): 300, 600, 1200…
 * @property {(info: { error?: any, response?: Response, attempt: number }) => boolean} [when]
 *   - Decide whether a failure is worth retrying. Default: network errors and `5xx`/`429`
 *     responses; never `4xx` (those won't fix themselves).
 */

/**
 * The mutable context an interceptor sees: change `headers` (add an auth token) or `init`
 * (swap the body) in place before the request goes out.
 * @typedef {{ method: string, url: string, headers: Record<string, string>, init: RequestInit }} RequestContext
 */

/**
 * @typedef {Object} RequestOptions
 * @property {any} [body] - Request body. Plain objects are JSON-encoded; strings and `FormData` are sent as-is.
 * @property {Record<string, string>} [headers] - Extra headers for this request.
 * @property {AbortSignal} [signal] - Cancel this request (e.g. pass `view.signal`).
 * @property {Record<string, string | number | boolean>} [query] - Query params appended to the URL.
 * @property {number} [timeout] - Abort after this many milliseconds. Composed with `signal` via
 *   `AbortSignal.any`, so either cancelling the view OR the timeout aborts the request. A timeout
 *   rejects with a `TimeoutError` (not `AbortError`).
 * @property {number | RetryOptions} [retry] - Retry transient failures. A number is shorthand for
 *   `{ retries: n }`. Overrides the client default. Aborts/timeouts are never retried (the signal
 *   is already spent).
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
 *
 * Two opt-in extensions keep the transport honest instead of pushing this logic into every
 * caller: `onRequest`/`onResponse` interceptors (inject auth, refresh a token, log) and a
 * `retry` policy with exponential backoff for transient failures.
 */
export class Http {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseURL] - Prepended to every request path.
   * @param {Record<string, string>} [options.headers] - Default headers merged into every request.
   * @param {AbortSignal} [options.signal] - Default cancel signal for every request.
   * @param {number} [options.timeout] - Default per-request timeout in ms; a per-request `timeout` overrides it.
   * @param {number | RetryOptions} [options.retry] - Default retry policy; a per-request `retry` overrides it.
   * @param {(ctx: RequestContext) => void | Promise<void>} [options.onRequest] - Runs before each
   *   attempt (and again on every retry). Mutate `ctx.headers`/`ctx.init` to inject auth, etc.
   * @param {(res: Response, ctx: RequestContext) => Response | void | Promise<Response | void>} [options.onResponse]
   *   - Runs after each response, before status handling. Observe it, or return a replacement
   *     `Response` (e.g. after a token refresh) to continue with that one.
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
    /** @type {number | RetryOptions | undefined} Default retry policy. */
    this.retry = options.retry;
    /** @type {((ctx: RequestContext) => void | Promise<void>) | undefined} */
    this.onRequest = options.onRequest;
    /** @type {((res: Response, ctx: RequestContext) => Response | void | Promise<Response | void>) | undefined} */
    this.onResponse = options.onResponse;
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

    /** @type {RequestContext} */
    const ctx = { method, url, headers, init };
    const retry = normalizeRetry(options.retry ?? this.retry);

    for (let attempt = 0; ; attempt++) {
      try {
        if (this.onRequest) await this.onRequest(ctx);
        let res = await fetch(ctx.url, ctx.init);
        if (this.onResponse) res = (await this.onResponse(res, ctx)) ?? res;

        if (!res.ok && retry && attempt < retry.retries && retry.when({ response: res, attempt })) {
          await backoff(retry, attempt, ctx.init.signal);
          continue;
        }
        const data = await parseBody(res);
        if (!res.ok) throw new HttpError(res, data);
        return data;
      } catch (err) {
        // A non-2xx we already decided not to retry, or a real bug — surface it.
        if (err instanceof HttpError) throw err;
        // The signal is single-use, so a cancel/timeout can never be retried.
        if (isAbort(err)) throw err;
        if (retry && attempt < retry.retries && retry.when({ error: err, attempt })) {
          await backoff(retry, attempt, ctx.init.signal);
          continue;
        }
        throw err;
      }
    }
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
 * Normalize the `retry` option into a concrete policy, or `null` when retrying is off.
 * @param {number | RetryOptions | undefined} retry
 * @returns {{ retries: number, delay: number, factor: number, when: (info: { error?: any, response?: Response, attempt: number }) => boolean } | null}
 */
function normalizeRetry(retry) {
  if (!retry) return null;
  const opts = typeof retry === 'number' ? { retries: retry } : retry;
  if (!opts.retries || opts.retries < 1) return null;
  return {
    retries: opts.retries,
    delay: opts.delay ?? 300,
    factor: opts.factor ?? 2,
    when: opts.when ?? defaultRetryWhen,
  };
}

/**
 * Default retry predicate: retry network errors and `5xx`/`429`, but not other `4xx`.
 * @param {{ error?: any, response?: Response }} info
 * @returns {boolean}
 */
function defaultRetryWhen({ error, response }) {
  if (error) return true;
  if (response) return response.status >= 500 || response.status === 429;
  return false;
}

/**
 * Whether an error is a cancellation (user abort or timeout) — never retried.
 * @param {any} err
 * @returns {boolean}
 */
function isAbort(err) {
  return err?.name === 'AbortError' || err?.name === 'TimeoutError';
}

/**
 * Wait out the exponential backoff before the next attempt, staying cancellable: if the
 * request's `signal` aborts mid-wait, the delay rejects at once instead of dangling.
 * @param {{ delay: number, factor: number }} retry
 * @param {number} attempt - Zero-based index of the attempt that just failed.
 * @param {AbortSignal | undefined | null} signal
 * @returns {Promise<void>}
 */
function backoff(retry, attempt, signal) {
  const ms = retry.delay * retry.factor ** attempt;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
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
