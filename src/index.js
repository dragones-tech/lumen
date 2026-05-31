// @ts-check

/**
 * Lumen — a transparent, no-magic, no-build vanilla-JS OOP UI framework.
 *
 * This barrel re-exports every public module. You can also import any module
 * directly (e.g. `import { EventEmitter } from 'lumen/event-emitter'`); with native
 * ES modules the browser only fetches what you actually import.
 */

export { EventEmitter } from './event-emitter.js';
export { $, $$, clone, refs } from './dom.js';
export { play, fadeIn, fadeOut, slideIn, slideOut } from './animate.js';
export { View } from './view.js';
export { Model } from './model.js';
export { Collection } from './collection.js';
export { CollectionView } from './collection-view.js';
export { Region } from './region.js';
export { Router } from './router.js';
export { Http, HttpError } from './http.js';
export { I18n } from './i18n.js';
export { defineElement } from './element.js';
export { runRules, required, minLength, maxLength, pattern, email, min, max, match } from './validate.js';
