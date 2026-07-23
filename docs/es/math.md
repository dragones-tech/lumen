# math

Helpers pequeños y puros de matemática + geometría — la trigonometría, interpolación, generación de puntos y aleatoriedad que dibujar y animar acaban re-derivando a mano una y otra vez. Agnóstico del renderer: las mismas funciones posicionan una `View` del DOM, mueven un tween o alimentan un `Path` de canvas.

## Filosofía

- **Funciones, no un sistema.** Como `dom`/`animate`/`validate`, es una bolsa de helpers sin estado. Importarlo no tiene efectos secundarios; nada toca `window` ni el documento.
- **Tuplas, no una clase `Vec2`.** Puntos y vectores son arrays `[x, y]` planos. Mantiene la capa funcional (según la regla "los helpers sin estado son funciones"), compone sin ceremonia (`const [x, y] = p`), coincide con `Line.points`/`Path.points` para que la salida de un generador sea dibujable tal cual, y se expande en la API nativa (`ctx.lineTo(...p)`).
- **Agnóstico del renderer.** `remap` mapea un dominio de datos a píxeles; `circlePoints` alimenta un canvas o un atributo `points` de SVG. Nada aquí sabe de canvas.
- **Aleatoriedad reproducible a propósito.** `Math.random` sirve para una moneda al aire, pero un generador *con semilla* (`rng(seed)`) hace repetible una escena generativa o un campo de partículas — y ese determinismo es más transparente, no menos: la semilla es tuya.

## API

### Interpolación & rangos

| Función | Descripción |
|---|---|
| `TAU` | Una vuelta completa en radianes (`2π`). |
| `clamp(v, lo, hi)` | Restringe `v` a `[lo, hi]`. |
| `lerp(a, b, t)` | Interpolación lineal; `t=0`→`a`, `t=1`→`b`. Sin clamp (extrapola). |
| `invLerp(a, b, v)` | Inversa de `lerp`: dónde cae `v` en `[a,b]` como `0..1`. `0` si `a===b`. |
| `remap(v, inMin, inMax, outMin, outMax)` | Mapea `v` de un rango a otro. El caballo de batalla de "datos → píxeles". |

### Ángulos & ondas

| Función | Descripción |
|---|---|
| `deg(radianes)` | Radianes → grados. |
| `rad(grados)` | Grados → radianes. |
| `wave(t, opciones?)` | Sinusoide: `offset + amp · sin(TAU · freq · t + phase)`. |

**`WaveOptions`** — `freq` (ciclos por unidad de `t`, por defecto `1`), `amp` (desplazamiento pico, `1`), `phase` (radianes, `0`), `offset` (línea central, `0`). Para un coseno, pasa `phase: TAU / 4`.

### Generadores de puntos (→ `[x, y][]`)

| Función | Descripción |
|---|---|
| `circlePoints(cx, cy, r, segments?)` | `segments` puntos alrededor de un círculo (anillo abierto; por defecto `64`). |
| `polygonPoints(cx, cy, r, sides, rotation?)` | Los `sides` vértices de un polígono regular. `rotation` lo gira (`-TAU/4` = vértice arriba). |
| `arcPoints(cx, cy, r, start, end, segments?)` | Puntos a lo largo de un arco, **inclusive** ambos extremos (`segments+1` puntos). |
| `plotPoints(fn, x0, x1, step?)` | Muestrea `y = fn(x)` en `[x0, x1]`; los extremos caen exactos. |

### Vectores — `vec.*` (sobre tuplas `[x, y]`)

| Función | Descripción |
|---|---|
| `vec.add(a, b)` / `vec.sub(a, b)` | Suma / resta. |
| `vec.scale(a, s)` | Multiplica por un escalar. |
| `vec.len(a)` / `vec.dist(a, b)` | Magnitud / distancia. |
| `vec.norm(a)` | Vector unitario (`[0,0]` para el vector cero — nunca NaN). |
| `vec.rot(a, angle)` | Rota alrededor del origen `angle` radianes. |
| `vec.dot(a, b)` | Producto punto. |
| `vec.angle(a)` | Ángulo desde el eje +x (`atan2`). |
| `vec.fromAngle(angle, len?)` | Un vector de longitud `len` en `angle`. |
| `vec.lerp(a, b, t)` | Lerp componente a componente entre dos puntos. |

### Aleatoriedad

| Función | Descripción |
|---|---|
| `random(min?, max?)` | Float en `[min, max)` (por defecto `[0, 1)`). |
| `randInt(min, max)` | Entero en `[min, max]`, **inclusive**. |
| `chance(p?)` | `true` con probabilidad `p` (por defecto `0.5`). |
| `randSign()` | `-1` o `+1`, por igual. |
| `gaussian(mean?, sd?)` | Distribución normal (Box–Muller) — jitter natural que se agrupa cerca de la media. |
| `jitter(v, amount)` | `v` movido por un `±amount` plano. |
| `pick(items)` | Un elemento uniformemente aleatorio. |
| `shuffle(items)` | Una **copia** barajada (no muta, Fisher–Yates). |
| `inRect(x0, y0, x1, y1)` | Un punto aleatorio dentro de un rectángulo. |
| `onCircle(cx, cy, r)` | Un punto aleatorio en el borde de un círculo. |
| `inDisc(cx, cy, r)` | Un punto aleatorio dentro de un disco (uniforme por área). |
| `rng(seed)` | Un paquete **con semilla**, reproducible, con todo lo anterior. |

**`rng(seed)`** devuelve un objeto `Random` con la misma forma que los helpers globales (`.random`, `.inDisc`, `.pick`, …), pero cada ejecución desde la misma `seed` produce la misma secuencia — escenas generativas repetibles y tests deterministas. Usa un generador `mulberry32` pequeño y rápido (no criptográfico).

## Ejemplos

Dibuja una onda senoidal que se desplaza con la primitiva `Path` del canvas:

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

Un hexágono regular, y movimiento orbital con vectores:

```js
import { polygonPoints, vec, TAU } from 'lumenjs/math';
import { Polygon, Circle } from 'lumenjs/canvas';

const hex = new Polygon({ x: 120, y: 120, points: polygonPoints(0, 0, 42, 6, -TAU / 4), stroke: '#38e0c8' });

// cada frame: pon un punto a radio 40, ángulo t (radianes)
const [x, y] = vec.add([300, 120], vec.fromAngle(t, 40));
```

Un campo de estrellas **reproducible** — idéntico en cada recarga:

```js
import { rng } from 'lumenjs/math';

const r = rng(20260722);
const stars = Array.from({ length: 90 }, () => r.inDisc(cx, cy, 200)); // los mismos puntos siempre
```

Mira el [ejemplo `math`](https://dragones-tech.github.io/lumen/examples/math/) con todo animado junto.

## Notas de diseño

- **Anillos abiertos.** `circlePoints`/`polygonPoints` no repiten el primer vértice al final. Cierra la forma con `Line`/`Path` (`closed: true`) o un `Polygon` — el cierre lo decide quien dibuja, no el generador.
- **Discos uniformes.** `inDisc` toma la √ del radio aleatorio, así los puntos se reparten uniformemente por *área* en vez de amontonarse hacia el centro (el error ingenuo).
- **Una única fuente de verdad para random.** Los helpers globales y cada paquete `rng` pasan por el mismo constructor interno sobre una fuente `() => number`, así el comportamiento con y sin semilla nunca diverge.
- **`gaussian` vs `random`.** Usa `gaussian` cuando quieras valores que se agrupen (dispersión de aspecto natural, movimiento sutil); `random` es plano en todo su rango.
