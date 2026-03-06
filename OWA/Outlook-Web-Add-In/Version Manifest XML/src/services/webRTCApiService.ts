/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { AktenQuery } from "@interfaces/IAkten";
import {
  WebRTCApiResponse,
  PendingRequest,
  ReceivedResponseChunk,
} from "@interfaces/IWebRTC";
import {
  LeistungenAuswahlQuery,
  LeistungPostData,
  LeistungenQuery,
} from "@interfaces/IService";
import {
  DokumentArt,
  DokumentPostData,
  DokumenteQuery,
} from "@interfaces/IDocument";
import { PersonenQuery } from "@interfaces/IPerson";
import { IAuthRequest, IAuthResponse } from "@interfaces/IAuth";
import { SipClientInstance } from "@infra/sip/SipClient";
import { tokenService } from "./TokenService";
import { WebRTCDataChannelService, DataChannelObserver } from "./WebRTCDataChannelService";
import { getLogger } from "@infra/logger";
import { store } from "@store";
import {
  createProtocolRequest,
  chunkRequest,
  createPendingRequest,
  logChunkTransmission,
  areAllResponseChunksReceived,
  reassembleChunkedResponse,
  CHUNKING_CONFIG,
} from "@utils/chunkingUtils";

/**
 * WebRTC API Service for handling messaging with chunking support
 * Provides communication over WebRTC data channels
 * Leverages existing SIP_Library for WebRTC connection management
 * Relies on SCTP for reliable delivery (built into WebRTC DataChannels)
 */

export class WebRTCApiService implements DataChannelObserver {
  private sipClient: SipClientInstance | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private logger = getLogger();

  /**
   * Decode base64 response body with UTF-8 support and comprehensive logging
   * @param body - Base64 encoded response body
   * @param messageType - Message type for logging context
   * @returns Decoded response body or original if not base64
   */
  private decodeResponseBody(body: string | undefined, messageType: string): string {
    if (!body) {
      this.logger.debug(`Response body is empty for ${messageType}`, "WebRTCApiService");
      return "";
    }

    this.logger.debug(
      `Raw response body received for ${messageType} (length: ${body.length})`,
      "WebRTCApiService"
    );
    this.logger.debug(`Raw response body content: "${body}"`, "WebRTCApiService");

    try {
      // Attempt to decode base64 with proper UTF-8 handling
      const decoded = this.decodeBase64UTF8(body);
      this.logger.debug(
        `Successfully decoded base64 response with UTF-8 for ${messageType} (decoded length: ${decoded.length})`,
        "WebRTCApiService"
      );
      this.logger.debug(`Decoded response content: "${decoded}"`, "WebRTCApiService");
      return decoded;
    } catch (error) {
      this.logger.info(
        `Response body is not base64 encoded for ${messageType}, using as-is`,
        "WebRTCApiService"
      );
      this.logger.debug(`Non-base64 response content: "${body}"`, "WebRTCApiService");
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
    const decoder = new TextDecoder("utf-8");
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
      `client_secret=${encodeURIComponent(authRequest.client_secret || "")}`,
      `grant_type=${encodeURIComponent(authRequest.grant_type)}`,
      `username=${encodeURIComponent(authRequest.username || "")}`,
      `password=${encodeURIComponent(authRequest.password || "")}`,
    ];

    const formData = formParams.join("&");

    this.logger.debug("Created URL-encoded form data", "WebRTCApiService");
    this.logger.debug(`Form data content: ${formData}`, "WebRTCApiService");

    return formData;
  }

  /**
   * Create headers for WebRTC requests with automatic authorization
   * @param baseHeaders - Base headers to include
   * @param messageType - Message type to determine if authorization is needed
   * @param token - Decrypted authentication token (optional, for authenticated requests)
   * @returns Headers object with authorization if needed
   */
  private createRequestHeaders(
    baseHeaders: Record<string, string>,
    messageType: string,
    token?: string | null
  ): Record<string, string> {
    const requestHeaders = { ...baseHeaders };

    const contentType = requestHeaders["Content-Type"];
    if (contentType && !contentType.includes("charset") && !contentType.includes("octet-stream")) {
      requestHeaders["Content-Type"] = `${contentType}; charset=utf-8`;
    }
    
    // Add Authorization header for all non-authentication requests
    if (!messageType.includes("auth.") && token) {
      // Log token validation details in development
      if (process.env.NODE_ENV === "development") {
        tokenService.logTokenValidation(token, messageType);
      }

      requestHeaders["Authorization"] = `Bearer ${token}`;
      this.logger.debug(
        "Added Authorization header to request: " + messageType,
        "WebRTCApiService"
      );
    } else if (!messageType.includes("auth.") && !token) {
      this.logger.warn(
        "No valid token available for authenticated request: " + messageType,
        "WebRTCApiService"
      );
      this.logger.warn("This request will likely fail with 401 Unauthorized", "WebRTCApiService");
    }

    return requestHeaders;
  }

