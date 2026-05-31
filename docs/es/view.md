# View

La clase base abstracta de todo lo que se ve. **Una vista es una clase — extiendes `View`.**
Envuelve las primitivas de `dom` (`clone` + `refs`), un ciclo de vida explícito y una
limpieza sin fugas, para que nunca cablees esa plomería a mano.

## Filosofía

- **OOP, no funciones.** Una vista es una clase con comportamiento y ciclo de vida. Los helpers sin estado (`clone`, `refs`, `fadeIn`…) son las primitivas que usa por dentro.
- **Una clase normal, no un Custom Element.** Mantienes el control total del ciclo de vida, así `animateOut()` termina *antes* de que el nodo salga del DOM. (El `disconnectedCallback` de un Custom Element solo se dispara *después* de quitarlo — demasiado tarde para animar la salida.)
- **Actualizaciones quirúrgicas, sin re-render.** Cambias nodos en `this.ui` directamente. Nunca se pierde el foco, el scroll ni el estado de los inputs. (El framework anterior hacía `innerHTML = ''` en cada cambio; Lumen jamás.)
- **Limpieza simétrica y automática.** Los listeners atados a `this.signal` (o con `this.listen(...)`) se quitan en `unmount()` — sin fugas, y sin el bug del framework anterior de "listener re-suscrito en cada update".

## Ciclo de vida, en orden

1. `new View(props)` — barato; no se construye ni se toca nada todavía.
2. `build()` (lo llama `mount`) — `render()` crea `el`, `refs()` llena `ui`, luego `onCreate()`. Corre una vez.
3. `mount(parent)` — inserta `el`, marca `mounted`, llama `onMount()`, espera `animateIn()`.
4. `unmount()` — espera `animateOut()`, desmonta hijos, llama `onUnmount()`, aborta `signal`, quita `el`.

Cablea listeners en `onMount()` (se re-cablean al re-montar); haz la configuración única en `onCreate()`.

## API

| Miembro | Descripción |
|---|---|
| `static template` | Un selector de `<template>` (p. ej. `'#card'`) o el elemento, usado por el `render()` por defecto. |
| `props` | Los datos/handlers pasados al constructor. |
| `el` | El elemento raíz (`null` hasta `build()`/`mount()`). |
| `ui` | Los elementos `[data-ref]`, por clave. |
| `events` | Un `EventEmitter` por vista para hablar con un padre. |
| `signal` | Un `AbortSignal` atado al tiempo montado — ata listeners con él para limpieza automática. |
| `mounted` | Si la vista está en el DOM. |
| `render()` | Construye el nodo raíz. Por defecto clona `static template`; sobreescribe para construirlo distinto. |
| `build()` | Crea `el` + `ui` (idempotente). |
| `mount(parent)` | Inserta y corre el ciclo de montaje. Devuelve `Promise<this>`. |
| `unmount()` | Anima la salida, desmonta hijos, limpia, quita. Devuelve `Promise<void>`. |
| `addChild(child, parent?)` | Monta un hijo (padre por defecto: `this.el`) y lo registra para desmontaje en cascada. |
| `removeChild(child)` | Desregistra y desmonta un hijo. |
| `listen(target, type, handler, options?)` | `addEventListener` atado a `signal` (se quita solo al desmontar). |
| `onCreate / onMount / onUnmount` | Hooks de ciclo de vida (sobreescribibles). |
| `animateIn / animateOut` | Hooks de transición; devuelven una Promesa (sobreescribibles). |

## Ejemplo

```html
<template id="note">
  <div class="note">
    <span data-ref="text"></span>
    <button data-ref="remove">×</button>
  </div>
</template>
```

```js
import { View } from 'lumenjs/view';
import { slideIn, slideOut } from 'lumenjs/animate';

class Note extends View {
  static template = '#note';

  onMount() {
    this.ui.text.textContent = this.props.text;
    // Atado a signal → se quita solo al desmontar.
    this.listen(this.ui.remove, 'click', () => this.props.onRemove(this));
  }
  onUnmount() { /* timers/suscripciones se limpian solos vía signal */ }

  animateIn()  { return slideIn(this.el); }
  animateOut() { return slideOut(this.el); } // se reproduce completo ANTES de quitar
}

await new Note({ text: 'Hola', onRemove: (n) => n.unmount() }).mount(document.body);
```

