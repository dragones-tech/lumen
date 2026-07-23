# svg

SVG como **tercera proyección** de tu estado — junto al DOM (`View`) y al canvas (`Node2D`). Una misma `Collection` puede alimentar una leyenda DOM, un gráfico de canvas y un gráfico SVG a la vez: una fuente de verdad, tres renderers.

## Filosofía

- **SVG es DOM retenido — así que `View` ya lo gestiona.** Todo el ciclo de vida de una vista (`onMount`, `signal`, `listen`, `refs` vía `data-ref`, `regions`, `animate`) corre sobre nodos SVG sin cambios, porque *son* DOM. Hit-testing, hover, foco y accesibilidad salen gratis — sin loop de render manual, sin `hitTest`.
- **SVG por modelos es simplemente `CollectionView`.** Monta las vistas hijas en un `<g data-ref="…">` dentro de un `<svg>` y cada modelo obtiene su propia vista SVG, sincronizada por la misma reconciliación keyed que el DOM. No hay `SvgLayer` — reutilizas lo que ya existe.
- **El único hueco es el namespace.** Un `<svg>…</svg>` completo en un `<template>` se parsea bien, así que una `View` con root `<svg>` ya funciona. Pero un `<circle>`/`<g>` *suelto* en un template cae en el namespace equivocado y nunca renderiza. `svg()` cierra ese hueco — es a SVG lo que `clone` a un `<template>` HTML.
- **Los generadores de `math` alimentan SVG sin cambios.** `polygonPoints`/`arcPoints`/`plotPoints` producen `[x,y][]`; `toPoints`/`toPath` los convierten en atributos `points`/`d` — los mismos puntos que darías a un `Line` de canvas.

## ¿Cuándo SVG, cuándo canvas?

| | SVG (este módulo) | Canvas (`canvas`) |
|---|---|---|
| Modelo | Nodos DOM retenidos | Redibujo immediate-mode |
| Interacción / a11y | Gratis (eventos DOM, `<title>`) | Manual (`hitTest`) |
| Estilo / glow | CSS (`filter: drop-shadow`, clases) | Pintado a mano |
| Nitidez | Vector a cualquier zoom | Ráster |
| Techo de escala | Cientos de nodos | Miles (partículas) |

Usa **SVG** para geometría nítida, interactiva y estilizable (gráficos, diagramas, HUDs); **canvas** cuando tengas miles de cosas en movimiento.

## API

| Función | Descripción |
|---|---|
| `svg(tag, attrs?, ...children)` | Crea un elemento SVG con namespace, fija `attrs`, añade hijos. Devuelve `SVGElement`. |
| `toPoints(points)` | `[x,y][]` → string `points` (`"x,y x,y …"`) para `<polyline>`/`<polygon>`. |
| `toPath(points, closed?)` | `[x,y][]` → string `d` de path (`"M x y L x y …"`), opcionalmente cerrado con `Z`. |

**`svg(tag, attrs, …children)`** — los valores de atributo se convierten a string; `true` fija un atributo sin valor, `false`/`null`/`undefined` lo omiten (así `cond && svg(...)` y los atributos opcionales funcionan solos). Los hijos pueden ser nodos o texto, sueltos o en arrays; los hijos falsy se omiten. Pon un `data-ref` en `attrs` y `refs()` recoge el nodo como a cualquier otro.

## Ejemplo — una barra por modelo, en SVG

El root SVG vive en un `<template>` (para que se parsee en el namespace SVG); los hijos montan en su `<g>`:

```html
<template id="chart">
  <svg viewBox="0 0 560 280">
    <g data-ref="bars"></g>
    <polyline data-ref="trend" fill="none" stroke="#888" points="" />
  </svg>
</template>
```

```js
import { View, CollectionView, svg, toPoints } from 'lumenjs';

// cada modelo → un <rect>, construido con svg() y actualizado quirúrgicamente
class SVGBar extends View {
  render() { return svg('rect', { rx: 3 }); }
  onMount() {
    const { model, collection } = this.props;
    const paint = () => {
      const i = collection.models.indexOf(model);
      const h = model.get('value') * 2;
      this.el.setAttribute('x', 46 + i * 96);
      this.el.setAttribute('y', 250 - h);
      this.el.setAttribute('width', 56);
      this.el.setAttribute('height', h);
      this.el.setAttribute('fill', model.color);
    };
    paint();
    model.on('change', paint, { signal: this.signal });
    this.listen(this.el, 'click', () => model.set('value', model.get('value') + 12)); // hit-test gratis
  }
}

class Chart extends CollectionView {
  static template = '#chart';
  static childView = SVGBar;
  static container = 'bars';
  childProps() { return { collection: this.collection }; }
}

new Chart({ collection: data }).mount(document.querySelector('#app'));
```

Un `<path>`/`<polyline>` alimentado por `math` es una línea — los mismos puntos que darías a un `Line` de canvas:

```js
import { plotPoints, wave } from 'lumenjs';
import { svg, toPath } from 'lumenjs';

const curve = svg('path', {
  d: toPath(plotPoints((x) => 120 + wave(x, { freq: 1 / 140, amp: 30 }), 0, 560, 4)),
  fill: 'none', stroke: '#38e0c8', 'stroke-width': 2,
});
```

Mira el [ejemplo `svg`](https://dragones-tech.github.io/lumen/examples/svg/) — una `Collection` como gráfico SVG **y** leyenda DOM, el hermano SVG del [spike de canvas](./canvas.md).

## Notas de diseño

- **Una View que renderiza SVG.** Sobrescribe `render()` para devolver `svg(...)` (una figura hija), o pon `static template` a un `<template>` con root `<svg>` (un diagrama completo). Ambos pasan por el ciclo de vida normal. En un proyecto type-checked, el retorno base de `render()` es `HTMLElement`; un `SVGElement` es un nodo DOM y funciona en runtime — castea si tu config de `tsc` es estricta con el retorno.
- **Namespace, una sola vez.** `svg()` es el único sitio donde aparece `createElementNS`. Todo lo que construyas a través de él — y cualquier `data-ref` dentro — se comporta como el resto de tu DOM.
- **No es un wrapper sobre `View`.** No hay clase `SvgView`, a propósito: SVG no necesitó un ciclo de vida nuevo, solo un factory de elementos con namespace. Ese es todo el módulo.
- **Cuidado con colisiones de `id`.** Las referencias de SVG (`filter`, `clipPath`, `mask`, `linearGradient`, un target de `<use>`…) se resuelven por `id` con `url(#id)`, que —como `getElementById`— toma el **primer** elemento con ese id en el orden del documento. Si un control del DOM comparte el id (un `<button id="glow">` junto a un `<filter id="glow">`), la referencia apunta en silencio al elemento equivocado y el efecto simplemente no se aplica. Da a los defs de SVG sus propios ids con namespace (`#glow-fx`, `#trace-mask`) para que nunca choquen con los controles de la página.
