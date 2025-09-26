/**
 * Utility functions for WebRTC message chunking with ACK-based retry strategy
 * Implements reliable chunking for requests that exceed the 256KB UDP limit
 */

import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { 
  WebRTCApiRequest,  
  WebRTCApiResponse,
  WebRTCAckResponse,
  ChunkInfo, 
  PendingRequest, 
  ChunkingResult,
  ReceivedResponseChunk
} from '../components/interfaces/IWebRTC';

/**
 * Configuration constants for chunking and ACK handling
 */
export const CHUNKING_CONFIG = {
  /** Maximum WebRTC DataChannel message size (256 KB) */
  MAX_MESSAGE_SIZE: 256 * 1024,
  
  /** Estimated size for chunk metadata overhead in JSON structure */
  CHUNK_METADATA_OVERHEAD: 200,
  
  /** Exponential backoff multiplier for retry timeouts */
  BACKOFF_MULTIPLIER: 1.5,
  
  /** Chunk-level configuration for individual chunk ACK handling */
  CHUNK: {
    /** Base timeout period for individual chunk ACKs in milliseconds */
    ACK_TIMEOUT_MS: 2000,
    
    /** Maximum timeout period after exponential backoff in milliseconds */
    MAX_ACK_TIMEOUT_MS: 10000,
    
    /** Maximum number of retry attempts for unacknowledged chunks */
    MAX_RETRY_ATTEMPTS: 3
  },
  
  /** Request-level configuration for overall pending request handling */
  REQUEST: {
    /** Maximum timeout for the entire chunked request in milliseconds */
    MAX_TIMEOUT_MS: 30000,
    
    /** Maximum number of retry attempts for failed requests */
    MAX_RETRY_ATTEMPTS: 2
  }
} as const;

/**
 * Calculate MD5 checksum using crypto-js
 * @param data - The data to calculate checksum for
 * @returns Base64 encoded MD5 hash
 */
export function calculateChecksum(data: string): string {
  const hash = CryptoJS.MD5(data);
  return CryptoJS.enc.Base64.stringify(hash);
}

/**
 * Create protocol ID with GUID + hash
 * @param guid - Base GUID
 * @returns Protocol ID format: GUID + first 4 chars of GUID's MD5 hash
 */
export function createProtocolId(guid?: string): string {
  const baseGuid = guid || uuidv4();
  const guidHash = CryptoJS.MD5(baseGuid);
  const shortHash = guidHash.toString().substring(0, 4);
  return `${baseGuid}${shortHash}`;
}

/**
 * Create a WebRTC API request with complete protocol structure
 * @param method - HTTP method
 * @param url - Request URL
 * @param headers - HTTP headers
 * @param body - Request body (optional)
 * @param messageType - Message type in format "sliceName.actionName"
 * @returns Complete WebRTC API request
 */
export function createProtocolRequest(method: string, url: string, headers: Record<string, string>, body?: any, messageType?: string): WebRTCApiRequest {
  const guid = uuidv4();
  const timestamp = Date.now();
  const protocolId = createProtocolId(guid);
  
  let processedBody: string | undefined;
  
  // Process body if it exists
  if (body) {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    console.log("📤 Original request body:", bodyString);
    // Base64 encode the body for POST requests
    if (method.toUpperCase() === 'POST') {
      processedBody = btoa(bodyString); // Base64 encode for POST requests
      console.log('📤 POST request body base64 encoded (length: original=' + bodyString.length + ', encoded=' + processedBody.length + ')');
    } else {
      processedBody = bodyString;
    }
  }
  
  // Create the nested request structure with proper chunk defaults
  const requestData = {
    timestamp,
    totalChunks: 1,                  // Default: single chunk
    currentChunk: 1,                 // Default: single chunk  
    method,
    uri: url,
    headers,
    ...(processedBody && { body: processedBody })
  };
  
  // Calculate checksum of the request data
  const checksum = calculateChecksum(JSON.stringify(requestData));
  
  // Return complete protocol request
  return {
    checksum,
    id: protocolId,
    messageType: messageType || 'unknown.action',  // Use provided messageType or default
    request: requestData
  };
}

/**
 * Calculate the total size of a complete WebRTC message
 * @param request - The complete WebRTC request
 * @returns Size in bytes
 */
export function calculateMessageSize(request: WebRTCApiRequest): number {
  const message = JSON.stringify(request);
  return new TextEncoder().encode(message).length;
}

/**
 * Check if a request needs chunking based on its total size
 * @param request - The complete WebRTC request
 * @returns True if chunking is required
 */
