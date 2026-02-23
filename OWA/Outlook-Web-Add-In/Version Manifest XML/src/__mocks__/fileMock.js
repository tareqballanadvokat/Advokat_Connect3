/* eslint-disable no-undef */
/**
 * Mock for file imports (images, fonts, etc.)
 *
 * Why this is needed:
 * - Components may import images: import logo from './logo.png'
 * - Jest can't process binary files (images, fonts)
 * - This mock prevents import errors during tests
 *
 * Why it returns a string:
 * - Some components might use the imported value in src attributes
 * - Returning 'test-file-stub' is a placeholder that won't break tests
 * - We don't care about actual image content in unit tests
 */
module.exports = "test-file-stub";
