// @ts-check

/**
 * A validation rule: given a field value (and the whole data object), return an error
 * message string, or `null` when valid.
 * @typedef {(value: any, data: Record<string, any>) => (string | null)} Rule
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
 * @param {Record<string, any>} data
 * @param {Record<string, Rule[]>} rules
 * @returns {Record<string, string[]>}
 */
export function runRules(data, rules) {
  /** @type {Record<string, string[]>} */
  const errors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    /** @type {string[]} */
    const messages = [];
    for (const rule of fieldRules) {
      const message = rule(data[field], data);
      if (message) messages.push(message);
    }
    if (messages.length) errors[field] = messages;
  }
  return errors;
}
