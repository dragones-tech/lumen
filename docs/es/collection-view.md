# CollectionView

Renderiza una vista hija (`View`) por cada modelo de una `Collection`, y las mantiene
sincronizadas mediante **reconciliación por key**.

> **Una `Collection` se aprovecha mejor con un `CollectionView`.** La colección es la capa
> de datos — guarda modelos y anuncia cambios estructurales. El `CollectionView` es lo que
> lo convierte en UI: mapea cada modelo a una vista y reacciona a `add`/`remove`/`reset`
> montando o desmontando **solo** la vista afectada. Usar una colección sin un
> `CollectionView` significa re-renderizar listas a mano; emparejarlas es el camino previsto.

## Filosofía

- **Incremental, no reconstruido.** En `add`, monta una vista (con su `animateIn`); en `remove`, desmonta una (su `animateOut` se reproduce primero); las hermanas no se tocan. (El framework anterior recreaba cada hija en cada render — y se rompía en la segunda pasada.)
- **Por key.** Un `Map` de modelo → vista hija es el índice, así se encuentra la hija correcta en O(1) para quitarla.
- **Compuesto de piezas que ya conoces.** Es una subclase de `View`; las hijas se registran con `addChild`, así desmontar la lista cae en cascada a cada hija y limpia todo.

## Configura con estáticos

| Estático | Requerido | Descripción |
|---|---|---|
| `childView` | sí | La subclase de `View` a instanciar por modelo. |
| `template` | no | Un `<template>`; las hijas montan en el ref `container` (o la raíz). |
| `container` | no | El nombre `data-ref` del elemento donde montan las hijas. Por defecto: la raíz. |
| `tag` | no | Si no hay `template`, el tag de la raíz auto-creada. Por defecto `'div'`. |

Pasa la colección como prop: `new TodoList({ collection })`. Cada vista hija recibe
`{ model }` más lo que devuelvas de `childProps(model)`.

## Ejemplo

```html
<template id="todo-list">
  <div>
    <form data-ref="form"><input data-ref="input" placeholder="Nuevo todo…" /></form>
    <ul data-ref="items"></ul>
  </div>
</template>
<template id="todo-item">
  <li><label><input type="checkbox" data-ref="check"> <span data-ref="text"></span></label>
      <button data-ref="remove">×</button></li>
</template>
```

```js
import { Collection, Model, View, CollectionView, slideIn, slideOut } from 'lumen';

class Todo extends Model {}

class TodoItem extends View {
  static template = '#todo-item';
  onMount() {
    const { model } = this.props;
    this.ui.text.textContent = model.get('text');
    this.ui.check.checked = model.get('done');
    this.listen(this.ui.check, 'change', this.toggle);
    this.listen(this.ui.remove, 'click', this.remove);
  }
  toggle = () => this.props.model.set('done', this.ui.check.checked);
  remove = () => this.props.onRemove();           // lo provee childProps de la lista
  animateIn()  { return slideIn(this.el); }
  animateOut() { return slideOut(this.el); }
}

class TodoList extends CollectionView {
  static template  = '#todo-list';
  static childView = TodoItem;
  static container = 'items';                      // las hijas montan en ui.items
  onMount() {
    super.onMount();                               // arma la reconciliación
    this.listen(this.ui.form, 'submit', this.onSubmit);
  }
  onSubmit = (e) => {
    e.preventDefault();
    const text = this.ui.input.value.trim();
    if (text) this.collection.add({ text, done: false });
    this.ui.input.value = '';
  };
  childProps(model) {
    return { onRemove: () => this.collection.remove(model) };
  }
}

const todos = new Collection([], Todo);
new TodoList({ collection: todos }).mount(document.body);
```

Añadir un todo agrega un modelo → la lista monta un `TodoItem` nuevo (entrando). Quitar
llama a `collection.remove` → la lista desmonta esa única hija (saliendo primero). Nada
más se re-renderiza.

## Notas de diseño

- `CollectionView` sobreescribe `View.render()` para clonar `template` o crear un elemento `tag`; todo lo demás (ciclo de vida, desmontaje en cascada, limpieza por signal) se hereda.
- Las suscripciones a la colección usan `this.signal`, así se quitan al desmontar la lista.
- `childProps(model)` es la costura para pasar callbacks por-hija o dependencias compartidas sin acoplar la hija a la colección.
- La colección hoy agrega al final en `add`, así las hijas se añaden en orden. Reordenar es una consulta (`sort` devuelve una copia) y no emite, así que el orden renderizado sigue la inserción; renderiza desde un array ordenado si necesitas otro orden.
