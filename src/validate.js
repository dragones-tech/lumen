// @ts-check

/**
 * A validation rule: given a field value (and the whole data object), return an error
 * message string, or `null` when valid. A rule may answer **synchronously** or return a
 * `Promise` (e.g. "is this email already taken?" hitting the server) — both go through the
 * same path; there is no separate async validator.
 * @typedef {(value: any, data: Record<string, any>) => (string | null | Promise<string | null>)} Rule
 */

/** @param {string} [message] @returns {Rule} */
export function required(message = 'is required') {
  return (v) => (v === undefined || v === null || v === '' ? message : null);
}

/** @param {number} n @param {string} [message] @returns {Rule} */
export function minLength(n, message) {
  return (v) => (v != null && String(v).length < n ? (message ?? `must be at least ${n} characters`) : null);
}

/** @param {number} n @param {string} [message] @returns {Rule} */
export function maxLength(n, message) {
  return (v) => (v != null && String(v).length > n ? (message ?? `must be at most ${n} characters`) : null);
}

/** @param {RegExp} re @param {string} [message] @returns {Rule} */
export function pattern(re, message = 'has an invalid format') {
  return (v) => (v != null && v !== '' && !re.test(String(v)) ? message : null);
}

/** @param {string} [message] @returns {Rule} */
export function email(message = 'must be a valid email') {
  return pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);
}

/** @param {number} n @param {string} [message] @returns {Rule} */
export function min(n, message) {
  return (v) => (v !== null && v !== undefined && v !== '' && Number(v) < n ? (message ?? `must be ≥ ${n}`) : null);
}

/** @param {number} n @param {string} [message] @returns {Rule} */
export function max(n, message) {
  return (v) => (v !== null && v !== undefined && v !== '' && Number(v) > n ? (message ?? `must be ≤ ${n}`) : null);
}

/**
 * Value must equal another field's value (e.g. password confirmation).
 * @param {string} field @param {string} [message] @returns {Rule}
 */
export function match(field, message) {
  return (v, data) => (v !== data[field] ? (message ?? `must match ${field}`) : null);
}

/**
 * Run a rules map against a data object. Returns errors keyed by field — only fields that
 * failed are present, so an empty object means "valid".
 *
 * Always `async`: a rule may be synchronous or return a `Promise`, and `runRules` `await`s
 * each one, so there is a **single** path for both. Rules run in declaration order and a
 * field collects every failure (it does not short-circuit on the first), so `await`-ing a
 * synchronous-only rules map simply resolves on the next microtask — no behaviour change
 * beyond the `await`.
 *
 * @param {Record<string, any>} data
 * @param {Record<string, Rule[]>} rules
 * @returns {Promise<Record<string, string[]>>}
 */
export async function runRules(data, rules) {
  /** @type {Record<string, string[]>} */
  const errors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    /** @type {string[]} */
    const messages = [];
    for (const rule of fieldRules) {
      const message = await rule(data[field], data);
      if (message) messages.push(message);
    }
    if (messages.length) errors[field] = messages;
  }
  return errors;
}
