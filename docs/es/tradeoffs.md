# Compensaciones: fortalezas y límites

Lumen toma un puñado de apuestas deliberadas: **sin build, sin magia, updates quirúrgicos,
del lado del cliente, cero dependencias.** Cada fortaleza *y* cada limitación de esta página
nacen de esas apuestas — son consecuencias coherentes, no huecos accidentales. Por eso la
pregunta nunca es "¿le falta la feature X?" sino **"¿mis restricciones encajan con sus
apuestas?"**

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
| **OOP y longevidad** | Clases planas, tipos JSDoc. Una superficie pequeña y estable que envejece bien. |

## Limitaciones

| Limitación | Qué significa |
|---|---|
| **Sin SSR / SSG / hidratación** | Las vistas renderizan en el navegador, así que el contenido no está en el HTML inicial. Para páginas críticas de SEO y primer pintado rápido, deja que el **servidor** renderice el contenido y usa Lumen para la interactividad (islas) — Lumen solo no es un renderizador de páginas para sitios de contenido. Es el hueco más grande frente a Next/Nuxt/SvelteKit. |
| **Los updates manuales no escalan con el dinamismo** | Tú eres el reconciliador. Para telarañas de estado derivado, render condicional complejo o UIs tipo editor/hoja-de-cálculo, escribes mucho código de sincronización del DOM a mano — con riesgo de que estado y DOM se desincronicen. No hay motor de reactividad/estado computado (ni signals, ni bindings). |
| **Sin ecosistema de componentes** | No hay datepicker, data grid, charts ni editor rich-text *hechos para Lumen*. Integras librerías vanilla (los hooks de ciclo de vida lo hacen limpio), pero no tienes los miles de componentes listos de React/Vue. |
| **DX y escala de equipo** | Sin HMR que preserve estado (el dev server recarga entero), sin type-checking estático del cableado template/DOM, sin devtools dedicadas. Y es a medida — la mayoría ya sabe React/Vue, así que el onboarding tiene costo. |
| **Capa de datos y listas grandes** | Sin store global, caché normalizada ni capa de data-fetching/caché (tipo React Query/Apollo) — los construyes sobre `EventEmitter`/`Model`/`Http`. `CollectionView` monta DOM real por modelo, **sin virtualización**, así que listas enormes necesitan un *windowing* que escribes tú. |
| **Solo navegadores evergreen** | Lumen se apoya en APIs modernas de la plataforma. Soportar navegadores viejos pediría polyfills y un paso de build — que contradice toda la premisa. |

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
