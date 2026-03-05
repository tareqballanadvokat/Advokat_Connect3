/**
 * WebRTC API Communication Interfaces
 * Defines the protocol structure for WebRTC DataChannel communication
 */

// WebRTC API request format (flat structure)
export interface WebRTCApiRequest {
  id: string;                         // GUID
  messageType: string;                // Format: "sliceName.actionName"
  timestamp: number;                  // Unix timestamp
  totalChunks: number;                // Total number of chunks (0 if not chunked)
  currentChunk: number;               // Current chunk number (0 if not chunked)
  method: string;                     // HTTP method
  uri: string;                        // Relative URI
  headers: Record<string, string>;    // HTTP headers
  body?: string;                      // HTTP body (optional)
}

// WebRTC API response format (flat structure)
export interface WebRTCApiResponse {
  id: string;                         // GUID
  timestamp: number;                  // Unix timestamp
  totalChunks: number;                // Total number of chunks (0 if not chunked)
  currentChunk: number;               // Current chunk number (0 if not chunked)
  statusCode?: number;                // HTTP status code
  errorCode?: number;                 // Alternative error code field (used in some error responses)
  headers?: Record<string, string>;   // HTTP headers
  body?: string;                      // HTTP body (optional)
  messageType?: string;               // Message type (optional, for routing)
}

/**
 * Tracking information for sent chunks
 */
export interface ChunkInfo {
  /** The chunk request that was sent */
  chunkRequest: WebRTCApiRequest;
  /** Chunk number (1-based) */
  chunkNumber: number;
  /** Timestamp when chunk was sent */
  sentAt: number;
}

/**
 * Result of chunking a large request
 */
export interface ChunkingResult {
  /** Array of chunked requests */
  chunks: WebRTCApiRequest[];
  /** Total number of chunks */
  totalChunks: number;
  /** Base ID of the original request */
  baseId: string;
}

/**
 * Tracking information for received response chunks awaiting reassembly
 */
export interface ReceivedResponseChunk {
  /** The response chunk that was received */
  responseChunk: WebRTCApiResponse;
  /** Chunk number (1-based) */
  chunkNumber: number;
  /** Timestamp when chunk was received */
  receivedAt: number;
}

/**
 * Unified pending request tracking for WebRTC API service
 * Supports both response handling and ACK tracking for chunked sending
 */
export interface PendingRequest {
  /** Request ID (same as WebRTCApiRequest.id) */
  id: string;
  /** Request message type */
  messageType: string;
  /** Request timestamp (used by webRTCApiService) */
  timestamp?: number;
  /** Request start timestamp (used by ACK strategy) */
  startTime?: number;
  /** Timeout handle for the request */
  timeoutHandle?: NodeJS.Timeout;
  /** Resolve function for basic response handling */
  resolve: ((response?: WebRTCApiResponse) => void) | (() => void);
  /** Reject function for error handling */
  reject: (error: Error) => void;
  /** Retry count for failed requests */
  retryCount?: number;
  /** Original request for retries */
  originalRequest?: WebRTCApiRequest;
  /** Whether a silent token-refresh retry has already been attempted for this request */
  authRetryAttempted?: boolean;
  
  // Chunked request tracking
  /** Map of chunk number to chunk info */
  chunks?: Map<number, ChunkInfo>;
  /** Total number of chunks for this request */
  totalChunks?: number;
  /** Total number of chunks sent for this request (legacy) */
  totalChunksSent?: number;
  
  // Chunked response handling properties (for receiving chunked responses)
  /** Map of received response chunks by chunk number */
  receivedResponseChunks?: Map<number, ReceivedResponseChunk>;
  /** Expected total chunks for incoming response */
  expectedResponseChunks?: number;
}
