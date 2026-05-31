# defineElement (adaptador a Custom Element)

Registra una `View` de Lumen como Custom Element, para usarla como `<tag-name>` en HTML plano
— o consumirla dentro de React/Vue/Angular. Es la **puerta de escape** para distribuir un
widget; tu clase sigue siendo una `View` normal.

## Por qué un adaptador (y no Custom Elements en todo)

Las vistas de Lumen son clases normales por defecto justamente para que mantengas el control
del ciclo de vida — p. ej. que `animateOut()` termine antes de quitar el nodo. Los Custom
Elements no pueden (`disconnectedCallback` se dispara *después* de quitarlo). Así que Lumen
invierte la decisión habitual: clases por defecto, Custom Element solo cuando necesitas
interop — vía este adaptador fino.

## API

```js
defineElement(tagName, ViewClass, { attributes? })
```

| Parámetro | Descripción |
|---|---|
| `tagName` | Nombre de custom element (debe llevar guion), p. ej. `'hello-widget'`. |
| `ViewClass` | La subclase de `View` a envolver. |
| `options.attributes` | Atributos a mantener sincronizados con `props` tras montar (`observedAttributes`). |

## Ejemplo

```js
import { View, defineElement } from 'lumen';

class Hello extends View {
  static template = '#hello';
  onMount() { this.ui.name.textContent = this.props.name; }
}

defineElement('hello-widget', Hello);
```

```html
<hello-widget name="Ada"></hello-widget>
<hello-widget name="Grace"></hello-widget>   <!-- instancias independientes -->
```

- **Atributos → props.** Al conectarse, cada atributo se lee en `props` (valores string).
- **Datos complejos → `.props`.** Para objetos o callbacks, asigna la propiedad `.props` del elemento antes de insertarlo: `el.props = { onSave }`.
- **Ciclo de vida.** Conectar monta la vista en el host; desconectar la desmonta (corre la limpieza).

## Matiz: sin animación de salida

El navegador quita el nodo *antes* de `disconnectedCallback`, así que `animateOut()` no puede
reproducirse cuando se quita el host — la limpieza (abortar signal, `onUnmount`) sí corre.
Es justo la limitación que mantiene las clases normales como default; el adaptador es para
interop, donde no se esperan animaciones de salida.

## Notas de diseño

- `element.js` no importa nada — envuelve cualquier objeto con `mount`/`unmount`/`props` (duck-typing), así no añade acoplamiento al grafo del framework.
- `defineElement` es idempotente (una segunda llamada para el mismo tag es no-op).
