import { AktenQuery } from '../components/interfaces/IAkten';
import { WebRTCApiRequest, WebRTCApiResponse, PendingRequest, WebRTCAckResponse, ChunkInfo } from '../components/interfaces/IWebRTC';
import { LeistungenAuswahlQuery, LeistungPostData } from '../components/interfaces/IService';
import { DokumentPostData, DokumenteQuery } from '../components/interfaces/IDocument';
import { PersonenQuery } from '../components/interfaces/IPerson';
import { IAuthRequest, IAuthResponse } from '../components/interfaces/IAuth';
import { SipClientInstance } from '../components/SIP_Library/SipClient';
import { store } from '../../store';
import { selectAuthToken, selectIsTokenValid } from '../../store/slices/authSlice';
import {
  calculateChecksum,
  createProtocolRequest,
  chunkRequest,
  createPendingRequest,
  logChunkTransmission,
  calculateBackoffTimeout,
  CHUNKING_CONFIG
} from '../utils/chunkingUtils';

/**
 * WebRTC API Service for handling fire-and-forget messaging with chunking support
 * Provides reliable communication over WebRTC data channels with automatic retry logic
 * Leverages existing SIP_Library for WebRTC connection management
 */
export class WebRTCApiService {
  private sipClient: SipClientInstance | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  
  private chunkMonitorTimer: NodeJS.Timeout | null = null;
  private readonly CHUNK_MONITOR_INTERVAL = 500; // 500ms interval for chunk monitoring

  /**
   * Decode base64 response body with UTF-8 support and comprehensive logging
   * @param body - Base64 encoded response body
   * @param messageType - Message type for logging context
   * @returns Decoded response body or original if not base64
   */
  private decodeResponseBody(body: string | undefined, messageType: string): string {
    if (!body) {
      console.log(`📥 Response body is empty for ${messageType}`);
      return '';
    }

    console.log(`📥 Raw response body received for ${messageType} (length: ${body.length})`);
    console.log(`📥 Raw response body content: "${body}"`);

    try {
      // Attempt to decode base64 with proper UTF-8 handling
      const decoded = this.decodeBase64UTF8(body);
      console.log(`✅ Successfully decoded base64 response with UTF-8 for ${messageType} (decoded length: ${decoded.length})`);
      console.log(`📥 Decoded response content: "${decoded}"`);
      return decoded;
    } catch (error) {
      console.log(`ℹ️ Response body is not base64 encoded for ${messageType}, using as-is`);
      console.log(`📥 Non-base64 response content: "${body}"`);
      return body;
    }
  }

  /**
   * Decode base64 string with proper UTF-8 handling
   * @param base64String - Base64 encoded string
   * @returns UTF-8 decoded string
   */
  private decodeBase64UTF8(base64String: string): string {
    // First decode base64 to binary string
    const binaryString = atob(base64String);
    
    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Decode as UTF-8
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  }

  /**
   * Create form data string from authentication request
   * @param authRequest - Authentication request data
   * @returns Form data string in URL-encoded format
   */
  private createAuthenticationFormData(authRequest: IAuthRequest): string {

    const formParams = [
      `client_id=${encodeURIComponent(authRequest.client_id)}`,
      `client_secret=${encodeURIComponent(authRequest.client_secret || '')}`,
      `grant_type=${encodeURIComponent(authRequest.grant_type)}`,
      `username=${encodeURIComponent(authRequest.username || '')}`,
      `password=${encodeURIComponent(authRequest.password || '')}`
    ];
    
    const formData = formParams.join('&');

    console.log(`📤 Created URL-encoded form data:`);
    console.log(`📤 Form data content: ${formData}`);

    return formData;
  }

  /**
   * Create headers for WebRTC requests with automatic authorization
   * @param baseHeaders - Base headers to include
   * @param messageType - Message type to determine if authorization is needed
   * @returns Headers object with authorization if needed
   */
  private createRequestHeaders(baseHeaders: Record<string, string>, messageType: string): Record<string, string> {
    const requestHeaders = { ...baseHeaders };
    
    // Add Authorization header for all non-authentication requests
    if (!messageType.includes('auth.')) {
      const state = store.getState();
      const token = selectAuthToken(state);
      const isTokenValid = selectIsTokenValid(state);
      
      if (token && isTokenValid) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Added Authorization header to request:', messageType);
      } else {
        console.warn('⚠️ No valid token available for authenticated request:', messageType);
        // You might want to trigger token refresh or reject the request here
      }
    }
    
