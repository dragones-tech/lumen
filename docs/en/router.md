# Router

A small client-side router built on native `hashchange`/`popstate` events. It pairs with
`Region` to swap screens as the URL changes.

## Philosophy

- **Events, not polling.** It listens to the browser's own navigation events. (The old framework polled the URL every 50 ms with `setInterval` — wasteful and laggy.)
- **No singleton.** Create a router, register routes, `start()`.
- **Plain handlers.** A route handler is just a function called with the matched params; `navigate` resolves immediately (even in `history` mode, where `pushState` doesn't fire `popstate`) — fixing the old bug where navigation didn't trigger the route.

## API

| Member | Description |
|---|---|
| `new Router({ mode?, root? })` | `mode` is `'hash'` (default) or `'history'`; `root` is the base path for history mode. |
| `add(pattern, handler)` | Register a route. `:name` segments become params. First match wins. |
| `notFound(handler)` | Handler when nothing matches (receives the path). |
| `start()` / `stop()` | Begin / end listening. `start()` also resolves the current URL. |
| `navigate(path)` | Change the URL and resolve the matching route. |
| `current()` | The current normalized path. |

## Patterns

| Pattern | Matches | Params |
|---|---|---|
| `/` | `/` | `{}` |
| `/about` | `/about` | `{}` |
| `/users/:id` | `/users/42` | `{ id: '42' }` |
| `/posts/:cat/:slug` | `/posts/js/raw` | `{ cat: 'js', slug: 'raw' }` |

## Example (with a Region)

```js
import { Router, Region, View } from 'lumen';

const main = new Region('#outlet');

const router = new Router(); // hash mode
router
  .add('/',          () => main.show(new HomeView()))
  .add('/about',     () => main.show(new AboutView()))
  .add('/users/:id', ({ id }) => main.show(new UserView({ id })))
  .notFound(() => main.show(new NotFoundView()))
  .start();

// later, in code:
router.navigate('/users/42');
// or in markup (hash mode): <a href="#/users/42">User 42</a>
```

Each route resolves to a single `region.show(...)`, so the previous screen animates out
and the next animates in — navigation gets transitions for free.

## Design notes

- `hash` mode needs no server configuration and is the default. `history` mode gives clean URLs but needs the server to serve your app for unknown paths.
- `navigate` in `history` mode calls `_resolve()` itself because `pushState` does not emit `popstate`.
- Handlers receive only params; keep `this` via an arrow or a bound method if a handler is a class method (see [View → event handler styles](view.md)).
