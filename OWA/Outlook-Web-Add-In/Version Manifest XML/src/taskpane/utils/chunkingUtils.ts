/* eslint-disable no-undef */
/**
 * Utility functions for WebRTC message chunking
 * Implements chunking for requests that exceed the 256KB message size limit
 */

import { v4 as uuidv4 } from "uuid";
import { getLogger } from "@services/logger";
import {
  WebRTCApiRequest,
  WebRTCApiResponse,
  ChunkInfo,
  PendingRequest,
  ChunkingResult,
  ReceivedResponseChunk,
} from "@interfaces/IWebRTC";

/**
 * Configuration constants for chunking
 */
export const CHUNKING_CONFIG = {
  /** Maximum WebRTC DataChannel message size (256 KB) */
  MAX_MESSAGE_SIZE: 256 * 1024,

  /** Estimated size for chunk metadata overhead in JSON structure */
  CHUNK_METADATA_OVERHEAD: 200,

  /** Request-level configuration for overall pending request handling */
  REQUEST: {
    /** Maximum timeout for the entire chunked request in milliseconds */
    MAX_TIMEOUT_MS: 30000,

    /** Maximum number of retry attempts for failed requests */
    MAX_RETRY_ATTEMPTS: 2,
  },
} as const;

/**
 * Create protocol ID with GUID
 * @param guid - Base GUID
 * @returns Protocol ID (just the GUID)
 */
export function createProtocolId(guid?: string): string {
  return guid || uuidv4();
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
export function createProtocolRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: any,
  messageType?: string
): WebRTCApiRequest {
  const guid = uuidv4();
  const timestamp = Date.now();
  const protocolId = createProtocolId(guid);
  const logger = getLogger();

  let processedBody: string | undefined;

  // Process body if it exists
  if (body) {
    const bodyString = typeof body === "string" ? body : JSON.stringify(body);
    logger.debug("chunkingUtils", "Original request body", bodyString);
    // Base64 encode the body for POST requests
    if (method.toUpperCase() === "POST") {
      // Use UTF-8 safe base64 encoding (btoa() only handles Latin-1,
      // so non-ASCII characters like German umlauts would be mis-encoded)
      const utf8Bytes = new TextEncoder().encode(bodyString);
      let binary = "";
      for (let i = 0; i < utf8Bytes.length; i++) binary += String.fromCharCode(utf8Bytes[i]);
      processedBody = btoa(binary);
      logger.debug(
        "chunkingUtils",
        `POST request body base64 encoded (UTF-8 safe) (length: original=${bodyString.length}, encoded=${processedBody.length})`
      );
    } else {
      processedBody = bodyString;
    }
  }

  // Return flat protocol request structure
  return {
    id: protocolId,
    messageType: messageType || "unknown.action",
    timestamp,
    totalChunks: 0, // 0 indicates not yet chunked (will be set correctly by chunkRequest)
    currentChunk: 0, // 0 indicates not yet chunked (will be set correctly by chunkRequest)
    method,
    uri: url,
    headers,
    ...(processedBody && { body: processedBody }),
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
  // If request doesn't need chunking, return as single chunk with proper metadata
  if (!needsChunking(request)) {
    // Ensure single chunk has correct totalChunks and currentChunk values
    const singleChunkRequest: WebRTCApiRequest = {
      ...request,
      totalChunks: 1,
      currentChunk: 1,
    };

    return {
      chunks: [singleChunkRequest],
      totalChunks: 1,
      baseId: request.id,
    };
  }

  // Calculate how much space we have for the body content
  const bodyContent = request.body || "";
  const requestWithoutBody = {
    ...request,
    body: "", // Empty body for size calculation
  };

  const overheadSize = calculateMessageSize(requestWithoutBody);
  const maxBodySizePerChunk =
    CHUNKING_CONFIG.MAX_MESSAGE_SIZE - overheadSize - CHUNKING_CONFIG.CHUNK_METADATA_OVERHEAD;

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
      ...request,
      totalChunks: totalChunks,
      currentChunk: i + 1, // 1-based chunk numbering
      body: chunkBody,
    };

    chunks.push(chunkRequest);
  }

  return {
    chunks,
    totalChunks,
    baseId: request.id,
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
  action: "single" | "chunked";
}): void {
  const logger = getLogger();
  const msgType = info.messageType ? ` (${info.messageType})` : "";
  if (info.action === "single") {
    logger.debug(
      "chunkingUtils",
      `Sending request${msgType} (single message) - Total size: ${info.totalSize} bytes`
    );
  } else {
    logger.debug(
      "chunkingUtils",
      `Request${msgType} too large (${info.totalSize} bytes), splitting into ${info.totalChunks} chunks...`
    );
  }
}

/**
 * Log individual chunk transmission
 * @param chunkNumber - Current chunk number (1-based)
 * @param totalChunks - Total number of chunks
 * @param messageType - Optional message type for context
 */
export function logChunkTransmission(
  chunkNumber: number,
  totalChunks: number,
  messageType?: string
): void {
  const logger = getLogger();
  const msgType = messageType ? ` (${messageType})` : "";
  logger.debug("chunkingUtils", `Sending chunk ${chunkNumber}/${totalChunks}${msgType}`);
}

/**
 * Create a pending request for chunk tracking
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
    totalChunks: chunkingResult.totalChunks,
    startTime,
    resolve,
    reject,
    originalRequest: request, // Store the original request for retry scenarios
  };

  // Create chunk info for each chunk
  for (let i = 0; i < chunkingResult.chunks.length; i++) {
    const chunk = chunkingResult.chunks[i];
    const chunkNumber = i + 1;

    const chunkInfo: ChunkInfo = {
      chunkRequest: chunk,
      chunkNumber,
      sentAt: Date.now(),
    };

    pendingRequest.chunks.set(chunkNumber, chunkInfo);
  }

  return pendingRequest;
}

/**
 * Check if all expected response chunks have been received
 * @param receivedChunks - Map of received chunks
 * @param expectedTotal - Expected total number of chunks
 * @returns True if all chunks received
 */
export function areAllResponseChunksReceived(
  receivedChunks: Map<number, ReceivedResponseChunk>,
  expectedTotal: number
): boolean {
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
export function reassembleChunkedResponse(
  receivedChunks: Map<number, ReceivedResponseChunk>,
  expectedTotal: number
): WebRTCApiResponse | null {
  if (!areAllResponseChunksReceived(receivedChunks, expectedTotal)) {
    return null;
  }

  // Sort chunks by chunk number
  const sortedChunks = Array.from(receivedChunks.values()).sort(
    (a, b) => a.chunkNumber - b.chunkNumber
  );

  // Take the first chunk as the base (it has all the metadata)
  const baseResponse = sortedChunks[0].responseChunk;

  // Concatenate all chunk bodies
  let reassembledBody = "";
  for (const chunkInfo of sortedChunks) {
    const chunkBody = chunkInfo.responseChunk.body || "";
    reassembledBody += chunkBody;
  }

  // Create the complete response (flat structure)
  const completeResponse: WebRTCApiResponse = {
    id: baseResponse.id,
    timestamp: baseResponse.timestamp,
    totalChunks: 1, // Reset to indicate it's now a single complete response
    currentChunk: 1, // Reset to indicate it's now a single complete response
    statusCode: baseResponse.statusCode,
    headers: baseResponse.headers,
    body: reassembledBody,
  };

  return completeResponse;
}