    return requestHeaders;
  }

  /**
   * Initialize with SIP client instance
   * @param sipClient - The initialized SIP client from SIP_Library
   */
  initialize(sipClient: SipClientInstance) {
    this.sipClient = sipClient;
    this.setupDataChannelListener();
  }

  /**
   * Set up listener for incoming API responses via DataChannel
   * Monitors data channel availability and registers message handlers
   */
  private setupDataChannelListener() {
    if (!this.sipClient) return;
    const checkDataChannel = () => {
      const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
      if (dataChannel && dataChannel.readyState === 'open') {
        this.sipClient.peer2peer.addMessageHandler((event) => {
          this.handleDataChannelMessage(event);
        });
      } else {
        setTimeout(checkDataChannel, 1000);
      }
    };

    checkDataChannel();
  }

  /**
   * Handle incoming messages from DataChannel
   * Processes different data types (Blob, ArrayBuffer, string) and routes to message processor
   */
  private handleDataChannelMessage(event: MessageEvent) {
    let data: string;
    if (event.data instanceof Blob) {
      event.data.text().then(text => this.processMessage(text));
      return;
    } else if (event.data instanceof ArrayBuffer) {
      data = new TextDecoder().decode(event.data);
    } else {
      data = event.data;
    }
    
    this.processMessage(data);
  }

  /**
   * Process message and check if it's an API response or ACK
   * Handles chunked responses, ACKs, and resolves pending requests
   */
  private processMessage(message: string) {
    try {
      const parsed = JSON.parse(message);
      console.log("📨 Received message (processMessage method):", parsed);

      if (this.isAckMessage(parsed)) {
        const ack = parsed as WebRTCAckResponse;
        console.log('📨 Detected ACK message for chunk:', ack.body.chunk);
        this.processAckMessage(ack);
        return;
      }
      
      // Handle normal API response
      const apiResponse = parsed as WebRTCApiResponse;
      if (apiResponse.id) {
        const pendingRequest = this.pendingRequests.get(apiResponse.id);
        if (pendingRequest) {
          console.log('✅ Received response for request ID:', apiResponse.id, 'MessageType:', pendingRequest.messageType);
          
          // All responses are handled as single responses now
          this.validateAndCompleteResponse(apiResponse, pendingRequest);
        } else {
          console.warn('⚠️ Received response for unknown request ID:', apiResponse.id);
        }
      } else {
        console.log('📨 DataChannel message (no ID):', message);
      }
    } catch (error) {
      console.log('📨 DataChannel message (not JSON):', message);
      console.log('📨 Ignoring non-JSON message');
    }
  }

  /**
   * Check if a parsed message is an ACK response
   * @param message - The parsed JSON message
   * @returns True if the message is an ACK
   */
  private isAckMessage(message: any): message is WebRTCAckResponse {
    return (
      message &&
      typeof message.checksum === 'string' &&
      typeof message.id === 'string' &&
      message.body &&
      typeof message.body.timestamp === 'number' &&
      typeof message.body.chunk === 'number' &&
      // ACK messages have body.timestamp and body.chunk (not response.timestamp)
      // API responses have response.timestamp, response.statusCode, etc.
      !message.response
    );
  }

  /**
   * Process received ACK message
   * @param ack - The received ACK response
   * @returns True if ACK was processed, false if no matching chunk found
   */
  private processAckMessage(ack: WebRTCAckResponse): boolean {
    const pendingRequest = this.pendingRequests.get(ack.id);
    if (!pendingRequest) {
      console.warn(`📨 Received ACK for unknown request: ${ack.id} chunk ${ack.body.chunk}`);
      return false;
    }
    
    const chunkInfo = pendingRequest.chunks?.get(ack.body.chunk);
    if (!chunkInfo) {
      console.warn(`📨 Received ACK for unknown chunk: ${ack.id} chunk ${ack.body.chunk}`);
      return false;
    }
    
    // Validate ACK checksum against the chunk's request data
    const expectedChecksum = calculateChecksum(JSON.stringify(ack.body));
    if (ack.checksum !== expectedChecksum) {
      console.error(`📨 Invalid ACK checksum for chunk ${ack.body.chunk}: expected ${expectedChecksum}, got ${ack.checksum}`);
      return false;
    }
    
    console.log(`📨 ACK received for chunk ${ack.body.chunk} of request ${ack.id}`);
    
    // Mark chunk as acknowledged
    chunkInfo.acknowledged = true;
    pendingRequest.receivedAcks?.set(ack.body.chunk, ack);
    
    // Check if all chunks are acknowledged
    const allAcknowledged = Array.from(pendingRequest.chunks?.values() || []).every(chunk => chunk.acknowledged);
    if (allAcknowledged) {
      console.log(`✅ All chunks ACK'd for request ${ack.id}, waiting for API response`);
      // Note: We DON'T call completeRequest here anymore - that's only for API responses
      // The request stays in pendingRequests until we get the actual API response
    }
    
    return true;
  }

  /**
   * Re-send the original request for retry scenarios
   * Handles chunking and sending logic internally within WebRTCApiService
   */
  private async resendOriginalRequest(pendingRequest: PendingRequest): Promise<void> {
    if (!pendingRequest.originalRequest) {
      console.error(`❌ Cannot retry ${pendingRequest.messageType}: no original request stored`);
      this.completeRequest(pendingRequest, undefined, new Error('Cannot retry: original request not available'));
      return;
    }

    const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
    /// TODO, we need to re-establish the connection here before retrying
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error(`❌ Cannot retry ${pendingRequest.messageType}: DataChannel not available`);
      this.completeRequest(pendingRequest, undefined, new Error('Cannot retry: DataChannel not available'));
      return;
    }

    try {
      console.log(`🔄 Re-sending original request for ${pendingRequest.messageType}`);
      
      // Step 1: Prepare chunking (using ChunkingUtils for pure chunking logic)
      const chunkingResult = chunkRequest(pendingRequest.originalRequest);
      
      // Step 2: Send all chunks (WebRTCApiService responsibility)
      for (let i = 0; i < chunkingResult.chunks.length; i++) {
        const chunk = chunkingResult.chunks[i];
        const chunkNumber = i + 1;
        
        logChunkTransmission(chunkNumber, chunkingResult.totalChunks, pendingRequest.messageType);
        
        try {
          const message = JSON.stringify(chunk);
          console.log(`📤 Re-sending chunk ${chunkNumber}/${chunkingResult.totalChunks}: Size ${new TextEncoder().encode(message).length} bytes`);
          dataChannel.send(message);
        } catch (error) {
          throw new Error(`Failed to re-send chunk ${chunkNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      console.log(`✅ Successfully re-sent ${chunkingResult.totalChunks} chunk(s) for ${pendingRequest.messageType}`);
      
    } catch (error) {
      console.error(`❌ Failed to re-send request for ${pendingRequest.messageType}:`, error);
      this.completeRequest(pendingRequest, undefined, new Error(`Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Reset all chunk tracking state for a pending request
   * @param pendingRequest - The request to reset state for
   * @param retryCount - The new retry count to set (optional)
   */
  private resetRequestState(pendingRequest: PendingRequest, retryCount?: number): void {
    // Reset ALL chunk tracking state
    pendingRequest.receivedAcks = undefined;
    pendingRequest.totalChunksSent = undefined;
    pendingRequest.chunks = undefined; // Clear the chunks map to stop monitoring stale chunks
    
    if (retryCount !== undefined) {
      pendingRequest.retryCount = retryCount;
    }
    
    // Clear existing timeout if it exists
    if (pendingRequest.timeoutHandle) {
      clearTimeout(pendingRequest.timeoutHandle);
    }
  }

  /**
   * Retry a request - handles timeouts, chunk failures, and other retry scenarios
   * Implements exponential backoff with configurable retry limits
   */
  private async retryRequest(pendingRequest: PendingRequest) {  
    // Check if request still exists (might have been completed or cancelled)
    if (!this.pendingRequests.has(pendingRequest.id)) {
      console.log(`ℹ️ Request ${pendingRequest.messageType} already completed, skipping timeout handling`);
      return;
    }
    
    const retryCount = (pendingRequest.retryCount || 0) + 1;
    
    if (retryCount <= CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS) {
      console.log(`⏰ Request timeout for ${pendingRequest.messageType}, retrying (${retryCount}/${CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS})`);
      
      // Reset all chunk tracking state for retry using helper method
      this.resetRequestState(pendingRequest, retryCount);
      
      // Re-send the original request first
      try {
        await this.resendOriginalRequest(pendingRequest);
        
        // Only set new timeout if resend was successful and request is still pending
        if (this.pendingRequests.has(pendingRequest.id)) {
          pendingRequest.timeoutHandle = setTimeout(() => {
            this.retryRequest(pendingRequest);
          }, CHUNKING_CONFIG.REQUEST.MAX_TIMEOUT_MS);
        }
      } catch (error) {
        // resendOriginalRequest already handled the error and completed the request
        console.log(`❌ Retry failed for ${pendingRequest.messageType}, request completed with error`);
      }
      
    } else {
      console.log(`❌ Max retries exceeded for ${pendingRequest.messageType}, failing request`);
      this.completeRequest(pendingRequest, undefined, new Error(`Request timeout after ${retryCount} retries`));
    }
  }

  /**
   * Handle checksum failure - retry the request due to data corruption
   * Resets ACK tracking state and attempts to resend the original request
   */
  private async handleChecksumFailure(pendingRequest: PendingRequest) {
    // Check if request still exists (might have been completed or cancelled)
    if (!this.pendingRequests.has(pendingRequest.id)) {
      console.log(`ℹ️ Request ${pendingRequest.messageType} already completed, skipping checksum failure handling`);
      return;
    }
    
    const retryCount = (pendingRequest.retryCount || 0) + 1;
    
    if (retryCount <= CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS) {
      console.log(`🔄 Checksum validation failed for ${pendingRequest.messageType}, retrying (${retryCount}/${CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS})`);
      
      // Reset all chunk tracking state for retry using helper method
      this.resetRequestState(pendingRequest, retryCount);
      
      // Re-send the original request first
      try {
        await this.resendOriginalRequest(pendingRequest);
        
        // Only set new timeout if resend was successful and request is still pending
        if (this.pendingRequests.has(pendingRequest.id)) {
          pendingRequest.timeoutHandle = setTimeout(() => {
            this.retryRequest(pendingRequest);
          }, CHUNKING_CONFIG.REQUEST.MAX_TIMEOUT_MS);
        }
      } catch (error) {
        // resendOriginalRequest already handled the error and completed the request
        console.log(`❌ Checksum retry failed for ${pendingRequest.messageType}, request completed with error`);
      }
      
    } else {
      console.log(`❌ Max retries exceeded for ${pendingRequest.messageType} due to checksum failures, failing request`);
      this.completeRequest(pendingRequest, undefined, new Error(`Checksum validation failed after ${retryCount} retries - data corruption detected`));
    }
  }

  /**
   * Validate checksum for single responses and complete the request
   * Performs integrity check and handles corruption by triggering retry
   */
  private validateAndCompleteResponse(response: WebRTCApiResponse, pendingRequest: PendingRequest) {
    const rawResponseBody = response.response.body || '';
    console.log(`📥 Processing single response for ${pendingRequest.messageType}`);
    
    // Check HTTP status code first
    const statusCode = response.response.statusCode;
    if (statusCode >= 400) {
      console.error(`❌ HTTP error ${statusCode} for ${pendingRequest.messageType}`);
      
      // For certain error codes, we want to retry (temporary errors)
      // For others, we want to fail immediately (permanent errors)
      const retryableErrors = [500, 502, 503, 504, 408, 429]; // Server errors, timeouts, rate limits
      const permanentErrors = [400, 401, 403, 404]; // Client errors, authorization, not found
      
      if (retryableErrors.includes(statusCode)) {
        console.log(`🔄 HTTP ${statusCode} is retryable, attempting retry for ${pendingRequest.messageType}`);
        this.handleChecksumFailure(pendingRequest); // Reuse the retry logic
        return;
      } else if (permanentErrors.includes(statusCode)) {
        console.log(`❌ HTTP ${statusCode} is permanent error, failing request for ${pendingRequest.messageType}`);
        this.completeRequest(pendingRequest, undefined, new Error(`HTTP ${statusCode}: ${rawResponseBody || 'Request failed'}`));
        return;
      } else {
        // Unknown error code, treat as permanent
        console.log(`❌ HTTP ${statusCode} is unknown error, failing request for ${pendingRequest.messageType}`);
        this.completeRequest(pendingRequest, undefined, new Error(`HTTP ${statusCode}: ${rawResponseBody || 'Request failed'}`));
        return;
      }
    }
    
    // Decode base64 response body
    const decodedBody = this.decodeResponseBody(rawResponseBody, pendingRequest.messageType);
    
    const expectedChecksum = response.checksum;
    
    if (expectedChecksum) {
      // Calculate checksum using the original response object with base64-encoded body
      const actualChecksum = calculateChecksum(JSON.stringify(response.response));
      
      if (actualChecksum !== expectedChecksum) {
        console.error(`❌ Checksum mismatch for single response ${pendingRequest.messageType}`);
        console.error(`Expected: ${expectedChecksum}, Actual: ${actualChecksum}`);
        console.error(`Response object used for checksum:`, response.response);
        console.error(`Response corrupted during transmission, retrying...`);
        
        this.handleChecksumFailure(pendingRequest);
        return;
      }
      
      console.log(`✅ Checksum validation passed for single response ${pendingRequest.messageType}`);
    } else {
      var message = `ℹ️ No checksum provided for ${pendingRequest.messageType}, skipping validation`
      console.log(message);
      this.completeRequest(pendingRequest, undefined, new Error(message));
    }
    
    // Create response with decoded body
    const processedResponse: WebRTCApiResponse = {
      ...response,
      response: {
        ...response.response,
        body: decodedBody
      }
    };
    
    this.completeRequest(pendingRequest, processedResponse);
  }

  /**
   * Complete a request (success or failure) and clean up all associated state
   * @param pendingRequest - The request to complete
   * @param response - The successful response (if any)
   * @param error - The error that occurred (if any)
   */
  private completeRequest(pendingRequest: PendingRequest, response?: WebRTCApiResponse, error?: Error) {
    // Reset all request state and clear timeout using helper method
    this.resetRequestState(pendingRequest);
    
    // Remove from pending requests (this will also stop chunk monitoring for this request)
    this.pendingRequests.delete(pendingRequest.id);
    
    console.log('📝 Pending requests after completion:', this.pendingRequests.size);
    
    // Complete the promise based on the outcome
    if (error) {
      console.error(`❌ Request ${pendingRequest.id} failed:`, error.message);
      pendingRequest.reject(error);
    } else if (response) {
      console.log(`✅ Request ${pendingRequest.id} completed successfully`);
      pendingRequest.resolve(response);
    } else {
      console.error(`❌ Request ${pendingRequest.id} completed without response or error`);
      pendingRequest.reject(new Error('Request completed without response or error'));
    }
  }

  /**
   * Send API request through WebRTC DataChannel with fire-and-forget pattern
   * @param messageType - Message type in format "sliceName.actionName"
   * @param method - HTTP method
   * @param url - Request URL
   * @param headers - Request headers
   * @param body - Request body (optional)
   * @returns Promise with API response
   */
  private async sendRequest(messageType: string, method: string, url: string, headers: Record<string, string>, body?: any): Promise<WebRTCApiResponse> {
    return new Promise(async (resolve, reject) => {
      if (!this.sipClient) {
        reject(new Error('WebRTC API service not initialized'));
        return;
      }

      const dataChannel = this.sipClient.peer2peer.getActiveDataChannel();
      
      if (!dataChannel || dataChannel.readyState !== 'open') {
        reject(new Error('WebRTC data channel is not available'));
        return;
      }

      // Check if there's already a pending request of the same type
      const existingRequestId = this.findPendingRequestByMessageType(messageType);
      if (existingRequestId) {
        const existingRequest = this.pendingRequests.get(existingRequestId);
        if (existingRequest) {
          console.log('🔄 Request already pending for messageType:', messageType, '- waiting for existing request');
          // Wait for the existing request instead of creating a new one
          existingRequest.resolve = resolve;
          existingRequest.reject = reject;
          return;
        }
      }

      // Create headers with automatic authorization
      const requestHeaders = this.createRequestHeaders(headers, messageType);
      // Create full protocol request with messageType
      const protocolRequest = createProtocolRequest(method, url, requestHeaders, body, messageType);
      console.log('📝 Created protocol request:', protocolRequest);

      console.log('📤 Preparing request for messageType:', messageType);
      console.log('📝 Pending requests before sending:', this.pendingRequests.size);

      try {
        // Step 1: Prepare chunking (ChunkingUtils responsibility)
        const chunkingResult = chunkRequest(protocolRequest);
        
        // Step 2: Create and store pending request (WebRTCApiService responsibility)
        const pendingRequest = createPendingRequest(protocolRequest, chunkingResult, messageType, resolve, reject);
        
        // Add timeout handling (WebRTCApiService responsibility)
        pendingRequest.timeoutHandle = setTimeout(() => {
          this.retryRequest(pendingRequest);
        }, CHUNKING_CONFIG.REQUEST.MAX_TIMEOUT_MS);
        
        this.pendingRequests.set(protocolRequest.id, pendingRequest);
        
        // Step 3: Start chunk monitoring (WebRTCApiService responsibility)
        this.startChunkMonitoring();
        
        // Step 4: Send all chunks (WebRTCApiService responsibility)
        for (let i = 0; i < chunkingResult.chunks.length; i++) {
          const chunk = chunkingResult.chunks[i];
          const chunkNumber = i + 1;
          
          logChunkTransmission(chunkNumber, chunkingResult.totalChunks, messageType);
          
          try {
            const message = JSON.stringify(chunk);
            console.log(`📤 Sending chunk: Size ${new TextEncoder().encode(message).length} bytes`);
            dataChannel.send(message);
            
            // Update chunk send time for retry tracking
            const chunkInfo = pendingRequest.chunks?.get(chunkNumber);
            if (chunkInfo) {
              chunkInfo.lastSentAt = Date.now();
            }
          } catch (error) {
            const sendError = new Error(`Failed to send chunk ${chunkNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Clean up pending request properly
            this.completeRequest(pendingRequest, undefined, sendError);
            return;
          }
        }
        
        // Log pending requests content after sending
        console.log(`📝 Pending requests after sending ${messageType}:`, this.pendingRequests.size);
        Array.from(this.pendingRequests.entries()).forEach(([requestId, request]) => {
          console.log(`  - ID: ${requestId}, MessageType: ${request.messageType}, TotalChunks: ${request.totalChunks}, AcksReceived: ${request.receivedAcks?.size || 0}`);
        });
        
      } catch (error) {
        // Clean up on send error
        const pendingReq = this.pendingRequests.get(protocolRequest.id);
        if (pendingReq) {
          this.completeRequest(pendingReq, undefined, error instanceof Error ? error : new Error('Unknown error'));
        } else {
          // Request not found, reject directly
          reject(error);
        }
      }
    });
  }

  /**
   * Find pending request by message type
   */
  private findPendingRequestByMessageType(messageType: string): string | undefined {
    const requestEntries = Array.from(this.pendingRequests.entries());
    for (const [id, request] of requestEntries) {
      if (request.messageType === messageType) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Check if there are any pending requests (for loading state)
   * @returns True if there are pending requests
   */
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }

  /**
   * Check if there's a pending request for a specific message type
   * @param messageType - Message type to check
   * @returns True if there's a pending request for this message type
   */
  hasPendingRequest(messageType: string): boolean {
    return this.findPendingRequestByMessageType(messageType) !== undefined;
  }

  /**
   * Get the number of pending requests
   * @returns Number of pending requests
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get favorite Akten (Cases) via WebRTC
   * @param query - Search parameters with NurFavoriten=true
  /**
   * Get favorite Akten with filtering options
   * @param query - Filter parameters for Akten search
   * @returns Promise resolving to Akten list matching the criteria
   */
  async getFavoriteAkten(query: AktenQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.AktId !== undefined) queryParams.append('AktId', query.AktId.toString());
    if (query.AKurzLike) queryParams.append('AKurzLike', query.AKurzLike);
    if (query.Count) queryParams.append('Count', query.Count.toString());
    if (query.NurFavoriten !== undefined) queryParams.append('NurFavoriten', query.NurFavoriten.toString());

    return this.sendRequest(
      'akten.getFavoriteAkten',
      'GET',
      `api/v1.1/akten?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Akt Lookup - search in different fields via WebRTC
   * @param searchText - Text to search for in different fields
   * @returns Promise resolving to matching Akten entries
   */
  async aktLookUp(searchText: string) {
    const queryParams = new URLSearchParams();
    queryParams.append('searchText', searchText);

    return this.sendRequest(
      'akten.aktLookUp',
      'GET',
      `api/v1.1/akten/LookUp?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Add Akt to favorites
   * @param aktId - The ID of the Akt to add to favorites
   */
  async addAktToFavorite(aktId: number) {
    return this.sendRequest(
      'akten.addAktToFavorite',
      'POST',
      `api/v1.1/akten/AddToFavorites/${aktId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Remove Akt from favorites
   * @param aktId - The ID of the Akt to remove from favorites
   * @returns Promise resolving when the removal is complete
   */
  async removeAktFromFavorite(aktId: number) {
    return this.sendRequest(
      'akten.removeAktFromFavorite',
      'DELETE',
      `api/v1.1/akten/RemoveFromFavorites/${aktId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Load Services for a specific Akt via WebRTC
   * @param query - Search parameters for services
   * @returns Promise resolving to available services for the Akt
   */
  async loadServices(query: LeistungenAuswahlQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.Kürzel != null && query.Kürzel != undefined) queryParams.append('Kürzel', query.Kürzel);
    if (query.OnlyQuickListe !== undefined) queryParams.append('OnlyQuickListe', query.OnlyQuickListe.toString());
    if (query.Limit != null && query.Limit != undefined) queryParams.append('Limit', query.Limit.toString());

    return this.sendRequest(
      'service.loadServices',
      'GET',
      `api/v1.1/leistungen/Auswahl?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Save a new Leistung via WebRTC
   * @param leistungData - Data for the new Leistung
   */
  async saveLeistung(leistungData: LeistungPostData) {
    return this.sendRequest(
      'service.saveLeistung',
      'POST',
      'api/v1.1/Leistungen',
      {
        'Content-Type': 'application/json-patch+json',
        'Accept': 'text/plain'
      },
      leistungData
    );
  }

  /**
   * Save a new document via WebRTC with automatic chunking for large content
   * @param dokumentData - Data for the new document
   */
  async saveDokument(dokumentData: DokumentPostData) {
    // The generic sendRequest method now handles all chunking automatically
    // No need for document-specific chunking logic
    return this.sendRequest(
      'dokument.saveDokument',
      'POST', 
      'api/v1.1/dokumente', 
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }, 
      dokumentData
    );
  }

  /**
   * Get available folders for a case via WebRTC
   * @param aktId - The case ID to get folders for
   */
  async getAvailableFolders(aktId: number) {
    return this.sendRequest(
      'dokument.getAvailableFolders',
      'GET',
      `api/v1.1/dokumente/folders/${aktId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Get documents via WebRTC with flexible query parameters
   * @param query - Query parameters including aktId, outlookEmailId, dokumentArten, and limit
   */
  async GetDocuments(query: DokumenteQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.aktId) queryParams.append('aktId', query.aktId.toString());
    if (query.outlookEmailId) queryParams.append('outlookEmailId', query.outlookEmailId);
    if (query.dokumentArten && query.dokumentArten.length > 0) {
      query.dokumentArten.forEach(art => queryParams.append('dokumentArten', art.toString()));
    }
    if (query.Count) queryParams.append('Count', query.Count.toString());

    return this.sendRequest(
      'dokument.getDocuments',
      'GET',
      `api/v1.1/dokumente?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  // ===== PERSON API METHODS =====

  /**
   * Get favorite persons via WebRTC
   * @param query - Search parameters with NurFavoriten=true
   */
  async getFavoritePersons(query: PersonenQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.NKurzLike) queryParams.append('NKurzLike', query.NKurzLike);
    if (query.Name1Like) queryParams.append('Name1Like', query.Name1Like);
    if (query.Count) queryParams.append('Count', query.Count.toString());
    if (query.NurFavoriten !== undefined) queryParams.append('NurFavoriten', query.NurFavoriten.toString());

    return this.sendRequest(
      'person.getFavoritePersons',
      'GET',
      `api/v1.1/personen?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Person Lookup - search in different fields via WebRTC
   * @param searchText - Text to search for in different fields
   */
  async personLookUp(searchText: string) {
    const queryParams = new URLSearchParams();
    queryParams.append('searchText', searchText);

    return this.sendRequest(
      'person.personLookUp',
      'GET',
      `api/v1.1/personen/Lookup?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Add person to favorites via WebRTC
   */
  async addPersonToFavorites(personId: number) {
    return this.sendRequest(
      'person.addPersonToFavorites',
      'POST',
      `api/v1.1/personen/AddToFavorites/${personId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Remove person from favorites via WebRTC
   */
  async removePersonFromFavorites(personId: number) {
    return this.sendRequest(
      'person.removePersonFromFavorites',
      'DELETE',
      `api/v1.1/personen/RemoveFromFavorites/${personId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Authenticate with API through WebRTC
   * This should be the first call made to establish authentication with the remote API
   * @param authRequest - Authentication request containing credentials
   * @returns Promise with authentication response containing token and expiration
   */
  async authenticate(authRequest: IAuthRequest): Promise<IAuthResponse> {
    console.log('🔐 Starting authentication via WebRTC...');
    console.log('🔐 Authentication request:', authRequest);
    
    // Create form data for authentication
    const formData = this.createAuthenticationFormData(authRequest);
    
    const response = await this.sendRequest(
      'auth.authenticate',
      'POST',
      'connect/token',
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      formData
    );

    console.log('🔐 Authentication response received');
    
    // Parse the response body to get authentication details
    if (response.response?.body && typeof response.response.body === 'string') {
      try {
        const authData = JSON.parse(response.response.body) as IAuthResponse;
        console.log('✅ Authentication successful - token received');
        return authData;
      } catch (error) {
        console.error('❌ Failed to parse authentication response:', error);
        throw new Error('Invalid authentication response format');
      }
    } else if (response.response?.body && typeof response.response.body === 'object') {
      // Response body is already an object
      console.log('✅ Authentication successful - token received');
      return response.response.body as IAuthResponse;
    } else {
      console.error('❌ Authentication failed - no token in response');
      throw new Error('Authentication failed - no token received');
    }
  }

  /**
   * Refresh authentication token
   * @param refreshToken - Refresh token from previous authentication
   * @returns Promise with new authentication response
   */
  async refreshToken(refreshToken: string): Promise<IAuthResponse> {
    console.log('🔄 Refreshing authentication token via WebRTC...');
    
    const refreshRequest: IAuthRequest = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'advokat.client.web'
    };

    return this.authenticate(refreshRequest);
  }

  /**
   * Start chunk monitoring for ACK timeouts and retries
   */
  private startChunkMonitoring(): void {
    if (this.chunkMonitorTimer) {
      return; // Already running
    }
    
    console.log('🕒 Starting chunk retry monitoring');
    this.chunkMonitorTimer = setInterval(() => {
      this.monitorPendingChunks();
    }, this.CHUNK_MONITOR_INTERVAL);
  }

  /**
   * Stop chunk monitoring
   */
  private stopChunkMonitoring(): void {
    if (this.chunkMonitorTimer) {
      console.log('🕒 Stopping chunk retry monitoring');
      clearInterval(this.chunkMonitorTimer);
      this.chunkMonitorTimer = null;
    }
  }

  /**
   * Monitor all pending chunks and retry unacknowledged ones that have timed out
   */
  private monitorPendingChunks(): void {
    const currentTime = Date.now();
    
    for (const [requestId, pendingRequest] of Array.from(this.pendingRequests.entries())) {
      if (!pendingRequest.chunks) continue; // Skip requests without chunking
      
      for (const [chunkNumber, chunkInfo] of Array.from(pendingRequest.chunks.entries())) {
        if (chunkInfo.acknowledged) {
          continue; // Skip acknowledged chunks
        }
        
        // Calculate timeout for this chunk based on retry count
        const timeout = calculateBackoffTimeout(chunkInfo.retryCount, CHUNKING_CONFIG.CHUNK.ACK_TIMEOUT_MS);
        const timeSinceLastSend = currentTime - chunkInfo.lastSentAt;
        
        if (timeSinceLastSend >= timeout) {
          // Chunk has timed out, retry if under limit
          if (chunkInfo.retryCount < CHUNKING_CONFIG.CHUNK.MAX_RETRY_ATTEMPTS) {
            this.retryChunk(pendingRequest, chunkInfo);
          } else {
            // Max chunk retries exceeded, try retrying the entire request
            console.log(`❌ Chunk ${chunkNumber} failed after ${CHUNKING_CONFIG.CHUNK.MAX_RETRY_ATTEMPTS} retries, attempting request retry`);
            this.retryRequest(pendingRequest);
            return;
          }
        }
      }
    }
    
    // Stop monitoring if no pending requests
    if (this.pendingRequests.size === 0) {
      this.stopChunkMonitoring();
    }
  }

  /**
   * Retry a specific chunk
   */
  private async retryChunk(pendingRequest: PendingRequest, chunkInfo: ChunkInfo): Promise<void> {
    chunkInfo.retryCount++;
    chunkInfo.lastSentAt = Date.now();
    
    console.log(`🔄 Retrying chunk ${chunkInfo.chunkNumber} (attempt ${chunkInfo.retryCount}/${CHUNKING_CONFIG.CHUNK.MAX_RETRY_ATTEMPTS})`);
    
    try {
      const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
      if (dataChannel && dataChannel.readyState === 'open') {
        const message = JSON.stringify(chunkInfo.chunkRequest);
        console.log(`📤 Retrying chunk: Size ${new TextEncoder().encode(message).length} bytes`);
        dataChannel.send(message);
      } else {
        throw new Error('DataChannel not available for retry');
      }
    } catch (error) {
      console.error(`❌ Failed to retry chunk ${chunkInfo.chunkNumber}:`, error);
      console.log(`🔄 Chunk retry failed, attempting request retry for ${pendingRequest.messageType}`);
      this.retryRequest(pendingRequest);
    }
  }

  /**
   * Check if WebRTC connection is ready for API calls
   * @returns True if data channel is open and ready for communication
   */
  isReady(): boolean {
    const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
    return dataChannel?.readyState === 'open' || false;
  }
}

// Export singleton instance
export const webRTCApiService = new WebRTCApiService();
