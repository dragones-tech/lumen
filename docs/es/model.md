# Model

Datos observables de una sola entidad (un usuario, un todo, un ajuste). Se empareja con
`Collection` (una lista de modelos, módulo 6).

## Filosofía

- **Estado explícito.** Lees con `get`, escribes con `set`. `set` emite eventos; mutar `model.data.x` directamente **no** notifica — a propósito, para que toda notificación tenga una causa visible. Sin proxies, sin intercepción oculta.
- **Granular, no total.** Un cambio emite `change:<clave>`, así una vista actualiza solo el nodo que cambió. No hay re-render total forzado (el framework anterior repintaba toda la vista ante cualquier cambio).
- **Sin crasheos con claves nuevas.** Asignar una clave que no estaba en los datos iniciales no falla. (El viejo `AbstractModel` lanzaba `TypeError` en ese caso.)
- **No-op con valores iguales.** `set` compara con `!==` estricto y se queda callado si nada cambió de verdad.

## Eventos

| Evento | Payload | Cuándo |
|---|---|---|
| `change:<clave>` | `{ value, previous, model }` | Cambió un atributo concreto. |
| `change` | `{ keys, model }` | Una vez por `set`, listando las claves cambiadas. |

## API

| Método | Descripción |
|---|---|
| `new Model(data)` | Crea con atributos iniciales (copiados, no referenciados). |
| `get(key)` / `get('a.b.c')` | Lee un atributo, o un valor anidado por dot-path (rama faltante → `undefined`). |
| `has(key)` / `has('a.b.c')` | Si el atributo **existe** (aunque su valor sea `undefined`). Soporta dot-path. |
| `set(key, value)` / `set('a.b.c', value)` / `set(patch)` | Escribe un atributo, un dot-path anidado (inmutable, crea ramas faltantes), o fusiona un objeto parcial. Devuelve `this`. |
| `unset(key)` / `unset('a.b.c')` | Elimina un atributo (no es lo mismo que ponerlo en `undefined`). Emite `change`. No-op si no está. Devuelve `this`. |
| `on(event, handler, { signal? })` | Suscribe. Devuelve una función para desuscribirse. |
| `once(event, handler, { signal? })` | Suscribe para una sola emisión. |
| `off(event, handler)` | Desuscribe. |
| `isDirty(key?)` | Si los atributos difieren de la última línea base confirmada (ediciones sin guardar). Con `key`, comprueba solo ese atributo. |
| `changedKeys()` | Los nombres de atributos que difieren de la línea base. |
| `changes()` | Un mapa `{ clave: { value, baseline } }` de cada atributo cambiado (`{}` = limpio). |
| `commit()` | Adopta los atributos actuales como la nueva línea base limpia (llámalo tras guardar). Devuelve `this`. |
| `revert(key?)` | Descarta ediciones sin guardar volviendo a la línea base — dispara eventos `change`. Con `key`, revierte solo ese atributo. Devuelve `this`. |
| `validate()` | Valida los atributos contra `static rules`. Devuelve errores por campo (`{}` = válido). |
| `isValid()` | Si los atributos pasan la validación. |
| `toJSON()` | Una copia superficial de los atributos. |

## Ejemplo: un modelo, observado quirúrgicamente

```js
import { Model } from 'lumenjs/model';

const profile = new Model({ name: 'Ada', color: '#2563eb' });

// Una vista se suscribe con su signal, así esto se limpia al desmontar,
// y actualiza SOLO el nodo que cambió.
profile.on('change:name',  ({ value }) => badge.textContent = value, { signal: view.signal });
profile.on('change:color', ({ value }) => badge.style.color = value, { signal: view.signal });

profile.set('name', 'Grace');   // dispara change:name + change
profile.set('name', 'Grace');   // no-op — valor sin cambio, callado
profile.set({ color: '#dc2626', role: 'admin' }); // la clave nueva 'role' está bien
```

## Usar un modelo dentro de una View

Suscríbete en `onMount` con `this.signal`:

```js
class Badge extends View {
  static template = '#badge';
  onMount() {
    const { model } = this.props;
    const paint = () => {
      this.ui.name.textContent = model.get('name');
      this.ui.name.style.color = model.get('color');
    };
    paint();
    model.on('change', paint, { signal: this.signal }); // se quita solo al desmontar
  }
}
```

## Tipa tus datos

```js
/** @type {Model<{ name: string, color: string }>} */
const profile = new Model({ name: 'Ada', color: '#2563eb' });
profile.get('name'); // string
```

## Validación

Un modelo es la única fuente de verdad de si sus datos son válidos. Declara `static rules`
y llama a `validate()`; la UI pinta los errores devueltos. Ver la [guía de validación](validate.md).

```js
import { Model, required, email } from 'lumenjs';

class User extends Model {
  static rules = { email: [required(), email()] };
}
new User({ email: 'mal' }).validate(); // { email: ['must be a valid email'] }
```

## Atributos anidados — dot-paths

Las respuestas de una API rara vez son planas. Cuando tu JSON anida
(`{ user: { address: { city } } }`), lee y escribe en profundidad con un **dot-path** en vez
de extraer la rama a mano:

```js
const m = new Model({ user: { name: 'Ada', address: { city: 'London' } } });

m.get('user.name');             // 'Ada'
m.get('user.address.city');     // 'London'
m.get('user.phone.work');       // undefined — una rama faltante nunca lanza
m.get('tags.0');                // los índices de array también funcionan

m.set('user.address.city', 'Oslo');   // escribe en profundidad
m.set('user.contact.email', 'a@x.io'); // crea la rama `contact` faltante
```

**Las escrituras son inmutables.** `set` clona cada rama del path (y crea las que falten), así
la referencia de nivel superior cambia y la detección `!==` de siempre sigue disparándose —
los hermanos no tocados conservan su identidad. El evento se ancla a la **raíz** del path:

```js
m.on('change:user', ({ value }) => render(value));  // dispara ante CUALQUIER edición bajo `user`
m.set('user.address.city', 'Oslo');                 // → change:user + change
```

