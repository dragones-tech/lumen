# Para agentes de IA (llms.txt)

Lumen incluye documentación legible por máquina para que le pases toda la API a un asistente
de IA (Claude, Codex, Cursor, …) y escriba código Lumen idiomático.

## Darle los docs a un LLM

- **[`llms.txt`](../../llms.txt)** — un índice conciso de cada módulo y guía con descripciones de una línea y enlaces. Sigue la convención de [llmstxt.org](https://llmstxt.org).
- **[`llms-full.txt`](../../llms-full.txt)** — toda la documentación concatenada en un solo archivo. Pégalo en el contexto de tu asistente (o apunta la herramienta a la URL) y conoce toda la API.

En el sitio desplegado:

```
https://dragones-tech.github.io/lumen/llms.txt
https://dragones-tech.github.io/lumen/llms-full.txt
```

Se generan desde los docs markdown con `npm run llms` — regenéralos tras editar los docs.

## Agentes trabajando en un repo

- **[`AGENTS.md`](../../AGENTS.md)** — convenciones del proyecto que leen Codex, Cursor y otros: las reglas duras (OOP primero, sin build, HTML en `<template>`, tipos JSDoc) más un resumen de la API.
- **`CLAUDE.md`** — lo que lee Claude Code automáticamente; apunta a `AGENTS.md`.

## Por qué importa

Lumen es explícito y pequeño, así que un agente que haya leído esto puede generar código
correcto e idiomático: una vista es una clase, los cambios de estado son explícitos, sin
build. Los docs legibles por máquina mantienen al asistente en patrón en vez de adivinar.
