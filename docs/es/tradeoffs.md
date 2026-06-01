# Compensaciones: fortalezas y límites

Lumen toma un puñado de apuestas deliberadas: **sin build, sin magia, updates quirúrgicos,
del lado del cliente, cero dependencias.** Cada fortaleza *y* cada limitación de esta página
nacen de esas apuestas — son consecuencias coherentes, no huecos accidentales. Por eso la
pregunta nunca es "¿le falta la feature X?" sino **"¿mis restricciones encajan con sus
apuestas?"**

**Lumen es una librería de UI, no un servidor.** Construye y gestiona vistas en el navegador;
no sirve HTTP ni renderiza páginas en el servidor. Cuando necesites SEO o un primer pintado
renderizado en servidor, combínalo con un servidor (Express, Rails, FastAPI…) que renderice el
contenido — Lumen pone la interactividad encima. Ver [Estructura del proyecto](structure.md).

Una idea para tener presente: el eje que limita a Lumen **no es el tamaño de la app**. Es
**el dinamismo de la UI + la necesidad de SEO + la dependencia del ecosistema**. Una app
grande renderizada en el servidor con islas de interactividad le queda perfecta; una SPA
mediana pero muy dinámica tipo editor le va a pelear.

## Fortalezas

| Fortaleza | Por qué importa |
|---|---|
| **Sin build, sin pudrición de dependencias** | Módulos ES nativos — lo que escribes es lo que corre, hoy y en cinco años. Nada que transpilar, nada que se actualice a tus espaldas. |
| **Carga solo lo que usas** | Cero dependencias en runtime; el navegador baja solo los módulos que importas. Sin medio mega de framework para un dropdown. |
| **Transparente, sin magia** | Estado explícito (`model.set`), ciclo de vida explícito, sin proxies, sin globals. Fácil de leer, depurar y razonar. |
| **Updates quirúrgicos** | Tocas solo los nodos que cambiaron — foco, scroll, selección y estado de inputs nunca se pierden. Sin re-render, sin diffing. |
| **Va con la plataforma** | Limpieza vía `AbortSignal`, transiciones vía View Transitions API, visibilidad vía `IntersectionObserver`, peticiones vía `fetch`. El trabajo pesado lo hace la plataforma. |
| **Hecho para islas** | `defineElement` expone cualquier vista como custom element — mete comportamiento en páginas renderizadas por el servidor o en otros frameworks. |
| **Anfitrión ideal para librerías imperativas** | `onMount`/`onUnmount`/`signal` son la costura de integración exacta para three.js, pixi, CodeMirror, mapas, charts — a menudo más limpio que el baile de `useRef` + `useEffect`, y sin re-render que pelear. Ver [Librerías vs. componentes](#librerías-vs-componentes). |
| **OOP y longevidad** | Clases planas, tipos JSDoc. Una superficie pequeña y estable que envejece bien. |

## Limitaciones

| Limitación | Qué significa |
|---|---|
| **Sin SSR / SSG / hidratación** | Las vistas renderizan en el navegador, así que el contenido no está en el HTML inicial. Para páginas críticas de SEO y primer pintado rápido, deja que el **servidor** renderice el contenido y usa Lumen para la interactividad (islas) — Lumen solo no es un renderizador de páginas para sitios de contenido. Es el hueco más grande frente a Next/Nuxt/SvelteKit. |
| **Los updates manuales no escalan con el dinamismo** | Tú eres el reconciliador. Para telarañas de estado derivado, render condicional complejo o UIs tipo editor/hoja-de-cálculo, escribes mucho código de sincronización del DOM a mano — con riesgo de que estado y DOM se desincronicen. No hay motor de reactividad/estado computado (ni signals, ni bindings). |
| **Sin kits de componentes acoplados a un framework** | No heredas los miles de componentes listos de React/Vue (un date picker de React, un data table de Vue, MUI) — están atados al modelo de render de su framework. Así que la velocidad en UI de producto estándar es menor. Ojo: es solo *media* limitación: las librerías agnósticas del framework integran limpio — ver [Librerías vs. componentes](#librerías-vs-componentes). |
| **DX y escala de equipo** | Sin HMR que preserve estado (el dev server recarga entero), sin type-checking estático del cableado template/DOM, sin devtools dedicadas. Y es a medida — la mayoría ya sabe React/Vue, así que el onboarding tiene costo. |
| **Capa de datos y listas grandes** | Sin store global, caché normalizada ni capa de data-fetching/caché (tipo React Query/Apollo) — los construyes sobre `EventEmitter`/`Model`/`Http`. `CollectionView` monta DOM real por modelo, **sin virtualización**, así que listas enormes necesitan un *windowing* que escribes tú. |
| **Solo navegadores evergreen** | Lumen se apoya en APIs modernas de la plataforma. Soportar navegadores viejos pediría polyfills y un paso de build — que contradice toda la premisa. |

## Librerías vs. componentes

"Sin ecosistema" necesita una línea más afilada, porque es solo media limitación:

- **Librerías agnósticas del framework** — three.js, pixi.js, CodeMirror, Chart.js, MapLibre,
  ProseMirror, D3 — dueñan un nodo del DOM y se renderizan solas. Lumen es un anfitrión
  *ideal*: instancias la librería en `onMount`, la liberas en `onUnmount`. La librería
  imperativa y el ciclo de vida imperativo encajan naturalmente — a menudo más limpio que el
  baile de `useRef` + `useEffect` + cleanup de React, sin re-render que pelear y sin el
  doble-invoke de `StrictMode`.

  ```js
  import * as THREE from 'three'; // ESM — importable por CDN/import map (sigue sin build)

  class Scene extends View {
    static template = '#scene';                 // p. ej. <canvas data-ref="canvas"></canvas>
    onMount() {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.ui.canvas });
      // …montas la escena y arrancas el loop de render
      this.tick();
    }
    tick = () => {
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(this.tick);
    };
    onUnmount() {
      cancelAnimationFrame(this._raf);
      this.renderer.dispose();                  // libera recursos GPU — teardown limpio
    }
  }
  ```

  La librería dueña su subárbol; Lumen solo hospeda el nodo raíz y el ciclo de vida. Para
  creative-coding, dataviz, mapas y editores esto es una **fortaleza** real, no un hueco.

- **Kits de componentes acoplados a un framework** — un date picker de React, un data table de
  Vue, MUI — están atados al modelo de render de su framework y no se pueden meter en Lumen.
  *Ese* es el hueco real. Muchas necesidades igual las cubren librerías vanilla agnósticas; lo
  que no obtienes son los kits atados al framework.

## El eje que decide

No preguntes "¿qué tan grande es la app?". Pregunta tres cosas:

1. **¿Necesito SEO / primer pintado renderizado en servidor?** Si sí, el servidor renderiza el contenido; Lumen es la capa de interactividad, no la página.
2. **¿Qué tan dinámica es la UI?** Mayormente contenido + interacciones discretas → genial. Una telaraña densa de estado derivado e interdependiente → vas a extrañar la reactividad declarativa.
3. **¿Dependo de un ecosistema de componentes para ir rápido?** Si sí, un framework mainstream gana en velocidad.

## Cuándo usar Lumen — y cuándo no

> **Usa Lumen** cuando el servidor (o un build estático) ya da el HTML/SEO; la interactividad
> son "islas", una herramienta interna o un dashboard de larga vida; controlas el navegador; y
> valoras transparencia y longevidad sobre velocidad de ecosistema. Las apps internas y los
> dashboards pueden ser **grandes** — el tamaño no es el límite.
>
> **Echa mano de React / Vue / Svelte + un meta-framework** cuando necesitas SSR/SEO de serie,
> la UI es grande y muy dinámica con estado derivado por todas partes, dependes del ecosistema
> de componentes para la velocidad, o un equipo grande ya vive en ese stack.

## Estos límites son intencionales

Añadir SSR, un motor de reactividad o un ecosistema empaquetado reintroduciría justo el paso de
build y el bloat que Lumen existe para evitar. Las limitaciones son el *precio* de las
fortalezas — elige por encaje, no por conteo de features. Ver también
[Estructura del proyecto](structure.md) (cómo mantener limpia una app que crece),
[defineElement](element.md) (islas) y [Despliegue](deployment.md) (por qué no hace falta
bundler).
