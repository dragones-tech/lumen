# Estructura del proyecto

Lumen separa el **comportamiento** (clases) del **markup** (`<template>`). Esa separación es
fácil en lo pequeño; lo que responde esta página es cómo mantenerla cuando la app crece — para
que cada sección (header, clientes, contacto…) sea dueña de lo suyo y nunca acabes con un
archivo gigante que lo tiene todo.

## La unidad: una View por archivo

Una vista es una clase, así que su lugar natural es su propio módulo. Una sección mapea a un
archivo:

```text
views/
  app-layout.js     # el shell (regiones)
  header.js
  clientes.js
  contacto.js
```

Cada archivo es dueño del comportamiento de una vista. Su markup vive en un `<template>` —
nunca como una cadena de HTML dentro del JS (perderías el soporte de HTML del editor:
resaltado, auto-cierre, Emmet, format-on-save). El HTML, como HTML.

## Dónde vive el markup (la decisión clave)

`clone('#id')` resuelve el selector contra el **document**, así que todo `<template>` que use
una vista debe estar presente en la página. Eso está bien — lo que quieres evitar es mantener
a mano un `index.html` monolítico con el markup de todas las secciones. La respuesta limpia
depende de si tienes servidor.

### Con servidor (Rails, FastAPI, cualquier templating) — recomendado

Cada sección es dueña de su parcial; el servidor los compone. En disco logras single
responsibility de verdad; el navegador igual recibe un solo documento con todos los templates
— justo lo que `clone('#id')` necesita. La página ensamblada es **output generado**, no un
archivo que editas.

**Rails**

```erb
<%# app/views/site/_header.html.erb %>
<template id="header"><header data-ref="root">…</header></template>

<%# app/views/site/index.html.erb %>
<%= render "header" %>
<%= render "clientes" %>
<%= render "contacto" %>
<div id="app"></div>
<%= javascript_import_module_tag "app" %>
```

**FastAPI / Jinja**

```django
{# templates/index.html #}
{% include "_header.html" %}     {# cada uno trae su propio <template id> #}
{% include "_clientes.html" %}
{% include "_contacto.html" %}
<div id="app"></div>
<script type="module" src="/static/app.js"></script>
```

**Express / EJS** (la versión Node — Lumen es una librería de UI, así que para SEO necesita un servidor así)

```js
// server.js
import express from 'express';
const app = express();
app.set('view engine', 'ejs');
app.use('/static', express.static('static'));   // tu JS: src/ copiado o un import map de CDN

app.get('/', async (req, res) => {
  res.render('index', { clientes: await db.clientes() });  // el servidor renderiza el contenido → SEO
});
app.listen(3000);
```

```html
<%# views/index.ejs %>
<%- include('_header') %>      <!-- cada parcial trae su propio <template id> -->
<%- include('_clientes') %>
<%- include('_contacto') %>
<div id="app"></div>
<script type="module" src="/static/app.js"></script>
```

> Lo que necesites **indexado** tiene que renderizarse en este HTML del servidor; Lumen pone
> luego la interactividad. El contenido que solo aparece tras un `fetch` del cliente no se rastrea.

### Estático (sin templating de servidor)

La plataforma no tiene un include de HTML nativo (HTML Modules no es Baseline), así que no
puedes componer archivos `.html` al cargar sin maquinaria. Dos opciones honestas:

1. **Un `index.html` organizado** — mantén todos los `<template id>` en la página, agrupados y
   comentados por sección. El JS sigue en archivos por sección. Para la mayoría de sitios
   estáticos este es el punto pragmático: el markup en un archivo, pero cada *comportamiento*
   separado.
2. **Un cargador de parciales** — entrega `.html` por sección y haz `fetch` + inyección de sus
   `<template>` antes de montar. Consigues markup por archivo a costa de orden async y
   peticiones extra. Solo vale la pena en apps estáticas grandes.

En cualquier caso: **no metas el markup como cadena de JS** para "separar" los archivos — eso
cambia un problema de organización de markup por uno peor de ergonomía del editor.

## Cablearlo: el entry

Un entry pequeño importa las vistas de sección y monta el shell. Compón con las `static
regions` de un layout (una región por sección) o el `Router` — nunca un archivo-dios:

```js
// app.js — el entry
import { View } from 'lumenjs';
import { Header } from './views/header.js';
import { Clientes } from './views/clientes.js';
import { Contacto } from './views/contacto.js';

class AppLayout extends View {
  static template = '#app-shell';
  static regions = { header: 'header', main: 'main', contacto: 'contacto' };
  onMount() {
    this.regions.header.show(new Header());
    this.regions.main.show(new Clientes());
    this.regions.contacto.show(new Contacto());
  }
}

new AppLayout().mount(document.querySelector('#app'));
```

Cada vista de sección, en su archivo, queda diminuta y enfocada:

```js
// views/contacto.js
import { View } from 'lumenjs';
export class Contacto extends View {
  static template = '#contacto';
  onMount() { /* cablea los listeners de esta sección */ }
}
```

## Un layout sugerido (con servidor)

```text
app/
  views/site/
    index.html.erb        # <div id="app"></div> + tags de assets
    _header.html.erb      # <template id="header">…
    _clientes.html.erb    # <template id="clientes">…
    _contacto.html.erb
  javascript/
    app.js                # entry: monta AppLayout
    views/                # una View por sección
      app-layout.js  header.js  clientes.js  contacto.js
    models/               # subclases de Model / Collection
    api.js                # una sola instancia Http, importada donde haga falta
```

## Reglas de oro

- **Una View por archivo**; el nombre del archivo nombra la sección.
- **Markup en `<template>`**, nunca como cadena en JS.
- **Las secciones son dueñas de su markup** — parciales del servidor cuando lo tienes; un
  `index.html` organizado cuando no.
- **Compón, no centralices** — las `static regions` de un layout (ver [View → Regiones](view.md))
  o el [Router](router.md) cablean las secciones; el entry solo monta el shell.
- **Un `Http` por API**, importado explícitamente — sin globals.
