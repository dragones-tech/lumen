# Canvas (experimental)

Una capa mínima de render sobre HTML canvas. La capa de datos — `Model`, `Collection`,
`EventEmitter`, `signal` — es **agnóstica del renderer**, así que el *mismo* estado puede alimentar
una `View` de DOM **y** un nodo de canvas a la vez: **una fuente de verdad, dos proyecciones**. Este
módulo es la proyección de canvas.

> **Joven y deliberadamente diminuto.** Solo contexto 2D, escena plana (un nivel de anidamiento),
> sin pipeline de assets. Es para los casos donde un motor completo es desproporcionado — una gráfica
> de barras, un sparkline, partículas, un diagrama arrastrable. Cuando necesites miles de sprites,
> WebGL o filtros, **engancha Pixi** (y maneja sus objetos desde `Model`s de Lumen — misma idea,
> motor más grande).

## Filosofía

- **Un estado, dos proyecciones.** Nada que "sincronizar": un solo `Model`/`Collection` alimenta un
  `CollectionView` de DOM y un `CanvasLayer` de canvas, cada uno suscrito a los mismos eventos. Las
  libs de canvas independientes son islas de estado; aquí el canvas es solo otro lector de tus datos.
- **Immediate mode, con honestidad.** El DOM es retenido (mutas un nodo, el navegador repinta). El
  canvas es inmediato — limpias y redibujas cada frame. Así el mantra "sin re-render total" se
  *invierte*: los eventos deciden **cuándo** redibujar (un dirty flag), no qué mutar.
- **Un solo loop unificado.** On-demand por default — un cambio agenda un único frame y el stage
  queda idle (cero frames). El ticker continuo arranca solo mientras haya animadores (tweens,
  emisores) y se auto-apaga al terminar. Una gráfica estática no cuesta nada; las partículas igual
  animan.
- **Reusa, no reinventes.** No importa runtime de Lumen — solo *consume* los eventos de una
  `Collection`. Tu código de estado y validación no cambia, renderice a DOM o a canvas.

## El mapa de clases — DOM ↔ canvas

| Rol | DOM | Canvas |
|---|---|---|
| Un objeto | `View` | `Node2D` (base de las formas; **no** es una View — sin DOM) |
| Primitivos concretos | *(tus vistas)* | `Rect`, `Circle`, `Line`, `Text` |
| Lista: 1 por modelo | `CollectionView` | `CanvasLayer` |
| Slot / contenedor | `Region` | `Stage` |
| Estado | `Model` / `Collection` | el **mismo** `Model` / `Collection` |

La columna de estado es **compartida** — las otras dos son proyecciones intercambiables que coexisten.

## API

### `Stage`

| Miembro | Descripción |
|---|---|
| `new Stage(canvas)` | Envuelve un `HTMLCanvasElement`; arranca el loop. |
| `add(node)` / `remove(node)` | Agrega/quita un nodo raíz (dispara `onAdd`/`onRemove`). Devuelve el nodo. |
| `invalidate()` | Marca la escena dirty → un frame, luego idle. |
| `animate(update)` | Registra un `(dt) => void` por frame (un tween/emisor). Devuelve un de-registrador; el ticker corre mientras haya alguno. |
| `hitTest(px, py)` | Nodo más arriba en un punto del canvas, o `null` (translate + scale; rotación es fase 2). |
| `destroy()` | Detiene el loop y aborta `signal`. |
| `signal` | Un `AbortSignal` para la vida del stage. |

### `Node2D` — la base (toda forma la extiende)

Campos: `x`, `y`, `scale`, `rotation`, `alpha`, `visible`, `model`.

| Miembro | Descripción |
|---|---|
| `onAdd()` / `onRemove()` | Hooks de ciclo de vida (≈ `onMount`/`onUnmount`). |
| `update(dt)` | Avanza movimiento por tiempo (partículas/física). `dt` en segundos. |
| `paint(ctx)` | **Sobreescribe esto** — dibuja, en un contexto ya transformado por este nodo. |
| `draw(ctx)` | Aplica transform + alpha, llama a `paint`, restaura. Rara vez se sobreescribe. |
| `animate(to, { duration?, easing? })` | Tween de campos hacia `to` sobre el loop. Devuelve `Promise`; reemplaza un tween en curso. |
| `stop()` | Cancela el tween en curso. |
| `contains(x, y)` | Hit-test en espacio local (sobreescribe por forma). Lo usa `Stage.hitTest`. |
| `stage` / `signal` | El stage al que está anclado y su signal. |

### Formas

| Forma | Campos | Hit test |
|---|---|---|
| `Rect` | `w`, `h`, `fill`, `stroke`, `lineWidth` | ✅ caja |
| `Circle` | `r`, `fill`, `stroke`, `lineWidth` | ✅ radio |
| `Line` | `points` (`[x,y][]`), `stroke`, `lineWidth`, `closed` | — |
| `Text` | `text`, `font`, `fill`, `align`, `baseline` | — |

### `CanvasLayer` — un nodo por modelo

| Miembro | Descripción |
|---|---|
| `new CanvasLayer(collection, factory, props?)` | `factory(model, index)` construye un nodo por modelo. |
| `children` | Los nodos hijos, en orden de la colección. |