Así una vista observa toda la rama que le importa (`change:user`) sin suscribirse a un conjunto
combinatorio de paths profundos. Como las escrituras son inmutables, el
[seguimiento de cambios](#seguimiento-de-cambios--ediciones-sin-guardar) funciona a través del
anidamiento sin cambios — `revert()` restaura el valor profundo y `commit()` lo re-basa.

> Los dot-paths aplican a las formas `get(path)` / `set(path, value)`. Las claves de un **objeto
> patch** (`set({ 'a.b': 1 })`) se toman **literalmente** — eso crea una clave llamada `'a.b'`,
> a propósito.

## Presencia — `has` y `unset`

`has` responde "¿existe este atributo?" — una pregunta distinta de "¿cuál es su valor?".
Un campo puesto en `undefined` sí *existe*; uno que nunca se asignó, no:

```js
const m = new Model({ name: 'Ada', nickname: undefined });
m.has('name');      // true
m.has('nickname');  // true  — presente, aunque su valor sea undefined
m.has('age');       // false — nunca se asignó
m.get('age');       // undefined  ← mismo valor que nickname, pero has() los distingue
```

`unset` elimina de verdad una clave — a diferencia de `set(key, undefined)`, que la mantiene
presente. Emite `change:<clave>`/`change` como cualquier edición, es un no-op silencioso si la
clave no estaba, y ambos soportan dot-path:

```js
m.unset('nickname');        // dispara change:nickname + change
m.has('nickname');          // false
m.toJSON();                 // { name: 'Ada' } — eliminado
m.unset('user.address.zip'); // quita la hoja de forma inmutable, dispara change:user
```

## Seguimiento de cambios — ediciones sin guardar

Un modelo recuerda una **línea base**: su último estado limpio confirmado. Editar lo vuelve
*sucio*; `commit()` adopta los valores actuales como nueva línea base; `revert()` descarta las
ediciones. Nada se contabiliza dentro de `set` — la suciedad se deriva por comparación, así que
se mantiene honesta.

```js
const draft = new Model({ title: 'Sin título', body: '' });

draft.isDirty();            // false — coincide con la línea base
draft.set('title', 'Lumen 1.0');
draft.isDirty();            // true
draft.isDirty('body');     // false — solo cambió `title`
draft.changes();           // { title: { value: 'Lumen 1.0', baseline: 'Sin título' } }

draft.revert();            // restaura la línea base — dispara change:title, las vistas se actualizan quirúrgicamente
draft.isDirty();           // false

// Tras un guardado exitoso, haz de los valores actuales la nueva línea base limpia:
await api.save(draft.toJSON());
draft.commit();            // isDirty() === false de nuevo, sin emitir eventos
```

Esto es justo lo que un formulario necesita: habilita el botón **Guardar** solo
`while (model.isDirty())`, conecta **Descartar** a `revert()`, y `commit()` cuando el servidor
confirme. Como `revert()` pasa por `set`, cada vista observadora reacciona por la misma ruta
`change` que cualquier edición.

## Datos derivados — el modelo como su propio presenter

El JSON de la API llega plano (`{ status: 'done', due: 1699… }`), pero las vistas necesitan
valores de *presentación* que no vienen en él: un color para un estado, un flag "está vencido",
una etiqueta legible. No los guardes ni los recalcules en cada vista — **un `Model` es una clase
de verdad, así que exprésalos una sola vez como getters**. Cada vista que pinte el modelo los
reutiliza:

```js
class Task extends Model {
  get color()     { return { todo: '#9ca3af', doing: '#2563eb', done: '#16a34a' }[this.get('status')]; }
  get isOverdue() { return !this.get('done') && this.get('due') < Date.now(); }
  get label()     { return this.get('title').trim() || '(sin título)'; }
}
```

```js
// la vista lee el valor derivado — nunca reimplementa el mapa de colores:
const paint = () => {
  this.el.style.setProperty('--accent', model.color);
  this.el.classList.toggle('is-overdue', model.isOverdue);
};
paint();
model.on('change', paint, { signal: this.signal });
```

Esto es el patrón **presenter / view-model**: la capa que convierte datos crudos en valores
listos para pintar. En Lumen esa capa *es* la subclase de `Model` — sin objeto decorator aparte,
porque "qué color le toca a una tarea `done`" es parte del *significado* del dato.

- **La reactividad sigue siendo explícita.** Un getter no emite su propio `change:color`, ni le
  hace falta. `color` deriva de `status`, así que la vista escucha la clave *origen*
  (`change:status`, o `change`) y recalcula. La dependencia está escrita en el handler, no oculta
  tras un tracker.
- **Los getters no se serializan.** `toJSON()` solo expande `data`, así que los derivados nunca
  se cuelan en un payload de guardado. Si quieres un snapshot *con* ellos, añade tu propio `toView()`.
- **La posición no es dato derivado — pertenece a la `Collection`.** El índice de un modelo
  depende de la lista, no de sí mismo, así que no lo pongas en el modelo (se desincronizaría al
  insertar/quitar). Léelo de la colección (`collection.models.indexOf(model)`, o el `index` de los
  eventos `add`/`remove`) o pásalo con `childProps(model)` de un `CollectionView`.
- **El comportamiento de *render* compartido (p. ej. la misma animación de entrada/salida)** es
  trabajo de la View, no del modelo — factorízalo en una subclase base de `View`. Ver
  [View › comportamiento de render compartido](view.md#comportamiento-de-render-compartido).

## Notas de diseño

- La notificación lleva `previous` y `value`, así los observadores pueden comparar sin guardar su propia copia.
- `change` se dispara una vez por `set`, incluso con un patch de varias claves, así un listener de "algo cambió, recalcula" corre una sola vez.
- Construido directo sobre `EventEmitter`; las suscripciones aceptan un `AbortSignal`, que es lo que hace que la integración con View no tenga fugas.
