// @ts-check

/**
 * **Spike** — a minimal HTML-canvas rendering layer for Lumen.
 *
 * The thesis: the data layer (`Model`/`Collection`/`EventEmitter`/`signal`) is renderer-agnostic,
 * so the *same* state can drive a DOM `View` **and** a canvas node — one source of truth, two
 * projections. This module is the canvas projection: a `Stage` (the loop), `Node2D` (the canvas
 * analog of `View`), a few primitive shapes, and `CanvasLayer` (the canvas analog of
 * `CollectionView` — one node per model).
 *
 * Deliberately tiny: 2D context only, flat scene (no nested transforms yet), no hit-testing,
 * no assets. For scale, attach Pixi instead. See the `canvas` example for the two-projection demo.
 */

/** Linear easing. @param {number} t @returns {number} */
export const linear = (t) => t;
/** Ease-out cubic — fast then settling. @param {number} t @returns {number} */
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
/** Ease-in-out cubic. @param {number} t @returns {number} */
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Owns a `<canvas>`, runs a single unified scheduler, and paints a flat list of {@link Node2D}.
 *
 * The loop is **on-demand by default**: a change marks the stage dirty and one frame is drawn,
 * then it idles (zero frames). A **continuous ticker** kicks in only while there are active
 * animators (tweens, emitters) and auto-stops when they finish — so a static chart costs nothing
 * and particles still animate. Everything is tied to {@link Stage#signal} for leak-free teardown.
 */
export class Stage {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    /** Root drawables (v0: flat). @type {Node2D[]} */
    this.nodes = [];
    /** @private */
    this._dirty = true;
    /** Per-frame callbacks driving time-based motion. @private @type {Set<(dt: number) => void>} */
    this._animators = new Set();
    /** @private */
    this._raf = 0;
    /** @private */
    this._last = 0;
    /** @private */
    this._ac = new AbortController();
    /** @private */
    this._tick = this._tick.bind(this);
    this._schedule(); // initial paint
  }

  /** Aborts on {@link Stage#destroy}; bind subscriptions/loops to it. @returns {AbortSignal} */
  get signal() {
    return this._ac.signal;
  }

  /**
   * Add a root node. Tracks it, fires `onAdd`, and requests a redraw.
   * @template {Node2D} N
   * @param {N} node
   * @returns {N}
   */
  add(node) {
    this.nodes.push(node);
    node._attach(this);
    this.invalidate();
    return node;
  }

  /**
   * Remove a root node (fires `onRemove`). No-op if absent.
   * @param {Node2D} node
   * @returns {void}
   */
  remove(node) {
    const i = this.nodes.indexOf(node);
    if (i === -1) return;
    this.nodes.splice(i, 1);
    node._detach();
    this.invalidate();
  }

  /** Mark the scene dirty and schedule a single frame. @returns {void} */
  invalidate() {
    this._dirty = true;
    this._schedule();
  }

  /**
   * Find the topmost node at a canvas-space point (e.g. `clientX - canvas.getBoundingClientRect().left`),
   * or `null`. Walks root nodes front-to-back, recursing into layers. Honors translate + scale, not
   * rotation (phase 2). Wire it from a `pointerdown`/`pointermove` listener on the canvas.
   * @param {number} px @param {number} py @returns {Node2D | null}
   */
  hitTest(px, py) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const hit = this.nodes[i]._hit(px, py);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * Register a per-frame callback (a tween or emitter). The ticker runs while any are active.
   * @param {(dt: number) => void} update - Called each frame with `dt` in seconds.
   * @returns {() => void} Deregister; when the last one goes the stage returns to idle.
   */
  animate(update) {
    this._animators.add(update);
    this._schedule();
    return () => this._animators.delete(update);
  }

  /** Stop the loop and abort the signal. @returns {void} */
  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._ac.abort();
  }

  /** @private */
  _schedule() {
    if (this._raf || this.signal.aborted) return;
    this._raf = requestAnimationFrame(this._tick);
  }

  /** @private @param {number} now */
  _tick(now) {
    this._raf = 0;
    const dt = this._last ? (now - this._last) / 1000 : 0;
    this._last = now;
    for (const fn of [...this._animators]) fn(dt);
    for (const node of this.nodes) node.update(dt);
    if (this._dirty || this._animators.size) {
      this._dirty = false;
      this._draw();
    }
    if (this._animators.size) this._schedule();
    else this._last = 0; // reset clock so the next wake starts fresh
  }

  /** @private */
  _draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const node of this.nodes) node.draw(ctx);
  }
}

