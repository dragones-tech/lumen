# Canvas (experimental)

A minimal HTML-canvas rendering layer. The data layer — `Model`, `Collection`, `EventEmitter`,
`signal` — is **renderer-agnostic**, so the *same* state can drive a DOM `View` **and** a canvas
node at once: **one source of truth, two projections**. This module is the canvas projection.

> **Young & deliberately tiny.** 2D context only, a flat scene (one level of nesting), no asset
> pipeline. It's for the cases where reaching for a full engine is overkill — a bar chart, a
> sparkline, particles, a draggable diagram. When you need thousands of sprites, WebGL, or filters,
> attach **Pixi** instead (and drive its objects from Lumen `Model`s — same idea, bigger engine).

## Philosophy

- **One state, two projections.** Nothing to "sync": a single `Model`/`Collection` feeds a DOM
  `CollectionView` and a canvas `CanvasLayer`, each subscribed to the same events. Standalone canvas
  libraries are state-islands; here the canvas is just another reader of your data.
- **Immediate mode, honestly.** The DOM is retained (mutate a node, the browser repaints). Canvas
  is immediate — you clear and redraw each frame. So the "no full re-render" mantra *inverts*: events
  drive **when** to redraw (a dirty flag), not what to mutate.
- **One unified loop.** On-demand by default — a change schedules a single frame, then the stage
  idles (zero frames). A continuous ticker kicks in only while animators (tweens, emitters) are
  active and auto-stops when they finish. A static chart costs nothing; particles still animate.
- **Reuse, don't reinvent.** It imports no Lumen runtime — it only *consumes* a `Collection`'s
  events. Your state and validation code is unchanged whether it renders to DOM or canvas.

## The class map — DOM ↔ canvas

| Role | DOM | Canvas |
|---|---|---|
| One object | `View` | `Node2D` (base for shapes; **not** a View — no DOM) |
| Concrete primitives | *(your views)* | `Rect`, `Circle`, `Line`, `Text` |
| List: one per model | `CollectionView` | `CanvasLayer` |
| Slot / container | `Region` | `Stage` |
| State | `Model` / `Collection` | the **same** `Model` / `Collection` |

The state column is **shared** — the other two are interchangeable, coexisting projections.

## API

### `Stage`

| Member | Description |
|---|---|
| `new Stage(canvas)` | Wrap an `HTMLCanvasElement`; start the loop. |
| `add(node)` / `remove(node)` | Add/remove a root node (fires `onAdd`/`onRemove`). Returns the node. |
| `invalidate()` | Mark the scene dirty → one frame, then idle. |
| `animate(update)` | Register a per-frame `(dt) => void` (a tween/emitter). Returns a deregister fn; the ticker runs while any are active. |
| `hitTest(px, py)` | Topmost node at a canvas-space point, or `null` (translate + scale; rotation is phase 2). |
| `destroy()` | Stop the loop and abort `signal`. |
| `signal` | An `AbortSignal` for the stage's lifetime. |

### `Node2D` — the base (every shape extends it)

Fields: `x`, `y`, `scale`, `rotation`, `alpha`, `visible`, `model`.

| Member | Description |
|---|---|
| `onAdd()` / `onRemove()` | Lifecycle hooks (≈ `onMount`/`onUnmount`). |
| `update(dt)` | Advance time-based motion (particles/physics). `dt` in seconds. |
| `paint(ctx)` | **Override this** — draw, in a context already transformed by this node. |
| `draw(ctx)` | Applies transform + alpha, calls `paint`, restores. Rarely overridden. |
| `animate(to, { duration?, easing? })` | Tween fields to `to` over the loop. Returns a `Promise`; supersedes any tween in flight. |
| `stop()` | Cancel the tween in flight. |
| `contains(x, y)` | Local-space hit test (override per shape). Used by `Stage.hitTest`. |
| `stage` / `signal` | The attached stage and its signal. |

### Shapes

| Shape | Fields | Hit test |
|---|---|---|
| `Rect` | `w`, `h`, `fill`, `stroke`, `lineWidth` | ✅ box |
| `Circle` | `r`, `fill`, `stroke`, `lineWidth` | ✅ radius |
| `Line` | `points` (`[x,y][]`), `stroke`, `lineWidth`, `closed` | — |
| `Path` | `points`, `stroke`, `lineWidth`, `lineJoin`, `lineCap`, `closed`, `fill` | — |
| `Polygon` | `points` (`[x,y][]`), `fill`, `stroke`, `lineWidth` | ✅ point-in-polygon |
| `Arc` | `r`, `start`, `end`, `stroke`, `lineWidth`, `fill`, `wedge`, `counter` | — |
| `Text` | `text`, `font`, `fill`, `align`, `baseline` | — |

