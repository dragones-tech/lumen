# CLAUDE.md

This project is **Lumen**, a transparent, no-magic, no-build vanilla-JS OOP UI framework.

The conventions for working in this repo and for building apps with Lumen live in
**[AGENTS.md](AGENTS.md)** — read it first. Full API in one file:
[`llms-full.txt`](https://dragones-tech.github.io/lumen/llms-full.txt).

Quick reminders:

- A view is a **class** (`extends View`); never a factory function.
- **No build, no bundler, no JSX** — native ES modules; markup in `<template>`.
- Types are **JSDoc**; check with `npm run check`. No `.ts` files.
- After editing docs, run `npm run llms` to regenerate `llms.txt` / `llms-full.txt`.