/**
 * The canvas analog of `View`: a positioned, drawable scene node. **Not** a `View` (no DOM,
 * no template) — hence `Node2D`, so nobody expects `el`/`ui`/`mount`.
 *
 * The base handles the transform (`x/y/scale/rotation/alpha`) and lifecycle; a subclass only
 * implements {@link Node2D#paint}. Movement is presentation: {@link Node2D#animate} tweens these
 * fields over the stage loop, while the bound model holds the *target* value.
 */
export class Node2D {
  /** @param {Record<string, any>} [props] - Initial fields (x, y, w, fill, …). */
  constructor(props = {}) {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.rotation = 0;
    this.alpha = 1;
    this.visible = true;
    /** The model this node projects, if any (set by {@link CanvasLayer}). @type {any} */
    this.model = null;
    /** @private @type {Stage | null} */
    this._stage = null;
    /** @private @type {(() => void) | null} */
    this._stopTween = null;
    Object.assign(this, props);
  }

  /** The stage this node is attached to (or `null`). @returns {Stage | null} */
  get stage() {
    return this._stage;
  }

  /** An `AbortSignal` for this node's attached lifetime (the stage's signal). @returns {AbortSignal} */
  get signal() {
    return (this._stage ?? { signal: new AbortController().signal }).signal;
  }

  /** Internal: attach to a stage and fire `onAdd`. @param {Stage} stage @returns {void} */
  _attach(stage) {
    this._stage = stage;
    this.onAdd();
  }

  /** Internal: detach from the stage, stop tweens, fire `onRemove`. @returns {void} */
  _detach() {
    this.stop();
    this.onRemove();
    this._stage = null;
  }

  // ---- Lifecycle hooks (override as needed) ----

  /** Called when attached to a stage. @returns {void} */
  onAdd() {}
  /** Called when removed from a stage. @returns {void} */
  onRemove() {}
  /** Advance open-ended, time-based motion (particles/physics). @param {number} dt - Seconds. @returns {void} */
  update(dt) {}

  /**
   * Paint into a context that has already had this node's transform + alpha applied. The base
   * `draw` sets up `translate/rotate/scale/globalAlpha` and restores; subclasses override only this.
   * @param {CanvasRenderingContext2D} ctx
   * @returns {void}
   */
  paint(ctx) {}

  /**
   * Apply the transform, then `paint`, then restore. Rarely overridden (containers do, to draw
   * children).
   * @param {CanvasRenderingContext2D} ctx
   * @returns {void}
   */
  draw(ctx) {
    if (!this.visible || this.alpha <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.rotation) ctx.rotate(this.rotation);
    if (this.scale !== 1) ctx.scale(this.scale, this.scale);
    ctx.globalAlpha *= this.alpha;
    this.paint(ctx);
    ctx.restore();
  }

