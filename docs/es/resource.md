# Resource

Estado de servidor **observable** — el patrón stale-while-revalidate (SWR), pequeño y
transparente. Es la pieza que toda vista que carga datos reimplementa a mano: una caché,
deduplicación de peticiones, revalidación en segundo plano y mutaciones.

## Filosofía

- **Un peer, no un wrapper.** `Resource` se sitúa junto a `Model`/`Collection` como primitivo de estado observable. **No** parchea `Http`; *consume* un `fetcher` simple (normalmente `(key) => http.get(key)`), así el transporte sigue siendo transporte y la caché sigue siendo caché.
- **Stale-while-revalidate.** Un `read` devuelve lo cacheado **al instante** y revalida en segundo plano — la UI nunca se bloquea esperando una respuesta de red que ya tiene.
- **Compartir explícito, sin singleton.** Una instancia de `Resource` es una caché que creas y pasas — igual que un bus `EventEmitter` o un cliente `Http`. Dos vistas que comparten la instancia comparten la caché y deduplican sus peticiones. Nada es global.
- **Los errores son estado, no excepciones.** Un fetch fallido queda en el `error` de la clave; la revalidación en segundo plano nunca lanza. Para un "carga y lanza si falla" imperativo, usa `Http` directamente.

## Estado

Cada clave expone un `ResourceState`:

| Campo | Significado |
|---|---|
| `data` | El último valor cargado con éxito (`undefined` hasta el primer éxito). |
| `error` | El último error de fetch (`undefined` cuando el fetch más reciente fue bien). |
| `isLoading` | **Primera** carga: aún no hay datos *y* hay un fetch en vuelo → muestra un skeleton. |
| `isValidating` | **Cualquier** fetch en vuelo, incluida una revalidación en segundo plano sobre datos existentes → muestra un spinner sutil. |

## API

| Miembro | Descripción |
|---|---|
| `new Resource({ fetcher, dedupe? })` | `fetcher(key)` carga los datos y recibe la clave original (sin serializar). `dedupe` (ms, por defecto `2000`) es la ventana en la que un `read` de una clave fresca evita refetch. |
| `get(key)` | El `ResourceState` cacheado actual **sin** disparar un fetch. |
| `read(key, handler?, { signal? })` | Devuelve el snapshot cacheado ahora, dispara un fetch en segundo plano si falta o está obsoleto y (con `handler`) se suscribe a los cambios posteriores. La entrada principal en `onMount()`. |
| `subscribe(key, handler, { signal? })` | Se suscribe a los cambios de una clave **sin** disparar un fetch. Devuelve una función para desuscribir. |
| `revalidate(key)` | Fuerza un refetch (deduplicado). Nunca rechaza — los errores quedan en el estado. Resuelve cuando el fetch termina. |
| `mutate(key, data?, options?)` | Actualiza la caché y (por defecto) revalida. Ver [Mutaciones](#mutaciones). Resuelve a los datos más frescos. |
| `clear(key?)` | Elimina una clave, o toda la caché sin argumento. Los suscriptores siguen suscritos y reciben un estado reset (vacío). |

Las claves son strings, o cualquier cosa serializable a JSON (p. ej. `['users', id]`) — mantén
las partes del array en orden estable. Las peticiones en vuelo se deduplican **siempre**,
independientemente de la ventana `dedupe`.

## Ejemplo

Crea un resource para la app y pásalo a las vistas. Una vista lee en `onMount`, ata la
suscripción a su `signal` y pinta cada estado que recibe:

```js
import { Http } from 'lumenjs/http';
import { Resource } from 'lumenjs/resource';

const http = new Http({ baseURL: 'https://api.example.com' });
const resource = new Resource({ fetcher: (key) => http.get(key) });

class UserCard extends View {
  static template = '#user-card';
  onMount() {
    const state = this.props.resource.read('/users/1', (s) => this.render(s), { signal: this.signal });
    this.render(state); // el snapshot cacheado ahora; el handler se dispara en cada cambio posterior
  }
  render({ data, error, isLoading }) {
    if (isLoading) return this.showSkeleton();
    if (error) return this.showError(error);
    this.ui.name.textContent = data.name;
  }
}

new UserCard({ resource }).mount(document.querySelector('#app'));
```

Como la suscripción está atada a `this.signal`, desmontar la vista la desconecta
automáticamente — sin fugas, sin "actualizar una vista desmontada".

## Mutaciones

`mutate` es un solo método con cuatro formas, de la más simple a la más rica:

```js
resource.mutate('/users/1');                       // invalidar → refetch
resource.mutate('/users/1', { name: 'Ada' });      // escribir un valor en la caché
resource.mutate('/users/1', (prev) => ({ ...prev, seen: true })); // derivar del actual
```

La cuarta forma es una **actualización optimista con rollback**: pasa la propia escritura al
servidor como `Promise`, muestra `optimisticData` de inmediato y deja que `Resource`
reconcilie — en éxito escribe el resultado resuelto (y luego revalida); en fallo restaura los
datos anteriores.

```js
const patch = { name: 'Ada Lovelace' };
await resource.mutate('/users/1', http.patch('/users/1', patch), {
  optimisticData: { ...currentUser, ...patch },
});
// La UI muestra el nuevo nombre al instante; si el PATCH rechaza, hace rollback a currentUser.
```

| Opción | Defecto | Significado |
|---|---|---|
| `revalidate` | `true` | Refetch del servidor tras la escritura local. |
| `optimisticData` | — | Valor a mostrar de inmediato mientras una `Promise` resuelve. |
| `rollbackOnError` | `true` | Restaura los datos anteriores si la `Promise` rechaza. |

Un `mutate` optimista rechazado vuelve a lanzar tras el rollback, así que puedes `catch`-earlo
para mostrar un aviso.

## Notas de diseño

- **Dedupe vs. ventana de revalidación.** Dos vistas que montan a la vez comparten una única petición en vuelo (dedupe en vuelo). Un `read` dentro de `dedupe` ms del último fetch con éxito evita la red por completo; pasada esa ventana, sirve los datos cacheados **y** revalida.
- **`isLoading` vs. `isValidating`.** Usa `isLoading` para decidir *skeleton vs. contenido* (primer pintado) y `isValidating` para un indicador de *refresco en segundo plano*. Solo coinciden en el primerísimo fetch.
- **`clear` conserva las suscripciones.** Al cerrar sesión, `resource.clear()` borra todas las entradas y empuja un estado vacío a las vistas vivas sin desuscribirlas — las vistas simplemente vuelven a pintarse como "cargando/vacío".
- **Combina con `Http`.** El `fetcher` natural es `(key) => http.get(key)`; reintentos, timeouts e interceptores de auth viven en `Http`, así que `Resource` los hereda gratis.
- **Sin instancia global.** Crea un `Resource` por ámbito de caché y pásalo donde haga falta (props, un módulo compartido). Compartir siempre es explícito.