export function needsChunking(request: WebRTCApiRequest): boolean {
  const totalSize = calculateMessageSize(request);
  return totalSize > CHUNKING_CONFIG.MAX_MESSAGE_SIZE;
}

/**
 * Chunk a large request into multiple smaller requests
 * @param request - The original request to chunk
 * @returns ChunkingResult with array of chunked requests
 */
export function chunkRequest(request: WebRTCApiRequest): ChunkingResult {
  // Calculate checksum of the original request
  const originalChecksum = calculateChecksum(JSON.stringify(request));
  
  // If request doesn't need chunking, return as single chunk with proper metadata
  if (!needsChunking(request)) {
    // Ensure single chunk has correct totalChunks and currentChunk values
    const singleChunkRequestData = {
      ...request.request,
      totalChunks: 1,
      currentChunk: 1
    };
    
    // Calculate checksum for the single chunk's request data
    const singleChunkChecksum = calculateChecksum(JSON.stringify(singleChunkRequestData));
    
    const singleChunkRequest: WebRTCApiRequest = {
      ...request,
      checksum: singleChunkChecksum,
      request: singleChunkRequestData
    };
    
    return {
      chunks: [singleChunkRequest],
      checksum: singleChunkChecksum,  // Use the recalculated checksum
      totalChunks: 1,
      baseId: request.id
    };
  }

  // Calculate how much space we have for the body content
  const bodyContent = request.request.body || '';
  const requestWithoutBody = {
    ...request,
    request: {
      ...request.request,
      body: '' // Empty body for size calculation
    }
  };
  
  const overheadSize = calculateMessageSize(requestWithoutBody);
  const maxBodySizePerChunk = CHUNKING_CONFIG.MAX_MESSAGE_SIZE - overheadSize - CHUNKING_CONFIG.CHUNK_METADATA_OVERHEAD;
  
  // Split body content into chunks
  const bodyBytes = new TextEncoder().encode(bodyContent);
  const chunks: WebRTCApiRequest[] = [];
  const totalChunks = Math.ceil(bodyBytes.length / maxBodySizePerChunk);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * maxBodySizePerChunk;
    const end = Math.min(start + maxBodySizePerChunk, bodyBytes.length);
    const chunkBodyBytes = bodyBytes.slice(start, end);
    const chunkBody = new TextDecoder().decode(chunkBodyBytes);
    
    // Create chunked request with updated metadata
    const chunkRequestData = {
      ...request.request,
      totalChunks: totalChunks,
      currentChunk: i + 1,      // 1-based chunk numbering
      body: chunkBody
    };
    
    // Calculate checksum for this specific chunk's request data
    const chunkChecksum = calculateChecksum(JSON.stringify(chunkRequestData));
    
    const chunkRequest: WebRTCApiRequest = {
      checksum: chunkChecksum,    // Each chunk has its own checksum
      id: request.id,             // All chunks share the same ID
      messageType: request.messageType,
      request: chunkRequestData
    };
    
    chunks.push(chunkRequest);
  }
  
  return {
    chunks,
    checksum: originalChecksum,
    totalChunks,
    baseId: request.id
  };
}

/**
 * Log chunking information for debugging
 * @param info - Chunking information to log
 */
export function logChunkingInfo(info: {
  totalSize: number;
  totalChunks: number;
  messageType?: string;
  action: 'single' | 'chunked';
}): void {
  const msgType = info.messageType ? ` (${info.messageType})` : '';
  if (info.action === 'single') {
    console.log(`📤 Sending request${msgType} (single message) - Total size: ${info.totalSize} bytes`);
  } else {
    console.log(`📤 Request${msgType} too large (${info.totalSize} bytes), splitting into ${info.totalChunks} chunks...`);
  }
}

/**
 * Log individual chunk transmission
 * @param chunkNumber - Current chunk number (1-based)
 * @param totalChunks - Total number of chunks
 * @param messageType - Optional message type for context
 */
export function logChunkTransmission(chunkNumber: number, totalChunks: number, messageType?: string): void {
  const msgType = messageType ? ` (${messageType})` : '';
  console.log(`📤 Sending chunk ${chunkNumber}/${totalChunks}${msgType}`);
}

/**
 * Calculate exponential backoff timeout for retry attempts
 * @param retryCount - Current retry attempt number
 * @param baseTimeout - Base timeout in milliseconds
 * @returns Calculated timeout with exponential backoff
 */
