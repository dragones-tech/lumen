// @ts-check

/**
 * Small, pure math + geometry helpers — the trigonometry, interpolation and point
 * generation that drawing and animating otherwise keep re-deriving by hand.
 *
 * Renderer-agnostic on purpose: nothing here touches a canvas or the DOM. The same
 * `remap` positions a DOM node or maps a data domain onto pixels; the same `circlePoints`
 * feeds a canvas `Line`/`Path` or an SVG `points` attribute. Importing this module has no
 * side effects — like `dom`/`animate`/`validate`, it is a bag of functions, not a system.
 *
 * Points and vectors are plain **tuples** `[x, y]` — there is no `Vec2` class, deliberately.
 * That keeps this a layer of *functions* (per the repo's "stateless helpers are functions"
 * rule), composes without ceremony (`const [x, y] = p`), matches the canvas `Line.points`
 * shape so a generator's output is drawable as-is, and spreads straight into the native API
 * (`ctx.lineTo(...p)`).
 *
 * @typedef {[number, number]} Vec2 - A 2D point or vector, `[x, y]`.
 */

/** A full turn in radians (`2π`) — nicer at a call site than `Math.PI * 2`. @type {number} */
export const TAU = Math.PI * 2;

// ---- Interpolation & ranges ----

/**
 * Constrain `v` to the inclusive range `[lo, hi]`.
 * @param {number} v @param {number} lo @param {number} hi @returns {number}
 */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Linear interpolation from `a` to `b` by `t`: `t = 0` → `a`, `t = 1` → `b`. `t` is **not**
 * clamped, so values outside `[0, 1]` extrapolate past the endpoints — `clamp(t, 0, 1)` first
 * if you don't want that.
 * @param {number} a @param {number} b @param {number} t @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * The inverse of {@link lerp}: where does `v` fall between `a` and `b`, as a `0..1` fraction?
 * Returns `0` when `a === b` (no range to place `v` in) instead of dividing by zero.
 * @param {number} a @param {number} b @param {number} v @returns {number}
 */
export function invLerp(a, b, v) {
  return a === b ? 0 : (v - a) / (b - a);
}

/**
 * Map `v` from the input range `[inMin, inMax]` onto `[outMin, outMax]`, linearly. The
 * workhorse for "data domain → screen pixels" (plotting) and any unit change. Built from
 * {@link invLerp} + {@link lerp}, so it extrapolates outside the input range just as they do.
 * @param {number} v @param {number} inMin @param {number} inMax @param {number} outMin @param {number} outMax @returns {number}
 */
export function remap(v, inMin, inMax, outMin, outMax) {
  return lerp(outMin, outMax, invLerp(inMin, inMax, v));
}

// ---- Angles & waves ----

/** Radians → degrees. @param {number} radians @returns {number} */
export function deg(radians) {
  return (radians * 180) / Math.PI;
}

/** Degrees → radians. @param {number} degrees @returns {number} */
export function rad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * @typedef {Object} WaveOptions
 * @property {number} [freq=1] - Cycles per unit of `t` (frequency).
 * @property {number} [amp=1] - Amplitude — the peak offset from the centre line.
 * @property {number} [phase=0] - Phase shift in radians (slides the wave sideways).
 * @property {number} [offset=0] - Centre line the wave oscillates around.
 */

/**
 * A sinusoid sampled at `t`: `offset + amp · sin(TAU · freq · t + phase)`. The single function
 * behind ripples, pulsing, orbits and bobbing motion — feed `t` with elapsed seconds for a
 * time wave, or with a coordinate for a spatial one. For a cosine, pass `phase: TAU / 4`.
 * @param {number} t - The sample point (time, or a coordinate).
 * @param {WaveOptions} [options]
 * @returns {number}
 */
export function wave(t, { freq = 1, amp = 1, phase = 0, offset = 0 } = {}) {
  return offset + amp * Math.sin(TAU * freq * t + phase);
}

// ---- Point generators (→ Vec2[]) ----

/**
 * `segments` points evenly spaced around a circle, starting at angle 0 (to the right) and
 * advancing by canvas convention (y down → clockwise). It's an **open** ring — the last point
 * does not repeat the first — so draw it closed with `new Line({ points, closed: true })` or a
 * `Polygon`.
 * @param {number} cx @param {number} cy @param {number} r @param {number} [segments=64] @returns {Vec2[]}
 */
