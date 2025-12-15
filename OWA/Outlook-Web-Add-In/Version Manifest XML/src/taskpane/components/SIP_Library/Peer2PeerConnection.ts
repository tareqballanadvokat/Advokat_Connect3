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

import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';
import { MessageFactory } from './MessageFactory';
import { SipPhaseEvents } from './SipClient';

type MessageHandler = (event: MessageEvent) => Promise<void> | void;

/**
 * Event callbacks for Peer2Peer WebRTC phase
 * Specialized from generic SipPhaseEvents with SdpExchangeState and 'RECEIVE_TIMEOUT'
 */
export type Peer2PeerEvents = SipPhaseEvents<SdpExchangeState, 'RECEIVE_TIMEOUT'>;

/**
 * WebRTC SDP Exchange state machine enum
 * Tracks the current state of the WebRTC offer/answer exchange
 */
export enum SdpExchangeState {
    IDLE = "IDLE",                      // Initial state
    OFFER_SENT = "OFFER_SENT",          // Offer sent, waiting for answer (RECEIVE_TIMEOUT active)
    ANSWER_RECEIVED = "ANSWER_RECEIVED",// Answer received and processed
    COMPLETE = "COMPLETE",              // WebRTC connection established
    FAILED = "FAILED"                   // SDP exchange failed
}

async function writeMessage(event: MessageEvent): Promise<void> {
    const data = event.data;
    let text: string;
    
    if (data instanceof ArrayBuffer) {
        text = new TextDecoder("utf-8").decode(data);
        logger.log("📨 [PEER2PEER] ArrayBuffer received: " + text);
    } else if (data instanceof Blob) {
        text = await data.text();
        logger.log("📨 [PEER2PEER] Blob received: " + text);
    } else if (typeof data === "string") {
        logger.log("📨 [PEER2PEER] Text received: " + data);
        text = data;
    } else {
        logger.log("❓ [PEER2PEER] Unknown message type: " + typeof data);
        return;
    }
    
    logger.log("📨 [PEER2PEER] DataChannel message: " + text);
}

export class Peer2PeerConnection {
    private static readonly LOG_PREFIX = '[PEER2PEER]';
    private static readonly CSEQ_OFFER = 1;
    private static readonly CSEQ_ANSWER = 2;
    private static readonly CSEQ_CONNECTION_BYE = 7;
    private static readonly DATA_CHANNEL_LABEL = 'offer';
    private static readonly RECEIVE_TIMEOUT = 'RECEIVE_TIMEOUT';
    private static readonly TIMEOUT_ICE_GATHERING = 'ICE_GATHERING_TIMEOUT';
    private static readonly TIMEOUT_DATACHANNEL_OPEN = 'DATACHANNEL_OPEN_TIMEOUT';
    private static readonly DEFAULT_RECEIVE_TIMEOUT = 1000;
    private static readonly ICE_GATHERING_TIMEOUT = 10000; // 10 seconds
    private static readonly DATACHANNEL_OPEN_TIMEOUT = 5000; // 5 seconds
    
    private static readonly REGEX_SERVICE_ANSWER = /^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/;
    private static readonly REGEX_CSEQ_ANSWER = /CSeq:\s*2 SERVICE/;
    private static readonly REGEX_SDP_BLOCK = /(\{[\s\S]*?"sdp"[\s\S]*?\})/m;
    
