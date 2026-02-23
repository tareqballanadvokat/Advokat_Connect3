/* eslint-disable no-undef */
/**
 * Mock for CSS/LESS/SCSS imports
 *
 * Why this is needed:
 * - Jest runs in Node.js environment, which doesn't understand CSS
 * - When components import styles (import './style.css'), Jest needs a mock
 * - This prevents "SyntaxError: Unexpected token" errors
 *
 * Why it's empty:
 * - We don't test CSS styles in unit tests
 * - We only care that the import doesn't crash
 * - Returning an empty object satisfies the import requirement
 */
module.exports = {};