Reconciliación con `add`/`remove`/`reset` de la colección, y un `change` propagado de cualquier
modelo invalida el stage. La misma `Collection` puede alimentar un `CollectionView` de DOM a la vez.

### Easings

`linear`, `easeOutCubic`, `easeInOutCubic` — funciones puras `t → t` para `animate`.

## Ejemplo: un estado, dos proyecciones

```js
import { Model, Collection, View, CollectionView } from 'lumenjs';
import { Stage, Node2D, CanvasLayer, easeOutCubic } from 'lumenjs/canvas';

// ── un estado — con un getter derivado reutilizado por AMBAS proyecciones ──
class Bar extends Model {
  get color() { const v = this.get('value'); return v >= 80 ? '#dc2626' : v >= 50 ? '#f59e0b' : '#2563eb'; }
}
const data = new Collection([{ label: 'Q1', value: 40 }, { label: 'Q2', value: 92 }], Bar);

// ── proyección A — canvas ──
class BarNode extends Node2D {
  paint(ctx) { ctx.fillStyle = this.model.color; ctx.fillRect(0, -this.h, 56, this.h); }
  contains(x, y) { return x >= 0 && x <= 56 && y <= 0 && y >= -this.h; }
  onAdd() {
    this.animate({ h: this.model.get('value') * 2 }, { duration: 600, easing: easeOutCubic });
    this.model.on('change:value', ({ value }) => this.animate({ h: value * 2 }), { signal: this.signal });
  }
}
const stage = new Stage(document.querySelector('#chart'));
stage.add(new CanvasLayer(data, () => new BarNode({ h: 0 }), { x: 50, y: 250 }));

// ── proyección B — DOM (un CollectionView normal sobre la MISMA colección) ──
class BarLabel extends View { /* … pinta model.get('label'), model.get('value'), model.color … */ }
class Legend extends CollectionView { static childView = BarLabel; static container = 'list'; }
new Legend({ collection: data }).mount(aside);

// edita una vez → ambas proyecciones reaccionan:
data.get('q2')?.set('value', 30);
```

Ver el ejemplo **`canvas`** para la gráfica completa, y el ejemplo **`particles`** para el lado del
ticker continuo.

## Movimiento — el modelo dice *dónde*, el nodo dice *cómo*

El movimiento es presentación, igual que la división de [datos derivados](model.md#datos-derivados--el-modelo-como-su-propio-presenter):
el modelo guarda el valor objetivo, `animate` decide cómo llega el nodo ahí.

```js
bar.model.on('change:value', ({ value }) =>
  bar.animate({ h: value * 2 }, { duration: 400 }), { signal: bar.signal });
// snap en vez de tween: bar.h = value * 2; stage.invalidate();
```

Para movimiento abierto (sin destino), sobreescribe `update(dt)` e integra por tiempo — un emisor de
partículas registra un animador continuo y avanza su array cada frame:

```js
class Emitter extends Node2D {
  play()  { this._stop = this.stage.animate((dt) => this.update(dt)); }  // mantén vivo el ticker
  pause() { this._stop?.(); this._stop = null; }                          // → el stage queda idle
  update(dt) { for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 480 * dt; } }
  paint(ctx) { /* dibuja cada partícula */ }
}
```

## Interacción — hit-testing

`Stage.hitTest(px, py)` recorre los nodos de adelante hacia atrás (entrando en las capas) y devuelve
el de más arriba cuyo `contains(x, y)` sea true. Conéctalo a un listener de puntero; un click en el
canvas puede editar el modelo compartido, así ambas proyecciones siguen:

```js
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const node = stage.hitTest(e.clientX - r.left, e.clientY - r.top);
  if (node?.model) node.model.set('value', node.model.get('value') + 10);
});
```

## Límites y cuándo ir por Pixi

- **Solo contexto 2D**, sin WebGL/batching — bien para cientos de formas, no miles de sprites.
- **Sin accesibilidad/selección en canvas** — mantén el texto y los formularios en la proyección
  DOM; el canvas es para gráficos. (`Text` existe para etiquetas/anotaciones, no copy de UI.)
- **El hit-testing honra translate + scale, no rotación**; la escena es plana (un nivel de capa).
- Sin loader de assets / `Sprite`, sin animación de salida al quitar. Diferido a propósito.

Cuando algo de eso te apriete, engancha Pixi y maneja sus display objects desde `Model`s de Lumen —
tu capa de estado no cambia.

## Notas de diseño

- El loop es un **único scheduler** con dos fuentes de "necesito un frame": el dirty flag (cambios
  discretos) y los animadores activos (continuo). Ninguno → no se agenda frame. Varios `set()` en un
  tick se fusionan en un redraw.
- `animate` tween-ea los campos planos del nodo (no el modelo), así un tween a 60fps nunca inunda el
  modelo de datos con eventos `change`; el dato guarda el objetivo, lo visual interpola hacia él.
- Todo se ata a `Stage#signal`, así `destroy()` detiene el loop y quita toda suscripción — la misma
  historia sin fugas que `View`.
