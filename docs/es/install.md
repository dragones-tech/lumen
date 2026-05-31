# Instalación

Lumen es sin build, módulos ES nativos y cero dependencias de runtime — así que "instalar"
puede ser tan ligero como apuntar a un CDN o copiar una carpeta. Elige lo que encaje con tu
montaje.

## Opción 1 — CDN, sin instalar (lo más rápido)

Añade un import map y carga desde un CDN (jsDelivr sirve el repo de GitHub directamente):

```html
<script type="importmap">
{
  "imports": {
    "lumen": "https://cdn.jsdelivr.net/gh/dragones-tech/lumen@main/src/index.js",
    "lumen/": "https://cdn.jsdelivr.net/gh/dragones-tech/lumen@main/src/"
  }
}
</script>

<script type="module">
  import { View } from 'lumen';
  // …tu app
</script>
```

Para producción fija un tag o commit en vez de `@main` (p. ej. `@v0.1.0`) para que no cambie bajo tus pies.

## Opción 2 — copiar `src/` (lo más transparente)

Lumen son solo archivos `.js` planos. Copia el `src/` del repo en tu proyecto (p. ej.
`vendor/lumen/`) e impórtalo — relativo o por import map:

```html
<script type="importmap">
{ "imports": { "lumen": "/vendor/lumen/index.js", "lumen/": "/vendor/lumen/" } }
</script>
```

El código es tuyo, sin gestor de paquetes, nada que se actualice a tus espaldas. Muy de marca.

## Opción 3 — npm / GitHub

```bash
npm i @universidad-carolina/lumen     # cuando se publique en npm
# o directo desde GitHub hoy:
npm i github:dragones-tech/lumen
```

Los bundlers y Node resuelven `@universidad-carolina/lumen` por el campo `exports` del paquete.
En el navegador **sin** bundler, igual añade un import map apuntando el especificador a los
archivos instalados (p. ej. `node_modules/@universidad-carolina/lumen/src/index.js`), porque
los navegadores no resuelven especificadores "pelados" por sí solos.

## Servirlo

Cualquier servidor estático sirve (los imports de módulos ES están bloqueados en `file://`).
El repo trae uno cero-dependencias con live reload:

```bash
npm run serve   # → http://localhost:8000
```

## Verificación de tipos (opcional)

Los tipos son JSDoc; verifícalos con TypeScript (solo dev, nunca corre en el navegador):

```bash
npm i -D typescript
npm run check   # tsc --noEmit
```

> Estado: publicado en GitHub (`dragones-tech/lumen`); el CDN y `github:` install funcionan
> hoy. El nombre del paquete npm es `@universidad-carolina/lumen` (publicación pendiente).
