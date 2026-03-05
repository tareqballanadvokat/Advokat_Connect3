/* eslint-disable no-undef */
/**
 * WebRTC Peer-to-Peer Connection Handler
 *
 * This class manages the WebRTC peer-to-peer connection establishment and data exchange
 * between SIP clients. It handles the complete WebRTC negotiation process including
 * SDP (Session Description Protocol) offer/answer exchange and ICE candidate gathering.
 *
 * EVENT-DRIVEN DESIGN:
 * Uses Peer2PeerEvents callback interface to emit state changes and outcomes.
 * SipClient subscribes to these events to coordinate final connection establishment.
 * No direct coupling to Redux or external state management.
 *
 * Protocol Flow:
 * - OWA Client: Always acts as OFFERER (creates SDP Offer, sends SERVICE CSeq: 1)
 * - Server: Always acts as ANSWERER (creates SDP Answer, sends SERVICE CSeq: 2)
 *
 * Success Flow:
 * ┌─────────────┐                                ┌─────────────┐
 * │  OWA Client │                                │   Server    │
 * │  (OFFERER)  │                                │ (ANSWERER)  │
 * └──────┬──────┘                                └──────┬──────┘
 *        │                                              │
 *        │ ──── SERVICE (SDP Offer, CSeq: 1) ────────> │
 *        │ [OFFER_SENT] Start RECEIVE_TIMEOUT           │
 *        │                                              │ Create Answer
 *        │ <─── SERVICE (SDP Answer, CSeq: 2) ──────── │
 *        │ Cancel RECEIVE_TIMEOUT                       │
 *        │ [ANSWER_RECEIVED]                            │
 *        │                                              │
 *        │ ═══════ WebRTC Connection Established ══════│
 *        │ [COMPLETE] DataChannel opens                 │
 *        │ <──────── Bidirectional Data Flow ────────> │
 *        │                                              │
 *
 * Retry Flow (RECEIVE_TIMEOUT):
 * ┌─────────────┐                                ┌─────────────┐
 * │  OWA Client │                                │   Server    │
 * └──────┬──────┘                                └──────┬──────┘
 *        │                                              │
 *        │ ──── SERVICE (SDP Offer, CSeq: 1) ────────> │
 *        │ [OFFER_SENT] Start RECEIVE_TIMEOUT           │
 *        │                                              X (No Answer)
 *        │ ⏱️  RECEIVE_TIMEOUT expires                  │
 *        │ Close PeerConnection, Retry (attempt 2/3)    │
 *        │ ──── SERVICE (SDP Offer, CSeq: 1) ────────> │
 *        │ [OFFER_SENT] Start RECEIVE_TIMEOUT           │
 *        │                                              X (No Answer)
 *        │ ⏱️  RECEIVE_TIMEOUT expires                  │
 *        │ Close PeerConnection, Retry (attempt 3/3)    │
 *        │ ──── SERVICE (SDP Offer, CSeq: 1) ────────> │
 *        │                                              X (No Answer)
 *        │ ⏱️  RECEIVE_TIMEOUT expires                  │
 *        │ [FAILED] Max retries reached                 │
 *        │ ──── CONNECTION BYE (CSeq: 7) ───────────> │
 *        │                                              │
 *
 * State Machine:
 * IDLE → OFFER_SENT → ANSWER_RECEIVED → COMPLETE
 *          ↓ (timeout)                      ↑
 *          └─── Retry (up to 3x) ───────────┘
 *          ↓ (max retries)
 *        FAILED → Send CONNECTION BYE
 *
 * Key Features:
 * - WebRTC peer connection management (OFFERER role only)
 * - SDP offer creation and transmission
 * - SDP answer processing with timeout and retry
 * - Data channel creation and message handling
 * - ICE candidate gathering and state management
 * - Automatic retry up to 3 attempts on timeout
 * - Bidirectional data channel communication
 *
 * @author AdvokatConnect Development Team
 * @version 2.1.0
 */

import { getLogger } from "@services/logger";
import { getConfig } from "@config";
import { TimeoutManager } from "./TimeoutManager";
import { MessageFactory } from "./MessageFactory";

const logger = getLogger();
import { SipPhaseEvents } from "./SipClient";
import { WebRTCDataChannelService } from "@taskpane/services/WebRTCDataChannelService";

/**
 * Event callbacks for Peer2Peer WebRTC phase
 * Specialized from generic SipPhaseEvents with SdpExchangeState and 'RECEIVE_TIMEOUT'
 */
