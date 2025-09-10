/**
 * WebRTC API Communication Interfaces
 * Defines the protocol structure for WebRTC DataChannel communication
 */

// WebRTC API request format with nested structure
export interface WebRTCApiRequest {
  checksum: string;                    // MD5 hash of request property (base64 encoded)
  id: string;                         // GUID + first 4 chars of GUID's MD5 hash
  isMultipart: boolean;               // true if chunking is used, false otherwise
  messageType?: string;               // Format: "sliceName.actionName" (optional for backward compatibility)
  request: {
    timestamp: number;                // Unix timestamp
    totalChunks: number;              // Total number of chunks (0 if not chunked)
    currentChunk: number;             // Current chunk number (0 if not chunked)
    method: string;                   // HTTP method
    uri: string;                      // Relative URI
    headers: Record<string, string>;  // HTTP headers
    body?: string;                    // HTTP body (optional)
  };
}

// WebRTC API response format with nested structure
export interface WebRTCApiResponse {
  checksum: string;                   // MD5 hash of response property (base64 encoded)
  id: string;                        // GUID + first 4 chars of GUID's MD5 hash
  response: {
    timestamp: number;                // Unix timestamp
    statusCode: number;               // HTTP status code
    headers: Record<string, string>;  // HTTP headers
    body?: string;                    // HTTP body (optional)
  };
}
