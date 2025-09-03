/**
 * Utility functions for WebRTC message chunking
 * Handles document splitting and size calculations for the 256KB UDP limit
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
  
  /** Estimated size for chunk metadata fields (numberOfParts, partNumber, checkSum) */
  CHUNK_METADATA_SIZE: 150,
  
  /** Delay between chunk transmissions in milliseconds */
  CHUNK_DELAY_MS: 100
} as const;

/**
 * Result of document chunking operation
 */
export interface ChunkingResult {
  /** Array of content chunks */
  chunks: string[];
  /** MD5-style checksum of the original content */
  checkSum: string;
  /** Total number of chunks created */
  totalChunks: number;
  /** Size of each chunk in bytes */
  chunkSizes: number[];
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
 * Calculate overhead size (everything except content) for a document request
 * @param documentData - Document data without content
 * @param createRequestFn - Function to create the WebRTC request
 * @returns Overhead size in bytes
 */
export function calculateOverheadSize<T>(
  documentData: T, 
  createRequestFn: (data: T) => WebRTCApiRequest
): number {
  const request = createRequestFn(documentData);
  return calculateMessageSize(request);
}

/**
 * Calculate maximum content size per chunk
 * @param overheadSize - Size of all non-content fields
 * @returns Maximum content size in bytes
 */
export function calculateMaxContentPerChunk(overheadSize: number): number {
  return CHUNKING_CONFIG.MAX_MESSAGE_SIZE - overheadSize - CHUNKING_CONFIG.CHUNK_METADATA_SIZE;
}

/**
 * Split document content into appropriately sized chunks
 * @param content - The content to split
 * @param maxChunkSize - Maximum size per chunk in bytes
 * @returns Chunking result with chunks and metadata
 */
export function splitDocumentContent(content: string, maxChunkSize: number): ChunkingResult {
  const contentBuffer = new TextEncoder().encode(content);
  const checkSum = calculateChecksum(content);
  
  if (contentBuffer.length <= maxChunkSize) {
    return {
      chunks: [content],
      checkSum,
      totalChunks: 1,
      chunkSizes: [contentBuffer.length]
    };
  }

  const chunks: string[] = [];
  const chunkSizes: number[] = [];
  
  for (let i = 0; i < contentBuffer.length; i += maxChunkSize) {
    const end = Math.min(i + maxChunkSize, contentBuffer.length);
    const chunkData = new TextDecoder().decode(contentBuffer.slice(i, end));
    chunks.push(chunkData);
    chunkSizes.push(end - i);
  }
  
  return {
    chunks,
    checkSum,
    totalChunks: chunks.length,
    chunkSizes
  };
}

/**
 * Check if a document needs chunking based on its total size
 * @param request - The complete WebRTC request
 * @returns True if chunking is required
 */
export function needsChunking(request: WebRTCApiRequest): boolean {
  const totalSize = calculateMessageSize(request);
  return totalSize > CHUNKING_CONFIG.MAX_MESSAGE_SIZE;
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
  overheadSize: number;
  maxContentPerChunk: number;
  totalChunks: number;
  action: 'single' | 'chunked';
}): void {
  if (info.action === 'single') {
    console.log(`📤 Sending document (single chunk) - Total size: ${info.totalSize} bytes`);
  } else {
    console.log(`📤 Document too large (${info.totalSize} bytes), splitting into ${info.totalChunks} chunks...`);
    console.log(`📊 Overhead size: ${info.overheadSize} bytes, Max content per chunk: ${info.maxContentPerChunk} bytes`);
  }
}

/**
 * Log individual chunk transmission
 * @param chunkNumber - Current chunk number (1-based)
 * @param totalChunks - Total number of chunks
 */
export function logChunkTransmission(chunkNumber: number, totalChunks: number): void {
  console.log(`📤 Sending document chunk ${chunkNumber}/${totalChunks}`);
}
