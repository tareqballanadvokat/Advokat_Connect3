/**
 * Error Handling Utilities
 * Type-safe error message extraction
 */

/**
 * Extract error message from unknown error type
 * @param error - Unknown error object
 * @returns Human-readable error message
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};