export type Peer2PeerEvents = SipPhaseEvents<SdpExchangeState, "RECEIVE_TIMEOUT">;

/**
 * WebRTC SDP Exchange state machine enum
 * Tracks the current state of the WebRTC offer/answer exchange
 */
export enum SdpExchangeState {
  IDLE = "IDLE", // Initial state
  OFFER_SENT = "OFFER_SENT", // Offer sent, waiting for answer (RECEIVE_TIMEOUT active)
  ANSWER_RECEIVED = "ANSWER_RECEIVED", // Answer received and processed
  COMPLETE = "COMPLETE", // WebRTC connection established
  FAILED = "FAILED", // SDP exchange failed
}

export class Peer2PeerConnection {
  private static readonly LOG_PREFIX = "[PEER2PEER]";
  private static readonly CSEQ_OFFER = 1;
  private static readonly CSEQ_ANSWER = 2;
  private static readonly DATA_CHANNEL_LABEL = "offer";
  private static readonly RECEIVE_TIMEOUT = "RECEIVE_TIMEOUT";
  private static readonly TIMEOUT_ICE_GATHERING = "ICE_GATHERING_TIMEOUT";
  private static readonly TIMEOUT_DATACHANNEL_OPEN = "DATACHANNEL_OPEN_TIMEOUT";
  private static readonly DEFAULT_RECEIVE_TIMEOUT = 20000; // 20 seconds (increased for slower networks)
  private static readonly ICE_GATHERING_TIMEOUT = 5000; // 5 seconds (reduced, will send with partial candidates)
  private static readonly DATACHANNEL_OPEN_TIMEOUT = 5000; // 5 seconds

  private static readonly REGEX_SERVICE_ANSWER = /^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/;
  private static readonly REGEX_CSEQ_ANSWER = /CSeq:\s*2 SERVICE/;
  private static readonly REGEX_SDP_BLOCK = /(\{[\s\S]*?"sdp"[\s\S]*?\})/m;

  // Get RTC configuration from environment config
  private static getRTCConfig(): RTCConfiguration {
    const config = getConfig();
    return {
      iceServers: config.webrtc.iceServers,
      iceTransportPolicy: "all",
    };
  }

  private pc = new RTCPeerConnection(Peer2PeerConnection.getRTCConfig());

  private dataChannelPeer: RTCDataChannel | undefined = undefined;
  public isOfferSent = false;
  private sdpExchangeState: SdpExchangeState = SdpExchangeState.IDLE;
  private lastError: string = "";
  private timeoutManager: TimeoutManager | null = null;
  private receiveTimeout: number = Peer2PeerConnection.DEFAULT_RECEIVE_TIMEOUT;

  // Track if answer was already received to prevent duplicate processing
  private answerReceived = false;

  // Store last offer parameters for retry and BYE message creation
  private lastOfferParams: {
    callId: string;
    sipUri: string;
    tag: string;
    toLine: string;
  } | null = null;

  // Event callbacks for SipClient observation
  private events: Peer2PeerEvents;

  constructor(events: Peer2PeerEvents) {
    this.events = events;

    // Subscribe to WebRTCDataChannelService events
    WebRTCDataChannelService.getInstance().subscribe({
      onDataChannelStateChanged: (state, channelType) => {
        this.handleDataChannelStateChange(state, channelType);
      },
      onDataChannelError: (error, channelType) => {
        this.handleDataChannelError(error, channelType);
      },
    });

    // Setup answer channel handler (will be attached after pc creation)
    this.setupAnswerChannelHandler();
  }

  /**
   * Setup handler for incoming answer channel with validation
   * Must be called after pc is created/reset to prevent race conditions
   */
  private setupAnswerChannelHandler(): void {
    this.pc.ondatachannel = (event) => {
      this.logWithPrefix(`📥 Answer channel received from server: ${event.channel.label}`);

      // Validate channel label - answer channel should match or complement offer channel
      // The server may send back the same label or a different one
      this.logWithPrefix(`🔍 Validating answer channel label: ${event.channel.label}`);

      // Register the answer channel regardless of label (server controls the label)
      // but log if it's unexpected for debugging purposes
      if (
        event.channel.label !== Peer2PeerConnection.DATA_CHANNEL_LABEL &&
        event.channel.label !== "answer"
      ) {
        this.logWithPrefix(
          `⚠️ Unexpected answer channel label: ${event.channel.label} (expected '${Peer2PeerConnection.DATA_CHANNEL_LABEL}' or 'answer')`
        );
      }

      WebRTCDataChannelService.getInstance().setAnswerChannel(event.channel);
    };
  }

