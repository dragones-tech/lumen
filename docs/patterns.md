# Patrones comunes de la web — catálogo para decidir qué abstraer

> Documento de trabajo (roadmap). Inventario de los **problemas recurrentes** del desarrollo
> web, mapeados a lo que Lumen ya resuelve / resuelve a medias / no resuelve, para **decidir
> cuáles merecen una abstracción** (módulo opt-in en `src/`), cuáles quedan como pegamento de
> app, y cuáles son "integra una lib". Cotejado con fuentes (TanStack Query/SWR, patterns.dev,
> tendencias 2026) — ver Fuentes.
>
> Hermano de [`blueprints.md`](./blueprints.md): allí está la **capa de navegación**
> (`Navigator`/`SiteMap`/`Machine`/`Stack`); aquí, **todo lo demás**.

## 0. Criterio de decisión

**Pregunta previa a todo (el test anti-hotfix):** antes de proponer una pieza nueva, decide si
tiene **lifetime y scope propios** (un *concern* separado) o si solo **compensa** algo que una
pieza existente debería hacer. Si es lo segundo, no se apila una capa encima: **se arregla esa
pieza**. Un layer "encima" se justifica solo cuando es un concern distinto; si no, es un parche y
delata que la base está incompleta.

Eso parte los veredictos en tres ejes (no en uno):

- **Arreglar-base** — la carencia es de un lego que ya existe (`Http`, `Model`, `View`, `validate`).
  Se corrige *dentro* de ese módulo, como capacidad nativa (igual que `static rules` vive en `Model`),
  no como wrapper. *(Ver §5: ya hechos.)*
- **Peer nuevo (`src/`)** — concern genuinamente separado, con su propio lifetime. Módulo opt-in por
  import suelto. *Consume* legos existentes pero no los parchea (p. ej. `Resource` usa `Http`, no lo
  ensucia con cache).
- **Pegamento de receta** — tiene decisiones por-app; se documenta con ejemplo, no se exporta.
- **Fuera de alcance** — pesado o nicho: "integra una lib" (como `canvas` dice "para escala, Pixi").

**Una alineación a favor, no un hueco:** la tendencia 2026 es *locality of state* — alejarse del
store global gigante y acercar el estado a donde se usa. Lumen **ya** lo cumple (`Model`/`Collection`
sin singleton, `EventEmitter` que se pasa explícito). Así que **no** habrá Redux-like; es decisión
de diseño, no carencia.

---

## 1. Catálogo de problemas

`✓` cubierto · `≈` parcial · `✗` hueco. Veredicto = recomendación (lego / pegamento / fuera).

### A. Gestión de estado
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Estado local de vista | `View` (`props`, `ui`) ✓ | — | — |
| Estado de entidad | `Model` (get/set, eventos, dot-path) ✓ | — | — |
| Lista observable | `Collection`/`CollectionView` ✓ | — | — |
| Estado derivado/computado | ≈ a mano | helper `computed` (memo + invalidación) | **pegamento** (util chica opcional) |
| Estado compartido entre vistas lejanas | `EventEmitter` / `Model` compartido ✓ | — (locality) | — |
| Estado ↔ URL (query como estado) | `Router` ≈ | sync bidireccional estado↔URL | **lego chico** (ligado a Router) |

### B. Datos de servidor (server state) — ★ era el gran hueco, ✅ cubierto
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Fetch + estados loading/error/data | `Resource` (`isLoading`/`isValidating`/`error`/`data`) ✓ | — | **✅ peer nuevo `Resource`** (§5) |
| Cache + dedupe + revalidación (SWR) | `Resource` (caché keyed + dedupe + revalidate) ✓ | — | **✅ peer nuevo `Resource`** (§5) |
| Mutaciones + invalidación | `Resource.mutate(key, …)` ✓ | — | **✅ peer nuevo `Resource`** (§5) |
| Optimistic updates | `Resource.mutate(key, promise, { optimisticData })` + rollback ✓ | — | **✅ peer nuevo `Resource`** (§5) |
| Paginación / infinite scroll | `Collection` + `Resource` ≈ | cursor/página + acumulación | **pegamento** sobre `Resource` |
| Reintentos / cancelación | `Http` `signal`/`timeout` + **`retry`** ✓ | — | **✅ arreglado en `Http`** (§5) |
| Interceptores (auth, refresh token) | `Http` **`onRequest`/`onResponse`** ✓ | — | **✅ arreglado en `Http`** (§5) |

### C. UI asíncrona
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Estados idle→loading→success→error | ✗ | máquina chica de async | **lego chico** (`AsyncState`) o lo cubre `Machine` |
| Skeleton/spinner/empty/error | SCC estiliza ✓ | patrón "vista por estado" | **pegamento** |
| Error boundary / fallback | ✗ | capturar y degradar | **pegamento** (patrón doc) |
| Esperar datos antes de montar | `Navigator`/`Region` lazy ≈ | coordinar datos+vista | **pegamento** (sobre `Resource`) |

