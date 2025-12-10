/**
 * WebRTC Peer-to-Peer Connection Handler
 * 
 * This class manages the WebRTC peer-to-peer connection establishment and data exchange
 * between SIP clients. It handles the complete WebRTC negotiation process including
 * SDP (Session Description Protocol) offer/answer exchange and ICE candidate gathering.
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

type MessageHandler = (event: MessageEvent) => Promise<void> | void;

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
    private static readonly TIMEOUT_NAME = 'RECEIVE_TIMEOUT';
    private static readonly DEFAULT_RECEIVE_TIMEOUT = 1000;
    private static readonly MAX_RETRIES = 3;
    
    private static readonly REGEX_SERVICE_ANSWER = /^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/;
    private static readonly REGEX_CSEQ_ANSWER = /CSeq:\s*2 SERVICE/;
    private static readonly REGEX_SDP_BLOCK = /(\{[\s\S]*?"sdp"[\s\S]*?\})/m;
    
    private pc = new RTCPeerConnection();
    private dataChannelPeer: RTCDataChannel | undefined = undefined;
    public isOfferSent = false;
    private messageHandlers: MessageHandler[] = [];
    private sdpExchangeState: SdpExchangeState = SdpExchangeState.IDLE;
    private retryCount: number = 0;
    private lastError: string = "";
    private timeoutManager: TimeoutManager | null = null;
    private receiveTimeout: number = Peer2PeerConnection.DEFAULT_RECEIVE_TIMEOUT;
    private lastOfferParams: {
        socket: WebSocket;
        callId: string;
        sipUri: string;
        tag: string;
        toLine: string;
    } | null = null;
    
    public onSendConnectionBye: ((message: string) => void) | null = null;
    
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
     * Transition to new SDP exchange state with logging
     */
    private transitionTo(newState: SdpExchangeState): void {
        const oldState = this.sdpExchangeState;
        this.sdpExchangeState = newState;
        this.logWithPrefix(`State transition: ${oldState} → ${newState}`);
    }
    
    /**
     * Cancel RECEIVE_TIMEOUT if active
     */
    private cancelReceiveTimeout(): void {
        if (this.timeoutManager && this.timeoutManager.isTimerActive(Peer2PeerConnection.TIMEOUT_NAME)) {
            this.timeoutManager.cancelTimer(Peer2PeerConnection.TIMEOUT_NAME);
            this.logWithPrefix(`⏱️ Cancelled ${Peer2PeerConnection.TIMEOUT_NAME}`);
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
    private setupICEHandlers(socket: WebSocket, callId: string, sipUri: string, tag: string, toLine: string): void {
        this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                this.logWithPrefix('📤 ICE candidate (offer): ' + JSON.stringify(evt.candidate));
            }
        };
        
        this.pc.onicegatheringstatechange = () => {
            if (this.pc.iceGatheringState === 'complete') {
                this.logWithPrefix('✅ ICE gathering complete (offer)');
                const offerSDP = JSON.stringify(this.pc.localDescription);
                const branch = Peer2PeerConnection.generateBranch();
                const offerMsg = this.createSdpOfferMessage(offerSDP, callId, sipUri, tag, toLine, branch);
                
                if (socket && socket.readyState === WebSocket.OPEN) {
                    this.logWithPrefix('📤 Sending SDP Offer via WebSocket');
                    socket.send(offerMsg);
                    this.logWithPrefix('✅ SDP Offer sent successfully');
                    this.startReceiveTimeout();
                } else {
                    this.logWithPrefix('❌ WebSocket is not available or not open - cannot send offer');
                    this.lastError = 'WebSocket not available';
                    this.transitionTo(SdpExchangeState.FAILED);
                }
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
        this.retryCount = 0;
        this.lastError = "";
        this.lastOfferParams = null;
        
        this.cancelReceiveTimeout();
        this.resetPeerConnection();
        
        this.logWithPrefix('Reset complete');
    }
    


    /**
     * Creates and sends WebRTC offer for establishing peer-to-peer connection
     * Implements retry logic with RECEIVE_TIMEOUT
     * @param socket - WebSocket connection for sending offer
     * @param callId - SIP Call-ID
     * @param sipUri - SIP URI for this peer
     * @param tag - SIP tag
     * @param toLine - Formatted To header line
     */
    async createAndSendOffer(socket: WebSocket, callId: string, sipUri: string, tag: string, toLine: string): Promise<void> {
        this.lastOfferParams = { socket, callId, sipUri, tag, toLine };
        
        this.logWithPrefix(`Creating SDP Offer (attempt ${this.retryCount + 1}/${Peer2PeerConnection.MAX_RETRIES})`);
        
        this.isOfferSent = true;
        this.transitionTo(SdpExchangeState.OFFER_SENT);
        
        this.dataChannelPeer = this.pc.createDataChannel(Peer2PeerConnection.DATA_CHANNEL_LABEL);
        this.dataChannelPeer.onopen = () => {
            this.logWithPrefix('🟢 DataChannel OFFER opened');
            if (this.dataChannelPeer) {
                this.dataChannelPeer.send('Hello from OFFER side');
            }
        };
        
        this.dataChannelPeer.onmessage = (event) => {
            const text = new TextDecoder('utf-8').decode(event.data);
            this.logWithPrefix('📨 Received on offer channel: ' + text);
        };
        
        this.dataChannelPeer.onerror = (err) => {
            this.logWithPrefix('❌ Offer DataChannel error: ' + err);
        };
        
        this.pc.ondatachannel = (ev) => {
            this.logWithPrefix('📥 DataChannel found: ' + ev.channel.label);
            this.setupDataChannelHandlers(ev.channel);
        };
        
        this.setupICEHandlers(socket, callId, sipUri, tag, toLine);
        
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        
        this.logWithPrefix('📤 SDP Offer created: ' + JSON.stringify(offer));
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
        if (Peer2PeerConnection.REGEX_SERVICE_ANSWER.test(data) && Peer2PeerConnection.REGEX_CSEQ_ANSWER.test(data)) {
            this.cancelReceiveTimeout();
            this.logWithPrefix('⏱️ Answer received');
            
            const sdpBlockMatch = data.match(Peer2PeerConnection.REGEX_SDP_BLOCK);
            if (sdpBlockMatch) {
                try {
                    const sdpBlock = sdpBlockMatch[1];
                    const sdpObj = JSON.parse(sdpBlock);
                    await this.pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
                    this.logWithPrefix('✅ Remote SDP Answer set successfully');
                    
                    this.transitionTo(SdpExchangeState.ANSWER_RECEIVED);
                    this.retryCount = 0;
                } catch (err) {
                    this.logWithPrefix('❌ SDP or WebRTC error: ' + err);
                    this.lastError = `SDP error: ${err}`;
                    this.transitionTo(SdpExchangeState.FAILED);
                }
            } else {
                this.logWithPrefix('⚠️ SDP block not found in SERVICE answer');
                this.lastError = 'SDP block not found in answer';
                this.transitionTo(SdpExchangeState.FAILED);
            }
        }
    }
    
    /**
     * Start RECEIVE_TIMEOUT waiting for SDP answer
     */
    private startReceiveTimeout(): void {
        if (!this.timeoutManager) {
            this.logWithPrefix(`⚠️ TimeoutManager not configured - cannot start ${Peer2PeerConnection.TIMEOUT_NAME}`);
            return;
        }
        
        this.logWithPrefix(`⏱️ Starting ${Peer2PeerConnection.TIMEOUT_NAME} (${this.receiveTimeout}ms) waiting for SDP answer`);
        
        this.timeoutManager.startTimer(Peer2PeerConnection.TIMEOUT_NAME, this.receiveTimeout, () => {
            this.handleReceiveTimeout();
        });
    }
    
    /**
     * Handle RECEIVE_TIMEOUT expiry (no answer received)
     * Retry up to MAX_RETRIES times, then fail
     */
    private async handleReceiveTimeout(): Promise<void> {
        this.logWithPrefix(`⏱️ ${Peer2PeerConnection.TIMEOUT_NAME} expired - no answer received (attempt ${this.retryCount + 1}/${Peer2PeerConnection.MAX_RETRIES})`);
        
        this.retryCount++;
        
        if (this.retryCount < Peer2PeerConnection.MAX_RETRIES && this.lastOfferParams) {
            this.logWithPrefix(`🔄 Retrying SDP offer (attempt ${this.retryCount + 1}/${Peer2PeerConnection.MAX_RETRIES})`);
            
            this.resetPeerConnection();
            
            const { socket, callId, sipUri, tag, toLine } = this.lastOfferParams;
            await this.createAndSendOffer(socket, callId, sipUri, tag, toLine);
        } else {
            this.logWithPrefix(`❌ Max retries (${Peer2PeerConnection.MAX_RETRIES}) reached - SDP exchange failed`);
            this.lastError = `No answer received after ${Peer2PeerConnection.MAX_RETRIES} attempts`;
            this.transitionTo(SdpExchangeState.FAILED);
            
            this.sendConnectionBye('SDP exchange failed - no answer received');
        }
    }
    
    /**
     * Create and send CONNECTION BYE message
     * @param reason - Reason for sending BYE
     */
    private sendConnectionBye(reason: string): void {
        this.logWithPrefix(`📤 Sending CONNECTION BYE: ${reason}`);
        
        if (this.onSendConnectionBye && this.lastOfferParams) {
            const { sipUri, tag, callId } = this.lastOfferParams;
            const byeMessage = this.createConnectionBye(sipUri, tag, callId, Peer2PeerConnection.CSEQ_CONNECTION_BYE, reason);
            this.onSendConnectionBye(byeMessage);
        } else {
            this.logWithPrefix('⚠️ Cannot send CONNECTION BYE - callback not configured');
        }
    }
    
    /**
     * Create CONNECTION BYE message
     * @param sipUri - SIP URI
     * @param tag - SIP tag
     * @param callId - Call ID
     * @param cseq - CSeq number
     * @param reason - Reason for BYE
     * @returns Formatted CONNECTION BYE message
     */
    private createConnectionBye(sipUri: string, tag: string, callId: string, cseq: number, reason: string): string {
        return MessageFactory.createByeMessage({
            sipUri: sipUri,
            branch: Peer2PeerConnection.generateBranch(),
            callId: callId,
            tag: tag,
            cseq: cseq,
            toDisplayName: 'macs',
            fromDisplayName: 'macc',
            reasonType: 'CONNECTION',
            reasonText: reason
        });
    }
    
    /**
     * Returns the active data channel for sending messages
     * @returns The active RTCDataChannel or undefined if not established
     */
    getActiveDataChannel(): RTCDataChannel | undefined {
        return this.dataChannelPeer;
    }
}