  /**
   * Handle DataChannel state changes from service
   */
  private handleDataChannelStateChange(
    state: RTCDataChannelState,
    channelType: "offer" | "answer"
  ): void {
    const prefix = channelType === "offer" ? "📤" : "📥";
    const timestamp = new Date().toISOString();
    this.logWithPrefix(`${prefix} ${channelType} channel state: ${state} [${timestamp}] (current SDP state: ${this.sdpExchangeState})`);

    // Process 'open' state for BOTH channels (either can open first)
    if (state === "open") {
      // State guard: only process if we're in ANSWER_RECEIVED state
      // Prevents acting on stale events from previous connection attempts
      if (this.sdpExchangeState !== SdpExchangeState.ANSWER_RECEIVED) {
        this.logWithPrefix(
          `⚠️ ${channelType} channel opened but state is ${this.sdpExchangeState} - ignoring`
        );
        return;
      }

      // CRITICAL: Verify BOTH channels are open before declaring success
      // This handles race conditions where either channel might open first
      const channelService = WebRTCDataChannelService.getInstance();
      if (!channelService.isReadyForCommunication) {
        const otherChannel = channelType === "offer" ? "answer" : "offer";
        this.logWithPrefix(
          `⚠️ ${channelType} channel open but ${otherChannel} channel not ready yet - waiting...`
        );
        this.logWithPrefix(
          `📊 Channel status: offer=${channelService.isOfferChannelOpen}, answer=${channelService.isAnswerChannelOpen}`
        );
        return;
      }

      // Cancel DataChannel opening timeout
      if (
        this.timeoutManager &&
        this.timeoutManager.isTimerActive(Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN)
      ) {
        this.timeoutManager.cancelTimer(Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN);
      }

      // Transition to COMPLETE state
      this.transitionTo(SdpExchangeState.COMPLETE);

      // Clear stale offer params
      this.lastOfferParams = null;

      // Both channels successfully opened - WebRTC connection established
      this.logWithPrefix("✅ Both channels ready - bidirectional communication established");
      this.events.onSuccess?.();
    } else if (state === "closed" && channelType === "answer") {
      // Only log if we were in COMPLETE state (unexpected close)
      if (this.sdpExchangeState === SdpExchangeState.COMPLETE) {
        this.logWithPrefix("⚠️ Answer channel closed unexpectedly after connection established");
      }
    }
  }

  /**
   * Handle DataChannel errors from service
   */
  private handleDataChannelError(error: Event | string, channelType: "offer" | "answer"): void {
    // State guard: only process if we're in an active connection attempt
    // Ignore errors from old/stale DataChannels
    if (
      this.sdpExchangeState === SdpExchangeState.IDLE ||
      this.sdpExchangeState === SdpExchangeState.FAILED
    ) {
      this.logWithPrefix(
        `⚠️ ${channelType} channel error in ${this.sdpExchangeState} state - ignoring`
      );
      return;
    }

    const prefix = channelType === "offer" ? "📤" : "📥";
    this.logWithPrefix(`❌ ${prefix} ${channelType} channel error: ${error}`);
    this.isOfferSent = false;
    this.cancelAllTimeouts();
    this.transitionTo(SdpExchangeState.FAILED);
    this.events.onFailure?.(`${channelType} channel error: ${error}`);
  }

