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
| `get(key)` | Lee un atributo. |
| `set(key, value)` / `set(patch)` | Escribe un atributo o fusiona un objeto parcial. Devuelve `this`. |
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

## Notas de diseño

- La notificación lleva `previous` y `value`, así los observadores pueden comparar sin guardar su propia copia.
- `change` se dispara una vez por `set`, incluso con un patch de varias claves, así un listener de "algo cambió, recalcula" corre una sola vez.
- Construido directo sobre `EventEmitter`; las suscripciones aceptan un `AbortSignal`, que es lo que hace que la integración con View no tenga fugas.