  /**
   * Initialize with SIP client instance
   * @param sipClient - The initialized SIP client from SIP_Library
   */
  initialize(sipClient: SipClientInstance) {
    // Clean up previous state first (idempotent)
    this.cleanup();

    this.sipClient = sipClient;
    this.setupDataChannelListener();
  }

  /**
   * Set up listener for incoming API responses via DataChannel
   * Subscribes to WebRTCDataChannelService for centralized message handling
   */
  private setupDataChannelListener() {
    this.logger.debug("Setting up data channel listener", "WebRTCApiService");

    const service = WebRTCDataChannelService.getInstance();
    if (service.isSubscribed(this)) {
      this.logger.debug("Already subscribed, skipping", "WebRTCApiService");
      return;
    }

    // Subscribe this service as observer
    service.subscribe(this);
  }

  /**
   * DataChannelObserver callback - called when DataChannel receives a message
   */
  onDataChannelMessage(event: MessageEvent): void {
    this.logger.debug("onDataChannelMessage callback triggered", "WebRTCApiService");
    this.handleDataChannelMessage(event);
  }

  /**
   * DataChannelObserver callback - called when DataChannel state changes
   */
  onDataChannelStateChanged(state: RTCDataChannelState, channelType: "offer" | "answer"): void {
    const prefix = channelType === "offer" ? "📤" : "📥";
    this.logger.debug(
      `${prefix} ${channelType} channel state changed: ${state}`,
      "WebRTCApiService"
    );
  }

  /**
   * DataChannelObserver callback - called when DataChannel error occurs
   */
  onDataChannelError(error: Event | string, channelType: "offer" | "answer"): void {
    const prefix = channelType === "offer" ? "📤" : "📥";
    this.logger.error(`${prefix} ${channelType} channel error:`, "WebRTCApiService", error);
  }

  /**
   * Cleanup service resources
   * Unsubscribes from DataChannel, rejects all pending requests, and clears references
   */
  cleanup(): void {
    this.logger.debug("Cleaning up service", "WebRTCApiService");

    // Unsubscribe from DataChannel events
    const service = WebRTCDataChannelService.getInstance();
    if (service.isSubscribed(this)) {
      service.unsubscribe(this);
    }

    // Reject all pending requests to prevent hanging promises / memory leaks
    if (this.pendingRequests.size > 0) {
      this.logger.warn(
        `Rejecting ${this.pendingRequests.size} pending request(s) due to connection cleanup`,
        "WebRTCApiService"
      );
      const connectionClosedError = new Error("Connection closed");
      for (const pendingRequest of Array.from(this.pendingRequests.values())) {
        this.resetRequestState(pendingRequest);
        pendingRequest.reject(connectionClosedError);
      }
      this.pendingRequests.clear();
    }

    // Clear SIP client reference
    this.sipClient = null;

    this.logger.debug("Cleanup complete", "WebRTCApiService");
  }

  /**
   * Handle incoming messages from DataChannel
   * Processes different data types (Blob, ArrayBuffer, string) and routes to message processor
   */
  private handleDataChannelMessage(event: MessageEvent) {
    let data: string;
    if (event.data instanceof Blob) {
      event.data.text().then((text) => this.processMessage(text));
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
      this.logger.debug("Received message (processMessage method)", "WebRTCApiService", parsed);

      // Handle API response (potentially chunked)
      const apiResponse = parsed as WebRTCApiResponse;
      if (apiResponse.id) {
        const pendingRequest = this.pendingRequests.get(apiResponse.id);
        if (pendingRequest) {
          this.logger.info(
            `Received response for request ID: ${apiResponse.id}, MessageType: ${pendingRequest.messageType}`,
            "WebRTCApiService"
          );

          // Check if this is a chunked response
          if (apiResponse.totalChunks > 1) {
            this.logger.debug(
              `Received chunked response ${apiResponse.currentChunk}/${apiResponse.totalChunks} for ${pendingRequest.messageType}`,
              "WebRTCApiService"
            );
            this.processChunkedResponse(apiResponse, pendingRequest);
          } else {
            // Single response - handle as before
            this.logger.debug(
              `Received single response for ${pendingRequest.messageType}`,
              "WebRTCApiService"
            );
            this.validateAndCompleteResponse(apiResponse, pendingRequest);
          }
        } else {
          this.logger.warn(
            "Received response for unknown request ID: " + apiResponse.id,
            "WebRTCApiService"
          );
        }
      } else {
        this.logger.debug("DataChannel message (no ID): " + message, "WebRTCApiService");
      }
    } catch (error) {
      this.logger.debug("DataChannel message (not JSON): " + message, "WebRTCApiService");
      this.logger.debug("Ignoring non-JSON message", "WebRTCApiService");
    }
  }

