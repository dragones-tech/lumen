# Créditos y linaje

Lumen se apoya en los hombros de **Backbone.js** y **Marionette.js**. Su diseño es un
heredero deliberado y modernizado de ellos — un homenaje respetuoso, no un fork (no se usa
código de Backbone ni de Marionette; son inspiraciones conceptuales).

## Backbone.js

*(Jeremy Ashkenas y DocumentCloud)* — el diseño explícito, de estado y eventos primero.

- **`Model`** y **`Collection`** descienden directamente de los de Backbone. `get`/`set`,
  eventos `change`, validación en el modelo — el linaje es obvio e intencional.

## Marionette.js

*(Derick Bailey)* — la capa de vistas y los patrones de composición.

- **`View`** — ciclo de vida (`onMount`/`onUnmount`), `ui`/refs, cableado declarativo de eventos.
- **`Region`** — gestionar un hueco e intercambiar la vista que vive en él.
- **`CollectionView`** — una vista hija por modelo, mantenidas en sincronía.
- **Layouts** (`static regions`) — el `LayoutView` de Marionette con regiones nombradas.

Si vienes de Marionette, Lumen debería sentirse como en casa.

## Qué cambia Lumen

Los patrones eran correctos; la implementación está reconstruida para hoy:

- **Sin jQuery, sin Underscore, sin runtime de Backbone** — solo la plataforma.
- **Sin build, módulos ES nativos** — viable hoy gracias a HTTP/2.
- **Sin bus de eventos global por defecto** — los eventos son instancias que pasas explícitamente.
- **Limpieza basada en `AbortSignal`** — sin "zombie views", sin listeners fugados.
- **Tipado por JSDoc**, HTML separado en `<template>`, y un **ciclo de vida consciente de animaciones**
  (`animateOut` termina antes de quitar el nodo — algo que la época de Marionette no resolvía con elegancia).

## Y la plataforma

Gracias también a los estándares web que hacen práctico el enfoque "sin magia, sin build":
`<template>`, la Web Animations API, la Constraint Validation API, los import maps y el
multiplexing de HTTP/2.

> Backbone y Marionette demostraron que una UI explícita, OOP y sin magia no solo era
> posible, sino agradable. Lumen es una carta de amor a esa idea, reescrita para la
> plataforma moderna.
