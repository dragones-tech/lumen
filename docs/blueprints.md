# Capa de navegación: los objetos que construimos para los planos

> Documento de trabajo (roadmap). El objetivo **no** son páginas de ejemplo, sino las
> **clases/objetos/utilidades** que abstraen cada tipo de app: "¿quieres single page? usa
> `SiteMap`. ¿navegación especial? usa `Machine`." Esos objetos son una **capa opcional sobre
> los legos del core** — se importan sueltos (ES modules, sin build), no pesan si no los usas.

## 0. El insight que lo unifica todo

Todos los "planos" (single page, blog, dashboard, one-page espacial, mobile) hacen lo mismo en
el fondo:

> **Algo decide qué `View` está activa; una `Region` la proyecta (monta/anima/desmonta).**

Lo único que cambia entre un plano y otro es **cómo se decide la siguiente vista**:

| Decide la vista por… | Objeto | Plano que habilita |
|---|---|---|
| la URL | `Router` *(ya existe)* | sitio tradicional, blog, dashboard |
| un grafo estructural + dirección | **`SiteMap`** | single page, one-page espacial, secciones |
| eventos + guards (un flujo) | **`Machine`** | wizards, navegación condicional |
| una pila push/pop | **`Stack`** | drill-down móvil, master-detail |
| un gesto del dedo | **`gestures`/`swipe`** (alimenta a los de arriba) | mobile/touch |

Como todos comparten "elegir vista → `Region` la muestra", **comparten una base**: `Navigator`.
Eso evita reimplementar en cada uno el *lock de transición* (no solapar enter/leave — el mismo
patrón de serialización que ya pusimos en `CollectionView`), el evento `transition`, y la
política de keep-alive. Esa base es la primera pieza a construir.

---

## 1. Los objetos a construir

### `Navigator` — base abstracta (no se usa directo)
El esqueleto compartido. **No** decide vistas; provee la mecánica.
```js
class Navigator {
  constructor(target, { keepAlive } = {})   // target: Region | selector | Element
  get current()                              // la View activa (o null)
  async _show(view)                          // proyección serializada: lock → Region.show → emit 'transition'
  on('transition', fn, { signal })           // before/after, dirección, from/to
  destroy()
}
```
Aporta: lock de transición, `EventEmitter`, binding a `Region`, hook de keep-alive. **Sobre
qué legos:** `Region`, `EventEmitter`, `animate`. Las subclases solo deciden *qué* mostrar.

### `SiteMap` — navegación estructural/direccional
Árbol de grafos dirigidos de nodos-vista, **anidable** (subsecciones = un nodo que es a su vez
un mapa). Degenera a single page (un nodo, sin aristas).
```js
new SiteMap(target, {
  initial: 's1',
  nodes: {
    s1: { view: () => import('./s1.js'), edges: { down: 's2' } },
    s3: { edges: { up: 's2', down: 's4' }, map: { /* sub-SiteMap: interiores */ } },
  },
});
sitemap.go('down');        // resuelve en el nivel activo; si no hay arista, burbujea al padre
sitemap.goto(['s3','a']);  // deep-link
```
Aporta: resolución direccional, **bubbling-on-miss**, lazy `import()` por nodo, proyección del
*path* activo sobre `Region`s anidadas. **Decisiones (config):** dirección→animación, keep-alive
por nodo, sync de URL (hash) opcional. Habilita #1 single page y #5 one-page espacial.

### `Machine` — navegación por flujo (FSM)
Estados + transiciones legales + guards. Fuente de verdad event-driven.
```js
new Machine(target, {
  initial: 'cart',
  states: {
    cart:    { view: () => import('./cart.js'),  on: { CHECKOUT: 'pay' } },
    pay:     { on: { OK: 'done', BACK: 'cart' }, guard: { OK: (ctx) => ctx.valid } },
    done:    { view: () => import('./done.js') },
  },
});
machine.send('CHECKOUT');   // no-op si la transición es ilegal
machine.can('OK');          // ¿permitida ahora? (respeta guards)
```
Aporta: tabla declarativa legible (ves el flujo entero), transiciones ilegales = no-op, guards,
`onEnter`/`onExit`. **Alcance:** FSM **plana** (no statecharts jerárquicos — eso es scope creep).
Habilita navegación condicional / wizards.

