// @ts-check

/**
 * Animation helpers built on the native Web Animations API.
 *
 * Every helper returns a `Promise<void>` that resolves when the animation finishes.
 * That is what lets a `View` coordinate transitions: `animateIn()` is awaited after
 * mounting, and `animateOut()` is awaited *before* the node is removed — so a leave
 * animation always plays fully before unmount. (Plain Custom Elements can't do this:
 * their `disconnectedCallback` fires only after removal.)
 *
 * There are no side effects on import. `prefers-reduced-motion` is checked lazily,
 * per call, and when set every helper resolves immediately without animating.
 */

/**
 * @typedef {Object} AnimateOptions
 * @property {number} [duration=200] - Duration in milliseconds. `0` skips the animation.
 * @property {string} [easing='ease'] - A CSS easing keyword or `cubic-bezier(...)`.
 * @property {number} [delay=0] - Delay before starting, in milliseconds.
 */

/**
 * Whether the user has requested reduced motion. Checked lazily (no import-time side effects).
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Run a keyframe animation on an element and resolve when it finishes.
 *
 * This is the primitive the named helpers below are built on. Resolves immediately
 * (without animating) when `prefers-reduced-motion` is set or `duration` is `0`. If the
 * animation is cancelled, the promise still resolves (it never rejects), so an
 * interrupted `animateOut` won't throw.
 *
 * @param {Element} el - The element to animate.
 * @param {Keyframe[]} keyframes - Standard Web Animations keyframes.
 * @param {AnimateOptions} [options] - Timing options.
 * @returns {Promise<void>} Resolves when the animation finishes (or is skipped/cancelled).
 */
export function play(el, keyframes, options = {}) {
  const { duration = 200, easing = 'ease', delay = 0 } = options;
  if (duration <= 0 || prefersReducedMotion()) return Promise.resolve();
  return el.animate(keyframes, { duration, easing, delay }).finished.then(
    () => undefined,
    () => undefined, // a cancelled animation resolves rather than rejecting
  );
}

/**
 * Fade an element in (opacity 0 → 1).
 * @param {Element} el
 * @param {AnimateOptions} [options]
 * @returns {Promise<void>}
 */
export function fadeIn(el, options) {
  return play(el, [{ opacity: 0 }, { opacity: 1 }], options);
}

/**
 * Fade an element out (opacity 1 → 0).
 * @param {Element} el
 * @param {AnimateOptions} [options]
 * @returns {Promise<void>}
 */
export function fadeOut(el, options) {
  return play(el, [{ opacity: 1 }, { opacity: 0 }], options);
}

/**
 * Slide and fade an element in (from slightly below, rising into place).
 * @param {Element} el
 * @param {AnimateOptions} [options]
 * @returns {Promise<void>}
 */
export function slideIn(el, options) {
  return play(el, [
    { opacity: 0, transform: 'translateY(8px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ], options);
}

/**
 * Slide and fade an element out (sinking slightly while fading).
 * @param {Element} el
 * @param {AnimateOptions} [options]
 * @returns {Promise<void>}
 */
export function slideOut(el, options) {
  return play(el, [
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(8px)' },
  ], options);
}
