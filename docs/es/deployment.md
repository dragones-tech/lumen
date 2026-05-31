# Despliegue y carga

Lumen entrega módulos ES nativos sin bundlear. Gracias a **HTTP/2** (y HTTP/3), eso no es un
sacrificio — es una ventaja. Esta página cubre cómo servirlo bien.

## Por qué no hace falta bundler

Con HTTP/1.1, muchos archivos pequeños eran lentos (≈6 conexiones, sobrecarga por request) —
por eso existía el bundling. Con HTTP/2 esa penalización desaparece:

- **Multiplexing** — muchas requests comparten una conexión sin head-of-line blocking, así que cargar los módulos pequeños de Lumen cuesta casi lo mismo que un archivo.
- **Compresión de headers (HPACK)** — sobrecarga por request barata.
- **Caché por archivo** — cambias `view.js` y solo se invalida la caché de ese archivo; un bundle invalidaría todo.

Casi todos los hosts estáticos modernos sirven HTTP/2 por defecto (Netlify, Vercel,
Cloudflare, nginx, Caddy). Así que: **despliega los archivos tal cual.** El bundler es
opcional, no obligatorio.

## Aplanar la cascada de ESM: `modulepreload`

El único inconveniente de los módulos nativos es la *cascada de descubrimiento*: el navegador
carga `index.js`, lo parsea, ve sus imports, los pide, los parsea, y así — un round trip por
nivel. Dile al navegador que baje todo el grafo de entrada, en paralelo:

```html
<link rel="modulepreload" href="/src/index.js" />
<link rel="modulepreload" href="/src/view.js" />
<link rel="modulepreload" href="/src/dom.js" />
<!-- …uno por cada módulo que tu página realmente use -->
```

Combinado con el multiplexing de HTTP/2, esto da el **rendimiento de carga de un bundle sin
bundle**. (Del lado servidor, `103 Early Hints` puede enviar estos preloads aún antes.)

## Imports limpios: import maps

Un import map te deja escribir `import { View } from 'lumenjs'` en vez de rutas relativas, y
mantiene tus URLs en un solo sitio:

```html
<script type="importmap">
  { "imports": { "lumenjs": "/src/index.js", "lumenjs/": "/src/" } }
</script>
```

Luego: `import { View } from 'lumenjs'` o `import { clone } from 'lumenjs/dom.js'`. Los import
maps están soportados en todos los navegadores actuales; este sitio de docs usa uno.

## Headers de caché

Como los archivos son independientes, cachéalos agresivamente y deja que la URL cambie al
desplegar:

```
Cache-Control: public, max-age=31536000, immutable   # para URLs de assets versionadas/hasheadas
Cache-Control: no-cache                               # para index.html
```

Si no hasheas nombres, usa un max-age más corto o `must-revalidate` para que las
actualizaciones se recojan.

## No te apoyes en HTTP/2 Server Push

Server Push fue **eliminado** de Chrome (2022). Su reemplazo es justo los hints
`modulepreload` / `preload` de arriba (opcionalmente vía `103 Early Hints`).

## El módulo Http

El módulo `http` no necesita nada especial: `fetch` usa HTTP/2 automáticamente cuando el
servidor lo soporta. Una consecuencia práctica — la concurrencia es barata, así que disparar
varias requests a la vez está bien:

```js
const [user, posts] = await Promise.all([
  api.get('/user', { signal }),
  api.get('/posts', { signal }),
]);
```
