// @ts-check

/**
 * A small client-side router built on native `hashchange`/`popstate` events.
 *
 * No polling: the old framework checked the URL every 50ms with `setInterval`; Lumen
 * listens for the browser's own navigation events instead. No global singleton — create
 * a router, register routes, `start()`. It pairs naturally with a `Region`: a route
 * handler calls `region.show(new SomeView())`.
 *
 * Patterns use `:name` for params: `'/users/:id'` matches `/users/42` and calls the
 * handler with `{ id: '42' }`. The first registered route that matches wins.
 *
 * @typedef {(params: Record<string, string>) => void} RouteHandler
 * @typedef {{ pattern: string, regex: RegExp, keys: string[], handler: RouteHandler }} Route
 */
export class Router {
  /**
   * @param {{ mode?: 'hash' | 'history', root?: string }} [options]
   *   `mode` defaults to `'hash'` (no server config needed). `root` is the base path for
   *   `'history'` mode (e.g. `'/app'`).
   */
  constructor(options = {}) {
    /** @type {'hash' | 'history'} */
    this.mode = options.mode ?? 'hash';
    /** @type {string} */
    this.root = options.root ?? '/';
    /** @private @type {Route[]} */
    this._routes = [];
    /** @private @type {((path: string) => void) | null} */
    this._notFound = null;
    /** @private */
    this._started = false;
    /** @private */
    this._onChange = () => this._resolve();
  }

  /**
   * Register a route. `:name` segments become named params.
   * @param {string} pattern - e.g. `'/'`, `'/about'`, `'/users/:id'`.
   * @param {RouteHandler} handler - Called with the matched params.
   * @returns {this}
   */
  add(pattern, handler) {
    /** @type {string[]} */
    const keys = [];
    let body = pattern.replace(/\/+$/, ''); // trim trailing slash
    body = body.replace(/:([^/]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    body = body.replace(/\//g, '\\/');
    this._routes.push({ pattern, regex: new RegExp('^' + body + '\\/?$'), keys, handler });
    return this;
  }

  /**
   * Set the handler used when no route matches.
   * @param {(path: string) => void} handler
   * @returns {this}
   */
  notFound(handler) {
    this._notFound = handler;
    return this;
  }

  /**
   * Begin listening for navigation events and resolve the current URL.
   * @returns {this}
   */
  start() {
    if (this._started) return this;
    this._started = true;
    window.addEventListener(this.mode === 'history' ? 'popstate' : 'hashchange', this._onChange);
    this._resolve();
    return this;
  }

  /**
   * Stop listening.
   * @returns {this}
   */
  stop() {
    window.removeEventListener(this.mode === 'history' ? 'popstate' : 'hashchange', this._onChange);
    this._started = false;
    return this;
  }

  /**
   * The current path, normalized with a leading slash and no surrounding slashes.
   * @returns {string}
   */
  current() {
    if (this.mode === 'history') {
      let path = decodeURI(window.location.pathname);
      if (this.root !== '/' && path.startsWith(this.root)) path = path.slice(this.root.length);
      return '/' + path.replace(/^\/+|\/+$/g, '');
    }
    return '/' + window.location.hash.replace(/^#!?/, '').replace(/^\/+|\/+$/g, '');
  }

  /**
   * Navigate to a path. Updates the URL and resolves the matching route.
   * @param {string} path
   * @returns {this}
   */
  navigate(path) {
    const clean = '/' + String(path).replace(/^\/+|\/+$/g, '');
    if (this.mode === 'history') {
      const base = this.root === '/' ? '' : this.root;
      window.history.pushState(null, '', (base + clean) || '/');
      this._resolve(); // pushState does not fire popstate, so resolve explicitly
    } else {
      window.location.hash = clean; // fires hashchange → _resolve
    }
    return this;
  }

  /**
   * Match the current path and invoke the first matching handler (or `notFound`).
   * @private
   * @returns {void}
   */
  _resolve() {
    const path = this.current();
    for (const route of this._routes) {
      const match = route.regex.exec(path);
      if (match) {
        /** @type {Record<string, string>} */
        const params = {};
        route.keys.forEach((key, i) => {
          params[key] = decodeURIComponent(match[i + 1]);
        });
        route.handler(params);
        return;
      }
    }
    if (this._notFound) this._notFound(path);
  }
}
