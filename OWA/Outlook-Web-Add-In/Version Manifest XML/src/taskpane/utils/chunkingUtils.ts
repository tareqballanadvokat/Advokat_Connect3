/**
 * Utility functions for WebRTC message chunking
 * Handles document splitting and size calculations for the 256KB UDP limit
 */

import { v4 as uuidv4 } from 'uuid';
import { WebRTCApiRequest } from '../components/interfaces/IAkten';

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
 * Calculate MD5-style checksum of a string
 * @param data - The data to calculate checksum for
 * @returns Hexadecimal checksum string
 */
export function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Calculate the total size of a WebRTC message including all fields
 * @param request - The WebRTC request to calculate size for
 * @returns Size in bytes
 */
export function calculateMessageSize(request: WebRTCApiRequest): number {
  const messageWithId = {
    Id: "test-guid-1234567890", // Use realistic GUID length
    Timestamp: Date.now(),
    ...request
  };
  const message = JSON.stringify(messageWithId);
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
