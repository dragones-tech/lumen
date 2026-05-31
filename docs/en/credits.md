# Credits & lineage

Lumen stands on the shoulders of **Backbone.js** and **Marionette.js**. Its design is a
deliberate, modernized descendant of theirs — a respectful homage, not a fork (no Backbone
or Marionette code is used; these are conceptual inspirations).

## Backbone.js

*(Jeremy Ashkenas & DocumentCloud)* — the events-first, explicit-state design.

- **`Model`** and **`Collection`** descend directly from Backbone's. `get`/`set`,
  `change` events, validation on the model — the lineage is obvious and intentional.

## Marionette.js

*(Derick Bailey)* — the view layer and composition patterns.

- **`View`** — lifecycle (`onMount`/`onUnmount`), `ui`/refs, declarative event wiring.
- **`Region`** — managing a slot and swapping the view in it.
- **`CollectionView`** — one child view per model, kept in sync.
- **Layouts** (`static regions`) — Marionette's `LayoutView` with named regions.

If you came from Marionette, Lumen should feel like home.

## What Lumen changes

The patterns were right; the implementation is rebuilt for today:

- **No jQuery, no Underscore, no Backbone runtime** — just the platform.
- **No build, native ES modules** — viable now thanks to HTTP/2.
- **No global event bus by default** — events are instances you pass explicitly.
- **`AbortSignal`-based cleanup** — no "zombie views", no leaked listeners.
- **Typed via JSDoc**, separate `<template>` HTML, and an **animation-aware lifecycle**
  (`animateOut` finishes before a node is removed — something Marionette's era couldn't do cleanly).

## And the platform

Thanks also to the web standards that make the "no-magic, no-build" approach practical:
`<template>`, the Web Animations API, the Constraint Validation API, import maps, and
HTTP/2 multiplexing.

> Backbone and Marionette showed that explicit, OOP, no-magic UI was not only possible but
> pleasant. Lumen is a love letter to that idea, rewritten for the modern platform.