export function circlePoints(cx, cy, r, segments = 64) {
  /** @type {Vec2[]} */
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (TAU * i) / segments;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/**
 * The `sides` vertices of a regular polygon inscribed in radius `r` around `(cx, cy)`. Like
 * {@link circlePoints} but for a handful of corners; `rotation` (radians) spins it — e.g.
 * `-TAU / 4` puts a vertex straight up. Open ring; close it with `Polygon`/`Line`.
 * @param {number} cx @param {number} cy @param {number} r @param {number} sides @param {number} [rotation=0] @returns {Vec2[]}
 */
export function polygonPoints(cx, cy, r, sides, rotation = 0) {
  /** @type {Vec2[]} */
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (TAU * i) / sides;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/**
 * Points along a circular arc from `start` to `end` (radians), **inclusive** of both ends —
 * `segments + 1` points, so the last one lands exactly on `end`. `end < start` sweeps the
 * other way. Feed the result to a `Line`/`Path` for a ring segment.
 * @param {number} cx @param {number} cy @param {number} r @param {number} start @param {number} end @param {number} [segments=32] @returns {Vec2[]}
 */
export function arcPoints(cx, cy, r, start, end, segments = 32) {
  /** @type {Vec2[]} */
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = lerp(start, end, i / segments);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/**
 * Sample `y = fn(x)` across `[x0, x1]` into a point list ready to stroke — the bridge from a
 * function (or a {@link wave}) to a drawable curve. `step` is the *approximate* x spacing: the
 * range is divided into whole segments, so both endpoints land exactly on `x0` and `x1`.
 * @param {(x: number) => number} fn @param {number} x0 @param {number} x1 @param {number} [step=1] @returns {Vec2[]}
 */
export function plotPoints(fn, x0, x1, step = 1) {
  const span = x1 - x0;
  const n = Math.max(1, Math.round(Math.abs(span) / step));
  /** @type {Vec2[]} */
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (span * i) / n;
    pts.push([x, fn(x)]);
  }
  return pts;
}

// ---- Vectors (tuples) ----

/**
 * 2D vector helpers over `[x, y]` tuples — pure, a fresh tuple per call, no `this`. Grouped
 * under one `vec` namespace so the verbs read clearly (`vec.rot`, `vec.norm`) without a class.
 */
export const vec = {
  /** Sum. @param {Vec2} a @param {Vec2} b @returns {Vec2} */
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  /** Difference `a - b`. @param {Vec2} a @param {Vec2} b @returns {Vec2} */
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  /** Scale by a scalar. @param {Vec2} a @param {number} s @returns {Vec2} */
  scale: (a, s) => [a[0] * s, a[1] * s],
  /** Length (magnitude). @param {Vec2} a @returns {number} */
  len: (a) => Math.hypot(a[0], a[1]),
  /** Unit vector, or `[0, 0]` for a zero vector (never NaN). @param {Vec2} a @returns {Vec2} */
  norm: (a) => {
    const l = Math.hypot(a[0], a[1]);
    return l === 0 ? [0, 0] : [a[0] / l, a[1] / l];
  },
  /** Rotate around the origin by `angle` radians. @param {Vec2} a @param {number} angle @returns {Vec2} */
  rot: (a, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
  },
  /** Dot product. @param {Vec2} a @param {Vec2} b @returns {number} */
  dot: (a, b) => a[0] * b[0] + a[1] * b[1],
  /** Distance between two points. @param {Vec2} a @param {Vec2} b @returns {number} */
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]),
  /** The vector's angle from the +x axis, in radians (`atan2`). @param {Vec2} a @returns {number} */
  angle: (a) => Math.atan2(a[1], a[0]),
  /** A vector of length `len` pointing at `angle` radians. @param {number} angle @param {number} [len=1] @returns {Vec2} */
  fromAngle: (angle, len = 1) => [Math.cos(angle) * len, Math.sin(angle) * len],
  /** Component-wise lerp between two points. @param {Vec2} a @param {Vec2} b @param {number} t @returns {Vec2} */
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
};

// ---- Randomness ----

/**
 * The full random toolkit built over one `() => number` source in `[0, 1)`. The top-level
 * `random`/`randInt`/… are this bundle bound to `Math.random`; {@link rng} returns another bundle
 * bound to a **seeded**, reproducible source. Same shape either way, so code swaps sources freely.
 *
 * @typedef {Object} Random
 * @property {(min?: number, max?: number) => number} random - Float in `[min, max)` (default `[0, 1)`).
 * @property {(min: number, max: number) => number} randInt - Integer in `[min, max]`, **inclusive**.
 * @property {(p?: number) => boolean} chance - `true` with probability `p` (default `0.5`).
 * @property {() => number} randSign - `-1` or `+1`, evenly.
 * @property {(mean?: number, sd?: number) => number} gaussian - Normal-distributed (Box–Muller).
 * @property {(v: number, amount: number) => number} jitter - `v` nudged by up to `±amount`.
 * @property {(items: any[]) => any} pick - A uniformly-random element.
 * @property {(items: any[]) => any[]} shuffle - A shuffled **copy** (non-mutating, Fisher–Yates).
 * @property {(x0: number, y0: number, x1: number, y1: number) => Vec2} inRect - A point inside a rectangle.
 * @property {(cx: number, cy: number, r: number) => Vec2} onCircle - A point on a circle's edge.
 * @property {(cx: number, cy: number, r: number) => Vec2} inDisc - A point inside a disc (uniform area).
 */

