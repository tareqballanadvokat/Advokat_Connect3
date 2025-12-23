import { AktenQuery } from '../components/interfaces/IAkten';
import { WebRTCApiRequest, WebRTCApiResponse, PendingRequest, ChunkInfo, ReceivedResponseChunk } from '../components/interfaces/IWebRTC';
import { LeistungenAuswahlQuery, LeistungPostData } from '../components/interfaces/IService';
import { DokumentPostData, DokumenteQuery, DokumentResponse } from '../components/interfaces/IDocument';
import { PersonenQuery } from '../components/interfaces/IPerson';
import { IAuthRequest, IAuthResponse } from '../components/interfaces/IAuth';
import { SipClientInstance } from '../components/SIP_Library/SipClient';
import { store } from '../../store';
import { selectAuthToken, selectIsTokenValid } from '../../store/slices/authSlice';
import { tokenService } from './TokenService';
import { WebRTCDataChannelService } from './WebRTCDataChannelService';
import {
  createProtocolRequest,
  chunkRequest,
  createPendingRequest,
  logChunkTransmission,
  areAllResponseChunksReceived,
  reassembleChunkedResponse,
  CHUNKING_CONFIG
} from '../utils/chunkingUtils';

/**
 * WebRTC API Service for handling messaging with chunking support
 * Provides communication over WebRTC data channels
 * Leverages existing SIP_Library for WebRTC connection management
 * Relies on SCTP for reliable delivery (built into WebRTC DataChannels)
 */
export class WebRTCApiService {
  private sipClient: SipClientInstance | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();

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
        // Validate token expiration
        if (tokenService.isTokenExpired(token)) {
          console.error('❌ Token is expired or expiring soon - request may fail');
          console.error('❌ Please refresh token before making request:', messageType);
          tokenService.logTokenValidation(token, messageType);
          // Continue with expired token - let server handle it and trigger refresh on 401/400
        } else {
          // Token is valid - log validation details in development
          if (process.env.NODE_ENV === 'development') {
            tokenService.logTokenValidation(token, messageType);
          }
        }
        