`Path` is the flexible sibling of `Line` (join/cap control, optional fill; `stroke: null` for fill-only). `Polygon` is the filled counterpart to the stroke-only `Line`. `Arc` draws a ring segment, or a pie slice with `wedge: true` + `fill`. All three pair naturally with the [`math`](./math.md) point generators (`polygonPoints`, `arcPoints`, `plotPoints`).

### `CanvasLayer` — one node per model

| Member | Description |
|---|---|
| `new CanvasLayer(collection, factory, props?)` | `factory(model, index)` builds a node per model. |
| `children` | The child nodes, in collection order. |

Reconciles on the collection's `add`/`remove`/`reset`, and a bubbled `change` from any model
invalidates the stage. The same `Collection` can feed a DOM `CollectionView` simultaneously.

### Easings

`linear`, `easeOutCubic`, `easeInOutCubic` — pure `t → t` functions for `animate`.

## Example: one state, two projections

```js
import { Model, Collection, View, CollectionView } from 'lumenjs';
import { Stage, Node2D, CanvasLayer, easeOutCubic } from 'lumenjs/canvas';

// ── one state — with a derived getter reused by BOTH projections ──
class Bar extends Model {
  get color() { const v = this.get('value'); return v >= 80 ? '#dc2626' : v >= 50 ? '#f59e0b' : '#2563eb'; }
}
const data = new Collection([{ label: 'Q1', value: 40 }, { label: 'Q2', value: 92 }], Bar);

// ── projection A — canvas ──
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

// ── projection B — DOM (a normal CollectionView over the SAME collection) ──
class BarLabel extends View { /* … renders model.get('label'), model.get('value'), model.color … */ }
class Legend extends CollectionView { static childView = BarLabel; static container = 'list'; }
new Legend({ collection: data }).mount(aside);

// edit once → both projections react:
data.get('q2')?.set('value', 30);
```

See the [`canvas` example](../examples/canvas/) for the full bar chart, and the
[`particles` example](../examples/particles/) for the continuous-ticker side.

## Movement — the model says *where*, the node says *how*

Movement is presentation, exactly like the [derived data](model.md#derived-data--the-model-as-its-own-presenter)
split: the model holds the target value, `animate` decides how the node gets there.

```js
bar.model.on('change:value', ({ value }) =>
  bar.animate({ h: value * 2 }, { duration: 400 }), { signal: bar.signal });
// snap instead of tween: bar.h = value * 2; stage.invalidate();
```

## Particles — the continuous ticker

The bar chart only used the loop's **on-demand** half (redraw when data changes, then idle).
Particles exercise the other half. They're *output-only* — no `Model` per particle (there could be
thousands) — so an `Emitter` owns a flat array and advances it by **time** in `update(dt)`. To keep
the loop running it registers a **continuous animator**; pausing deregisters it and the stage returns
to a true idle (zero frames). This is the second `canvas` example on this page.

```js
class Emitter extends Node2D {
  play()  { this._stop = this.stage.animate((dt) => this.update(dt)); }  // keep the ticker alive
  pause() { this._stop?.(); this._stop = null; }                          // → stage goes idle
  update(dt) {                                                            // advance by elapsed time
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 480 * dt; }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }
  paint(ctx) { /* draw each particle */ }
}
```

So the same `Stage` covers both modes without you choosing one: discrete data edits redraw on
demand, while anything that moves by time registers an animator and rides the ticker until it stops.

## Interaction — hit-testing

`Stage.hitTest(px, py)` walks nodes front-to-back (recursing into layers) and returns the topmost
whose `contains(x, y)` is true. Wire it from a pointer listener; a click on the canvas can edit the
shared model, so both projections follow:

```js
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const node = stage.hitTest(e.clientX - r.left, e.clientY - r.top);
  if (node?.model) node.model.set('value', node.model.get('value') + 10);
});
```

## Limits & when to reach for Pixi

- **2D context only**, no WebGL/batching — fine for hundreds of shapes, not thousands of sprites.
- **No accessibility/selection on canvas** — keep text and forms in the DOM projection; canvas is
  for graphics. (`Text` exists for labels/annotations, not UI copy.)
- **Hit-testing honors translate + scale, not rotation**; the scene is flat (one layer level).
- No asset loader / `Sprite`, no exit animation on remove. These are deferred on purpose.

When any of those bite, attach Pixi and drive its display objects from Lumen `Model`s — your state
layer doesn't change.

## Design notes

- The loop is a **single scheduler** with two "needs a frame" sources: the dirty flag (discrete
  changes) and active animators (continuous). Neither → no frame scheduled. Multiple `set()`s in a
  tick coalesce into one redraw.
- `animate` tweens a node's plain fields (not the model), so a 60fps tween never floods the data
  model with `change` events; the data holds the target, the visual interpolates toward it.
- Everything ties to `Stage#signal`, so `destroy()` stops the loop and removes every subscription —
  the same leak-free story as `View`.