/**
 * Build a {@link Random} bundle over a `[0, 1)` source. The single source of the actual logic —
 * both the global helpers and every seeded {@link rng} run through here, so their behaviour never
 * drifts apart.
 * @param {() => number} rand - Returns a float in `[0, 1)`.
 * @returns {Random}
 */
function build(rand) {
  /** @param {number} [min] @param {number} [max] @returns {number} */
  const random = (min = 0, max = 1) => min + rand() * (max - min);
  return {
    random,
    randInt: (min, max) => Math.floor(random(min, max + 1)),
    chance: (p = 0.5) => rand() < p,
    randSign: () => (rand() < 0.5 ? -1 : 1),
    gaussian: (mean = 0, sd = 1) => {
      let u = 0;
      let v = 0;
      while (u === 0) u = rand(); // avoid log(0)
      while (v === 0) v = rand();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    },
    jitter: (v, amount) => v + random(-amount, amount),
    pick: (items) => items[Math.floor(rand() * items.length)],
    shuffle: (items) => {
      const a = [...items];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    inRect: (x0, y0, x1, y1) => [random(x0, x1), random(y0, y1)],
    onCircle: (cx, cy, r) => {
      const a = rand() * TAU;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    },
    inDisc: (cx, cy, r) => {
      const a = rand() * TAU;
      const rr = Math.sqrt(rand()) * r; // √ keeps the distribution uniform by area, not clumped centre
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    },
  };
}

/** @type {Random} The default bundle, over `Math.random`. Backs the top-level helpers below. */
const _default = build(Math.random);

/**
 * A **seeded**, reproducible random bundle — the same shape as the global helpers, but every run
 * from the same `seed` yields the same sequence. That is what makes a generative scene or a
 * particle field repeatable (and testable): same seed, same picture. Uses a small, fast
 * `mulberry32` generator (fine for graphics; not cryptographic).
 *
 * ```js
 * const r = rng(1234);
 * const stars = Array.from({ length: 80 }, () => r.inDisc(cx, cy, 200)); // identical every reload
 * ```
 * @param {number} seed - Any integer. The same seed reproduces the same stream.
 * @returns {Random}
 */
export function rng(seed) {
  return build(mulberry32(seed));
}

/**
 * Float in `[min, max)` — the whole range `[0, 1)` by default. From `Math.random`; for a
 * reproducible stream use `rng(seed).random`.
 * @param {number} [min] @param {number} [max] @returns {number}
 */
export function random(min, max) {
  return _default.random(min, max);
}

/** Integer in `[min, max]`, **inclusive** of both ends. @param {number} min @param {number} max @returns {number} */
export function randInt(min, max) {
  return _default.randInt(min, max);
}

/** `true` with probability `p` (a coin flip by default). @param {number} [p=0.5] @returns {boolean} */
export function chance(p) {
  return _default.chance(p);
}

/** `-1` or `+1`, evenly — flip a direction. @returns {number} */
export function randSign() {
  return _default.randSign();
}

/**
 * A normally-distributed number (Gaussian / bell curve) via Box–Muller — for *natural* jitter that
 * clusters near the mean, unlike the flat `random`. @param {number} [mean=0] @param {number} [sd=1] @returns {number}
 */
export function gaussian(mean, sd) {
  return _default.gaussian(mean, sd);
}

/** Nudge `v` by a uniform `±amount` — a flat wobble around a value. @param {number} v @param {number} amount @returns {number} */
export function jitter(v, amount) {
  return _default.jitter(v, amount);
}

/** A uniformly-random element of `items`. @template T @param {T[]} items @returns {T} */
export function pick(items) {
  return _default.pick(items);
}

/**
 * A shuffled **copy** of `items` (Fisher–Yates) — the input is left untouched, matching the
 * "queries never mutate" stance of `Collection`. @template T @param {T[]} items @returns {T[]}
 */
export function shuffle(items) {
  return _default.shuffle(items);
}

/** A random point inside the rectangle `[x0,x1] × [y0,y1]`. @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @returns {Vec2} */
export function inRect(x0, y0, x1, y1) {
  return _default.inRect(x0, y0, x1, y1);
}

/** A random point on a circle's circumference. @param {number} cx @param {number} cy @param {number} r @returns {Vec2} */
export function onCircle(cx, cy, r) {
  return _default.onCircle(cx, cy, r);
}

/** A random point inside a disc, uniform by area (√-corrected, not centre-clumped). @param {number} cx @param {number} cy @param {number} r @returns {Vec2} */
export function inDisc(cx, cy, r) {
  return _default.inDisc(cx, cy, r);
}

/**
 * A small, fast seeded PRNG (`mulberry32`) → a `() => number` in `[0, 1)`. Not cryptographic;
 * plenty for scattering, jitter and generative geometry.
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
