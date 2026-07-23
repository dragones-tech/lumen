# math

Small, pure math + geometry helpers — the trigonometry, interpolation, point generation and randomness that drawing and animating otherwise keep re-deriving by hand. Renderer-agnostic: the same functions position a DOM `View`, drive a tween, or feed a canvas `Path`.

## Philosophy

- **Functions, not a system.** Like `dom`/`animate`/`validate`, this is a bag of stateless helpers. Importing it has no side effects; nothing touches `window` or the document.
- **Tuples, not a `Vec2` class.** Points and vectors are plain `[x, y]` arrays. That keeps the layer functional (per the repo's "stateless helpers are functions" rule), composes without ceremony (`const [x, y] = p`), matches the canvas `Line.points`/`Path.points` shape so a generator's output is drawable as-is, and spreads into the native API (`ctx.lineTo(...p)`).
- **Renderer-agnostic.** `remap` maps a data domain onto pixels; `circlePoints` feeds a canvas or an SVG `points` attribute. Nothing here knows about canvas.
- **Reproducible randomness on purpose.** `Math.random` is fine for a coin flip, but a *seeded* generator (`rng(seed)`) makes a generative scene or particle field repeatable — and that determinism is more transparent, not less: you own the seed.

## API

### Interpolation & ranges

| Function | Description |
|---|---|
| `TAU` | A full turn in radians (`2π`). |
| `clamp(v, lo, hi)` | Constrain `v` to `[lo, hi]`. |
| `lerp(a, b, t)` | Linear interpolate; `t=0`→`a`, `t=1`→`b`. Not clamped (extrapolates). |
| `invLerp(a, b, v)` | Inverse of `lerp`: where `v` sits in `[a,b]` as `0..1`. `0` when `a===b`. |
| `remap(v, inMin, inMax, outMin, outMax)` | Map `v` from one range onto another. The workhorse for "data → pixels". |

### Angles & waves

| Function | Description |
|---|---|
| `deg(radians)` | Radians → degrees. |
| `rad(degrees)` | Degrees → radians. |
| `wave(t, options?)` | Sinusoid: `offset + amp · sin(TAU · freq · t + phase)`. |

**`WaveOptions`** — `freq` (cycles per unit `t`, default `1`), `amp` (peak offset, `1`), `phase` (radians, `0`), `offset` (centre line, `0`). For a cosine, pass `phase: TAU / 4`.

### Point generators (→ `[x, y][]`)

| Function | Description |
|---|---|
| `circlePoints(cx, cy, r, segments?)` | `segments` points around a circle (open ring; default `64`). |
| `polygonPoints(cx, cy, r, sides, rotation?)` | The `sides` vertices of a regular polygon. `rotation` spins it (`-TAU/4` = vertex up). |
| `arcPoints(cx, cy, r, start, end, segments?)` | Points along an arc, **inclusive** of both ends (`segments+1` points). |
| `plotPoints(fn, x0, x1, step?)` | Sample `y = fn(x)` across `[x0, x1]`; endpoints land exactly. |

### Vectors — `vec.*` (over `[x, y]` tuples)

| Function | Description |
|---|---|
| `vec.add(a, b)` / `vec.sub(a, b)` | Sum / difference. |
| `vec.scale(a, s)` | Multiply by a scalar. |
| `vec.len(a)` / `vec.dist(a, b)` | Magnitude / distance. |
| `vec.norm(a)` | Unit vector (`[0,0]` for a zero vector — never NaN). |
| `vec.rot(a, angle)` | Rotate around the origin by `angle` radians. |
| `vec.dot(a, b)` | Dot product. |
| `vec.angle(a)` | Angle from +x axis (`atan2`). |
| `vec.fromAngle(angle, len?)` | A vector of length `len` at `angle`. |
| `vec.lerp(a, b, t)` | Component-wise lerp between two points. |

### Randomness

| Function | Description |
|---|---|
| `random(min?, max?)` | Float in `[min, max)` (default `[0, 1)`). |
| `randInt(min, max)` | Integer in `[min, max]`, **inclusive**. |
| `chance(p?)` | `true` with probability `p` (default `0.5`). |
| `randSign()` | `-1` or `+1`, evenly. |
| `gaussian(mean?, sd?)` | Normal-distributed (Box–Muller) — natural jitter that clusters near the mean. |
| `jitter(v, amount)` | `v` nudged by a flat `±amount`. |
| `pick(items)` | A uniformly-random element. |
| `shuffle(items)` | A shuffled **copy** (non-mutating, Fisher–Yates). |
| `inRect(x0, y0, x1, y1)` | A random point inside a rectangle. |
| `onCircle(cx, cy, r)` | A random point on a circle's edge. |
| `inDisc(cx, cy, r)` | A random point inside a disc (uniform by area). |
| `rng(seed)` | A **seeded**, reproducible bundle with all of the above. |

**`rng(seed)`** returns a `Random` object shaped exactly like the global helpers (`.random`, `.inDisc`, `.pick`, …), but every run from the same `seed` yields the same sequence — repeatable generative scenes and deterministic tests. It uses a small, fast `mulberry32` generator (not cryptographic).

## Examples

Draw a scrolling sine wave with the canvas `Path` primitive:

```js
import { wave, plotPoints } from 'lumenjs/math';
import { Stage, Path } from 'lumenjs/canvas';

const stage = new Stage(canvas);
const line = stage.add(new Path({ stroke: '#38e0c8', lineWidth: 2, lineJoin: 'round' }));

let t = 0;
stage.animate((dt) => {
  t += dt;
  line.points = plotPoints((x) => 120 + wave(x, { freq: 1 / 140, amp: 30, phase: -t * 2 }), 0, 560, 4);
});
```

A regular hexagon, and orbiting motion via vectors:

```js
import { polygonPoints, vec, TAU } from 'lumenjs/math';
import { Polygon, Circle } from 'lumenjs/canvas';

const hex = new Polygon({ x: 120, y: 120, points: polygonPoints(0, 0, 42, 6, -TAU / 4), stroke: '#38e0c8' });

// each frame: put a dot at radius 40, angle t (radians)
const [x, y] = vec.add([300, 120], vec.fromAngle(t, 40));
```

A **reproducible** starfield — identical on every reload:

```js
import { rng } from 'lumenjs/math';

const r = rng(20260722);
const stars = Array.from({ length: 90 }, () => r.inDisc(cx, cy, 200)); // same points every run
```

See the [`math` example](https://dragones-tech.github.io/lumen/examples/math/) for all of it animated together.

## Design notes

- **Open rings.** `circlePoints`/`polygonPoints` do not repeat the first vertex at the end. Close the shape with `Line`/`Path` (`closed: true`) or a `Polygon` — the drawing side owns closure, not the generator.
- **Uniform discs.** `inDisc` takes the √ of the random radius, so points spread evenly by *area* instead of clumping toward the centre (the naive mistake).
- **One source of truth for random.** The global helpers and every `rng` bundle run through the same internal builder over a `() => number` source, so seeded and unseeded behaviour can never drift apart.
- **`gaussian` vs `random`.** Reach for `gaussian` when you want values that cluster (natural-looking scatter, subtle motion); `random` is flat across its range.
