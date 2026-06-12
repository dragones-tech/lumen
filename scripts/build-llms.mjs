// Generates llms.txt (index) and llms-full.txt (all docs concatenated) from docs/en/*.md.
// Run: node scripts/build-llms.mjs   (or: npm run llms)
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://dragones-tech.github.io/lumen';

const MODULES = [
  ['event-emitter', 'Typed event bus — on/once/off/emit, AbortSignal cleanup, no global singleton.'],
  ['dom', 'clone(template), refs(root), $, $$ — the bridge between <template> markup and classes.'],
  ['animate', 'Promise-based fadeIn/fadeOut/slideIn/slideOut over the Web Animations API.'],
  ['view', 'Abstract base class you extend — lifecycle, refs, static regions (layouts), surgical updates.'],
  ['model', 'Observable single-entity state (get/set, change events) + validation via static rules.'],
  ['collection', 'Ordered list of Models; add/remove/reset events; non-mutating find/where/sort.'],
  ['collection-view', 'One child View per Model, kept in sync with keyed reconciliation.'],
  ['region', 'Manages a DOM slot; show(view) animates the old view out before mounting the new.'],
  ['router', 'hashchange/popstate routing with :params; pairs with Region to swap screens.'],
  ['http', 'Small fetch wrapper — JSON, HttpError, per-request AbortSignal.'],
  ['i18n', 'Tiny reactive translations with {interpolation}, nested keys, and fallback.'],
  ['validate', 'Composable validation rules; Model.validate() returns errors keyed by field.'],
  ['element', 'defineElement(tag, ViewClass) — use a View as a Custom Element.'],
  ['canvas', 'Experimental canvas layer — Stage/Node2D/CanvasLayer; render the same Model/Collection to canvas as well as DOM.'],
];

const START = [
  ['install', 'How to add Lumen — CDN (import map + jsDelivr), copy src/, or npm.'],
];

const GUIDES = [
  ['tradeoffs', 'Strengths & limits — what Lumen is great at, where it falls short, and when to use it.'],
  ['structure', 'Project structure — one View per file, where templates live, server partials vs static.'],
  ['messaging', 'Messaging between views — a shared EventEmitter bus + Model/Collection events, leak-free via signal.'],
  ['styling', 'Style-agnostic — plain CSS, native @scope, or Tailwind.'],
  ['deployment', 'HTTP/2, import maps, modulepreload — why no bundler is needed.'],
  ['credits', 'A respectful homage to Backbone.js and Marionette.js.'],
];

const TAGLINE = 'A transparent, no-magic, no-build vanilla-JS OOP UI framework. What you write is what runs.';
const INTRO =
  'Lumen is an OOP UI framework in the lineage of Backbone.js and Marionette.js, rebuilt for the ' +
  'modern platform: native ES modules (no build step), plain classes (not Web Components), separate ' +
  'HTML in <template> elements, JSDoc types, and zero runtime dependencies. Views are classes you ' +
  'extend; Models/Collections are observable; Regions and a hash Router handle layout and navigation.';

const link = ([id, desc]) => `- [${id}](${BASE}/docs/en/${id}.md): ${desc}`;

// ---- llms.txt (concise index) ----
const llms = `# Lumen

> ${TAGLINE}

${INTRO}

## Getting started
${START.map(link).join('\n')}

## Modules
${MODULES.map(link).join('\n')}

## Guides
${GUIDES.map(link).join('\n')}

## Full text
- [llms-full.txt](${BASE}/llms-full.txt): Every page concatenated into one file.
`;
writeFileSync('llms.txt', llms);

// ---- llms-full.txt (everything in one file) ----
const parts = [`# Lumen — full documentation\n\n> ${TAGLINE}\n`];
const add = (path) => parts.push(`\n\n---\n\n<!-- ${path} -->\n\n` + readFileSync(path, 'utf8').trim());
add('README.md');
for (const [id] of [...START, ...MODULES, ...GUIDES]) add(`docs/en/${id}.md`);
writeFileSync('llms-full.txt', parts.join('\n'));

console.log('wrote llms.txt and llms-full.txt');