  /**
   * Tween fields from their current values to `to` over the stage loop. Returns a Promise that
   * resolves when done. Registers an animator so the ticker runs only while tweening, then idles.
   * A fresh `animate` supersedes any tween already in flight.
   * @param {Record<string, number>} to - Target field values, e.g. `{ x: 200, alpha: 1 }`.
   * @param {{ duration?: number, easing?: (t: number) => number }} [opts] - ms + easing.
   * @returns {Promise<this>}
   */
  animate(to, { duration = 300, easing = easeOutCubic } = {}) {
    this.stop();
    const self = /** @type {any} */ (this);
    /** @type {Record<string, number>} */
    const from = {};
    for (const k in to) from[k] = self[k];
    const stage = this._stage;
    if (!stage || duration <= 0) {
      Object.assign(this, to);
      stage?.invalidate();
      return Promise.resolve(this);
    }
    let elapsed = 0;
    return new Promise((resolve) => {
      const stop = stage.animate((dt) => {
        elapsed += dt * 1000;
        const t = easing(Math.min(elapsed / duration, 1));
        for (const k in to) self[k] = from[k] + (to[k] - from[k]) * t;
        if (elapsed >= duration) {
          this._stopTween = null;
          stop();
          resolve(this);
        }
      });
      this._stopTween = stop;
    });
  }

  /** Cancel any tween in flight (leaves fields at their current values). @returns {void} */
  stop() {
    if (this._stopTween) {
      this._stopTween();
      this._stopTween = null;
    }
  }

  // ---- Hit testing (translate + scale; rotation is phase 2) ----

  /**
   * Whether a point in **this node's local space** is inside it. Default `false` (nothing to hit);
   * shapes override. Used by {@link Stage#hitTest} to route pointer input to a node.
   * @param {number} x @param {number} y @returns {boolean}
   */
  contains(x, y) {
    return false;
  }

  /**
   * Internal: map a parent-space point into local space and return this node if it's a hit.
   * @param {number} px @param {number} py @returns {Node2D | null}
   */
  _hit(px, py) {
    if (!this.visible) return null;
    const x = (px - this.x) / this.scale;
    const y = (py - this.y) / this.scale;
    return this.contains(x, y) ? this : null;
  }
}

/** A filled/stroked rectangle drawn from its origin. Fields: `w`, `h`, `fill`, `stroke`, `lineWidth`. */
export class Rect extends Node2D {
  /** @param {CanvasRenderingContext2D} ctx */
  paint(ctx) {
    const self = /** @type {any} */ (this);
    if (self.fill) {
      ctx.fillStyle = self.fill;
      ctx.fillRect(0, 0, self.w, self.h);
    }
    if (self.stroke) {
      ctx.strokeStyle = self.stroke;
      ctx.lineWidth = self.lineWidth ?? 1;
      ctx.strokeRect(0, 0, self.w, self.h);
    }
  }
  /** @param {number} x @param {number} y @returns {boolean} */
  contains(x, y) {
    const self = /** @type {any} */ (this);
    return x >= 0 && x <= self.w && y >= 0 && y <= self.h;
  }
}

/** A filled/stroked circle centered on its origin. Fields: `r`, `fill`, `stroke`, `lineWidth`. */
export class Circle extends Node2D {
  /** @param {CanvasRenderingContext2D} ctx */
  paint(ctx) {
    const self = /** @type {any} */ (this);
    ctx.beginPath();
    ctx.arc(0, 0, self.r, 0, Math.PI * 2);
    if (self.fill) {
      ctx.fillStyle = self.fill;
      ctx.fill();
    }
    if (self.stroke) {
      ctx.strokeStyle = self.stroke;
      ctx.lineWidth = self.lineWidth ?? 1;
      ctx.stroke();
    }
  }
  /** @param {number} x @param {number} y @returns {boolean} */
  contains(x, y) {
    const r = /** @type {any} */ (this).r;
    return x * x + y * y <= r * r;
  }
}

/** A stroked polyline. Fields: `points` (array of `[x, y]`), `stroke`, `lineWidth`, `closed`. */
export class Line extends Node2D {
  /** @param {CanvasRenderingContext2D} ctx */
  paint(ctx) {
    const self = /** @type {any} */ (this);
    /** @type {[number, number][]} */
    const pts = self.points;
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (self.closed) ctx.closePath();
    ctx.strokeStyle = self.stroke ?? '#000';
    ctx.lineWidth = self.lineWidth ?? 1;
    ctx.stroke();
  }
}

