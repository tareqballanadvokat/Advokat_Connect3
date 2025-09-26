/**
 * WebRTC API Communication Interfaces
 * Defines the protocol structure for WebRTC DataChannel communication
 */

// WebRTC API request format with nested structure
export interface WebRTCApiRequest {
  checksum: string;                    // MD5 hash of request property (base64 encoded)
  id: string;                         // GUID + first 4 chars of GUID's MD5 hash
  messageType: string;                // Format: "sliceName.actionName"
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
  messageType: string;                // Format: "sliceName.actionName"
  response: {
    timestamp: number;                // Unix timestamp
    totalChunks: number;              // Total number of chunks (0 if not chunked)
    currentChunk: number;             // Current chunk number (0 if not chunked)
    statusCode: number;               // HTTP status code
    headers: Record<string, string>;  // HTTP headers
    body?: string;                    // HTTP body (optional)
  };
}

/**
 * ACK response structure from remote
 */
export interface WebRTCAckResponse {
  /** Checksum that should match the original chunk checksum */
  checksum: string;
  /** Protocol ID calculated using createProtocolId */
  id: string;
  /** ACK body containing timestamp and chunk number */
  body: {
    /** Unix timestamp when ACK was sent */
    timestamp: number;
    /** Chunk number being acknowledged (1-based) */
    chunk: number;
  };
}

/**
 * Tracking information for sent chunks awaiting ACK
 */
export interface ChunkInfo {
  /** The chunk request that was sent */
  chunkRequest: WebRTCApiRequest;
  /** Chunk number (1-based) */
  chunkNumber: number;
  /** Number of retry attempts made */
  retryCount: number;
  /** Timestamp when chunk was last sent */
  lastSentAt: number;
  /** Whether this chunk has been acknowledged */
  acknowledged: boolean;
}

/**
 * Result of chunking a large request
 */
export interface ChunkingResult {
  /** Array of chunked requests */
  chunks: WebRTCApiRequest[];
  /** Total number of chunks */
  totalChunks: number;
  /** Checksum of the original request */
  checksum: string;
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
  /** Whether ACK was sent for this chunk */
  ackSent: boolean;
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
  
  // ACK strategy specific properties (for sending chunked requests)
  /** Map of chunk number to chunk info */
  chunks?: Map<number, ChunkInfo>;
  /** Map of received ACKs by chunk number */
  receivedAcks?: Map<number, WebRTCAckResponse>;
  /** Total number of chunks for this request */
  totalChunks?: number;
  /** Function to send/resend chunks */
  sendFunction?: (chunk: WebRTCApiRequest) => Promise<void> | void;
  /** Total number of chunks sent for this request (legacy) */
  totalChunksSent?: number;
  
  // Chunked response handling properties (for receiving chunked responses)
  /** Map of received response chunks by chunk number */
  receivedResponseChunks?: Map<number, ReceivedResponseChunk>;
  /** Expected total chunks for incoming response */
  expectedResponseChunks?: number;
}
