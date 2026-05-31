# Router

Un router de cliente pequeño, sobre los eventos nativos `hashchange`/`popstate`. Se empareja
con `Region` para cambiar pantallas según cambia la URL.

## Filosofía

- **Eventos, no polling.** Escucha los propios eventos de navegación del navegador. (El framework anterior consultaba la URL cada 50 ms con `setInterval` — derrochador y con latencia.)
- **Sin singleton.** Creas un router, registras rutas, `start()`.
- **Handlers planos.** Un handler de ruta es solo una función llamada con los params; `navigate` resuelve de inmediato (incluso en modo `history`, donde `pushState` no dispara `popstate`) — corrigiendo el bug viejo de que navegar no disparaba la ruta.

## API

| Miembro | Descripción |
|---|---|
| `new Router({ mode?, root? })` | `mode` es `'hash'` (por defecto) o `'history'`; `root` es la base para el modo history. |
| `add(pattern, handler)` | Registra una ruta. Los segmentos `:name` son params. Gana la primera coincidencia. |
| `notFound(handler)` | Handler cuando nada coincide (recibe el path). |
| `start()` / `stop()` | Empieza / deja de escuchar. `start()` también resuelve la URL actual. |
| `navigate(path)` | Cambia la URL y resuelve la ruta que coincide. |
| `current()` | El path actual normalizado. |

## Patrones

| Patrón | Coincide con | Params |
|---|---|---|
| `/` | `/` | `{}` |
| `/about` | `/about` | `{}` |
| `/users/:id` | `/users/42` | `{ id: '42' }` |
| `/posts/:cat/:slug` | `/posts/js/raw` | `{ cat: 'js', slug: 'raw' }` |

## Ejemplo (con una Region)

```js
import { Router, Region, View } from 'lumenjs';

const main = new Region('#outlet');

const router = new Router(); // modo hash
router
  .add('/',          () => main.show(new HomeView()))
  .add('/about',     () => main.show(new AboutView()))
  .add('/users/:id', ({ id }) => main.show(new UserView({ id })))
  .notFound(() => main.show(new NotFoundView()))
  .start();

// más adelante, en código:
router.navigate('/users/42');
// o en el markup (modo hash): <a href="#/users/42">User 42</a>
```

Cada ruta resuelve en un único `region.show(...)`, así la pantalla anterior sale animada y
la siguiente entra — la navegación obtiene transiciones gratis.

## Notas de diseño

- El modo `hash` no necesita configuración de servidor y es el predeterminado. El modo `history` da URLs limpias pero requiere que el servidor sirva tu app para paths desconocidos.
- `navigate` en modo `history` llama a `_resolve()` por su cuenta porque `pushState` no emite `popstate`.
- Los handlers reciben solo params; conserva `this` con un arrow o un método ligado si el handler es un método de clase (ver [View → estilos de handler](view.md)).