### D. Formularios
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Validación / dirty / commit / revert | `Model` (rules/validate/isDirty/commit) ✓ | — | — |
| Estado de envío (loading/disable) | ≈ | botón ocupado | **pegamento** |
| Validación async (ej. email único) | una `Rule` puede devolver `Promise`; `validate()` async ✓ | — | **✅ arreglado en `validate`/`Model`** (§5) |
| Field arrays / anidados | `Collection` + dot-path ≈ | — | **pegamento** |

### E. Navegación
| Problema | Lumen hoy | Veredicto |
|---|---|---|
| Rutas, grafos, flujos, pila, gestos | `Router` ✓ + capa planificada | Ver [`blueprints.md`](./blueprints.md) |

### F. Listas y render
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Reconciliación keyed | `CollectionView` ✓ | — | — |
| Orden / filtro / búsqueda | `Collection` ✓ | debounce del input | **pegamento** (+ util debounce, §L) |
| Virtualización (listas enormes) | ✗ | render por ventana | **fuera** (nota "integra lib") |
| Drag-and-drop reorder | ✗ | — | **fuera / pegamento** |

### G. Efectos y ciclo de vida
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Cleanup de listeners/subscripciones | `signal` / `listen` ✓ | — | — |
| Visibilidad (IntersectionObserver) | `observe` ✓ | — | — |
| Resize / MediaQuery atados a vida | `View.onResize`/`onMedia` ✓ | — | **✅ arreglado en `View`** (§5) |
| Timers/intervalos atados a vida | `View.interval` (se limpia en unmount) ✓ | — | **✅ arreglado en `View`** (§5) |

### H. Persistencia
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| local/sessionStorage | `Model` **`static storage`** (carga + guarda) ✓ | — | **✅ arreglado en `Model`** (§5) |
| Sync estado ↔ URL | ✗ | (ver A) | **lego chico** |
| IndexedDB | ✗ | — | **fuera** (lib) |

### I. Comunicación
| Problema | Lumen hoy | Veredicto |
|---|---|---|
| Padre ↔ hijo | `props` / `events` ✓ | — |
| Pub/sub global | `EventEmitter` ✓ | — |
| Cross-tab (BroadcastChannel) | ✗ | **pegamento / lego chico** |

### J. Auth y permisos
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Sesión / token en requests | `Http` headers ≈ | — | **pegamento** |
| Refresh de token | `Http` `onResponse` puede reintentar/reemplazar ✓ | — | **✅ arreglado en `Http`** (§5) |
| Rutas/estados protegidos (guards) | `Machine` guards (planeado) ≈ | guard en Router/Navigator | **lego chico** |

### K. Tiempo real
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| WebSocket / SSE → estado | ✗ | adaptador a `Collection`/`Model` | **lego medio** (`LiveSource`) |
| Polling | ✗ | interval + `Http` | **pegamento** (sobre `Resource`) |

### L. Rendimiento
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Code splitting | `import()` nativo ✓ (centralizado en `Navigator`) | — | — |
| debounce / throttle | ✗ | utilísimas, triviales | **lego chico** (`src/util.js`) |
| Memo / computed | ≈ | (ver A) | **pegamento** |

### M. Transversales
| Problema | Lumen hoy | Hueco / candidato | Veredicto |
|---|---|---|---|
| Animación enter/leave/shared | `animate` + Region View Transitions ✓ | — | — |
| Foco/teclado/ARIA (a11y) | ≈ (capa nav) | focus-trap para modal/overlay | **lego chico** (lo pide el modal) |
| Command / undo-redo | ✗ | patrón Command + historial | **lego nicho** o pegamento |
| Theming / dark | SCC ✓ | — | — |
| i18n | `I18n` ✓ | — | — |

---

## 2. Los huecos de más valor (priorizados)

1. ~~**`Resource` — server state (★★★).**~~ **✅ HECHO (§5), alcance SWR-simple.** `fetcher` + caché
   keyed + dedupe + estados (`isLoading`/`isValidating`/`error`/`data`) + revalidación + `mutate`
   (optimista con rollback). Era el de mayor impacto; es un **peer** que consume `Http`, no lo parchea.
2. **Lote de arreglos a la base (★★) — ✅ HECHO (§5).** Persistencia (`Model.static storage`),
   interceptores + retry en `Http`, observadores de ciclo de vida (`View.onResize`/`onMedia`/`interval`)
   y `validate` async ya están en `src/`, cada uno *dentro* del lego que les correspondía (no como
   wrappers). **Pendiente del lote:** `debounce`/`throttle` (utils puras en `src/util.js`) — único
   resto, porque no pertenecen a ningún lego existente (serían módulo nuevo, no arreglo-base).
3. **`focus-trap` / a11y de overlay (★★).** Lo necesita el modal del catálogo de componentes;
   bloquea hacer overlays accesibles.
4. **`AsyncState` (★).** Máquina idle/loading/success/error. Quizá **lo absorbe `Machine`** — decidir.
5. **`LiveSource` (WS/SSE → Collection) (★).** Medio peso, valor según tipo de app.
6. **Estado ↔ URL (★).** Útil y chico, pero acoplado al `Router`.
7. **Command / undo-redo (★).** Nicho; probablemente pegamento documentado, no lego.

