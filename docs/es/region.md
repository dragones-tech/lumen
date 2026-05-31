# Region

Gestiona un único hueco del DOM que contiene como máximo una `View` a la vez, con un swap animado.

## Filosofía

- **Transiciones ordenadas.** `show(view)` reproduce el `animateOut()` de la vista actual hasta el final, la desmonta, luego monta la nueva y reproduce su `animateIn()`. Sale, luego entra — predecible.
- **Lo que los Custom Elements no pueden.** Como una `View` es una clase normal, la region controla el momento de la remoción, así que la animación de salida siempre termina antes de que el nodo se vaya. El `disconnectedCallback` de un Custom Element se dispara solo *después* de quitarlo.
- **La base de la navegación.** Apunta una region a un elemento "outlet" y llama a `show()` al cambiar de ruta. El router (módulo 9) se construye sobre esto.

## API

| Miembro | Descripción |
|---|---|
| `new Region(target)` | `target` es un elemento o un selector CSS del hueco. |
| `el` | El elemento del hueco. |
| `current` | La vista mostrada actualmente, o `null`. |
| `show(view)` | Swap animado. Devuelve `Promise<view>` (resuelve tras la entrada). No-op si ya es la actual. |
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

## Regiones con nombre en un layout

Un layout suele tener varias regiones (header, sidebar, main, modal). No las creas a mano —
decláralas en una `View` con `static regions` y cada una se crea y se vacía por ti, en
cascada por los layouts anidados. Ver [View → Regiones (layouts)](view.md). El ejemplo de
abajo es un layout anidado hecho así.

## Notas de diseño

- `show` espera a `unmount()` (que espera a `animateOut`) antes de montar la siguiente vista, así las transiciones nunca se solapan. Si quieres un crossfade, monta en dos regions apiladas.
- Una region contiene exactamente una vista; para listas usa `CollectionView`.
- Que `show` devuelva la vista (tras `animateIn`) permite hacer `await` de una transición completa — útil para secuenciar la navegación.
