# Estilos

Lumen no trae **nada de CSS** y no impone nada. Tú traes lo que quieras. Como las vistas
renderizan en el **Light DOM** (sin Shadow DOM), cualquier hoja de estilos global o clases
de utilidad aplican directamente a los nodos clonados de tu `<template>` — no hay nada que
perforar ni configurar.

## Tus opciones

| Enfoque | Cuándo |
|---|---|
| **CSS plano** + una convención de nombres | Lo más simple; control total. |
| **`@scope`** nativo | Estilos por componente sin Shadow DOM y sin build. Recomendado para aislar. |
| **Tailwind** (o cualquier framework de utilidades) | Utilidades en el markup del template. |
| Cualquier framework CSS por CDN/build | Es solo CSS global; Lumen no estorba. |

## Estilos con alcance sin build: `@scope`

`@scope` (Chrome/Edge 118+, Safari 17.4+, Firefox 2024+) da aislamiento real en el Light
DOM — sin Shadow DOM, sin build:

```css
@scope (.card) {
  :scope { padding: 1rem; border-radius: var(--radius); }
  h3 { font-size: 1.1rem; }   /* solo el h3 dentro de .card */
}
```

Los tokens globales (`:root { --radius: 8px }`) siguen llegando a todo, así que el theming queda simple.

## Tailwind

Escribe las utilidades en el `<template>`; `clone` las copia y aplican porque la vista es
Light DOM:

```html
<template id="card">
  <div class="rounded-xl border border-slate-200 shadow-sm p-4 bg-white" data-ref="root">
    <h3 class="font-semibold" data-ref="title"></h3>
  </div>
</template>
```

```js
class Card extends View {
  static template = '#card';            // Tailwind se encarga del aspecto
  onMount() { this.ui.title.textContent = this.props.title; }
}
```

No hace falta código de integración — Lumen maneja comportamiento y ciclo de vida, Tailwind el
aspecto. Mira el [ejemplo de Tailwind](../../examples/tailwind/) corriendo.

Para prototipar puedes usar el **Play CDN** de Tailwind (`<script src="https://cdn.tailwindcss.com"></script>`),
que hace JIT en el navegador sin build. Para producción, usa el build de Tailwind o una hoja
de estilos prearmada.

## Widgets JS de terceros (p. ej. componentes de Bootstrap)

Para frameworks CSS que también traen widgets JS (modales, dropdowns), instancia el widget
en `onMount` y libéralo en `onUnmount` — el ciclo de vida de Lumen te da los hooks exactos:

```js
class Modal extends View {
  static template = '#modal';
  onMount()   { this.widget = new SomeLib.Modal(this.el); this.widget.show(); }
  onUnmount() { this.widget.dispose(); }   // teardown limpio
}
```

## Opcional: estilos por componente

Una vista puede declarar un string `static styles` e inyectarlo una vez si quieres
componentes autocontenidos — pero es opt-in y está apagado por defecto. La mayoría de apps
están mejor con una hoja global, `@scope`, o utilidades.