---

## 3. Lo que NO se abstrae (decisión, no carencia)

- **Store global / Redux-like:** no. *Locality of state* (Model/Collection sin singleton) es la
  apuesta, alineada con la tendencia 2026.
- **Virtualización, IndexedDB, drag-and-drop, charts, rich-text:** "integra una lib".
- **SSR / React Server Components / PWA-offline:** fuera — Lumen es no-build, client-first.

---

## 4. Decisiones a tomar

1. ~~¿`Resource` es la siguiente gran pieza y con qué alcance?~~ **RESUELTO: SWR-simple, ya en `src/`
   (§5).** `stale-while-revalidate` + dedupe + `mutate(key)`. Si algún día hace falta *Query-rico*
   (claves jerárquicas, `staleTime`/`gcTime`, invalidación por patrón), se crece desde aquí — pero no
   se construyó por adelantado, coherente con "no magic, surface mínima".
2. **¿`AsyncState` separado, o lo cubre `Machine`?** (Una FSM idle/loading/success/error es literal.)
3. ~~¿Aprobamos el lote de utils chicas?~~ **RESUELTO: sí, hechos como arreglos-base** (§5). Solo
   queda `debounce`/`throttle` como módulo nuevo (`src/util.js`), no como arreglo a un lego.
4. **¿Realtime (`LiveSource`) y `focus-trap`** entran ya, o esperan a que el componente/plano que los
   pide llegue a su etapa?

> **Estado actual: arreglos-base + `Resource` hechos; faltan piezas menores.** Todo lo de §5 ya está
> en `src/` (con `npm run check` en verde y docs `en`/`es` actualizadas). Lo que sigue siendo solo
> especificación: `debounce`/`throttle` (`src/util.js`), `LiveSource` (WS/SSE), `focus-trap`,
> estado↔URL, `AsyncState` (probablemente lo cubre `Machine`), command/undo. La capa de navegación va
> aparte en [`blueprints.md`](./blueprints.md).

---

## 5. Hecho (en código + docs)

### Arreglos a la base

Aplicando el test anti-hotfix de §0: lo que era una carencia de un lego existente se corrigió
**dentro** de ese lego, como capacidad nativa, no como capa apilada encima.

| Arreglo | Dónde | API añadida |
|---|---|---|
| Persistencia (local/sessionStorage) | `src/model.js` | `static storage = 'clave'` o `{ key, area, serialize, deserialize }`; carga al construir (baseline limpio), guarda en cada `change`; `clearStored()` |
| Validación async | `src/validate.js` + `src/model.js` | una `Rule` puede devolver `Promise`; `runRules`, `Model.validate()` e `isValid()` ahora son async (ruta **única**, sin fork) |
| Interceptores | `src/http.js` | `new Http({ onRequest(ctx), onResponse(res, ctx) })` — inyectar auth, refrescar token, reemplazar `Response` |
| Reintentos | `src/http.js` | `retry` (constructor y por petición): `n` o `{ retries, delay, factor, when }`; backoff exponencial cancelable; nunca reintenta abort/timeout |
| Ciclo de vida en `View` | `src/view.js` | `onResize`/`onMedia`/`interval`, hermanos de `observe`, atados a `signal` (auto-limpieza en `unmount`) |

**Por qué fueron arreglos y no piezas nuevas:** ninguno tiene lifetime propio — son capacidades que
el lego *debía* tener (persistir un `Model`, validar contra el server, una petición resiliente, un
timer que muere con la vista).

### Peer nuevo: `Resource` (server state, SWR-simple)

| Pieza | Dónde | API |
|---|---|---|
| Server state observable | `src/resource.js` | `new Resource({ fetcher, dedupe })`; `read(key, handler?, { signal })` (SWR), `get`, `subscribe`, `revalidate`, `mutate(key, data?, opts)` (invalidar / set / derivar / optimista+rollback), `clear` |

A diferencia del lote anterior, `Resource` **sí** es pieza nueva: tiene su propio ciclo de vida (una
caché observable en el tiempo) y *consume* un `fetcher`/`Http` sin ensuciarlo — es el ejemplo canónico
de **peer nuevo** del test §0. Estado: `{ data, error, isLoading, isValidating }`. Una instancia es una
caché compartida explícitamente (como un bus `EventEmitter`), sin singleton global. Alcance **SWR-simple**
(§4.1); los errores viven en el estado, no se lanzan (para throw imperativo, usa `Http` directo).

---

## Fuentes

- [SWR vs TanStack Query — LogRocket](https://blog.logrocket.com/swr-vs-tanstack-query-react/) ·
  [Refine: React Query vs TanStack vs SWR](https://refine.dev/blog/react-query-vs-tanstack-query-swr-2025/)
- [patterns.dev](https://www.patterns.dev/) · [Frontend Patterns (40+)](https://frontendpatterns.dev/)
- [State Management 101 — DEV](https://dev.to/abbeyperini/state-management-in-front-end-web-development-state-101-48g3) ·
  [Frontend trends 2026 — Netguru](https://www.netguru.com/blog/front-end-trends)
