# animate

Helpers de animación basados en promesas, construidos sobre la Web Animations API nativa. Son las primitivas que una `View` usa para coordinar las transiciones de entrada/salida.

## Filosofía

- **Promesas, no callbacks.** Cada helper devuelve `Promise<void>` que se resuelve al terminar la animación. Eso es lo que hace posible `animateOut`: una `View` puede `await view.animateOut()` *antes* de quitar el nodo, así la animación de salida siempre se reproduce completa.
- **Sin efectos secundarios al importar.** `prefers-reduced-motion` se consulta de forma perezosa, en cada llamada.
- **Accesible por defecto.** Si el usuario prefiere movimiento reducido (o `duration` es `0`), los helpers se resuelven de inmediato sin animar.
- **Nunca rechaza.** Una animación cancelada se resuelve en vez de lanzar error, así una transición interrumpida no puede romper un desmontaje.

## API

| Función | Descripción |
|---|---|
| `play(el, keyframes, options?)` | Reproduce cualquier keyframe; se resuelve al terminar. La primitiva base. |
| `fadeIn(el, options?)` | Opacidad 0 → 1. |
| `fadeOut(el, options?)` | Opacidad 1 → 0. |
| `slideIn(el, options?)` | Sube a su sitio mientras aparece. |
| `slideOut(el, options?)` | Baja un poco mientras desaparece. |

### `AnimateOptions`

| Opción | Por defecto | Descripción |
|---|---|---|
| `duration` | `200` | Milisegundos. `0` omite la animación. |
| `easing` | `'ease'` | Una palabra clave de easing CSS o `cubic-bezier(...)`. |
| `delay` | `0` | Milisegundos antes de empezar. |

## Ejemplo

```js
import { fadeIn, slideOut } from 'lumen/animate';

// Entrada: añadir y luego reproducir la animación de entrada.
document.body.appendChild(el);
await fadeIn(el, { duration: 250 });

// Salida: reproducir la animación de salida y LUEGO quitar.
await slideOut(el, { duration: 200 });
el.remove();
```

Dentro de una `View` (módulo 4) esto queda:

```js
class Toast extends View {
  animateIn()  { return slideIn(this.el); }
  animateOut() { return slideOut(this.el); } // se espera antes de que el nodo salga del DOM
}
```

## Keyframes propios

`play` acepta cualquier keyframe de Web Animations, así que nunca quedas encajonado:

```js
import { play } from 'lumen/animate';

await play(el, [
  { transform: 'scale(0.8)', opacity: 0 },
  { transform: 'scale(1)',   opacity: 1 },
], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
```

## Notas de diseño

- Los helpers no usan `fill`/`commitStyles`: el estado final de cada animación coincide con el estilo natural en reposo del elemento (opacidad 1, sin transform), así no hay que fijar nada ni quedan estilos inline.
- `play` se resuelve tanto si `Animation.finished` se cumple como si se rechaza, unificando "terminó" y "cancelado" en un único resultado seguro.