/**
 * A stroked (and optionally filled) path through `points` — the flexible sibling of {@link Line}.
 * Beyond `Line` it exposes `lineJoin`/`lineCap` for smooth corners and rounded ends (curves from
 * `plotPoints`/`circlePoints`, motion trails) and can `fill` a `closed` path. Stroking is on by
 * default; pass `stroke: null` for a fill-only shape.
 *
 * Fields: `points` (`[x,y][]`), `stroke`, `lineWidth`, `lineJoin`, `lineCap`, `closed`, `fill`.
 */
export class Path extends Node2D {
  /** @param {CanvasRenderingContext2D} ctx */
  paint(ctx) {
    const self = /** @type {any} */ (this);
    /** @type {[number, number][]} */
    const pts = self.points;
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (self.closed) ctx.closePath();
    if (self.fill) {
      ctx.fillStyle = self.fill;
      ctx.fill();
    }
    if (self.stroke !== null) {
      ctx.strokeStyle = self.stroke ?? '#000';
      ctx.lineWidth = self.lineWidth ?? 1;
      ctx.lineJoin = self.lineJoin ?? 'miter';
      ctx.lineCap = self.lineCap ?? 'butt';
      ctx.stroke();
    }
  }
}

/**
 * A filled, closed shape through `points`, with an optional outline — the filled counterpart to
 * the stroke-only {@link Line}. Pair it with `polygonPoints`/`circlePoints` for regular n-gons and
 * discs. Hit-tests with point-in-polygon, so a filled shape is clickable via {@link Stage#hitTest}.
 *
 * Fields: `points` (`[x,y][]`), `fill`, `stroke`, `lineWidth`.
 */