### `Stack` — navegación push/pop con historial
```js
new Stack(target, { keepAlive: true });   // las capas inferiores no se desmontan, se ocultan
stack.push(view);   // desliza la nueva encima
stack.pop();         // vuelve, restaurando estado/scroll de la inferior
```
Aporta: historial, animación direccional (push entra, pop sale), keep-alive de capas inferiores.
Habilita drill-down móvil y master-detail. **Necesita** la variante keep-alive de proyección
(ocultar ≠ desmontar) — ver §2.

### `gestures` / `swipe` — adaptador de entrada táctil
Utilidad que traduce dedo → dirección y alimenta a un `SiteMap`/`Stack`. Sobre `pointer events`
(cubre touch + mouse), atada al `signal`.
```js
swipe(el, { onSwipe: (dir) => sitemap.go(dir), axis: 'x', threshold: 40 }, { signal });
// o como método de View, al estilo de this.observe/this.listen:  this.swipe(el, {...})
```
**Decisión pendiente** (ver §3): si nace en `src/` como lego desde el inicio o se queda como
pegamento hasta validar que no necesita política por-app.

### Apoyos (utilidades menores)
- **Keep-alive en `Region`** (o `KeepAliveRegion`): cachear vistas por clave y *ocultar* en vez
  de desmontar, para no perder estado/scroll. Lo piden `Stack`, tabs, one-page y mobile.
- **`markdown`**: promover `site/markdown.js` a utilidad reutilizable (lo usa el plano blog).
- **`AppShell`** (a evaluar): ¿hace falta una clase, o basta `View` + `static regions` que ya
  existe? Inclino a que **no** hace falta clase nueva — el shell de dashboard es `static regions`
  + un `Router`/`SiteMap` montado en el `main`.

---

## 2. Mapa: plano → objetos que lo construyen

| Plano | Objetos |
|---|---|
| Single page | `SiteMap` (un nodo) — o nada, `Region` directa |
| Sitio tradicional | `Router` *(existe)* + `Region` |
| Blog | `Router` + `Collection`/`CollectionView` + `markdown` |
| Dashboard | `View static regions` + `Router` anidado en `main` |
| One-page espacial | `SiteMap` + keep-alive + binder scroll/teclado |
| Mobile / touch | `SiteMap` o `Stack` + `gestures/swipe` + keep-alive |

Observa que la columna derecha es **corta y se repite**: con ~5 objetos nuevos (`Navigator`,
`SiteMap`, `Machine`, `Stack`, `gestures`) + keep-alive, se arman los seis planos. Eso es la
señal de que estamos en el nivel de abstracción correcto.

---

## 3. Decisiones de diseño (RESUELTAS)

1. **Ubicación: `src/`.** La capa de navegación vive en `src/`, cada objeto como **módulo
   aislado** (`src/navigator.js`, `src/sitemap.js`, `src/machine.js`, `src/stack.js`). Opt-in por
   import suelto: cero coste si no se usa, coherente con "el navegador solo baja lo que importas".
   Se exportarán desde `index.js` cuando existan. *(Decidido: no paquete aparte.)*
2. **`Navigator` base primero.** Se construye el esqueleto compartido (lock + proyección a
   `Region` + evento `transition` + keep-alive + resolución de vistas) **antes** que
   `SiteMap`/`Machine`/`Stack`, que lo heredan. Spec completa en el Anexo A. *(Decidido.)*
3. **Familia separada.** `SiteMap` (estructural), `Machine` (flujo), `Stack` (historial) son
   objetos **distintos**, no se fusionan: un FSM y un grafo espacial resuelven problemas distintos
   y mezclarlos crea un configurable inmanejable. **Tabs = `SiteMap` plano** (no merece objeto
   propio). *(Decidido.)*
