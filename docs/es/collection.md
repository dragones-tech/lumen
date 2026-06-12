# Collection

Una lista ordenada de `Model`s con eventos estructurales. Se empareja con `CollectionView`
(módulo 7), que renderiza una vista por modelo.

## Filosofía

- **Las mutaciones se anuncian.** `add`, `remove` y `reset` cambian la lista y emiten un evento.
- **Las consultas nunca mutan.** `find`, `where`, `filter`, `map` y `sort` devuelven resultados y dejan el contenido y el orden de la colección intactos. (El `find`/`where`/`sort` del framework anterior *sobrescribía* la lista visible como efecto secundario de consultar — esto corrige esa trampa.)
- **Los cambios se propagan (bubbling).** El `change` de un modelo se reemite como un `change` a nivel de colección — reacciona a "cambió algo en la lista" sin una sub-vista por fila. Las suscripciones se gestionan por ti (se añaden en `add`/`reset`, se quitan en `remove`/`reset`), así un modelo removido no deja fugas. Para UI por fila, prefiere un `CollectionView` — cada modelo tiene su propia vista suscrita a su propio modelo, manteniendo las reacciones granulares.

## Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `add` | `{ model, index, collection }` | Se añadió un modelo. |
| `remove` | `{ model, index, collection }` | Se quitó un modelo. |
| `reset` | `{ models, collection }` | Se reemplazó toda la lista. |
| `change` | `{ model, keys, collection }` | Un modelo de la lista cambió (propagado). `keys` son los atributos cambiados. |

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
| `isDirty()` / `changed()` | Si algún modelo tiene ediciones sin guardar / el array de los que sí. |
| `commitAll()` / `revertAll()` | `commit()` / `revert()` en cada modelo (guardar / descartar en lote). Devuelve `this`. |
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

// `change` se propaga desde cualquier modelo — útil para un botón "Guardar todo" o un total en vivo:
todos.on('change', ({ model, keys }) => console.log(model.get('id'), 'cambió', keys));
todos.at(0).set('done', false);                     // → change { model: a, keys: ['done'] }

todos.add({ id: 3, text: 'c', done: false });

// Las consultas devuelven resultados SIN cambiar el orden de la colección:
todos.where({ done: false });                       // [model b, model c]
todos.sort((a, b) => a.get('text') < b.get('text') ? -1 : 1); // una COPIA ordenada
todos.map((m) => m.get('text'));                    // sigue ['a','b','c'] — sin cambios
```

## Lista editable — dirty tracking agregado

Apoyándose en el [seguimiento de cambios](model.md#seguimiento-de-cambios--ediciones-sin-guardar)
de cada modelo y en el `change` propagado, la colección responde "¿la lista entera tiene ediciones
sin guardar?" y guarda/descarta en lote — justo lo que necesita una tabla editable:

```js
todos.isDirty();        // true si CUALQUIER modelo tiene ediciones sin guardar
todos.changed();        // los modelos que cambiaron — para marcadores por fila

// Un solo handler mantiene honesto el botón Guardar-todo mientras el usuario edita o descarta:
todos.on('change', () => saveAllBtn.disabled = !todos.isDirty());

todos.revertAll();      // descartar — cada revert propaga change, así el botón se actualiza
await api.saveAll(todos.toJSON());
todos.commitAll();      // re-basa la lista entera — isDirty() vuelve a ser false
```

`revertAll()` revierte vía el `set` de cada modelo, así propaga `change` y las vistas reaccionan;
`commitAll()` no emite nada (ningún valor observable cambió) — recalcula justo después de llamarlo.

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
- El bubbling de `change` usa una única referencia de handler suscrita a cada modelo, así la colección suelta la suscripción de un modelo removido con un solo `off` — sin bookkeeping por modelo, sin fugas.