export class Polygon extends Node2D {
  /** @param {CanvasRenderingContext2D} ctx */
  paint(ctx) {
    const self = /** @type {any} */ (this);
    /** @type {[number, number][]} */
    const pts = self.points;
    if (!pts || pts.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (self.fill) {
      ctx.fillStyle = self.fill;
      ctx.fill();
    }
    if (self.stroke) {
      ctx.strokeStyle = self.stroke;
      ctx.lineWidth = self.lineWidth ?? 1;
      ctx.stroke();
    }
  }
  /** @param {number} x @param {number} y @returns {boolean} */
  contains(x, y) {
    /** @type {[number, number][]} */
    const pts = /** @type {any} */ (this).points;
    if (!pts || pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  }
}

/**
 * A circular arc / ring segment / pie slice, centered on its origin. Strokes the arc from `start`
 * to `end` (radians, default a full turn); set `wedge: true` to close through the centre so a
 * `fill` draws a pie slice. `counter: true` sweeps anticlockwise.
 *
 * Fields: `r`, `start`, `end`, `stroke`, `lineWidth`, `fill`, `wedge`, `counter`.
 */
export class Arc extends Node2D {
  /** @param {CanvasRenderingContext2D} ctx */
  paint(ctx) {
    const self = /** @type {any} */ (this);
    const start = self.start ?? 0;
    const end = self.end ?? Math.PI * 2;
    ctx.beginPath();
    if (self.wedge) ctx.moveTo(0, 0);
    ctx.arc(0, 0, self.r, start, end, !!self.counter);
    if (self.wedge) ctx.closePath();
    if (self.fill) {
      ctx.fillStyle = self.fill;
      ctx.fill();
    }
    if (self.stroke) {
      ctx.strokeStyle = self.stroke;
      ctx.lineWidth = self.lineWidth ?? 1;
      ctx.lineCap = self.lineCap ?? 'butt';
      ctx.stroke();
    }
  }
}

/**
 * A line of text. Fields: `text`, `font`, `fill`, `align`, `baseline`. Note: canvas text has no
 * accessibility or selection — for real UI copy, use a DOM `View` projection instead.
 */
export class Text extends Node2D {
  /** @param {CanvasRenderingContext2D} ctx */
  paint(ctx) {
    const self = /** @type {any} */ (this);
    ctx.fillStyle = self.fill ?? '#000';
    ctx.font = self.font ?? '14px system-ui, sans-serif';
    ctx.textAlign = self.align ?? 'left';
    ctx.textBaseline = self.baseline ?? 'alphabetic';
    ctx.fillText(self.text ?? '', 0, 0);
  }
}

/**
 * The canvas analog of `CollectionView`: one child {@link Node2D} per model, reconciled from a
 * `Collection`'s `add`/`remove`/`reset` events. A bubbled `change` from any model invalidates the
 * stage. The same `Collection` can feed a DOM `CollectionView` at the same time — two projections,
 * one state.
 */
export class CanvasLayer extends Node2D {
  /**
   * @param {import('./collection.js').Collection} collection - The shared state.
   * @param {(model: any, index: number) => Node2D} factory - Build a node for a model.
   * @param {Record<string, any>} [props]
   */
  constructor(collection, factory, props = {}) {
    super(props);
    /** @type {import('./collection.js').Collection} */
    this.collection = collection;
    /** @private */
    this._factory = factory;
    /** Child nodes, in collection order. @type {Node2D[]} */
    this.children = [];
    /** @private @type {Map<any, Node2D>} */
    this._byModel = new Map();
    /** Unsubscribe fns for the collection listeners, dropped on detach. @private @type {Array<() => void>} */
    this._offs = [];
  }

  onAdd() {
    const { signal } = this.stage ?? {};
    this.collection.forEach((m, i) => this._mount(m, i));
    // Keep the unsubscribers: these are bound to the stage's signal, but the layer can be
    // removed from a still-alive stage — so we also drop them in onRemove to avoid a leak.
    this._offs = [
      this.collection.on('add', ({ model, index }) => { this._mount(model, index); this._invalidate(); }, { signal }),
      this.collection.on('remove', ({ model }) => { this._unmount(model); this._invalidate(); }, { signal }),
      this.collection.on('reset', () => { this._reset(); this._invalidate(); }, { signal }),
      this.collection.on('change', () => this._invalidate(), { signal }),
    ];
  }

  onRemove() {
    for (const off of this._offs) off();
    this._offs = [];
    for (const node of this.children) node._detach();
    this.children = [];
    this._byModel.clear();
  }

  /**
   * Advance children's time-based motion. The stage ticks only root nodes, so a layer must
   * forward `update` to its children (it already forwards `draw`).
   * @param {number} dt - Seconds since the last frame.
   * @returns {void}
   */
  update(dt) {
    for (const child of this.children) child.update(dt);
  }

  /** @private @param {any} model @param {number} index */
  _mount(model, index) {
    const node = this._factory(model, index);
    node.model = model;
    this._byModel.set(model, node);
    this.children.push(node);
    node._attach(/** @type {Stage} */ (this.stage));
  }

  /** @private @param {any} model */
  _unmount(model) {
    const node = this._byModel.get(model);
    if (!node) return;
    this._byModel.delete(model);
    this.children.splice(this.children.indexOf(node), 1);
    node._detach();
  }

  /** @private */
  _reset() {
    for (const model of [...this._byModel.keys()]) this._unmount(model);
    this.collection.forEach((m, i) => this._mount(m, i));
  }

  /** @private */
  _invalidate() {
    this.stage?.invalidate();
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    for (const child of this.children) child.draw(ctx);
    ctx.restore();
  }

  /**
   * Hit-test children topmost-first in the layer's local space.
   * @param {number} px @param {number} py @returns {Node2D | null}
   */
  _hit(px, py) {
    if (!this.visible) return null;
    const x = (px - this.x) / this.scale;
    const y = (py - this.y) / this.scale;
    for (let i = this.children.length - 1; i >= 0; i--) {
      const hit = this.children[i]._hit(x, y);
      if (hit) return hit;
    }
    return null;
  }
}
