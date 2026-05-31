# dom

Helpers de DOM — el puente entre tu HTML separado (elementos `<template>`) y tus clases de componente.

## Filosofía

- **Sin magia.** `clone` es un clon profundo cómodo de un `<template>`, `refs` es un `querySelectorAll` recogido en un objeto, y `$`/`$$` son envoltorios tipados. Importar el módulo **no tiene efectos secundarios**: no toca `window`, no observa el documento. (El framework anterior instalaba un `window.createElement` global y un `MutationObserver` de todo el documento al importar; Lumen no hace ninguna de las dos.)
- **El patrón:** escribe el markup una vez en un `<template>` → `clone()` un nodo nuevo → `refs()` los elementos que vas a actualizar. El componente toca solo lo que cambió, en vez de repintar todo su subárbol.

## API

| Función | Devuelve | Descripción |
|---|---|---|
| `$(selector, root?)` | `Element \| null` | `querySelector`, tipado y con alcance (root por defecto `document`). |
| `$$(selector, root?)` | `Element[]` | `querySelectorAll` como array real, no un NodeList vivo. |
| `clone(template, root?)` | `HTMLElement` | Clon profundo del único elemento raíz de un `<template>`. Acepta un `<template>` o un selector. |
| `refs(root)` | `Record<string, HTMLElement>` | Recoge cada descendiente `[data-ref]` en un objeto por clave. |

## Convenciones

- **Una raíz por template.** `clone()` devuelve el primer elemento hijo del template. Envuelve el markup de cada componente en un único elemento raíz.
- **`data-ref` para las referencias.** `<button data-ref="save">` → `refs.save`. El elemento raíz se incluye si tiene `data-ref`. `data-ref` es para el markup *propio* de un componente; los hijos manejan los suyos.

## Ejemplo

```html
<template id="card">
  <article class="card">
    <h2 data-ref="title"></h2>
    <button data-ref="save">Guardar</button>
  </article>
</template>
```

```js
import { clone, refs } from 'lumen/dom';

const el = clone('#card');          // <article> nuevo y desconectado
const ui = refs(el);                // { title, save }

ui.title.textContent = 'Hola';
ui.save.onclick = () => console.log('guardado');

document.body.appendChild(el);
```

Tipar el mapa de refs (opcional) te da autocompletado:

```js
/** @type {{ title: HTMLElement, save: HTMLButtonElement }} */
const ui = refs(el);
```

## Notas de diseño

- `$$` expande el NodeList a un array para que puedas `map`/`filter` directo y no sea vivo.
- `clone` lanza un error claro si el template falta o está vacío — los fallos son ruidosos, no silenciosos.
- `clone` devuelve a propósito un único elemento (no un fragmento): la raíz de un componente es un solo nodo, lo que simplifica `mount`/`unmount` y las animaciones.
- No se incluye un helper `el()`/hyperscript por defecto — el markup vive en `<template>`. Se puede añadir luego si algún caso necesita nodos puramente programáticos.