export function calculateBackoffTimeout(retryCount: number, baseTimeout: number): number {
  const timeout = baseTimeout * Math.pow(CHUNKING_CONFIG.BACKOFF_MULTIPLIER, retryCount);
  return Math.min(timeout, CHUNKING_CONFIG.CHUNK.MAX_ACK_TIMEOUT_MS);
}

/**
 * Create a pending request for chunk tracking (structure only - no timeout handling)
 * @param request - The original request
 * @param chunkingResult - The chunking result
 * @param messageType - Message type
 * @param resolve - Promise resolve function
 * @param reject - Promise reject function
 * @returns PendingRequest object ready for tracking
 */
export function createPendingRequest(
  request: WebRTCApiRequest,
  chunkingResult: ChunkingResult,
  messageType: string,
  resolve: (value?: any) => void,
  reject: (reason?: any) => void
): PendingRequest {
  const startTime = Date.now();
  
  const pendingRequest: PendingRequest = {
    id: request.id,
    messageType: messageType,
    chunks: new Map(),
    receivedAcks: new Map(),
    totalChunks: chunkingResult.totalChunks,
    startTime,
    resolve,
    reject,
    originalRequest: request // Store the original request for retry scenarios
  };
  
  // Create chunk info for each chunk
  for (let i = 0; i < chunkingResult.chunks.length; i++) {
    const chunk = chunkingResult.chunks[i];
    const chunkNumber = i + 1;
    
    const chunkInfo: ChunkInfo = {
      chunkRequest: chunk,
      chunkNumber,
      retryCount: 0,
      lastSentAt: Date.now(),
      acknowledged: false
    };
    
    pendingRequest.chunks.set(chunkNumber, chunkInfo);
  }
  
  return pendingRequest;
}

/**
 * Create ACK response for a received chunk
 * @param responseChunk - The response chunk to acknowledge
 * @returns WebRTCAckResponse to send back
 */
export function createAckForResponseChunk(responseChunk: WebRTCApiResponse): WebRTCAckResponse {
  const ackBody = {
    timestamp: Date.now(),
    chunk: responseChunk.response.currentChunk
  };
  
  const checksum = calculateChecksum(JSON.stringify(ackBody));
  
  return {
    checksum,
    id: responseChunk.id,
    body: ackBody
  };
}

/**
 * Check if all expected response chunks have been received
 * @param receivedChunks - Map of received chunks
 * @param expectedTotal - Expected total number of chunks
 * @returns True if all chunks received
 */
export function areAllResponseChunksReceived(receivedChunks: Map<number, ReceivedResponseChunk>, expectedTotal: number): boolean {
  if (receivedChunks.size !== expectedTotal) {
    return false;
  }
  
  // Check that we have all chunks from 1 to expectedTotal
  for (let i = 1; i <= expectedTotal; i++) {
    if (!receivedChunks.has(i)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Reassemble chunked response into a single complete response
 * @param receivedChunks - Map of received response chunks
 * @param expectedTotal - Expected total number of chunks
 * @returns Complete WebRTCApiResponse or null if not ready
 */
export function reassembleChunkedResponse(receivedChunks: Map<number, ReceivedResponseChunk>, expectedTotal: number): WebRTCApiResponse | null {
  if (!areAllResponseChunksReceived(receivedChunks, expectedTotal)) {
    return null;
  }
  
  // Sort chunks by chunk number
  const sortedChunks = Array.from(receivedChunks.values())
    .sort((a, b) => a.chunkNumber - b.chunkNumber);
  
  // Take the first chunk as the base (it has all the metadata)
  const baseResponse = sortedChunks[0].responseChunk;
  
  // Concatenate all chunk bodies
  let reassembledBody = '';
  for (const chunkInfo of sortedChunks) {
    const chunkBody = chunkInfo.responseChunk.response.body || '';
    reassembledBody += chunkBody;
  }
  
  // Create the complete response
  const completeResponse: WebRTCApiResponse = {
    checksum: baseResponse.checksum, // We'll validate this later
    id: baseResponse.id,
    messageType: baseResponse.messageType,
    response: {
      timestamp: baseResponse.response.timestamp,
      totalChunks: 1, // Reset to indicate it's now a single complete response
      currentChunk: 1, // Reset to indicate it's now a single complete response
      statusCode: baseResponse.response.statusCode,
      headers: baseResponse.response.headers,
      body: reassembledBody
    }
  };
  
  // Recalculate checksum for the complete response
  completeResponse.checksum = calculateChecksum(JSON.stringify(completeResponse.response));
  
  return completeResponse;
}

