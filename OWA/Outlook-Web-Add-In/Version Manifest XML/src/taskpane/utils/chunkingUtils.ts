/**
 * Utility functions for WebRTC message chunking
 * Generic chunking system for all requests that exceed the 256KB UDP limit
 */

import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { WebRTCApiRequest } from '../components/interfaces/IWebRTC';

/**
 * Configuration constants for chunking
 */
export const CHUNKING_CONFIG = {
  /** Maximum WebRTC DataChannel message size (256 KB) */
  MAX_MESSAGE_SIZE: 256 * 1024,
  
  /** Estimated size for chunk metadata overhead in JSON structure */
  CHUNK_METADATA_OVERHEAD: 200,
  
  /** Delay between chunk transmissions in milliseconds */
  CHUNK_DELAY_MS: 100
} as const;

/**
 * Result of generic request chunking operation
 */
export interface ChunkingResult {
  /** Array of chunked requests ready to send */
  chunks: WebRTCApiRequest[];
  /** MD5-style checksum of the original request */
  checksum: string;
  /** Total number of chunks created */
  totalChunks: number;
  /** Base request ID (same for all chunks) */
  baseId: string;
}

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
 * @returns Complete WebRTC API request
 */
export function createProtocolRequest(method: string, url: string, headers: Record<string, string>, body?: any): WebRTCApiRequest {
  const guid = uuidv4();
  const timestamp = Date.now();
  const protocolId = createProtocolId(guid);
  
  // Create the nested request structure
  const requestData = {
    timestamp,
    totalChunks: 0,                  // Default: no chunks
    currentChunk: 0,                 // Default: no chunks
    method,
    uri: url,
    headers,
    ...(body && { body: typeof body === 'string' ? body : JSON.stringify(body) })
  };
  
  // Calculate checksum of the request data
  const checksum = calculateChecksum(JSON.stringify(requestData));
  
  // Return complete protocol request
  return {
    checksum,
    id: protocolId,
    isMultipart: false,              // Default: not chunked
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
  
  // If request doesn't need chunking, return as single chunk
  if (!needsChunking(request)) {
    return {
      chunks: [request],
      checksum: originalChecksum,
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
    const chunkRequest: WebRTCApiRequest = {
      checksum: originalChecksum, // All chunks share the same checksum
      id: request.id,             // All chunks share the same ID
      isMultipart: true,          // Mark as chunked
      messageType: request.messageType,
      request: {
        ...request.request,
        totalChunks: totalChunks,
        currentChunk: i + 1,      // 1-based chunk numbering
        body: chunkBody
      }
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
 * Create a delay between chunk transmissions
 * @param delayMs - Delay in milliseconds (optional, uses default)
 * @returns Promise that resolves after the delay
 */
export function createChunkDelay(delayMs: number = CHUNKING_CONFIG.CHUNK_DELAY_MS): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Generate a proper GUID (UUID v4) for chunk identification
 * @returns UUID v4 string
 */
export function generateGuid(): string {
  return uuidv4();
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
 * Send a request with automatic chunking if needed
 * @param request - The request to send
 * @param sendFunction - Function to actually send each chunk
 * @returns Promise that resolves when all chunks are sent
 */
export async function sendRequestWithChunking(
  request: WebRTCApiRequest,
  sendFunction: (chunk: WebRTCApiRequest) => Promise<void> | void
): Promise<void> {
  const chunkingResult = chunkRequest(request);
  
  // Log chunking decision
  logChunkingInfo({
    totalSize: calculateMessageSize(request),
    totalChunks: chunkingResult.totalChunks,
    messageType: request.messageType,
    action: chunkingResult.totalChunks > 1 ? 'chunked' : 'single'
  });
  
  // Send each chunk with delay between them
  for (let i = 0; i < chunkingResult.chunks.length; i++) {
    const chunk = chunkingResult.chunks[i];
    
    if (chunkingResult.totalChunks > 1) {
      logChunkTransmission(i + 1, chunkingResult.totalChunks, request.messageType);
    }
    
    await sendFunction(chunk);
    
    // Add delay between chunks (except for the last one)
    if (i < chunkingResult.chunks.length - 1) {
      await createChunkDelay();
    }
  }
}