4. **`gestures` — pendiente menor.** Sin resolver aún; default propuesto: pegamento de app primero,
   extraer a `src/gestures.js` solo si se repite idéntico (mismo criterio lego). No bloquea el
   resto: el adaptador de entrada se enchufa al final.

> **Estado actual: solo documentación.** Aún no se escribe código en `src/`. Este doc es la
> especificación; la implementación arranca en otra etapa, empezando por `Navigator` (Anexo A).

---

## 4. Orden de construcción (de los objetos, no de ejemplos)

1. **`Navigator`** (base: lock, Region, `transition`, keep-alive hook).
2. **`SiteMap`** (habilita single page + one-page espacial; valida la base con el caso más rico).
3. **keep-alive en `Region`** (lo necesitan Stack/tabs/mobile).
4. **`Stack`** (push/pop sobre Navigator + keep-alive).
5. **`gestures`/`swipe`** (adaptador de entrada; conecta dedo → `SiteMap`/`Stack`).
6. **`Machine`** (flujo/condicional).
7. **`markdown`** util (cierra el plano blog) y revisión de si `AppShell` merece clase.

---

## Anexo A — `Navigator`: especificación de diseño (primera pieza)

Base abstracta de la capa de navegación. **No se usa directamente**; `SiteMap`/`Machine`/`Stack`
la heredan. Concentra todo lo común para que esas subclases solo aporten *la decisión de qué
vista sigue*. Vive en `src/navigator.js`.

### A.1 Responsabilidad

**Qué hace:** posee el slot de salida, recuerda la vista activa, **serializa** las transiciones
(nunca solapa enter/leave), resuelve specs de vista (instancia/factory/lazy), aplica la política
de keep-alive, y emite `transition`.

**Qué NO hace:** no decide cuál es la siguiente vista (eso es de la subclase) ni conoce URLs,
grafos, estados ni gestos. No re-renderiza vistas (eso es del `View`).

### A.2 Construcción y estado

```js
new Navigator(target, options)
// target : Region | string (selector) | Element   → si no es Region, se envuelve en una
// options:
//   keepAlive : boolean                 (default false) — ocultar en vez de desmontar
//   transition: boolean                 (default false) — preferir View Transitions API (vía Region)
```

```js
nav.current        // View activa | null
nav.transitioning  // boolean — hay una transición en vuelo (las subclases lo consultan para "drop")
nav.on(event, fn, { signal })   // 'transition' (+ posibles 'transition:start'/'end', ver A.6)
nav.destroy()      // desmonta activa + cacheadas, aborta signal
```

Compone un `EventEmitter` (`this._events`), igual que `Model`/`Collection`/`I18n` — no hereda de él.

### A.3 Resolución de vistas (centralizada aquí)

Las subclases guardan "specs" de vista heterogéneos; el `Navigator` los normaliza a una `View`
montable. Un helper `_resolve(spec)` acepta y unifica:

```
View (instancia)            → se usa tal cual
() => View                  → se llama
() => Promise<{default}>    → import() perezoso: se await-ea y se toma .default
class extends View          → se instancia
```

Así el lazy `import()` por nodo/estado se maneja en **un** lugar y todas las subclases lo heredan.
*(Sub-decisión: ¿se cachea la instancia resuelta o se reinstancia en cada visita? Ligado a keep-alive, A.5.)*

### A.4 Proyección serializada — el lock (corazón de la base)

Método protegido `_show(view, meta)` que las subclases llaman cuando ya decidieron la vista. Es
el **mismo patrón de cola** que arreglamos en `CollectionView`: una promesa-cola encadena las
transiciones para que jamás se solapen un `animateIn` y un `animateOut`.