## Tipar tus refs

Extiende con un genérico para que `this.ui` quede tipado:

```js
/** @extends {View<{ text: HTMLElement, remove: HTMLButtonElement }>} */
class Note extends View {
  static template = '#note';
  onMount() {
    this.ui.text;   // HTMLElement
    this.ui.remove; // HTMLButtonElement
  }
}
```

## Estilos de handler

Lumen no fuerza un estilo de handler — cualquier enfoque estándar sirve. El único trabajo
del framework es que `this` no se pierda y limpiar al desmontar (eso es `listen` + `signal`).
Elige el que prefiera tu equipo. Tres comunes, con sus trade-offs:

**1. Campo arrow auto-bound** — el handler es un campo de clase; lo referencias directo.
```js
onMount() { this.listen(this.ui.name, 'input', this.onNameInput); }
onNameInput = () => this.props.model.set('name', this.ui.name.value);
```
Sin arrow inline, sin `bind`, `this` siempre correcto. Vive por-instancia (no en el prototipo), así que no se sobreescribe vía `super`.

**2. Método ligado una vez** — la idea de `@boundMethod` sin decorador; liga en `onCreate`.
```js
onCreate() { this.onNameInput = this.onNameInput.bind(this); }
onMount()  { this.listen(this.ui.name, 'input', this.onNameInput); }
onNameInput() { this.props.model.set('name', this.ui.name.value); }
```
El método queda en el prototipo (compartido, sobreescribible), a costa de una línea de bind.

**3. Método + arrow de cableado** — referencia el método con un arrow fino.
```js
onMount() { this.listen(this.ui.name, 'input', () => this.onNameInput()); }
onNameInput() { this.props.model.set('name', this.ui.name.value); }
```
Método en el prototipo; el arrow conserva `this`, a costa de una función inline en el cableado.

> Nunca pases una referencia cruda y sin ligar (`this.listen(el, 'input', this.onNameInput)`) — el `this` se pierde dentro.

Los ejemplos usan los estilos 1 y 3; ninguno es "el" correcto.

## Regiones (layouts)

Declara `static regions` — un mapa de nombre de región → el `data-ref` de su hueco — y se
crea una `Region` por cada una como `this.regions.<nombre>`. Se vacían automáticamente en
`unmount()`, así que **los layouts anidados se desmontan en cascada**.

```html
<template id="app-layout">
  <div class="app">
    <header data-ref="header"></header>
    <aside  data-ref="sidebar"></aside>
    <main   data-ref="main"></main>
  </div>
</template>
```

```js
class AppLayout extends View {
  static template = '#app-layout';
  static regions = { header: 'header', sidebar: 'sidebar', main: 'main' };
  onMount() {
    this.regions.header.show(new NavBar());
    this.regions.sidebar.show(new Menu());
    this.regions.main.show(new Dashboard());   // Dashboard puede declarar SUS propias regiones
  }
}
```

Una vista mostrada en una región puede tener regiones a su vez, hasta donde quieras. Cuando
`AppLayout` se desmonta, vacía sus regiones → cada vista mostrada se desmonta → esa vista
vacía *sus* regiones → y así. No escribes nada de teardown.

> `View` (contenido) vs `Region` (un hueco que intercambia qué vista se muestra). Un layout
> es una View cuyos huecos son Regions llenadas con otras Views. Ver [region](region.md).

## Hablar con un padre

Dos patrones, ambos explícitos:

- **Callbacks por props** (lo más simple): pasa `onRemove`, llama `this.props.onRemove(this)`.
- **Eventos por vista**: `this.events.emit('remove', this)`; el padre hace
  `child.events.on('remove', handler, { signal: child.signal })`.

## Notas de diseño

- `build()` corre `render()`/`refs()` *después* de que la subclase está totalmente construida (lo llama `mount`, no el constructor), así un `render()` u `onCreate()` sobreescritos pueden usar campos de la subclase sin problemas — sin el footgun del orden de inicialización de campos.
- `unmount()` crea un `AbortController` nuevo al final, así una vista puede desmontarse y volverse a montar; los listeners se re-cablean en `onMount()`.
- La composición es explícita: `addChild` monta y registra; `unmount` cae en cascada a los hijos. No hay registro padre/hijo oculto.
