/* eslint-disable no-undef */
/**
 * SIP Helper Utility Class
 *
 * This utility class provides common helper functions for
 * SIP (Session Initiation Protocol) operations.
 * It includes logging functionality, blob conversion utilities,
 * and content length calculation methods
 * that are used throughout the SIP communication flow.
 *
 * Key Features:
 * - Centralized logging for debugging SIP messages
 * - Blob to string conversion for WebSocket message handling
 * - Content length calculation for SIP message headers
 *
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

export class Helper {
  /**
   * Converts WebSocket event.data to a string regardless of its type.
   * - string  → returned directly (synchronous, no async I/O)
   * - Blob    → read via Blob.text()  (truly async in Office runtime)
   * - ArrayBuffer → decoded via TextDecoder (synchronous)
   *
   * Handling string data as a resolved Promise (not real async I/O) ensures
   * that when the server sends two messages in rapid succession, the message
   * handlers retain their arrival order as microtasks rather than racing as
   * concurrent Blob reads.
   */
  async blobToStringAsync(b: Blob | string | ArrayBuffer): Promise<string> {
    if (typeof b === "string") {
      return b;
    }
    if (b instanceof ArrayBuffer) {
      return new TextDecoder("utf-8").decode(b);
    }
    return await b.text();
  }

  /**
   * Calculates the byte length of a string for Content-Length header
   * @param data - The string data to measure
   * @returns The byte length of the data
   */
  contentLength(data: string): number {
    const encoder = new TextEncoder();
    return encoder.encode(data).length;
  }
}

// Export a singleton instance for convenience
export const helper = new Helper();
