# EventEmitter

Un emisor de eventos pequeño, tipado y sin fugas. Es la base de la mensajería en Lumen.

## Filosofía

- **Sin singleton global.** Creas emisores con `new` y los pasas explícitamente. Importar el módulo *no tiene efectos secundarios*: no registra nada, no toca `window`.
- **Limpieza simétrica.** Cada `on()` devuelve una función para desuscribirse. También puedes pasar un `AbortSignal`, de modo que abortar un controlador elimina de golpe todos los listeners atados a él. (Así es como `View` desbindeará sus listeners al desmontarse, sin fugas.)
- **Seguro por defecto.** Llamar a `off()` sobre un evento que nunca se registró es un no-op, no un error.

## API

| Método | Devuelve | Descripción |
|---|---|---|
| `on(evento, handler, { signal? })` | `() => void` | Suscribe. Devuelve una función para desuscribirse. |
| `once(evento, handler, { signal? })` | `() => void` | Suscribe para una sola emisión y se quita solo. |
| `off(evento, handler)` | `void` | Quita un handler concreto. No-op si no existe. |
| `emit(evento, payload)` | `void` | Llama a cada handler de forma síncrona con `payload`. |
| `clear(evento?)` | `void` | Quita todos los handlers de `evento`, o de todos si se omite. |
| `listenerCount(evento)` | `number` | Cuántos handlers hay registrados para `evento`. |

## Tipar tus eventos

Pasa un mapa de eventos como genérico para tener autocompletado y verificación del payload:

```js
/** @typedef {{ 'todo:add': { text: string }, 'todo:clear': void }} TodoEvents */

/** @type {EventEmitter<TodoEvents>} */
const bus = new EventEmitter();

bus.on('todo:add', (p) => console.log(p.text)); // p es { text: string }
bus.emit('todo:add', { text: 'leche' });         // payload verificado
```

Para eventos sin datos, tipa el payload como `void` y pasa `undefined`.

## Ejemplo

```js
import { EventEmitter } from 'lumenjs/event-emitter';

const bus = new EventEmitter();

// Suscríbete; guarda el manejador de desuscripción.
const off = bus.on('ping', (n) => console.log('ping', n));
bus.emit('ping', 1); // imprime: ping 1
off();
bus.emit('ping', 2); // nada — ya estaba desuscrito

// Limpieza en grupo con un AbortController.
const ac = new AbortController();
bus.on('tick', () => console.log('tick'), { signal: ac.signal });
bus.on('tock', () => console.log('tock'), { signal: ac.signal });
ac.abort(); // elimina AMBOS listeners de golpe
```

## Notas de diseño

- Los handlers se guardan en un `Map<string, Set<Function>>`. El `Set` deduplica la misma referencia de handler y hace que `off()` sea O(1).
- `emit()` itera sobre una **copia** del set, así un handler puede llamar a `on()`/`off()` durante la emisión sin alterar la pasada actual.
- Reemplaza al paquete `eventing` del framework anterior, corrigiendo dos bugs: el singleton global congelado (ahora es instanciable) y el `off()` que reventaba cuando el evento nunca se había registrado (ahora protegido).
