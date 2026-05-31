# Http

A small, transparent `fetch` wrapper (phase 2). It replaces the old framework's
`requester`.

## Philosophy

- **Thin over `fetch`.** Sensible defaults — JSON encode/decode and "throw on non-2xx" — and nothing else. No interceptors-by-magic, no hidden retries.
- **Cancellable, lifecycle-friendly.** Pass an `AbortSignal` (e.g. a view's `this.signal`) and the request is cancelled automatically when the view unmounts.
- **Errors carry data.** A non-2xx response throws `HttpError` with the status, the `Response`, and the already-parsed body.

## API

| Member | Description |
|---|---|
| `new Http({ baseURL?, headers?, signal? })` | Configure a client. |
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

## Design notes

- Bodies are parsed by content type: JSON when the response is JSON, text otherwise, `null` for `204`/empty.
- A cancelled request rejects with an `AbortError` (the platform's behavior) — check `e.name === 'AbortError'` to ignore it.
- No global instance: create one `Http` per API/base URL and pass it where needed.
