# Mensajería entre vistas

Cómo hablan entre sí vistas, modelos y colecciones independientes — el papel que jugaba el
Radio de Backbone, sin el singleton global. Creas un `EventEmitter`, lo compartes importándolo,
y dejas que vistas no relacionadas se suscriban (cada una con `this.signal`, así las
suscripciones se limpian solas al desmontar). `Model` y `Collection` ya emiten eventos a los
que te suscribes igual.

## Dos canales

El ejemplo en vivo (un mini-shop) coordina tres vistas **independientes** — un catálogo, un
badge de carrito y toasts — por dos canales compartidos, con cero acoplamiento directo:

- Una **`Collection`** compartida (`cart`) — sus eventos estructurales (`add`/`remove`/`reset`) mueven el badge.
- Un **`EventEmitter`** compartido (`bus`) — notificaciones de app que mueven los toasts.

```js
import { View, Model, Collection, EventEmitter } from 'lumenjs';

const bus  = new EventEmitter();        // notificaciones de app
const cart = new Collection([], Model); // carrito compartido; emite add/remove/reset

class CartBadge extends View {
  static template = '#bar';
  onMount() {
    this.update();
    cart.on('add',    this.update, { signal: this.signal });  // suscríbete directo a la Collection
    cart.on('remove', this.update, { signal: this.signal });
    cart.on('reset',  this.update, { signal: this.signal });
  }
  update = () => { this.ui.count.textContent = String(cart.length); };
}

class Toasts extends View {
  static template = '#toasts';
  onMount() { bus.on('notify', this.show, { signal: this.signal }); }  // escucha en el bus de app
  show = ({ text }) => { /* añade un toast transitorio */ };
}
```

Una vista `Product` hace ambas a la vez al hacer clic en *add*: `cart.add(model)` (evento
estructural → el badge se actualiza) y `bus.emit('notify', …)` (bus de app → aparece un toast).
Ninguno de los suscriptores sabe que el producto existe.

## Sin fugas, sin global

- Cada suscripción se ata a `this.signal`, así se quita al `unmount()` — sin `off()` manual, sin las fugas clásicas de listeners del Radio de Backbone.
- El bus es **explícito**: lo creas y lo compartes importando el módulo — no es un global a nivel `window`, sin efectos al importar. Para asuntos separados, crea buses separados.

## Cuándo usarlo

- **Usa un bus** para reacciones *transversales y desacopladas*: notificaciones, cambio de tema, un indicador de "cambios sin guardar" — cosas que les importan a muchas vistas no relacionadas.
- **No** lo uses para hablar padre↔hijo local: pasa un callback por `props`, o usa el `events` propio del hijo. Un bus global para todo recrea la maraña de "¿quién escucha?" que Lumen existe para evitar.

Ver [event-emitter](event-emitter.md), [model](model.md) y [collection](collection.md).