        requestHeaders['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Added Authorization header to request:', messageType);
      } else {
        console.warn('⚠️ No valid token available for authenticated request:', messageType);
        console.warn('⚠️ This request will likely fail with 401 Unauthorized');
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
   * Subscribes to WebRTCDataChannelService for centralized message handling
   */
  private setupDataChannelListener() {
    console.log('[WebRTCApiService] 🎯 Setting up data channel listener');
    
    // Subscribe to data channel messages via the service
    WebRTCDataChannelService.getInstance().subscribe({
      onDataChannelMessage: (event) => {
        console.log('[WebRTCApiService] 📥 onDataChannelMessage callback triggered');
        this.handleDataChannelMessage(event);
      },
      onDataChannelStateChanged: (state) => {
        console.log(`📡 [WebRTCApiService] DataChannel state changed: ${state}`);
      },
      onDataChannelError: (error) => {
        console.error(`❌ [WebRTCApiService] DataChannel error:`, error);
      }
    });
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
   * Process message and check if it's an API response
   * Handles chunked responses and resolves pending requests
   */
  private processMessage(message: string) {
    try {
      const parsed = JSON.parse(message);
      console.log("📨 Received message (processMessage method):", parsed);

      // Handle API response (potentially chunked)
      const apiResponse = parsed as WebRTCApiResponse;
      if (apiResponse.id) {
        const pendingRequest = this.pendingRequests.get(apiResponse.id);
        if (pendingRequest) {
          console.log('✅ Received response for request ID:', apiResponse.id, 'MessageType:', pendingRequest.messageType);
          
          // Check if this is a chunked response
          if (apiResponse.totalChunks > 1) {
            console.log(`📨 Received chunked response ${apiResponse.currentChunk}/${apiResponse.totalChunks} for ${pendingRequest.messageType}`);
            this.processChunkedResponse(apiResponse, pendingRequest);
          } else {
            // Single response - handle as before
            console.log(`📨 Received single response for ${pendingRequest.messageType}`);
            this.validateAndCompleteResponse(apiResponse, pendingRequest);
          }
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
   * Process a chunked response chunk
   * Accumulates chunks and reassembles when all are received
   */
  private processChunkedResponse(responseChunk: WebRTCApiResponse, pendingRequest: PendingRequest): void {
    const chunkNumber = responseChunk.currentChunk;
    const totalChunks = responseChunk.totalChunks;
    
    console.log(`📨 Processing response chunk ${chunkNumber}/${totalChunks} for ${pendingRequest.messageType}`);
    
    // Initialize response chunk tracking if not exists
    if (!pendingRequest.receivedResponseChunks) {
      pendingRequest.receivedResponseChunks = new Map();
    }
    if (!pendingRequest.expectedResponseChunks) {
      pendingRequest.expectedResponseChunks = totalChunks;
    }
    
    // Check if we already have this chunk (duplicate)
    if (pendingRequest.receivedResponseChunks.has(chunkNumber)) {
      console.log(`📨 Duplicate chunk ${chunkNumber} received, ignoring (SCTP should handle delivery)`);
      return;
    }
    
    // Store the chunk
    const chunkInfo: ReceivedResponseChunk = {
      responseChunk,
      chunkNumber,
      receivedAt: Date.now()
    };
    
    pendingRequest.receivedResponseChunks.set(chunkNumber, chunkInfo);
    
    console.log(`📨 Stored chunk ${chunkNumber}/${totalChunks}, total received: ${pendingRequest.receivedResponseChunks.size}`);
    
    // Check if we have all chunks
    if (areAllResponseChunksReceived(pendingRequest.receivedResponseChunks, totalChunks)) {
      console.log(`✅ All ${totalChunks} response chunks received, reassembling`);
      
      // Reassemble the complete response
      const completeResponse = reassembleChunkedResponse(pendingRequest.receivedResponseChunks, totalChunks);
      if (completeResponse) {
        console.log(`✅ Response reassembled successfully for ${pendingRequest.messageType}`);
        console.log(`📦 Reassembled response:`, {
          statusCode: completeResponse.statusCode,
          headers: completeResponse.headers,
          bodyLength: completeResponse.body?.length || 0,
          rawBody: completeResponse.body
        });
        // Process the complete response
        this.validateAndCompleteResponse(completeResponse, pendingRequest);
      } else {
        console.error(`❌ Failed to reassemble response for ${pendingRequest.messageType}`);
        
        // Check if we can retry before completing with error
        const retryCount = (pendingRequest.retryCount || 0) + 1;
        if (retryCount <= CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS) {
          console.log(`🔄 Response reassembly failed for ${pendingRequest.messageType}, retrying (${retryCount}/${CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS})`);
          
          // Clear received chunks and retry the request
          this.resetRequestState(pendingRequest, retryCount);
          
          // Resend the original request
          this.resendOriginalRequest(pendingRequest).catch(error => {
            console.error(`❌ Failed to resend request during retry:`, error);
            this.completeRequest(pendingRequest, undefined, error);
          });
        } else {
          console.error(`❌ Response reassembly failed for ${pendingRequest.messageType} after ${retryCount} retries - giving up`);
          this.completeRequest(pendingRequest, undefined, new Error(`Failed to reassemble chunked response after ${retryCount} retries`));
        }
      }
    }
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

    // Use WebRTCDataChannelService to check channel availability
    if (!WebRTCDataChannelService.getInstance().isOpen) {
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
          WebRTCDataChannelService.getInstance().send(message);
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
    // Reset chunk tracking state
    pendingRequest.totalChunksSent = undefined;
    pendingRequest.chunks = undefined;
    
    // Reset response chunk tracking state (for receiving chunked responses)
    pendingRequest.receivedResponseChunks = undefined;
    pendingRequest.expectedResponseChunks = undefined;
    
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
   * Validate response for single responses and complete the request
   */
  private validateAndCompleteResponse(response: WebRTCApiResponse, pendingRequest: PendingRequest) {
    const rawResponseBody = response.body || '';
    console.log(`📥 Processing single response for ${pendingRequest.messageType}`);
    console.log(`📝 Raw response body (base64):`, rawResponseBody.substring(0, 100) + (rawResponseBody.length > 100 ? '...' : ''));
    
    // For binary file downloads, keep the body as base64
    // For other responses, decode the base64 to get JSON or text
    const isBinaryDownload = pendingRequest.messageType === 'dokument.downloadDocument';
    const decodedBody = isBinaryDownload ? rawResponseBody : this.decodeResponseBody(rawResponseBody, pendingRequest.messageType);
    
    if (!isBinaryDownload) {
      console.log(`📝 Decoded response body:`, decodedBody);
    } else {
      console.log(`📝 Binary download - keeping base64 encoding (length: ${decodedBody.length})`);
    }
    
    // Check HTTP status code first
    const statusCode = response.statusCode;
    const errorCode = response.errorCode; // Some responses use errorCode instead of statusCode
    const actualStatusCode = statusCode || errorCode;
    
    if (actualStatusCode && actualStatusCode >= 400) {
      console.error(`❌ HTTP error ${actualStatusCode} for ${pendingRequest.messageType}`);
      console.error(`❌ Error response body:`, decodedBody);
      
      // Handle authentication/authorization errors specially
      if (actualStatusCode === 401 || actualStatusCode === 400) {
        console.error(`🔐 Authentication error ${actualStatusCode} - token may be expired or invalid`);
        console.error(`🔐 Request ID: ${pendingRequest.id}`);
        console.error(`🔐 Message type: ${pendingRequest.messageType}`);
        
        // Check if we have a token to validate
        const state = store.getState();
        const token = selectAuthToken(state);
        if (token) {
          console.error(`🔐 Checking token validity...`);
          tokenService.logTokenValidation(token, pendingRequest.messageType);
          
          if (tokenService.isTokenExpired(token)) {
            console.error(`🔐 Token is expired - user should re-authenticate`);
          }
        }
        
        // Fail the request with clear auth error
        this.completeRequest(
          pendingRequest, 
          undefined, 
          new Error(`Authentication failed (${actualStatusCode}): Token may be expired. Please refresh your session.`)
        );
        return;
      }
      
      // For certain error codes, we want to retry (temporary errors)
      // For others, we want to fail immediately (permanent errors)
      const retryableErrors = [500, 502, 503, 504, 408, 429]; // Server errors, timeouts, rate limits
      const permanentErrors = [403, 404, 422]; // Forbidden, not found, validation errors
      
      if (retryableErrors.includes(actualStatusCode)) {
        console.log(`🔄 HTTP ${actualStatusCode} is retryable, attempting retry for ${pendingRequest.messageType}`);
        this.retryRequest(pendingRequest);
        return;
      } else if (permanentErrors.includes(actualStatusCode)) {
        console.log(`❌ HTTP ${actualStatusCode} is permanent error, failing request for ${pendingRequest.messageType}`);
        this.completeRequest(pendingRequest, undefined, new Error(`HTTP ${actualStatusCode}: ${decodedBody || 'Request failed'}`));
        return;
      } else {
        // Unknown error code, treat as permanent
        console.log(`❌ HTTP ${actualStatusCode} is unknown error, failing request for ${pendingRequest.messageType}`);
        this.completeRequest(pendingRequest, undefined, new Error(`HTTP ${actualStatusCode}: ${decodedBody || 'Request failed'}`));
        return;
      }
    }
    
    // Create response with decoded body (no checksum validation - SCTP ensures data integrity)
    const processedResponse: WebRTCApiResponse = {
      ...response,
      body: decodedBody
    };
    
    console.log(`✅ Response processed for ${pendingRequest.messageType} (SCTP ensures integrity)`);
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

      // Use WebRTCDataChannelService to check channel availability
      if (!WebRTCDataChannelService.getInstance().isOpen) {
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
      console.log('📝 Created initial protocol request (before chunking):', protocolRequest);

      console.log('📤 Preparing request for messageType:', messageType);
      console.log('📝 Pending requests before sending:', this.pendingRequests.size);

      try {
        // Step 1: Prepare chunking (ChunkingUtils responsibility)
        const chunkingResult = chunkRequest(protocolRequest);
        console.log('📦 Chunking result: totalChunks =', chunkingResult.totalChunks);
        
        // Step 2: Create and store pending request (WebRTCApiService responsibility)
        const pendingRequest = createPendingRequest(protocolRequest, chunkingResult, messageType, resolve, reject);
        
        // Add timeout handling (WebRTCApiService responsibility)
        pendingRequest.timeoutHandle = setTimeout(() => {
          this.retryRequest(pendingRequest);
        }, CHUNKING_CONFIG.REQUEST.MAX_TIMEOUT_MS);
        
        this.pendingRequests.set(protocolRequest.id, pendingRequest);
        
        // Step 3: Send all chunks (rely on SCTP for reliable delivery)
        for (let i = 0; i < chunkingResult.chunks.length; i++) {
          const chunk = chunkingResult.chunks[i];
          const chunkNumber = i + 1;
          
          logChunkTransmission(chunkNumber, chunkingResult.totalChunks, messageType);
          
          const message = JSON.stringify(chunk);
          console.log(`📤 Sending chunk: Size ${new TextEncoder().encode(message).length} bytes`);
          WebRTCDataChannelService.getInstance().send(message);
        }
        
        // Log pending requests content after sending
        console.log(`📝 Pending requests after sending ${messageType}:`, this.pendingRequests.size);
        
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
      'api/v2.0/dokumente', 
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
      `api/v2.0/dokumente/folders/${aktId}`,
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
      `api/v2.0/dokumente?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Download document content (file stream as base64)
   * @param dokumentId - The ID of the document to download
   * @returns Promise resolving to base64 encoded file content string
   */
  async downloadDocument(dokumentId: number): Promise<string> {
    const response = await this.sendRequest(
      'dokument.downloadDocument',
      'GET',
      `api/v2.0/Dokumente/${dokumentId}/download`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/octet-stream' // Expecting binary file stream
      }
    );
    
    // The response body is already base64-encoded (from the chunking process)
    // The C# API returns File(stream, contentType, fileName) which sends raw bytes
    // These bytes are base64-encoded when sent through WebRTC chunks
    return response.body || '';
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
    if (response.body && typeof response.body === 'string') {
      try {
        const authData = JSON.parse(response.body) as IAuthResponse;
        console.log('✅ Authentication successful - token received');
        return authData;
      } catch (error) {
        console.error('❌ Failed to parse authentication response:', error);
        throw new Error('Invalid authentication response format');
      }
    } else if (response.body && typeof response.body === 'object') {
      // Response body is already an object
      console.log('✅ Authentication successful - token received');
      return response.body as IAuthResponse;
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
      client_id: 'TestClientId'
    };

    return this.authenticate(refreshRequest);
  }

  /**
   * Check if WebRTC connection is ready for API calls
   * @returns True if data channel is open and ready for communication
   */
  isReady(): boolean {
    return WebRTCDataChannelService.getInstance().isOpen;
  }
}

// Export singleton instance
export const webRTCApiService = new WebRTCApiService();