```
_show(viewSpec, meta):
  this._tail = this._tail.then(async () => {
    this.transitioning = true
    const view = await this._resolve(viewSpec)
    this._events.emit('transition', { phase: 'start', from: this.current, to: view, ...meta })
    // proyección según keep-alive (A.5):
    //   sin keep-alive: Region.show(view)            (desmonta la anterior, anima out→in)
    //   con keep-alive: ocultar anterior, mostrar/montar `view` por su clave
    this.current = view
    this.transitioning = false
    this._events.emit('transition', { phase: 'end', from, to: view, ...meta })
  }, /* onError igual, para no atascar la cola */)
  return this._tail
```

**Política ante eventos rápidos** (un swipe que dispara `go()` 5 veces): la base **encola**
(garantiza orden, nunca pierde el último estado). Si una subclase prefiere **descartar** mientras
hay transición (UX típica de gestos), consulta `this.transitioning` y hace early-return en su
método público (`go`/`send`/`push`) — la base ofrece el primitivo, la subclase elige la política.

### A.5 Keep-alive

Sin keep-alive (default), la proyección delega en `Region.show`: desmonta la vista saliente
(pierde su estado/scroll) — barato y correcto para la mayoría.

Con `keepAlive: true`, el `Navigator` **no** puede usar `Region.show` (que siempre desmonta), así
que **generaliza la gestión del slot**: mantiene un `Map<clave, View>`, monta cada vista la primera
vez y luego **oculta** la saliente (p. ej. `hidden`/`display:none`) en vez de desmontar; al revisitar
una clave, la re-muestra con su estado intacto. **Requiere una clave** por vista, que aporta la
subclase (`SiteMap`: id de nodo; `Machine`: nombre de estado; `Stack`: índice de pila).

> **Tensión de diseño a resolver en implementación:** `Region` modela "una vista a la vez y la
> anterior se desmonta". Keep-alive rompe ese supuesto. Dos caminos: (a) el `Navigator` gestiona el
> elemento-slot directamente en modo keep-alive (sin `Region`), reusando solo `animate`/View
> Transitions; (b) se añade a `Region` un modo "ocultar en vez de vaciar". Inclinación: **(a)**,
> para no cargar de política al lego `Region`. Decisión final, en la etapa de implementación.

### A.6 Eventos

`transition` como evento único con `phase: 'start' | 'end'` y payload `{ from, to, ...meta }`,
donde `meta` lo aporta la subclase (`direction` en `SiteMap`, `event` en `Machine`, `action:
'push'|'pop'` en `Stack`). Alternativa: dos eventos `transition:start`/`transition:end`.
*(Sub-decisión menor; preferencia: un evento con `phase`, menos superficie.)*

### A.7 Contrato para subclases

Una subclase de `Navigator`:
1. Expone su **API de decisión** propia (`SiteMap.go/goto`, `Machine.send`, `Stack.push/pop`).
2. Traduce esa llamada a **un viewSpec + meta**, opcionalmente descartando si `this.transitioning`.
3. Llama a `this._show(viewSpec, meta)` y deja que la base haga lock + resolución + proyección +
   keep-alive + evento.
4. Si maneja URL (opcional), sincroniza en el handler de `transition`, no en la base.

### A.8 Limpieza

`destroy()` desmonta la vista activa y todas las cacheadas (keep-alive), vacía la cola y aborta un
`AbortController` interno (mismo patrón `signal` que `View`/`Stage`), de modo que cualquier binder
externo (gestos, scroll, teclado) atado a ese signal se desconecta solo.

### A.9 Sub-decisiones abiertas (para la etapa de implementación, no ahora)

- A.3: ¿cachear instancia resuelta siempre, o solo bajo keep-alive?
- A.5: ¿`Navigator` gestiona el slot en keep-alive (a), o `Region` gana un modo "ocultar" (b)?
- A.6: ¿un evento `transition` con `phase`, o `transition:start`/`end` separados?
- ¿`go`/`send`/`push` devuelven `Promise` (resuelta al terminar la transición) — sí, por
  consistencia con `Region.show`/`View.mount`.

Cada paso usa el anterior; la base se valida temprano con `SiteMap` (el más exigente).
