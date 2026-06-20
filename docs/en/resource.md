# Resource

Observable **server state** — the stale-while-revalidate (SWR) pattern, kept small and
transparent. It's the piece every data-loading view otherwise re-implements by hand:
a cache, request dedupe, background revalidation, and mutations.

## Philosophy

- **A peer, not a wrapper.** `Resource` sits beside `Model`/`Collection` as an observable state primitive. It does **not** patch `Http`; it *consumes* a plain `fetcher` (often `(key) => http.get(key)`), so the transport stays a transport and the cache stays a cache.
- **Stale-while-revalidate.** A `read` returns whatever is cached **instantly**, then revalidates in the background — the UI never blocks on a network round-trip it already has an answer for.
- **Explicit sharing, no singleton.** One `Resource` instance is a cache you create and pass around — exactly like an `EventEmitter` bus or an `Http` client. Two views that share the instance share the cache and dedupe each other's requests. Nothing is global.
- **Errors are state, not exceptions.** A failed fetch lands in the key's `error`; background revalidation never throws. For imperative "fetch and throw on error", call `Http` directly.

## State

Every key exposes a `ResourceState`:

| Field | Meaning |
|---|---|
| `data` | The last successfully fetched value (`undefined` until the first success). |
| `error` | The last fetch error (`undefined` when the latest fetch succeeded). |
| `isLoading` | **First** load: no data yet *and* a fetch is in flight → render a skeleton. |
| `isValidating` | **Any** fetch in flight, including a background revalidation over existing data → render a subtle spinner. |

## API

| Member | Description |
|---|---|
| `new Resource({ fetcher, dedupe? })` | `fetcher(key)` loads the data and receives the original (un-serialized) key. `dedupe` (ms, default `2000`) is the window in which a `read` of a fresh key skips refetching. |
| `get(key)` | The current cached `ResourceState` **without** triggering a fetch. |
| `read(key, handler?, { signal? })` | Return the cached snapshot now, trigger a background fetch if missing/stale, and (with `handler`) subscribe to later changes. The main entry in `onMount()`. |
| `subscribe(key, handler, { signal? })` | Subscribe to a key's changes **without** triggering a fetch. Returns an unsubscribe function. |
| `revalidate(key)` | Force a refetch (deduped). Never rejects — errors land in state. Resolves when the fetch settles. |
| `mutate(key, data?, options?)` | Update the cache, then (by default) revalidate. See [Mutations](#mutations). Resolves to the freshest data. |
| `clear(key?)` | Drop one key, or the whole cache with no argument. Subscribers stay subscribed and get a reset (empty) state. |

Keys are strings, or anything JSON-serializable (e.g. `['users', id]`) — keep array parts in
a stable order. In-flight requests are **always** deduped, regardless of the `dedupe` window.

## Example

Create one resource for the app and pass it to views. A view reads in `onMount`, binds the
subscription to its `signal`, and renders each state it receives:

```js
import { Http } from 'lumenjs/http';
import { Resource } from 'lumenjs/resource';

const http = new Http({ baseURL: 'https://api.example.com' });
const resource = new Resource({ fetcher: (key) => http.get(key) });

class UserCard extends View {
  static template = '#user-card';
  onMount() {
    const state = this.props.resource.read('/users/1', (s) => this.render(s), { signal: this.signal });
    this.render(state); // the cached snapshot now; the handler fires on every later change
  }
  render({ data, error, isLoading }) {
    if (isLoading) return this.showSkeleton();
    if (error) return this.showError(error);
    this.ui.name.textContent = data.name;
  }
}

new UserCard({ resource }).mount(document.querySelector('#app'));
```

Because the subscription is bound to `this.signal`, unmounting the view detaches it
automatically — no leak, no "update on unmounted view".

## Mutations

`mutate` is one method with four shapes, from simplest to richest:

```js
resource.mutate('/users/1');                       // invalidate → refetch
resource.mutate('/users/1', { name: 'Ada' });      // write a value into the cache
resource.mutate('/users/1', (prev) => ({ ...prev, seen: true })); // derive from current
```

The fourth shape is an **optimistic update with rollback**: pass the server write itself as a
`Promise`, show `optimisticData` immediately, and let `Resource` reconcile — on success it
writes the resolved result (then revalidates); on failure it restores the previous data.

```js
const patch = { name: 'Ada Lovelace' };
await resource.mutate('/users/1', http.patch('/users/1', patch), {
  optimisticData: { ...currentUser, ...patch },
});
// UI shows the new name instantly; if the PATCH rejects, it rolls back to currentUser.
```

| Option | Default | Meaning |
|---|---|---|
| `revalidate` | `true` | Refetch from the server after the local write. |
| `optimisticData` | — | Value to show immediately while a passed `Promise` resolves. |
| `rollbackOnError` | `true` | Restore the previous data if the `Promise` rejects. |

A rejected optimistic `mutate` re-throws after rolling back, so you can still `catch` it to
show a toast.

## Design notes

- **Dedupe vs. revalidate window.** Two views mounting at once share a single in-flight request (in-flight dedupe). A `read` within `dedupe` ms of the last successful fetch skips the network entirely; past that window it serves cached data **and** revalidates.
- **`isLoading` vs. `isValidating`.** Use `isLoading` to decide *skeleton vs. content* (first paint) and `isValidating` for a *background refresh* indicator. They overlap only on the very first fetch.
- **`clear` keeps subscriptions.** On logout, `resource.clear()` wipes every entry and pushes an empty state to live views without unsubscribing them — the views simply re-render as "loading/empty".
- **Pair with `Http`.** The natural `fetcher` is `(key) => http.get(key)`; retries, timeouts, and auth interceptors all live in `Http`, so `Resource` inherits them for free.
- **No global instance.** Create one `Resource` per cache scope and pass it where needed (props, a shared module). Sharing is always explicit.
