# For AI agents (llms.txt)

Lumen ships machine-readable docs so you can feed the whole API to an AI assistant (Claude,
Codex, Cursor, …) and have it write idiomatic Lumen code.

## Feed the docs to an LLM

- **[`llms.txt`](../../llms.txt)** — a concise index of every module and guide with one-line descriptions and links. Follows the [llmstxt.org](https://llmstxt.org) convention.
- **[`llms-full.txt`](../../llms-full.txt)** — the entire documentation concatenated into one file. Paste it into your assistant's context (or point the tool at the URL) and it knows the full API.

On the deployed site:

```
https://dragones-tech.github.io/lumen/llms.txt
https://dragones-tech.github.io/lumen/llms-full.txt
```

These are generated from the markdown docs with `npm run llms` — regenerate after editing docs.

## Agents working in a repo

- **[`AGENTS.md`](../../AGENTS.md)** — project conventions read by Codex, Cursor and others: the hard rules (OOP-first, no build, HTML in `<template>`, JSDoc types) plus an API cheat-sheet.
- **`CLAUDE.md`** — what Claude Code reads automatically; it points to `AGENTS.md`.

## Why this matters

Lumen is explicit and small, so an agent that has read these can generate correct,
idiomatic code: a view is a class, state changes are explicit, no build step. The
machine-readable docs keep the assistant on-pattern instead of guessing.
