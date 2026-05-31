# Collection

Una lista ordenada de `Model`s con eventos estructurales. Se empareja con `CollectionView`
(módulo 7), que renderiza una vista por modelo.

## Filosofía

- **Las mutaciones se anuncian.** `add`, `remove` y `reset` cambian la lista y emiten un evento.
- **Las consultas nunca mutan.** `find`, `where`, `filter`, `map` y `sort` devuelven resultados y dejan el contenido y el orden de la colección intactos. (El `find`/`where`/`sort` del framework anterior *sobrescribía* la lista visible como efecto secundario de consultar — esto corrige esa trampa.)
- **Reacciones locales.** Los cambios por modelo no se propagan aquí; en un `CollectionView` cada modelo tiene su propia vista suscrita a su propio modelo, así las reacciones quedan granulares.

## Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `add` | `{ model, index, collection }` | Se añadió un modelo. |
| `remove` | `{ model, index, collection }` | Se quitó un modelo. |
| `reset` | `{ models, collection }` | Se reemplazó toda la lista. |

## API

| Miembro | Descripción |
|---|---|
| `new Collection(items?, Model?)` | Envuelve datos planos con `Model` (una subclase), o pasa instancias de `Model`. |
| `length` / `at(i)` / `get(id)` | Tamaño, acceso por índice, búsqueda por atributo `id`. |
| `add(item)` | Añade al final (envolviendo datos). Emite `add`. Devuelve el modelo. |
| `remove(model)` | Quita. Emite `remove`. No-op si no está. |
| `reset(items?)` | Reemplaza todo. Emite `reset`. |
| `find(fn)` | Primera coincidencia, o `undefined`. |
| `where(attrs)` | Array nuevo de modelos que coinciden con todos los atributos. |
| `filter(fn)` / `map(fn)` / `forEach(fn)` | Estándar, sin mutar. |
| `sort(compare)` | Una **copia ordenada** — no reordena la colección. |
| `on/once/off(event, handler, { signal? })` | Suscribe / desuscribe. |
| `toJSON()` | Array con los datos de cada modelo. |
| `for…of` | Itera los modelos. |

## Ejemplo

```js
import { Collection } from 'lumenjs/collection';
import { Model } from 'lumenjs/model';

class Todo extends Model {}

const todos = new Collection([
  { id: 1, text: 'a', done: true },
  { id: 2, text: 'b', done: false },
], Todo);

todos.on('add',    ({ model }) => console.log('añadido', model.get('text')));
todos.on('remove', ({ model }) => console.log('quitado', model.get('text')));

todos.add({ id: 3, text: 'c', done: false });

// Las consultas devuelven resultados SIN cambiar el orden de la colección:
todos.where({ done: false });                       // [model b, model c]
todos.sort((a, b) => a.get('text') < b.get('text') ? -1 : 1); // una COPIA ordenada
todos.map((m) => m.get('text'));                    // sigue ['a','b','c'] — sin cambios
```

## Tipalo

```js
/** @typedef {{ id: number, text: string, done: boolean }} TodoData */
/** @type {Collection<TodoData, Todo>} */
const todos = new Collection([], Todo);
```

## Notas de diseño

- `sort` devuelve una copia en vez de ordenar in situ, así una consulta nunca puede reordenar lo que ven los observadores. Para presentar otro orden, renderiza desde el array devuelto (o, luego, pásalo a un `CollectionView`).
- Construido sobre `EventEmitter`; las suscripciones aceptan un `AbortSignal`, así una vista puede suscribirse con `this.signal` y limpiarse al desmontar.
- `add`/`remove` llevan el `index`, que `CollectionView` usará para insertar o quitar una sola vista hija sin reconstruir la lista.