  /**
   * Generate SIP branch parameter
   */
  private static generateBranch(): string {
    return "z9hG4bK" + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Log with standardized prefix
   */
  private logWithPrefix(message: string): void {
    logger.debug(`${Peer2PeerConnection.LOG_PREFIX} ${message}`, "Peer2PeerConnection");
  }

  /**
   * Transition to new SDP exchange state with logging and event emission
   */
  private transitionTo(newState: SdpExchangeState): void {
    const oldState = this.sdpExchangeState;
    this.sdpExchangeState = newState;
    this.logWithPrefix(`State transition: ${oldState} → ${newState}`);
    this.events.onStateChange?.(newState);
  }

  /**
   * Cancel RECEIVE_TIMEOUT if active
   */
  private cancelReceiveTimeout(): void {
    if (
      this.timeoutManager &&
      this.timeoutManager.isTimerActive(Peer2PeerConnection.RECEIVE_TIMEOUT)
    ) {
      this.timeoutManager.cancelTimer(Peer2PeerConnection.RECEIVE_TIMEOUT);
      this.logWithPrefix(`⏱️ Cancelled ${Peer2PeerConnection.RECEIVE_TIMEOUT}`);
    }
  }

  /**
   * Cancel all active timeouts
   */
  private cancelAllTimeouts(): void {
    if (this.timeoutManager) {
      const timers = [
        Peer2PeerConnection.RECEIVE_TIMEOUT,
        Peer2PeerConnection.TIMEOUT_ICE_GATHERING,
        Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN,
      ];
      timers.forEach((timer) => {
        if (this.timeoutManager!.isTimerActive(timer)) {
          this.timeoutManager!.cancelTimer(timer);
          this.logWithPrefix(`⏱️ Cancelled ${timer}`);
        }
      });
    }
  }
  /**
   * Reset peer connection to fresh state
   */
  private resetPeerConnection(): void {
    if (this.pc) {
      this.pc.close();
    }
    this.pc = new RTCPeerConnection(Peer2PeerConnection.getRTCConfig());
    this.dataChannelPeer = undefined;

    // Re-attach answer channel handler to new peer connection
    this.setupAnswerChannelHandler();
  }

  /**
   * Setup DataChannel event handlers
   * Registers the offer channel with WebRTCDataChannelService for centralized management
   */
  private setupDataChannelHandlers(channel: RTCDataChannel): void {
    // Register the offer channel with the centralized service (for sending)
    // The service will handle all event management and observer notifications
    WebRTCDataChannelService.getInstance().setOfferChannel(channel);

    this.logWithPrefix(
      `📤 Offer channel registered with WebRTCDataChannelService: ${channel.label}`
    );
  }

  /**
   * Setup ICE event handlers for peer connection
   */
  private setupICEHandlers(callId: string, sipUri: string, tag: string, toLine: string): void {
    let candidateCount = 0;
    let hasRelayCandidates = false;

    this.pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        candidateCount++;
        if (evt.candidate.candidate.includes("typ relay")) {
          hasRelayCandidates = true;
        }
        this.logWithPrefix(
          `📤 ICE candidate (offer) #${candidateCount}: ${JSON.stringify(evt.candidate)}`
        );
      } else {
        // null candidate signals end of gathering
        this.logWithPrefix("📤 ICE candidate gathering complete (null candidate received)");
      }
    };