    private pc = new RTCPeerConnection();
    private dataChannelPeer: RTCDataChannel | undefined = undefined;
    public isOfferSent = false;
    private messageHandlers: MessageHandler[] = [];
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
    }
    
    /**
     * Generate SIP branch parameter
     */
    private static generateBranch(): string {
        return 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
    }
    
    /**
     * Log with standardized prefix
     */
    private logWithPrefix(message: string): void {
        logger.log(`${Peer2PeerConnection.LOG_PREFIX} ${message}`);
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
        if (this.timeoutManager && this.timeoutManager.isTimerActive(Peer2PeerConnection.RECEIVE_TIMEOUT)) {
            this.timeoutManager.cancelTimer(Peer2PeerConnection.RECEIVE_TIMEOUT);
            this.logWithPrefix(`⏱️ Cancelled ${Peer2PeerConnection.RECEIVE_TIMEOUT}`);
        }
    }
    
    /**
     * Cancel all active timeouts
     */
    private cancelAllTimeouts(): void {
        if (this.timeoutManager) {
            const timers = [Peer2PeerConnection.RECEIVE_TIMEOUT, Peer2PeerConnection.TIMEOUT_ICE_GATHERING, Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN];
            timers.forEach(timer => {
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
        this.pc = new RTCPeerConnection();
        this.dataChannelPeer = undefined;
    }
    
    /**
     * Setup DataChannel event handlers
     */
    private setupDataChannelHandlers(channel: RTCDataChannel): void {
        channel.onopen = () => {
            this.logWithPrefix(`🟢 DataChannel opened: ${channel.label}`);
        };
        
        channel.onmessage = (event) => this.dispatchMessage(event);
        
        channel.onclose = () => {
            this.logWithPrefix('🔴 DataChannel closed');
        };
        
        channel.onerror = (err) => {
            this.logWithPrefix('❌ DataChannel error: ' + err);
        };
    }
    
    /**
     * Setup ICE event handlers for peer connection
     */
    private setupICEHandlers(callId: string, sipUri: string, tag: string, toLine: string): void {
        this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                this.logWithPrefix('📤 ICE candidate (offer): ' + JSON.stringify(evt.candidate));
            }
        };
        
        this.pc.onicegatheringstatechange = () => {
            if (this.pc.iceGatheringState === 'complete') {
                // Cancel ICE gathering timeout
                if (this.timeoutManager && this.timeoutManager.isTimerActive(Peer2PeerConnection.TIMEOUT_ICE_GATHERING)) {
                    this.timeoutManager.cancelTimer(Peer2PeerConnection.TIMEOUT_ICE_GATHERING);
                }
                
                this.logWithPrefix('✅ ICE gathering complete (offer)');
                const offerSDP = JSON.stringify(this.pc.localDescription);
                const branch = Peer2PeerConnection.generateBranch();
                const offerMsg = this.createSdpOfferMessage(offerSDP, callId, sipUri, tag, toLine, branch);
                
                this.logWithPrefix('📤 Sending SDP Offer message');
                
                // Set state and flag when actually sending the offer
                this.isOfferSent = true;
                this.transitionTo(SdpExchangeState.OFFER_SENT);
                
                this.events.onMessageToSend?.(offerMsg, 'SERVICE Offer');
                this.startReceiveTimeout();
            }
        };
    }
    
    /**
     * Add a message handler that will be called for all incoming DataChannel messages
     * @param handler - Function to handle incoming messages
     */
    addMessageHandler(handler: MessageHandler): void {
        this.messageHandlers.push(handler);
    }
    
    /**
     * Remove a message handler
     * @param handler - Function to remove from handlers
     */
    removeMessageHandler(handler: MessageHandler): void {
        const index = this.messageHandlers.indexOf(handler);
        if (index > -1) {
            this.messageHandlers.splice(index, 1);
        }
    }
    
    /**
     * Dispatch message to all registered handlers
     * @param event - MessageEvent from DataChannel
     */
    private async dispatchMessage(event: MessageEvent): Promise<void> {
        await writeMessage(event);
        
        for (const handler of this.messageHandlers) {
            try {
                await handler(event);
            } catch (error) {
                this.logWithPrefix('❌ Error in message handler: ' + error);
            }
        }
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
        
        this.logWithPrefix('Reset complete');
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
            this.logWithPrefix('Creating SDP Offer');
            
            this.dataChannelPeer = this.pc.createDataChannel(Peer2PeerConnection.DATA_CHANNEL_LABEL);
            this.dataChannelPeer.onopen = () => {
                this.logWithPrefix('🟢 DataChannel OFFER opened');
                if (this.dataChannelPeer) {
                    this.dataChannelPeer.send('Hello from OFFER side');
                }
                
                // Cancel DataChannel opening timeout
                if (this.timeoutManager && this.timeoutManager.isTimerActive(Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN)) {
                    this.timeoutManager.cancelTimer(Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN);
                }
                
                // Transition to COMPLETE state
                this.transitionTo(SdpExchangeState.COMPLETE);
                
                // Clear stale offer params
                this.lastOfferParams = null;
                
                // DataChannel successfully opened - WebRTC connection established
                this.events.onSuccess?.();
            };
            
            this.dataChannelPeer.onmessage = (event) => {
                const text = new TextDecoder('utf-8').decode(event.data);
                this.logWithPrefix('📨 Received on offer channel: ' + text);
            };
            
            this.dataChannelPeer.onerror = (err) => {
                this.logWithPrefix('❌ Offer DataChannel error: ' + err);
                this.isOfferSent = false;
                this.cancelAllTimeouts();
                this.transitionTo(SdpExchangeState.FAILED);
                this.events.onFailure?.(`DataChannel error: ${err}`);
            };
            
            this.setupICEHandlers(callId, sipUri, tag, toLine);
            
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            
            this.logWithPrefix('📤 SDP Offer created: ' + JSON.stringify(offer));
            
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
    private createSdpOfferMessage(offerSDP: string, callId: string, sipUri: string, tag: string, toLine: string, branch: string): string {
        return MessageFactory.createServiceMessage({
            sipUri: sipUri,
            branch: branch,
            callId: callId,
            tag: tag,
            cseq: Peer2PeerConnection.CSEQ_OFFER,
            toLine: toLine,
            body: offerSDP,
            contentType: 'application/sdp',
            fromDisplayName: 'macc'
        });
    }
    
    /**
     * Parses incoming SDP answer and sets it as remote description
     * Cancels RECEIVE_TIMEOUT on success
     * @param data - The SIP message containing SDP answer
     */
    async parseIncomingAnswer(data: string): Promise<void> {
        // Check for duplicate answer
        if (this.answerReceived) {
            this.logWithPrefix('⚠️ Duplicate SERVICE answer received - ignoring');
            return;
        }
        
        // Validate it's a SERVICE answer with CSeq 2
        if (!Peer2PeerConnection.REGEX_SERVICE_ANSWER.test(data) || !Peer2PeerConnection.REGEX_CSEQ_ANSWER.test(data)) {
            this.logWithPrefix('⚠️ Invalid SERVICE answer format - ignoring');
            return;
        }
        
        this.cancelReceiveTimeout();
        this.answerReceived = true;
        this.logWithPrefix('⏱️ Answer received');
        
        const sdpBlockMatch = data.match(Peer2PeerConnection.REGEX_SDP_BLOCK);
            if (sdpBlockMatch) {
                try {
                    const sdpBlock = sdpBlockMatch[1];
                    const sdpObj = JSON.parse(sdpBlock);
                    await this.pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
                    this.logWithPrefix('✅ Remote SDP Answer set successfully');
                    
                    this.transitionTo(SdpExchangeState.ANSWER_RECEIVED);
                    
                    // Start timeout waiting for DataChannel to open
                    this.startDataChannelOpenTimeout();
                    // Success will be emitted when DataChannel opens in createAndSendOffer
                } catch (err) {
                    this.logWithPrefix('❌ SDP or WebRTC error: ' + err);
                    this.lastError = `SDP error: ${err}`;
                    this.isOfferSent = false;
                    this.answerReceived = false;
                    this.cancelAllTimeouts();
                    this.transitionTo(SdpExchangeState.FAILED);
                    this.events.onFailure?.(`SDP parsing error: ${err}`);
                }
            } else {
                this.logWithPrefix('⚠️ SDP block not found in SERVICE answer');
                this.lastError = 'SDP block not found in answer';
                this.isOfferSent = false;
                this.answerReceived = false;
                this.cancelAllTimeouts();
                this.transitionTo(SdpExchangeState.FAILED);
                this.events.onFailure?.('SDP block not found in SERVICE answer');
            }
    }
    
    /**
     * Start RECEIVE_TIMEOUT waiting for SDP answer
     */
    private startReceiveTimeout(): void {
        if (!this.timeoutManager) {
            const error = 'TimeoutManager not configured - cannot start RECEIVE_TIMEOUT';
            this.logWithPrefix(`❌ ${error}`);
            this.lastError = error;
            this.isOfferSent = false;
            this.transitionTo(SdpExchangeState.FAILED);
            this.events.onFailure?.(error);
            return;
        }
        
        this.logWithPrefix(`⏱️ Starting ${Peer2PeerConnection.RECEIVE_TIMEOUT} (${this.receiveTimeout}ms) waiting for SDP answer`);
        
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
            this.logWithPrefix(`⏱️ ${Peer2PeerConnection.RECEIVE_TIMEOUT} fired but state is ${this.sdpExchangeState} - ignoring`);
            return;
        }
        
        this.logWithPrefix(`⏱️ ${Peer2PeerConnection.RECEIVE_TIMEOUT} expired - no answer received`);
        
        this.lastError = 'No answer received - timeout expired';
        this.isOfferSent = false;
        this.transitionTo(SdpExchangeState.FAILED);
        
        this.events.onTimeout?.(Peer2PeerConnection.RECEIVE_TIMEOUT);
        this.events.onFailure?.('RECEIVE_TIMEOUT expired - no SDP answer received');
    }
    
    /**
     * Start ICE_GATHERING_TIMEOUT
     */
    private startIceGatheringTimeout(): void {
        if (!this.timeoutManager) {
            this.logWithPrefix('⚠️ TimeoutManager not configured - cannot start ICE gathering timeout');
            return;
        }
        
        this.logWithPrefix(`⏱️ Starting ${Peer2PeerConnection.TIMEOUT_ICE_GATHERING} (${Peer2PeerConnection.ICE_GATHERING_TIMEOUT}ms)`);
        
        this.timeoutManager.startTimer(Peer2PeerConnection.TIMEOUT_ICE_GATHERING, Peer2PeerConnection.ICE_GATHERING_TIMEOUT, () => {
            this.handleIceGatheringTimeout();
        });
    }
    
    /**
     * Handle ICE_GATHERING_TIMEOUT expiry
     */
    private handleIceGatheringTimeout(): void {
        this.logWithPrefix('⏱️ ICE gathering timeout expired');
        
        this.lastError = 'ICE gathering timeout expired';
        this.isOfferSent = false;
        this.cancelAllTimeouts();
        this.transitionTo(SdpExchangeState.FAILED);
        
        this.events.onFailure?.('ICE gathering timeout - connection failed');
    }
    
    /**
     * Start DATACHANNEL_OPEN_TIMEOUT
     */
    private startDataChannelOpenTimeout(): void {
        if (!this.timeoutManager) {
            this.logWithPrefix('⚠️ TimeoutManager not configured - cannot start DataChannel open timeout');
            return;
        }
        
        this.logWithPrefix(`⏱️ Starting ${Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN} (${Peer2PeerConnection.DATACHANNEL_OPEN_TIMEOUT}ms)`);
        
        this.timeoutManager.startTimer(Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN, Peer2PeerConnection.DATACHANNEL_OPEN_TIMEOUT, () => {
            this.handleDataChannelOpenTimeout();
        });
    }
    
    /**
     * Handle DATACHANNEL_OPEN_TIMEOUT expiry
     */
    private handleDataChannelOpenTimeout(): void {
        // State guard: only process if still in ANSWER_RECEIVED state
        if (this.sdpExchangeState !== SdpExchangeState.ANSWER_RECEIVED) {
            this.logWithPrefix(`⏱️ ${Peer2PeerConnection.TIMEOUT_DATACHANNEL_OPEN} fired but state is ${this.sdpExchangeState} - ignoring`);
            return;
        }
        
        this.logWithPrefix('⏱️ DataChannel opening timeout expired');
        
        this.lastError = 'DataChannel did not open within timeout';
        this.isOfferSent = false;
        this.answerReceived = false;
        this.cancelAllTimeouts();
        this.transitionTo(SdpExchangeState.FAILED);
        
        this.events.onFailure?.('DataChannel opening timeout - connection failed');
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
    
    /**
     * Generate SIP branch parameter
     */
    private static generateConnectionByeBranch(): string {
        return 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
    }
    
    /**
     * Create CONNECTION BYE message using saved offer parameters
     * @param reason - Reason for sending BYE
     * @returns Formatted CONNECTION BYE message or null if parameters not available
     */
    createConnectionBye(reason: string): string | null {
        if (!this.lastOfferParams) {
            this.logWithPrefix('⚠️ Cannot create CONNECTION BYE - offer parameters not saved');
            return null;
        }
        
        const { sipUri, tag, callId } = this.lastOfferParams;
        
        return MessageFactory.createByeMessage({
            sipUri: sipUri,
            branch: Peer2PeerConnection.generateConnectionByeBranch(),
            callId: callId,
            tag: tag,
            cseq: Peer2PeerConnection.CSEQ_CONNECTION_BYE,
            toDisplayName: 'macs',
            fromDisplayName: 'macc',
            reasonType: 'CONNECTION',
            reasonText: reason
        });
    }
}
