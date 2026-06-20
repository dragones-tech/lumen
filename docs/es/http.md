# Http

Un wrapper pequeño y transparente sobre `fetch` (fase 2). Reemplaza al `requester` del
framework anterior.

## Filosofía

- **Fino sobre `fetch`.** Defaults sensatos — codificar/decodificar JSON y "lanzar en no-2xx" — y nada más por defecto. Interceptores y reintentos son **opt-in y explícitos**, nunca mágicos: no pasa nada si no lo pides.
- **Cancelable, amigable con el ciclo de vida.** Pasa un `AbortSignal` (p. ej. el `this.signal` de una vista) y la petición se cancela sola cuando la vista se desmonta.
- **Los errores llevan datos.** Una respuesta no-2xx lanza `HttpError` con el status, el `Response` y el cuerpo ya parseado.

## API

| Miembro | Descripción |
|---|---|
| `new Http({ baseURL?, headers?, signal?, timeout?, retry?, onRequest?, onResponse? })` | Configura un cliente. `timeout` (ms) y `retry` son defaults de cada petición. `onRequest`/`onResponse` son interceptores. |
| `get(path, options?)` | GET. Devuelve el cuerpo parseado. |
| `post(path, body?, options?)` | POST (objetos planos se codifican a JSON). |
| `put` / `patch(path, body?, options?)` | PUT / PATCH. |
| `delete(path, options?)` | DELETE. |
| `request(method, path, options?)` | La primitiva sobre la que se construyen los demás. |

### `RequestOptions`

| Opción | Descripción |
|---|---|
| `body` | Objeto plano → JSON; `string`/`FormData` se envían tal cual. |
| `headers` | Headers extra para esta petición. |
| `signal` | `AbortSignal` para cancelar (pasa `view.signal`). |
| `query` | Objeto de query params que se añaden a la URL. |
| `timeout` | Aborta tras N ms. Se compone con `signal` vía `AbortSignal.any`; sobreescribe el default del cliente. |
| `retry` | Reintenta fallos transitorios. Un número es atajo de `{ retries: n }`; sobreescribe el default del cliente. |

### `HttpError`

`status`, `response` y `body` (parseado). Se lanza en cualquier no-2xx.

## Ejemplo

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

## Con Collection + CollectionView

El patrón natural: haces fetch del JSON, lo metes en una `Collection` y dejas que un
`CollectionView` lo renderice.

```js
class UserList extends CollectionView {
  static childView = UserItem;
  async onMount() {
    super.onMount();
    try {
      const data = await api.get('/users', { signal: this.signal });
      this.collection.reset(data);            // CollectionView reconcilia
    } catch (e) {
      if (e.name !== 'AbortError') this.showError(e);
    }
  }
}
```

Como la petición usa `this.signal`, navegar a otra parte (que desmonta la vista) cancela un
fetch en vuelo — adiós a la clase de bug de "setState en una vista desmontada".

## Timeouts

Pasa `timeout` (ms) para abortar una petición lenta — construido sobre el `AbortSignal.timeout()`
de la plataforma, combinado con tu `signal` vía `AbortSignal.any()`, así que **o** cancelar la
vista **o** que salte el timeout aborta la petición. Pon un default en el cliente y sobreescribe
por petición:

```js
const api = new Http({ baseURL: 'https://api.example.com', timeout: 8000 });

await api.get('/slow', { timeout: 2000, signal: this.signal }); // override por petición
```

Un timeout rechaza con `TimeoutError` (no `AbortError`), así puedes distinguir "tardó demasiado"
de "el usuario navegó a otra parte":

```js
try {
  await api.get('/slow', { timeout: 2000, signal: this.signal });
} catch (e) {
  if (e.name === 'TimeoutError') this.showRetry();      // hizo timeout
  else if (e.name !== 'AbortError') this.showError(e);  // error real (ignora aborts por desmontaje)
}
```

## Interceptores

Dos hooks opcionales te dejan tocar cada petición sin envolver cada llamada. Viven en el
cliente, corren en la primitiva `request` y siguen siendo explícitos — tú pasas las
funciones, así que no hay nada oculto.

- **`onRequest(ctx)`** corre antes de cada intento (y de nuevo en cada reintento). El contexto
  es `{ method, url, headers, init }`, todo mutable — el uso canónico es inyectar auth.
- **`onResponse(res, ctx)`** corre tras cada respuesta, antes del manejo de status. Obsérvala, o
  devuelve un **`Response` de reemplazo** para continuar con ese (p. ej. tras refrescar un token).

```js
const api = new Http({
  baseURL: 'https://api.example.com',
  onRequest: (ctx) => { ctx.headers.Authorization = `Bearer ${getToken()}`; },
  onResponse: (res) => { if (res.status === 401) signOut(); },
});
```

Ambos pueden ser `async`, así que un refresh de token puede `await` antes de que la petición siga.

## Reintentos

Pasa `retry` para reintentar fallos transitorios con backoff exponencial. Un número es atajo
de `{ retries: n }`; la forma completa es `{ retries, delay = 300, factor = 2, when }`. Pon un
default en el cliente y sobreescribe por petición:

```js
const api = new Http({ baseURL: 'https://api.example.com', retry: 2 });

await api.get('/flaky', { retry: { retries: 3, delay: 500 } }); // override por petición
```

- El backoff entre intentos es `delay * factor ** attempt` — `300, 600, 1200…` por defecto.
- El `when` por defecto reintenta **errores de red** y respuestas **`5xx`/`429`**, y nunca otros
  `4xx` (un `404` no se va a arreglar solo). Pasa tu propio `when({ error?, response?, attempt })` para cambiarlo.
- La espera es **cancelable**: si el `signal` de la petición aborta a mitad del backoff, se corta al instante.
- **Aborts y timeouts nunca se reintentan** — un `AbortSignal` es de un solo uso, así que el reintento
  fallaría al instante de todos modos.

## Notas de diseño

- Los cuerpos se parsean por content-type: JSON cuando la respuesta es JSON, texto si no, `null` para `204`/vacío.
- Una petición cancelada rechaza con `AbortError` (comportamiento de la plataforma) — comprueba `e.name === 'AbortError'` para ignorarla. Un timeout rechaza con `TimeoutError`.
- Sin instancia global: crea un `Http` por API/base URL y pásalo donde haga falta.
