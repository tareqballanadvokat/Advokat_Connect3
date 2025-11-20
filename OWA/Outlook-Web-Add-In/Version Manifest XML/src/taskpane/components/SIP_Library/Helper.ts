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
     * Logs a message to the console for debugging purposes
     * @param msg - The message to log
     */
    log(msg: string): void { 
        console.log(msg);
    }
    
    /**
     * Modern async alternative to blobToString
     * @param b - The Blob to convert
     * @returns Promise that resolves to the string representation
     */
    async blobToStringAsync(b: Blob): Promise<string> {
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
export const logger = new Helper();
