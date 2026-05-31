# Http

Un wrapper pequeño y transparente sobre `fetch` (fase 2). Reemplaza al `requester` del
framework anterior.

## Filosofía

- **Fino sobre `fetch`.** Defaults sensatos — codificar/decodificar JSON y "lanzar en no-2xx" — y nada más. Sin interceptores mágicos, sin reintentos ocultos.
- **Cancelable, amigable con el ciclo de vida.** Pasa un `AbortSignal` (p. ej. el `this.signal` de una vista) y la petición se cancela sola cuando la vista se desmonta.
- **Los errores llevan datos.** Una respuesta no-2xx lanza `HttpError` con el status, el `Response` y el cuerpo ya parseado.

## API

| Miembro | Descripción |
|---|---|
| `new Http({ baseURL?, headers?, signal? })` | Configura un cliente. |
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

## Notas de diseño

- Los cuerpos se parsean por content-type: JSON cuando la respuesta es JSON, texto si no, `null` para `204`/vacío.
- Una petición cancelada rechaza con `AbortError` (comportamiento de la plataforma) — comprueba `e.name === 'AbortError'` para ignorarla.
- Sin instancia global: crea un `Http` por API/base URL y pásalo donde haga falta.
