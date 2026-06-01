# Region

Gestiona un único hueco del DOM que contiene como máximo una `View` a la vez, con un swap animado.

## Filosofía

- **Transiciones ordenadas.** `show(view)` reproduce el `animateOut()` de la vista actual hasta el final, la desmonta, luego monta la nueva y reproduce su `animateIn()`. Sale, luego entra — predecible.
- **Lo que los Custom Elements no pueden.** Como una `View` es una clase normal, la region controla el momento de la remoción, así que la animación de salida siempre termina antes de que el nodo se vaya. El `disconnectedCallback` de un Custom Element se dispara solo *después* de quitarlo.
- **La base de la navegación.** Apunta una region a un elemento "outlet" y llama a `show()` al cambiar de ruta. El router (módulo 9) se construye sobre esto.

## API

| Miembro | Descripción |
|---|---|
| `new Region(target, { transition? })` | `target` es un elemento o un selector CSS del hueco. `transition: true` activa las View Transitions nativas. |
| `el` | El elemento del hueco. |
| `current` | La vista mostrada actualmente, o `null`. |
| `show(view, { transition? })` | Swap animado. Devuelve `Promise<view>` (resuelve tras la entrada). No-op si ya es la actual. |
| `empty()` | Desmonta lo que haya (animando la salida primero). Devuelve `Promise<void>`. |

## Ejemplo

```js
import { Region, View, fadeIn, fadeOut } from 'lumenjs';

class Screen extends View {
  static template = '#screen';
  onMount()   { this.ui.title.textContent = this.props.title; }
  onUnmount() { console.log('salió', this.props.title); }
  animateIn()  { return fadeIn(this.el); }
  animateOut() { return fadeOut(this.el); }
}

const main = new Region('#outlet');
await main.show(new Screen({ title: 'Home' }));
await main.show(new Screen({ title: 'About' })); // Home se desvanece, luego About aparece
```

## View Transitions nativas (opt-in)

Por defecto un swap son dos animaciones JS: el `animateOut()` de la vista vieja y luego el
`animateIn()` de la nueva. Activa la [View Transitions API](https://developer.mozilla.org/es/docs/Web/API/View_Transition_API)
nativa y lo hace el navegador — un crossfade de fábrica y morphs de *elemento compartido* para
todo lo que etiquetes con `view-transition-name`.

```js
const main = new Region('#outlet', { transition: true });   // default de esta region
await main.show(new Home());
await main.show(new About());     // el navegador hace crossfade; se saltan animateIn/animateOut

// o por swap:
await main.show(new About(), { transition: true });
```

Es **pura mejora progresiva**:

- Apagado por defecto — las regions existentes se comportan exactamente igual que antes.
- En navegadores sin `document.startViewTransition`, **cae** al swap animado por JS de siempre.
  Nada se rompe; solo no obtienes el crossfade nativo.
- Dentro de una transición se saltan los `animateIn`/`animateOut` de las vistas (el navegador
  reproduce lo visual), así nunca animas dos veces. El ciclo de vida (`onMount`/`onUnmount`,
  limpieza en cascada, `signal`) corre exactamente como siempre.

Morph de elemento compartido: dale el mismo `view-transition-name` a un elemento en la vista
saliente y en la entrante (en tu CSS) y el navegador lo anima de una posición a la otra.

> Las View Transitions de mismo documento son Baseline (soporte amplio). Las de cross-document
> aún no — Lumen solo usa la API de mismo documento, que es todo lo que una SPA necesita.

## Regiones con nombre en un layout

Un layout suele tener varias regiones (header, sidebar, main, modal). No las creas a mano —
decláralas en una `View` con `static regions` y cada una se crea y se vacía por ti, en
cascada por los layouts anidados. Ver [View → Regiones (layouts)](view.md). El ejemplo de
abajo es un layout anidado hecho así.

## Notas de diseño

- `show` espera a `unmount()` (que espera a `animateOut`) antes de montar la siguiente vista, así las transiciones nunca se solapan. Para un crossfade, activa `{ transition: true }` (nativo) o monta en dos regions apiladas.
- Una region contiene exactamente una vista; para listas usa `CollectionView`.
- Que `show` devuelva la vista (tras `animateIn`) permite hacer `await` de una transición completa — útil para secuenciar la navegación.