    this.pc.onicegatheringstatechange = () => {
      const state = this.pc.iceGatheringState;
      this.logWithPrefix(
        `📊 ICE gathering state changed: ${state} (candidates: ${candidateCount}, relay: ${hasRelayCandidates})`
      );

      if (state === "complete") {
        // Cancel ICE gathering timeout
        if (
          this.timeoutManager &&
          this.timeoutManager.isTimerActive(Peer2PeerConnection.TIMEOUT_ICE_GATHERING)
        ) {
          this.timeoutManager.cancelTimer(Peer2PeerConnection.TIMEOUT_ICE_GATHERING);
        }

        this.logWithPrefix(
          `✅ ICE gathering complete (offer) - collected ${candidateCount} candidates`
        );

        // CRITICAL: Only send offer if we haven't received an answer yet
        // ICE gathering can complete AFTER receiving answer (triggered by setRemoteDescription)
        // In that case, we should NOT send another offer
        if (this.sdpExchangeState === SdpExchangeState.IDLE) {
          this.logWithPrefix("📤 Sending offer with collected ICE candidates");
          this.sendOfferWithCurrentCandidates(callId, sipUri, tag, toLine);
        } else {
          this.logWithPrefix(
            `⚠️ ICE gathering complete but state is ${this.sdpExchangeState} - not sending offer (already sent or answer received)`
          );
        }
      }
    };
  }

  /**
   * Send SDP offer with currently gathered ICE candidates
   */
  private sendOfferWithCurrentCandidates(
    callId: string,
    sipUri: string,
    tag: string,
    toLine: string
  ): void {
    // Log candidates before cleaning
    if (this.pc.localDescription?.sdp) {
      const candidates = this.extractCandidatesFromSDP(this.pc.localDescription.sdp);
      this.logWithPrefix(`📋 ICE Candidates in SDP before cleaning (${candidates.length} total):`);
      candidates.forEach((candidate, index) => {
        const type = this.extractCandidateType(candidate);
        const ip = this.extractCandidateIP(candidate);
        const port = this.extractCandidatePort(candidate);
        this.logWithPrefix(`  ${index + 1}. Type: ${type}, IP: ${ip}, Port: ${port}`);
        this.logWithPrefix(`     Full: ${candidate}`);
      });
    }

    // Remove mDNS candidates from SDP before sending
    const cleanedSDP = this.pc.localDescription; //this.removeMdnsCandidates(this.pc.localDescription);

    // Log candidates after cleaning
    if (cleanedSDP?.sdp) {
      const cleanedCandidates = this.extractCandidatesFromSDP(cleanedSDP.sdp);
      this.logWithPrefix(
        `📋 ICE Candidates after mDNS filtering (${cleanedCandidates.length} total):`
      );
      cleanedCandidates.forEach((candidate, index) => {
        const type = this.extractCandidateType(candidate);
        const ip = this.extractCandidateIP(candidate);
        const port = this.extractCandidatePort(candidate);
        this.logWithPrefix(`  ${index + 1}. Type: ${type}, IP: ${ip}, Port: ${port}`);
      });
    }

    const offerSDP = JSON.stringify(cleanedSDP);
    const branch = Peer2PeerConnection.generateBranch();
    const offerMsg = this.createSdpOfferMessage(offerSDP, callId, sipUri, tag, toLine, branch);

    this.logWithPrefix("📤 Sending SDP Offer message");

    // Set state and flag when actually sending the offer
    this.isOfferSent = true;
    this.transitionTo(SdpExchangeState.OFFER_SENT);

    this.events.onMessageToSend?.(offerMsg, "SERVICE Offer");
    this.startReceiveTimeout();
  }

  /**
   * Remove mDNS (.local) candidates from SDP to prevent resolution issues on server
   */
  private removeMdnsCandidates(
    description: RTCSessionDescription | null
  ): RTCSessionDescription | null {
    if (!description || !description.sdp) {
      return description;
    }

    const sdpLines = description.sdp.split("\r\n");
    const filteredLines = sdpLines.filter((line) => {
      // Remove lines containing .local hostnames
      if (line.includes(".local")) {
        this.logWithPrefix(`🚫 Removing mDNS candidate: ${line}`);
        return false;
      }
      return true;
    });

    return {
      type: description.type,
      sdp: filteredLines.join("\r\n"),
    } as RTCSessionDescription;
  }

  /**
   * Extract all ICE candidate lines from SDP
   */
  private extractCandidatesFromSDP(sdp: string): string[] {
    const lines = sdp.split("\r\n");
    return lines.filter((line) => line.startsWith("a=candidate:"));
  }

  /**
   * Extract candidate type (host/srflx/relay) from candidate line
   */
  private extractCandidateType(candidateLine: string): string {
    const match = candidateLine.match(/typ\s+(\w+)/);
    return match ? match[1] : "unknown";
  }

  /**
   * Extract IP address from candidate line
   */
  private extractCandidateIP(candidateLine: string): string {
    // Format: a=candidate:<foundation> <component-id> <transport> <priority> <ip> <port> ...
    const parts = candidateLine.split(" ");
    return parts.length > 4 ? parts[4] : "unknown";
  }

  /**
   * Extract port from candidate line
   */
  private extractCandidatePort(candidateLine: string): string {
    const parts = candidateLine.split(" ");
    return parts.length > 5 ? parts[5] : "unknown";
  }

  /**
   * Update timeout manager and receive timeout value
   * Called from SipClient after registration completes
   * @param timeoutManager - TimeoutManager instance for managing timeouts
   * @param receiveTimeout - Timeout duration in milliseconds for waiting for SDP answer
   */
  updateConfiguration(timeoutManager: TimeoutManager, receiveTimeout: number): void {
    this.timeoutManager = timeoutManager;
    this.receiveTimeout = receiveTimeout;
    this.logWithPrefix(`Updated configuration - ReceiveTimeout: ${receiveTimeout}ms`);
  }

  /**
   * Get current SDP exchange state
   * @returns Current state of SDP exchange
   */
  getState(): SdpExchangeState {
    return this.sdpExchangeState;
  }

  /**
   * Get last error message
   * @returns Last error message or empty string
   */
  getLastError(): string {
    return this.lastError;
  }

  /**
   * Reset for new attempt
   * Clears all state, cancels timeouts, and creates fresh peer connection
   */
  reset(): void {
    this.sdpExchangeState = SdpExchangeState.IDLE;
    this.isOfferSent = false;
    this.answerReceived = false;
    this.lastError = "";
    this.lastOfferParams = null;

    this.cancelAllTimeouts();
    this.resetPeerConnection();

    // Clear both DataChannels from service to prevent stale events
    // Use the service's cleanup method for proper encapsulation
    // Note: reset() clears all observers, so we need to resubscribe
    const service = WebRTCDataChannelService.getInstance();
    service.reset();

    // Resubscribe to service events after reset
    service.subscribe({
      onDataChannelStateChanged: (state, channelType) => {
        this.handleDataChannelStateChange(state, channelType);
      },
      onDataChannelError: (error, channelType) => {
        this.handleDataChannelError(error, channelType);
      },
    });

    this.logWithPrefix("Reset complete");
  }

  /**
   * Creates WebRTC offer and prepares for peer-to-peer connection
   * Offer is sent when ICE gathering completes via onMessageToSend callback
   * @param callId - SIP Call-ID
   * @param sipUri - SIP URI for this peer
   * @param tag - SIP tag
   * @param toLine - Formatted To header line
   */
  async createOffer(callId: string, sipUri: string, tag: string, toLine: string): Promise<void> {
    // Save offer parameters for retry and BYE message creation
    this.lastOfferParams = { callId, sipUri, tag, toLine };

    try {
      this.logWithPrefix("Creating SDP Offer");

      this.dataChannelPeer = this.pc.createDataChannel(Peer2PeerConnection.DATA_CHANNEL_LABEL);

      // Register the data channel with the service
      // Service will handle all events (onopen, onclose, onerror, onmessage)
      this.setupDataChannelHandlers(this.dataChannelPeer);

      // Setup ICE handlers BEFORE creating offer
      this.setupICEHandlers(callId, sipUri, tag, toLine);

      // Monitor ICE connection state for diagnostics
      this.pc.oniceconnectionstatechange = () => {
        this.logWithPrefix(`📊 ICE connection state: ${this.pc.iceConnectionState}`);
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.logWithPrefix(`📤 SDP Offer created (type: ${offer.type})`);
      this.logWithPrefix(`📊 Initial ICE gathering state: ${this.pc.iceGatheringState}`);

      // Start ICE gathering timeout
      this.startIceGatheringTimeout();
    } catch (error) {
      this.logWithPrefix(`❌ Failed to create SDP offer: ${error}`);
      this.lastError = `SDP offer creation failed: ${error}`;
      this.isOfferSent = false;
      this.cancelAllTimeouts();
      this.transitionTo(SdpExchangeState.FAILED);
      this.events.onFailure?.(`SDP offer creation failed: ${error}`);
    }
  }

  /**
   * Formats and creates SDP offer message for SIP transmission
   * @param offerSDP - The SDP offer as JSON string
   * @param callId - SIP Call-ID
   * @param sipUri - SIP URI for this peer
   * @param tag - SIP tag
   * @param toLine - Formatted To header line
   * @param branch - SIP branch parameter
   * @returns Formatted SIP SERVICE message with SDP offer
   */
  private createSdpOfferMessage(
    offerSDP: string,
    callId: string,
    sipUri: string,
    tag: string,
    toLine: string,
    branch: string
  ): string {
    return MessageFactory.createServiceMessage({
      sipUri: sipUri,
      branch: branch,
      callId: callId,
      tag: tag,
      cseq: Peer2PeerConnection.CSEQ_OFFER,
      toLine: toLine,
      body: offerSDP,
      contentType: "application/sdp",
      fromDisplayName: "macc",
    });
  }

  /**
   * Parses incoming SDP answer and sets it as remote description
   * Cancels RECEIVE_TIMEOUT on success
   * @param data - The SIP message containing SDP answer
   */
  async parseIncomingAnswer(data: string): Promise<void> {
    this.logWithPrefix(`📥 parseIncomingAnswer called (current state: ${this.sdpExchangeState}, answerReceived: ${this.answerReceived})`);
    
    // State guard: only process answers if we're waiting for one
    // Ignore answers if we're IDLE (reset) or already COMPLETE
    if (
      this.sdpExchangeState === SdpExchangeState.IDLE ||
      this.sdpExchangeState === SdpExchangeState.COMPLETE
    ) {
      this.logWithPrefix(
        `⚠️ Received answer in ${this.sdpExchangeState} state - ignoring (likely from previous attempt)`
      );
      return;
    }

    // Check for duplicate answer
    if (this.answerReceived) {
      this.logWithPrefix("⚠️ Duplicate SERVICE answer received - ignoring");
      return;
    }
    
    this.logWithPrefix("🔍 State guards passed, validating SERVICE answer format");

    // Validate it's a SERVICE answer with CSeq 2
    const isServiceMatch = Peer2PeerConnection.REGEX_SERVICE_ANSWER.test(data);
    const isCSeqMatch = Peer2PeerConnection.REGEX_CSEQ_ANSWER.test(data);
    this.logWithPrefix(`🔍 Format validation: SERVICE=${isServiceMatch}, CSeq:2=${isCSeqMatch}`);
    
    if (!isServiceMatch || !isCSeqMatch) {
      this.logWithPrefix("⚠️ Invalid SERVICE answer format - ignoring");
      return;
    }

    this.logWithPrefix("✅ SERVICE answer format validated");
    this.cancelReceiveTimeout();
    this.answerReceived = true;
    this.logWithPrefix("⏱️ Answer received - processing SDP block");

    const sdpBlockMatch = data.match(Peer2PeerConnection.REGEX_SDP_BLOCK);
    this.logWithPrefix(`🔍 SDP block match: ${!!sdpBlockMatch}`);
    
    if (sdpBlockMatch) {
      try {
        const sdpBlock = sdpBlockMatch[1];
        this.logWithPrefix(`📋 Parsing SDP block (length: ${sdpBlock.length})`);
        const sdpObj = JSON.parse(sdpBlock);
        this.logWithPrefix(`📋 SDP parsed, setting remote description (type: ${sdpObj.type})`);
        
        // CRITICAL: Transition to ANSWER_RECEIVED BEFORE setting remote description
        // This prevents race condition where channel opens during setRemoteDescription
        // but state guard rejects it because we're still in OFFER_SENT
        this.logWithPrefix(`🔄 Transitioning to ANSWER_RECEIVED state (before setRemoteDescription)`);
        this.transitionTo(SdpExchangeState.ANSWER_RECEIVED);
        
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
        this.logWithPrefix("✅ Remote SDP Answer set successfully");

        // Start timeout waiting for DataChannel to open
        this.logWithPrefix("⏱️ Starting DataChannel open timeout");
        this.startDataChannelOpenTimeout();
        // Success will be emitted when DataChannel opens in createAndSendOffer
      } catch (err) {
        this.logWithPrefix("❌ SDP or WebRTC error: " + err);
        this.lastError = `SDP error: ${err}`;
        this.isOfferSent = false;
        this.answerReceived = false;
        this.cancelAllTimeouts();
        this.transitionTo(SdpExchangeState.FAILED);
        this.events.onFailure?.(`SDP parsing error: ${err}`);
      }
    } else {
      this.logWithPrefix("⚠️ SDP block not found in SERVICE answer");
      this.lastError = "SDP block not found in answer";
      this.isOfferSent = false;
      this.answerReceived = false;
      this.cancelAllTimeouts();
      this.transitionTo(SdpExchangeState.FAILED);
      this.events.onFailure?.("SDP block not found in SERVICE answer");
    }
  }

  /**
   * Start RECEIVE_TIMEOUT waiting for SDP answer
   */
  private startReceiveTimeout(): void {
    if (!this.timeoutManager) {
      const error = "TimeoutManager not configured - cannot start RECEIVE_TIMEOUT";
      this.logWithPrefix(`❌ ${error}`);
      this.lastError = error;
      this.isOfferSent = false;
      this.transitionTo(SdpExchangeState.FAILED);
      this.events.onFailure?.(error);
      return;
    }

    this.logWithPrefix(
      `⏱️ Starting ${Peer2PeerConnection.RECEIVE_TIMEOUT} (${this.receiveTimeout}ms) waiting for SDP answer`
    );

    this.timeoutManager.startTimer(Peer2PeerConnection.RECEIVE_TIMEOUT, this.receiveTimeout, () => {
      this.handleReceiveTimeout();
    });
  }

  /**
   * Handle RECEIVE_TIMEOUT expiry (no answer received)
   * Emits timeout and failure events - retry decision handled by SipClient
   */
  private handleReceiveTimeout(): void {
    // State guard: only process timeout if still waiting for answer
    if (this.sdpExchangeState !== SdpExchangeState.OFFER_SENT) {
      this.logWithPrefix(
        `⏱️ ${Peer2PeerConnection.RECEIVE_TIMEOUT} fired but state is ${this.sdpExchangeState} - ignoring`
      );
      return;
    }

    this.logWithPrefix(`⏱️ ${Peer2PeerConnection.RECEIVE_TIMEOUT} expired - no answer received`);

    this.lastError = "No answer received - timeout expired";
    this.isOfferSent = false;
    this.transitionTo(SdpExchangeState.FAILED);

    this.events.onTimeout?.(Peer2PeerConnection.RECEIVE_TIMEOUT);
    this.events.onFailure?.("RECEIVE_TIMEOUT expired - no SDP answer received");
  }

  /**
   * Start ICE_GATHERING_TIMEOUT
   */
  private startIceGatheringTimeout(): void {
    if (!this.timeoutManager) {
      this.logWithPrefix("⚠️ TimeoutManager not configured - cannot start ICE gathering timeout");
      return;
    }

    this.logWithPrefix(
      `⏱️ Starting ${Peer2PeerConnection.TIMEOUT_ICE_GATHERING} (${Peer2PeerConnection.ICE_GATHERING_TIMEOUT}ms)`
    );

    this.timeoutManager.startTimer(
      Peer2PeerConnection.TIMEOUT_ICE_GATHERING,
      Peer2PeerConnection.ICE_GATHERING_TIMEOUT,
      () => {
        this.handleIceGatheringTimeout();
      }
    );
  }

  /**
   * Handle ICE_GATHERING_TIMEOUT expiry
   * Instead of failing, send offer with whatever candidates we have
   */
  private handleIceGatheringTimeout(): void {
    const state = this.pc.iceGatheringState;
    const connectionState = this.pc.iceConnectionState;

    this.logWithPrefix(
      `⏱️ ICE gathering timeout expired (gathering state: ${state}, connection state: ${connectionState})`
    );

    // If we have a local description, send it even if gathering isn't complete
    // This allows the connection to proceed with whatever candidates we have
    if (this.pc.localDescription && this.lastOfferParams) {
      this.logWithPrefix("⚠️ Proceeding with partial ICE candidates due to timeout");
      const { callId, sipUri, tag, toLine } = this.lastOfferParams;
      this.sendOfferWithCurrentCandidates(callId, sipUri, tag, toLine);
    } else {
      this.logWithPrefix("❌ Cannot send offer - no local description or offer params");
      this.lastError = "ICE gathering timeout with no local description";
      this.isOfferSent = false;
      this.cancelAllTimeouts();
      this.transitionTo(SdpExchangeState.FAILED);
      this.events.onFailure?.("ICE gathering timeout - connection failed");
    }
  }

  /**
   * Start DATACHANNEL_OPEN_TIMEOUT
   */
  private startDataChannelOpenTimeout(): void {
    if (!this.timeoutManager) {
      this.logWithPrefix(
        "⚠️ TimeoutManager not configured - cannot start DataChannel open timeout"
      );
      return;
    }

    this.logWithPrefix(
      `⏱️ Starting ${Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN} (${Peer2PeerConnection.DATACHANNEL_OPEN_TIMEOUT}ms)`
    );

    this.timeoutManager.startTimer(
      Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN,
      Peer2PeerConnection.DATACHANNEL_OPEN_TIMEOUT,
      () => {
        this.handleDataChannelOpenTimeout();
      }
    );
  }

  /**
   * Handle DATACHANNEL_OPEN_TIMEOUT expiry
   */
  private handleDataChannelOpenTimeout(): void {
    // State guard: only process if still in ANSWER_RECEIVED state
    if (this.sdpExchangeState !== SdpExchangeState.ANSWER_RECEIVED) {
      this.logWithPrefix(
        `⏱️ ${Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN} fired but state is ${this.sdpExchangeState} - ignoring`
      );
      return;
    }

    this.logWithPrefix("⏱️ DataChannel opening timeout expired");

    this.lastError = "DataChannel did not open within timeout";
    this.isOfferSent = false;
    this.answerReceived = false;
    this.cancelAllTimeouts();
    this.transitionTo(SdpExchangeState.FAILED);

    this.events.onFailure?.("DataChannel opening timeout - connection failed");
  }

  /**
   * Returns the active data channel for sending messages
   * @returns The active RTCDataChannel or undefined if not established
   */
  getActiveDataChannel(): RTCDataChannel | undefined {
    return this.dataChannelPeer;
  }

  /**
   * Get the last sent offer parameters
   * @returns Last offer parameters or null if not available
   */
  getLastOfferParams(): { callId: string; sipUri: string; tag: string; toLine: string } | null {
    return this.lastOfferParams;
  }
}
