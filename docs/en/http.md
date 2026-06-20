# Http

A small, transparent `fetch` wrapper (phase 2). It replaces the old framework's
`requester`.

## Philosophy

- **Thin over `fetch`.** Sensible defaults — JSON encode/decode and "throw on non-2xx" — and nothing else by default. Interceptors and retry are **opt-in and explicit**, never magic: nothing happens unless you ask for it.
- **Cancellable, lifecycle-friendly.** Pass an `AbortSignal` (e.g. a view's `this.signal`) and the request is cancelled automatically when the view unmounts.
- **Errors carry data.** A non-2xx response throws `HttpError` with the status, the `Response`, and the already-parsed body.

## API

| Member | Description |
|---|---|
| `new Http({ baseURL?, headers?, signal?, timeout?, retry?, onRequest?, onResponse? })` | Configure a client. `timeout` (ms) and `retry` are defaults for every request. `onRequest`/`onResponse` are interceptors. |
| `get(path, options?)` | GET. Returns the parsed body. |
| `post(path, body?, options?)` | POST (plain objects are JSON-encoded). |
| `put` / `patch(path, body?, options?)` | PUT / PATCH. |
| `delete(path, options?)` | DELETE. |
| `request(method, path, options?)` | The primitive the rest build on. |

### `RequestOptions`

| Option | Description |
|---|---|
| `body` | Plain object → JSON; `string`/`FormData` sent as-is. |
| `headers` | Extra headers for this request. |
| `signal` | `AbortSignal` to cancel (pass `view.signal`). |
| `query` | Object of query params appended to the URL. |
| `timeout` | Abort after N ms. Composed with `signal` via `AbortSignal.any`; overrides the client default. |
| `retry` | Retry transient failures. A number is shorthand for `{ retries: n }`; overrides the client default. |

### `HttpError`

`status`, `response`, and `body` (parsed). Thrown on any non-2xx.

## Example

```js
import { Http, HttpError } from 'lumenjs/http';

const api = new Http({ baseURL: 'https://api.example.com', headers: { Authorization: 'Bearer …' } });

const users = await api.get('/users', { query: { active: true }, signal: this.signal });
await api.post('/users', { name: 'Ada' });

try {
  await api.get('/missing');
} catch (e) {
  if (e instanceof HttpError) console.log(e.status, e.body);
}
```

## With Collection + CollectionView

The natural pattern: fetch JSON, drop it into a `Collection`, let a `CollectionView`
render it.

```js
class UserList extends CollectionView {
  static childView = UserItem;
  async onMount() {
    super.onMount();
    try {
      const data = await api.get('/users', { signal: this.signal });
      this.collection.reset(data);            // CollectionView reconciles
    } catch (e) {
      if (e.name !== 'AbortError') this.showError(e);
    }
  }
}
```

Because the request uses `this.signal`, navigating away (which unmounts the view) cancels
an in-flight fetch — no "setState on unmounted view" class of bug.

## Timeouts

Pass `timeout` (ms) to abort a slow request — built on the platform's `AbortSignal.timeout()`,
combined with your `signal` via `AbortSignal.any()`, so **either** cancelling the view **or**
the timeout firing aborts the request. Set a default on the client, override per request:

```js
const api = new Http({ baseURL: 'https://api.example.com', timeout: 8000 });

await api.get('/slow', { timeout: 2000, signal: this.signal }); // per-request override
```

A timeout rejects with a `TimeoutError` (not an `AbortError`), so you can tell "took too long"
apart from "user navigated away":

```js
try {
  await api.get('/slow', { timeout: 2000, signal: this.signal });
} catch (e) {
  if (e.name === 'TimeoutError') this.showRetry();      // it timed out
  else if (e.name !== 'AbortError') this.showError(e);  // real error (ignore unmount aborts)
}
```

## Interceptors

Two optional hooks let you touch every request without wrapping each call site. They live
on the client, run on the primitive `request`, and stay explicit — you pass the functions, so
there is nothing hidden.

- **`onRequest(ctx)`** runs before each attempt (and again on every retry). The context is
  `{ method, url, headers, init }`, all mutable — the canonical use is injecting auth.
- **`onResponse(res, ctx)`** runs after each response, before status handling. Observe it, or
  return a **replacement `Response`** to continue with that one (e.g. after refreshing a token).

```js
const api = new Http({
  baseURL: 'https://api.example.com',
  onRequest: (ctx) => { ctx.headers.Authorization = `Bearer ${getToken()}`; },
  onResponse: (res) => { if (res.status === 401) signOut(); },
});
```

Both may be `async`, so a token refresh can `await` before the request proceeds.

## Retry

Pass `retry` to retry transient failures with exponential backoff. A number is shorthand
for `{ retries: n }`; the full form is `{ retries, delay = 300, factor = 2, when }`. Set a
default on the client and override per request:

```js
const api = new Http({ baseURL: 'https://api.example.com', retry: 2 });

await api.get('/flaky', { retry: { retries: 3, delay: 500 } }); // per-request override
```

- Backoff between attempts is `delay * factor ** attempt` — `300, 600, 1200…` by default.
- The default `when` retries **network errors** and **`5xx`/`429`** responses, and never other
  `4xx` (a `404` won't fix itself). Pass your own `when({ error?, response?, attempt })` to change that.
- The wait is **cancellable**: if the request's `signal` aborts mid-backoff, it stops at once.
- **Aborts and timeouts are never retried** — an `AbortSignal` is single-use, so the retry would
  fail instantly anyway.

## Design notes

- Bodies are parsed by content type: JSON when the response is JSON, text otherwise, `null` for `204`/empty.
- A cancelled request rejects with an `AbortError` (the platform's behavior) — check `e.name === 'AbortError'` to ignore it. A timeout rejects with a `TimeoutError`.
- No global instance: create one `Http` per API/base URL and pass it where needed.