  /**
   * Process a chunked response chunk
   * Accumulates chunks and reassembles when all are received
   */
  private processChunkedResponse(
    responseChunk: WebRTCApiResponse,
    pendingRequest: PendingRequest
  ): void {
    const chunkNumber = responseChunk.currentChunk;
    const totalChunks = responseChunk.totalChunks;

    this.logger.debug(
      `Processing response chunk ${chunkNumber}/${totalChunks} for ${pendingRequest.messageType}`,
      "WebRTCApiService"
    );

    // Initialize response chunk tracking if not exists
    if (!pendingRequest.receivedResponseChunks) {
      pendingRequest.receivedResponseChunks = new Map();
    }
    if (!pendingRequest.expectedResponseChunks) {
      pendingRequest.expectedResponseChunks = totalChunks;
    }

    // Check if we already have this chunk (duplicate)
    if (pendingRequest.receivedResponseChunks.has(chunkNumber)) {
      this.logger.debug(
        `Duplicate chunk ${chunkNumber} received, ignoring (SCTP should handle delivery)`,
        "WebRTCApiService"
      );
      return;
    }

    // Store the chunk
    const chunkInfo: ReceivedResponseChunk = {
      responseChunk,
      chunkNumber,
      receivedAt: Date.now(),
    };

    pendingRequest.receivedResponseChunks.set(chunkNumber, chunkInfo);

    this.logger.debug(
      `Stored chunk ${chunkNumber}/${totalChunks}, total received: ${pendingRequest.receivedResponseChunks.size}`,
      "WebRTCApiService"
    );

    // Check if we have all chunks
    if (areAllResponseChunksReceived(pendingRequest.receivedResponseChunks, totalChunks)) {
      this.logger.info(
        `All ${totalChunks} response chunks received, reassembling`,
        "WebRTCApiService"
      );

      // Reassemble the complete response
      const completeResponse = reassembleChunkedResponse(
        pendingRequest.receivedResponseChunks,
        totalChunks
      );
      if (completeResponse) {
        this.logger.info(
          `Response reassembled successfully for ${pendingRequest.messageType}`,
          "WebRTCApiService"
        );
        this.logger.debug("Reassembled response", "WebRTCApiService", {
          statusCode: completeResponse.statusCode,
          headers: completeResponse.headers,
          bodyLength: completeResponse.body?.length || 0,
          rawBody: completeResponse.body,
        });
        // Process the complete response
        this.validateAndCompleteResponse(completeResponse, pendingRequest);
      } else {
        this.logger.error(
          `Failed to reassemble response for ${pendingRequest.messageType}`,
          "WebRTCApiService"
        );

        // Check if we can retry before completing with error
        const retryCount = (pendingRequest.retryCount || 0) + 1;
        if (retryCount <= CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS) {
          this.logger.info(
            `Response reassembly failed for ${pendingRequest.messageType}, retrying (${retryCount}/${CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS})`,
            "WebRTCApiService"
          );

          // Clear received chunks and retry the request
          this.resetRequestState(pendingRequest, retryCount);

          // Resend the original request
          this.resendOriginalRequest(pendingRequest).catch((error) => {
            this.logger.error("Failed to resend request during retry:", "WebRTCApiService", error);
            this.completeRequest(pendingRequest, undefined, error);
          });
        } else {
          this.logger.error(
            `Response reassembly failed for ${pendingRequest.messageType} after ${retryCount} retries - giving up`,
            "WebRTCApiService"
          );
          this.completeRequest(
            pendingRequest,
            undefined,
            new Error(`Failed to reassemble chunked response after ${retryCount} retries`)
          );
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
      this.logger.error(
        `Cannot retry ${pendingRequest.messageType}: no original request stored`,
        "WebRTCApiService"
      );
      this.completeRequest(
        pendingRequest,
        undefined,
        new Error("Cannot retry: original request not available")
      );
      return;
    }

    // Ensure both channels are ready for bidirectional communication (send request + receive response)
    if (!WebRTCDataChannelService.getInstance().isReadyForCommunication) {
      this.logger.error(
        `Cannot retry ${pendingRequest.messageType}: Channels not ready for bidirectional communication`,
        "WebRTCApiService"
      );
      this.completeRequest(
        pendingRequest,
        undefined,
        new Error("Cannot retry: Channels not ready for bidirectional communication")
      );
      return;
    }

    try {
      this.logger.info(
        `Re-sending original request for ${pendingRequest.messageType}`,
        "WebRTCApiService"
      );

      // Step 1: Prepare chunking (using ChunkingUtils for pure chunking logic)
      const chunkingResult = chunkRequest(pendingRequest.originalRequest);

      // Step 2: Send all chunks (WebRTCApiService responsibility)
      for (let i = 0; i < chunkingResult.chunks.length; i++) {
        const chunk = chunkingResult.chunks[i];
        const chunkNumber = i + 1;

        logChunkTransmission(chunkNumber, chunkingResult.totalChunks, pendingRequest.messageType);

        try {
          const message = JSON.stringify(chunk);
          this.logger.debug(
            `Re-sending chunk ${chunkNumber}/${chunkingResult.totalChunks}: Size ${new TextEncoder().encode(message).length} bytes`,
            "WebRTCApiService"
          );
          WebRTCDataChannelService.getInstance().send(message);
        } catch (error) {
          throw new Error(
            `Failed to re-send chunk ${chunkNumber}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      this.logger.info(
        `Successfully re-sent ${chunkingResult.totalChunks} chunk(s) for ${pendingRequest.messageType}`,
        "WebRTCApiService"
      );
    } catch (error) {
      this.logger.error(
        `Failed to re-send request for ${pendingRequest.messageType}:`,
        "WebRTCApiService",
        error
      );
      this.completeRequest(
        pendingRequest,
        undefined,
        new Error(`Retry failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      );
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
      this.logger.info(
        `Request ${pendingRequest.messageType} already completed, skipping timeout handling`,
        "WebRTCApiService"
      );
      return;
    }

    const retryCount = (pendingRequest.retryCount || 0) + 1;

    if (retryCount <= CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS) {
      this.logger.info(
        `Request timeout for ${pendingRequest.messageType}, retrying (${retryCount}/${CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS})`,
        "WebRTCApiService"
      );

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
        this.logger.info(
          `Retry failed for ${pendingRequest.messageType}, request completed with error`,
          "WebRTCApiService"
        );
      }
    } else {
      this.logger.error(
        `Max retries exceeded for ${pendingRequest.messageType}, failing request`,
        "WebRTCApiService"
      );
      this.completeRequest(
        pendingRequest,
        undefined,
        new Error(`Request timeout after ${retryCount} retries`)
      );
    }
  }

  /**
   * Validate response for single responses and complete the request
   */
  private async validateAndCompleteResponse(
    response: WebRTCApiResponse,
    pendingRequest: PendingRequest
  ) {
    const rawResponseBody = response.body || "";
    this.logger.debug(
      `Processing single response for ${pendingRequest.messageType}`,
      "WebRTCApiService"
    );
    this.logger.debug(
      `Raw response body (base64): ${rawResponseBody.substring(0, 100) + (rawResponseBody.length > 100 ? "..." : "")}`,
      "WebRTCApiService"
    );

    // For binary file downloads, keep the body as base64
    // For other responses, decode the base64 to get JSON or text
    const isBinaryDownload = pendingRequest.messageType === "dokument.downloadDocument";
    const decodedBody = isBinaryDownload
      ? rawResponseBody
      : this.decodeResponseBody(rawResponseBody, pendingRequest.messageType);

    if (!isBinaryDownload) {
      this.logger.debug("Decoded response body", "WebRTCApiService", decodedBody);
    } else {
      this.logger.debug(
        `Binary download - keeping base64 encoding (length: ${decodedBody.length})`,
        "WebRTCApiService"
      );
    }

    // Check HTTP status code first
    const statusCode = response.statusCode;
    const errorCode = response.errorCode; // Some responses use errorCode instead of statusCode
    const actualStatusCode = statusCode || errorCode;

    if (actualStatusCode && actualStatusCode >= 400) {
      this.logger.error(
        `HTTP error ${actualStatusCode} for ${pendingRequest.messageType}`,
        "WebRTCApiService"
      );
      this.logger.error("Error response body", "WebRTCApiService", decodedBody);

      // Handle authentication/authorization errors
      // Silently refresh the token once, patch the Authorization header, then
      // hand off to the shared retryRequest() mechanism so the retry budget is shared.
      if (actualStatusCode === 401) {
        if (!pendingRequest.messageType.includes("auth.") && !pendingRequest.authRetryAttempted) {
          this.logger.info(
            `Auth error ${actualStatusCode} for ${pendingRequest.messageType} – refreshing token and queuing retry`,
            "WebRTCApiService"
          );
          pendingRequest.authRetryAttempted = true;

          tokenService.handleTokenExpiredOrRevoked()
            .then((newToken) => {
              if (newToken && pendingRequest.originalRequest) {
                pendingRequest.originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
              } else {
                this.logger.warn(
                  `Token refresh yielded no token for ${pendingRequest.messageType}, retrying with existing credentials`,
                  "WebRTCApiService"
                );
              }
              this.retryRequest(pendingRequest);
            })
            .catch(() => {
              // Even if refresh throws, still attempt the shared retry; it will
              // exhaust the budget and fail cleanly if the server keeps rejecting.
              this.retryRequest(pendingRequest);
            });
          return;
        }

        // authRetryAttempted already set → auth request or second auth failure → fail permanently
        this.logger.error(
          `Authentication error ${actualStatusCode} for ${pendingRequest.messageType} – no further retries`,
          "WebRTCApiService"
        );
        this.completeRequest(
          pendingRequest,
          undefined,
          new Error(
            `Authentication failed (${actualStatusCode}): Token may have been revoked or is invalid on server.`
          )
        );
        return;
      }

      // For certain error codes, we want to retry (temporary errors)
      // For others, we want to fail immediately (permanent errors)
      const retryableErrors = [500, 502, 503, 504, 408, 429]; // Server errors, timeouts, rate limits
      const permanentErrors = [400, 403, 404, 422]; // Bad request, forbidden, not found, validation errors

      if (retryableErrors.includes(actualStatusCode)) {
        this.logger.info(
          `HTTP ${actualStatusCode} is retryable, attempting retry for ${pendingRequest.messageType}`,
          "WebRTCApiService"
        );
        this.retryRequest(pendingRequest);
        return;
      } else if (permanentErrors.includes(actualStatusCode)) {
        this.logger.error(
          `HTTP ${actualStatusCode} is permanent error, failing request for ${pendingRequest.messageType}`,
          "WebRTCApiService"
        );
        this.completeRequest(
          pendingRequest,
          undefined,
          new Error(`HTTP ${actualStatusCode}: ${decodedBody || "Request failed"}`)
        );
        return;
      } else {
        // Unknown error code, treat as permanent
        this.logger.error(
          `HTTP ${actualStatusCode} is unknown error, failing request for ${pendingRequest.messageType}`,
          "WebRTCApiService"
        );
        this.completeRequest(
          pendingRequest,
          undefined,
          new Error(`HTTP ${actualStatusCode}: ${decodedBody || "Request failed"}`)
        );
        return;
      }
    }

    // Create response with decoded body (no checksum validation - SCTP ensures data integrity)
    const processedResponse: WebRTCApiResponse = {
      ...response,
      body: decodedBody,
    };

    this.logger.info(
      `Response processed for ${pendingRequest.messageType} (SCTP ensures integrity)`,
      "WebRTCApiService"
    );
    this.completeRequest(pendingRequest, processedResponse);
  }

  /**
   * Complete a request (success or failure) and clean up all associated state
   * @param pendingRequest - The request to complete
   * @param response - The successful response (if any)
   * @param error - The error that occurred (if any)
   */
  private completeRequest(
    pendingRequest: PendingRequest,
    response?: WebRTCApiResponse,
    error?: Error
  ) {
    // Reset all request state and clear timeout using helper method
    this.resetRequestState(pendingRequest);

    // Remove from pending requests (this will also stop chunk monitoring for this request)
    this.pendingRequests.delete(pendingRequest.id);

    this.logger.debug(
      "Pending requests after completion: " + this.pendingRequests.size,
      "WebRTCApiService"
    );

    // Complete the promise based on the outcome
    if (error) {
      this.logger.error(
        `Request ${pendingRequest.id} failed: ${error.message}`,
        "WebRTCApiService"
      );
      pendingRequest.reject(error);
    } else if (response) {
      this.logger.info(`Request ${pendingRequest.id} completed successfully`, "WebRTCApiService");
      pendingRequest.resolve(response);
    } else {
      this.logger.error(
        `Request ${pendingRequest.id} completed without response or error`,
        "WebRTCApiService"
      );
      pendingRequest.reject(new Error("Request completed without response or error"));
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
  private async sendRequest(
    messageType: string,
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: any
  ): Promise<WebRTCApiResponse> {
    // Perform async validation before creating the Promise
    if (!this.sipClient) {
      throw new Error("WebRTC API service not initialized");
    }

    // Ensure both channels are ready for bidirectional communication (send request + receive response)
    if (!WebRTCDataChannelService.getInstance().isReadyForCommunication) {
      throw new Error('WebRTC channels not ready for bidirectional communication');
    }

    // For authenticated requests, ensure token is valid before sending
    let validToken: string | null = null;
    if (!messageType.includes("auth.")) {
      validToken = await tokenService.ensureValidToken();
      if (!validToken) {
        // Token absent or expired — attempt a silent refresh before giving up
        this.logger.info(
          `No token available for ${messageType}, attempting silent refresh`,
          "WebRTCApiService"
        );
        validToken = await tokenService.handleTokenExpiredOrRevoked().catch(() => null);
        if (!validToken) {
          throw new Error("No valid token available. Please authenticate.");
        }
        this.logger.info(`Silent refresh succeeded for ${messageType}`, "WebRTCApiService");
      }
      // Token will be passed to createRequestHeaders
    }

    return new Promise((resolve, reject) => {
      // Create headers with automatic authorization (pass decrypted token)
      const requestHeaders = this.createRequestHeaders(headers, messageType, validToken);
      // Create full protocol request with messageType
      const protocolRequest = createProtocolRequest(method, url, requestHeaders, body, messageType);
      this.logger.debug(
        "Created initial protocol request (before chunking)",
        "WebRTCApiService",
        protocolRequest
      );

      this.logger.debug("Preparing request for messageType: " + messageType, "WebRTCApiService");
      this.logger.debug(
        "Pending requests before sending: " + this.pendingRequests.size,
        "WebRTCApiService"
      );

      try {
        // Step 1: Prepare chunking (ChunkingUtils responsibility)
        const chunkingResult = chunkRequest(protocolRequest);
        this.logger.debug(
          "Chunking result: totalChunks = " + chunkingResult.totalChunks,
          "WebRTCApiService"
        );

        // Step 2: Create and store pending request (WebRTCApiService responsibility)
        const pendingRequest = createPendingRequest(
          protocolRequest,
          chunkingResult,
          messageType,
          resolve,
          reject
        );

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
          this.logger.debug(
            `Sending chunk: Size ${new TextEncoder().encode(message).length} bytes`,
            "WebRTCApiService"
          );
          WebRTCDataChannelService.getInstance().send(message);
        }

        // Log pending requests content after sending
        this.logger.debug(
          `Pending requests after sending ${messageType}: ${this.pendingRequests.size}`,
          "WebRTCApiService"
        );
      } catch (error) {
        // Clean up on send error
        const pendingReq = this.pendingRequests.get(protocolRequest.id);
        if (pendingReq) {
          this.completeRequest(
            pendingReq,
            undefined,
            error instanceof Error ? error : new Error("Unknown error")
          );
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
   * Get favorite Akten with filtering options via WebRTC
   * @param query - Filter parameters for Akten search
   * @returns Promise resolving to Akten list matching the criteria
   */
  async getFavoriteAkten(query: AktenQuery) {
    const queryParams = new URLSearchParams();

    if (query.AktId !== undefined) queryParams.append("AktId", query.AktId.toString());
    if (query.AKurzLike) queryParams.append("AKurzLike", query.AKurzLike);
    if (query.Count) queryParams.append("Count", query.Count.toString());
    if (query.NurFavoriten !== undefined)
      queryParams.append("NurFavoriten", query.NurFavoriten.toString());

    return this.sendRequest(
      "akten.getFavoriteAkten",
      "GET",
      `api/v1.1/akten?${queryParams.toString()}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
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
    queryParams.append("searchText", searchText);

    return this.sendRequest(
      "akten.aktLookUp",
      "GET",
      `api/v1.1/akten/LookUp?${queryParams.toString()}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    );
  }

  /**
   * Add Akt to favorites
   * @param aktId - The ID of the Akt to add to favorites
   */
  async addAktToFavorite(aktId: number) {
    return this.sendRequest(
      "akten.addAktToFavorite",
      "POST",
      `api/v1.1/akten/AddToFavorites/${aktId}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
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
      "akten.removeAktFromFavorite",
      "DELETE",
      `api/v1.1/akten/RemoveFromFavorites/${aktId}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
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

    if (query.Kürzel != null && query.Kürzel != undefined)
      queryParams.append("Kürzel", query.Kürzel);
    if (query.OnlyQuickListe !== undefined)
      queryParams.append("OnlyQuickListe", query.OnlyQuickListe.toString());
    if (query.Limit != null && query.Limit != undefined)
      queryParams.append("Limit", query.Limit.toString());

    return this.sendRequest(
      "service.loadServices",
      "GET",
      `api/v1.1/leistungen/Auswahl?${queryParams.toString()}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    );
  }

  /**
   * Save a new Leistung via WebRTC
   * @param leistungData - Data for the new Leistung
   */
  async saveLeistung(leistungData: LeistungPostData) {
    return this.sendRequest(
      "service.saveLeistung",
      "POST",
      "api/v1.1/Leistungen",
      {
        "Content-Type": "application/json-patch+json",
        Accept: "text/plain",
      },
      leistungData
    );
  }

  /**
   * Get all Leistungen by Akt via WebRTC
   * @param query - Query parameters (aktId, outlookEmailId, count)
   * @returns Promise resolving to array of LeistungResponse
   */
  async getLeistungenByAkt(query: LeistungenQuery) {
    const queryParams = new URLSearchParams();

    if (query.aktId != null) queryParams.append("AktId", query.aktId.toString());
    if (query.outlookEmailId != null) queryParams.append("OutlookEmailId", query.outlookEmailId);
    if (query.count != null) queryParams.append("Count", query.count.toString());
    if (query.erstelltAb != null) queryParams.append("ErstelltAb", query.erstelltAb instanceof Date ? query.erstelltAb.toISOString() : query.erstelltAb);
    if (query.erstelltBis != null) queryParams.append("ErstelltBis", query.erstelltBis instanceof Date ? query.erstelltBis.toISOString() : query.erstelltBis);
    if (query.erstelltVon != null) queryParams.append("ErstelltVon", query.erstelltVon);
    if (query.bearbeitetAb != null) queryParams.append("BearbeitetAb", query.bearbeitetAb instanceof Date ? query.bearbeitetAb.toISOString() : query.bearbeitetAb);
    if (query.bearbeitetBis != null) queryParams.append("BearbeitetBis", query.bearbeitetBis instanceof Date ? query.bearbeitetBis.toISOString() : query.bearbeitetBis);
    if (query.bearbeitetVon != null) queryParams.append("BearbeitetVon", query.bearbeitetVon);

    return this.sendRequest(
      "service.getLeistungenByAkt",
      "GET",
      `api/v1.1/Leistungen?${queryParams.toString()}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    );
  }

  /**
   * Save a new document via WebRTC with automatic chunking for large content
   * @param dokumentData - Data for the new document
   */
  async saveDokument(dokumentData: DokumentPostData) {
    // Inject sachbearbeiterKürzel and vonSachbearbeiterKürzel from logged-in user if not provided
    const kürzel = store.getState().auth.credentials.username || undefined;
    const enriched: DokumentPostData = {
      ...dokumentData,
      sachbearbeiterKürzel: dokumentData.sachbearbeiterKürzel ?? kürzel,
      vonSachbearbeiterKürzel: dokumentData.vonSachbearbeiterKürzel ?? kürzel,
    };
    console.log("Enriched dokument data with user kürzel:", enriched);
    return this.sendRequest(
      "dokument.saveDokument",
      "POST",
      "api/v2.0/dokumente",
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      enriched
    );
  }

  /**
   * Get available folders for a case via WebRTC
   * @param aktId - The case ID to get folders for
   */
  async getAvailableFolders(aktId: number) {
    return this.sendRequest(
      "dokument.getAvailableFolders",
      "GET",
      `api/v2.0/dokumente/folders/${aktId}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    );
  }

  /**
   * Format a Date as local ISO string without timezone offset: YYYY-MM-DDTHH:mm:ss.SS
   * The backend expects local time in this format (no trailing Z).
   */
  private toLocalISOString(d: Date): string {
    const p = (n: number, len = 2) => String(n).padStart(len, "0");
    const ms2 = p(Math.floor(d.getMilliseconds() / 10)); // 2-digit fractional seconds
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${ms2}`;
  }

  /**
   * Get documents via WebRTC with flexible query parameters
   * @param query - Query parameters including aktId, outlookEmailId, dokumentArten, and limit
   */
  async GetDocuments(query: DokumenteQuery) {
    const queryParams = new URLSearchParams();

    if (query.aktId) queryParams.append("AktId", query.aktId.toString());
    if (query.outlookEmailId) queryParams.append("OutlookEmailId", query.outlookEmailId);
    if (query.dokumentArten && query.dokumentArten.length > 0) {
      query.dokumentArten.forEach((art) => queryParams.append("DokumentArten", DokumentArt[art]));
    }
    if (query.Count) queryParams.append("Count", query.Count.toString());
    if (query.erstelltVon) queryParams.append("ErstelltVon", query.erstelltVon);

    let url = `api/v2.0/dokumente?${queryParams.toString()}`;
    if (query.erstelltAb) url += `&ErstelltAb=${this.toLocalISOString(query.erstelltAb)}`;
    if (query.erstelltBis) url += `&ErstelltBis=${this.toLocalISOString(query.erstelltBis)}`;
    return this.sendRequest(
      "dokument.getDocuments",
      "GET",
      url,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
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
      "dokument.downloadDocument",
      "GET",
      `api/v2.0/Dokumente/${dokumentId}/download`,
      {
        "Content-Type": "application/json",
        Accept: "application/octet-stream", // Expecting binary file stream
      }
    );

    // The response body is already base64-encoded (from the chunking process)
    // The C# API returns File(stream, contentType, fileName) which sends raw bytes
    // These bytes are base64-encoded when sent through WebRTC chunks
    return response.body || "";
  }

  // ===== PERSON API METHODS =====

  /**
   * Get favorite persons via WebRTC
   * @param query - Search parameters with NurFavoriten=true
   */
  async getFavoritePersons(query: PersonenQuery) {
    const queryParams = new URLSearchParams();

    if (query.NKurzLike) queryParams.append("NKurzLike", query.NKurzLike);
    if (query.Name1Like) queryParams.append("Name1Like", query.Name1Like);
    if (query.Count) queryParams.append("Count", query.Count.toString());
    if (query.NurFavoriten !== undefined)
      queryParams.append("NurFavoriten", query.NurFavoriten.toString());

    return this.sendRequest(
      "person.getFavoritePersons",
      "GET",
      `api/v1.1/personen?${queryParams.toString()}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    );
  }

  /**
   * Person Lookup - search in different fields via WebRTC
   * @param searchText - Text to search for in different fields
   */
  async personLookUp(searchText: string) {
    const queryParams = new URLSearchParams();
    queryParams.append("searchText", searchText);

    return this.sendRequest(
      "person.personLookUp",
      "GET",
      `api/v1.1/personen/Lookup?${queryParams.toString()}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    );
  }

  /**
   * Add person to favorites via WebRTC
   */
  async addPersonToFavorites(personId: number) {
    return this.sendRequest(
      "person.addPersonToFavorites",
      "POST",
      `api/v1.1/personen/AddToFavorites/${personId}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    );
  }

  /**
   * Remove person from favorites via WebRTC
   */
  async removePersonFromFavorites(personId: number) {
    return this.sendRequest(
      "person.removePersonFromFavorites",
      "DELETE",
      `api/v1.1/personen/RemoveFromFavorites/${personId}`,
      {
        "Content-Type": "application/json",
        Accept: "application/json",
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
    this.logger.info("Starting authentication via WebRTC...", "WebRTCApiService");
    this.logger.debug("Authentication request", "WebRTCApiService", authRequest);

    // Create form data for authentication
    const formData = this.createAuthenticationFormData(authRequest);

    const response = await this.sendRequest(
      "auth.authenticate",
      "POST",
      "connect/token",
      {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      formData
    );

    this.logger.info("Authentication response received", "WebRTCApiService");

    // Parse the response body to get authentication details
    if (response.body && typeof response.body === "string") {
      try {
        const authData = JSON.parse(response.body) as IAuthResponse;
        this.logger.info("Authentication successful - token received", "WebRTCApiService");
        return authData;
      } catch (error) {
        this.logger.error("Failed to parse authentication response:", "WebRTCApiService", error);
        throw new Error("Invalid authentication response format");
      }
    } else if (response.body && typeof response.body === "object") {
      // Response body is already an object
      this.logger.info("Authentication successful - token received", "WebRTCApiService");
      return response.body as IAuthResponse;
    } else {
      this.logger.error("Authentication failed - no token in response", "WebRTCApiService");
      throw new Error("Authentication failed - no token received");
    }
  }

  /**
   * Refresh authentication token
   * @param refreshToken - Refresh token from previous authentication
   * @returns Promise with new authentication response
   */
  async refreshToken(refreshToken: string): Promise<IAuthResponse> {
    this.logger.info("Refreshing authentication token via WebRTC...", "WebRTCApiService");

    const refreshRequest: IAuthRequest = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: "TestClientId",
    };

    return this.authenticate(refreshRequest);
  }

  /**
   * Check if WebRTC connection is ready for API calls
   * @returns True if both channels are open and ready for bidirectional communication
   */
  isReady(): boolean {
    return WebRTCDataChannelService.getInstance().isReadyForCommunication;
  }
}

// Export singleton instance
export const webRTCApiService = new WebRTCApiService();
