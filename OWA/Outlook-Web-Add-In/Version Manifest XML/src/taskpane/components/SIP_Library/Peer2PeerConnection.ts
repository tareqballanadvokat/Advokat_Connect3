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
 * OWA OFFERER Process:
 * 1. OWA creates WebRTC peer connection and data channel
 * 2. OWA creates and sends SDP offer (SERVICE CSeq: 1)
 * 3. OWA waits for and processes SDP answer (SERVICE CSeq: 2) from server
 * 4. WebRTC connection establishes and data channel opens
 * 5. Bidirectional data channel communication begins
 * 
 * Key Features:
 * - WebRTC peer connection management (OFFERER role only)
 * - SDP offer creation and transmission
 * - SDP answer processing
 * - Data channel creation and message handling
 * - ICE candidate gathering and state management
 * - Bidirectional data channel communication
 * 
 * @author AdvokatConnect Development Team
 * @version 2.0.0
 */

import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';

// Type for message handler functions
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

// Message handler for incoming WebRTC DataChannel messages
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
    // WebRTC peer connection that handles media/data exchange
    private pc = new RTCPeerConnection();
    // The DataChannel for sending messages directly between peers
    private dataChannelPeer: RTCDataChannel | undefined = undefined;
    public isOfferSent = false;
    
    // Array of message handlers that will be called for each incoming message
    private messageHandlers: MessageHandler[] = [];
    
    // State machine and retry logic
    private sdpExchangeState: SdpExchangeState = SdpExchangeState.IDLE;
    private retryCount: number = 0;
    private readonly MAX_RETRIES = 3;
    private lastError: string = "";
    
    // Timeout management
    private timeoutManager: TimeoutManager | null = null;
    private receiveTimeout: number = 1000;  // Default 1s, will be updated from Registration
    
    // Stored offer parameters for retries
    private lastOfferParams: {
        socket: WebSocket;
        callId: string;
        sipUri: string;
        tag: string;
        toLine: string;
    } | null = null;
    
    // Callback for sending CONNECTION BYE
    public onSendConnectionBye: ((message: string) => void) | null = null;
    
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
        // First call the default writeMessage handler
        await writeMessage(event);
        
        // Then call all registered handlers
        for (const handler of this.messageHandlers) {
            try {
                await handler(event);
            } catch (error) {
                logger.log('❌ [PEER2PEER] Error in message handler: ' + error);
            }
        }
    }
    
    /**
     * Update timeout manager and receive timeout value
     * Called from SipClient after registration completes
     */
    updateConfiguration(timeoutManager: TimeoutManager, receiveTimeout: number): void {
        this.timeoutManager = timeoutManager;
        this.receiveTimeout = receiveTimeout;
        logger.log(`[PEER2PEER] Updated configuration - ReceiveTimeout: ${receiveTimeout}ms`);
    }
    
    /**
     * Get current SDP exchange state
     */
    getState(): SdpExchangeState {
        return this.sdpExchangeState;
    }
    
    /**
     * Get last error message
     */
    getLastError(): string {
        return this.lastError;
    }
    
    /**
     * Reset for new attempt
     */
    reset(): void {
        this.sdpExchangeState = SdpExchangeState.IDLE;
        this.isOfferSent = false;
        this.retryCount = 0;
        this.lastError = "";
        this.lastOfferParams = null;
        
        // Cancel any active timeouts
        if (this.timeoutManager) {
            this.timeoutManager.cancelTimer('RECEIVE_TIMEOUT');
        }
        
        // Close existing peer connection and create new one
        if (this.pc) {
            this.pc.close();
        }
        this.pc = new RTCPeerConnection();
        this.dataChannelPeer = undefined;
        
        logger.log('[PEER2PEER] Reset complete');
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
        // Store parameters for potential retries
        this.lastOfferParams = { socket, callId, sipUri, tag, toLine };
        
        logger.log(`[PEER2PEER] Creating SDP Offer (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})`);
        
        this.isOfferSent = true;
        this.sdpExchangeState = SdpExchangeState.OFFER_SENT;
        const branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
        
        // Create offer data channel
        this.dataChannelPeer = this.pc.createDataChannel("offer");
        this.dataChannelPeer.onopen = () => {
            logger.log("🟢 [PEER2PEER] DataChannel OFFER opened");
            if (this.dataChannelPeer) {
                this.dataChannelPeer.send("Hello from OFFER side");
            }
        };
        
        this.dataChannelPeer.onmessage = (event) => {
            const text = new TextDecoder("utf-8").decode(event.data);
            logger.log("📨 [PEER2PEER] Received on offer channel: " + text);
        };
        
        this.dataChannelPeer.onerror = (err) => {
            logger.log("❌ [PEER2PEER] Offer DataChannel error: " + err);
        };
        
        // Set up data channel event handlers
        this.pc.ondatachannel = (ev) => {
            logger.log("📥 [PEER2PEER] DataChannel found: " + ev.channel.label);
            
            ev.channel.onopen = () => {
                logger.log("🟢 [PEER2PEER] DataChannel opened: " + ev.channel.label);
            };
            
            ev.channel.onmessage = (event) => this.dispatchMessage(event);
            
            ev.channel.onclose = () => {
                logger.log("🔴 [PEER2PEER] DataChannel closed");
            };
            
            ev.channel.onerror = (err) => {
                logger.log("❌ [PEER2PEER] DataChannel error: " + err);
            };
        };
        
        // Handle ICE candidates
        this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                logger.log("📤 [PEER2PEER] ICE candidate (offer): " + JSON.stringify(evt.candidate));
            }
        };
        
        // Handle ICE gathering completion
        this.pc.onicegatheringstatechange = () => {
            if (this.pc.iceGatheringState === 'complete') {
                logger.log("✅ [PEER2PEER] ICE gathering complete (offer)");
                const offerSDP = JSON.stringify(this.pc.localDescription);
                const offerMsg = this.sendSdpOffer(offerSDP, callId, sipUri, tag, toLine, branch);
                if (socket && socket.readyState === WebSocket.OPEN) {
                    logger.log('📤 [PEER2PEER] Sending SDP Offer via WebSocket');
                    socket.send(offerMsg);
                    logger.log('✅ [PEER2PEER] SDP Offer sent successfully');
                    
                    // Start RECEIVE_TIMEOUT waiting for answer
                    this.startReceiveTimeout();
                } else {
                    logger.log("❌ [PEER2PEER] WebSocket is not available or not open - cannot send offer");
                    this.lastError = "WebSocket not available";
                    this.sdpExchangeState = SdpExchangeState.FAILED;
                }
            }
        };
        
        // Create and set local offer
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        
        logger.log("📤 [PEER2PEER] SDP Offer created: " + JSON.stringify(offer));
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
    sendSdpOffer(offerSDP: string, callId: string, sipUri: string, tag: string, toLine: string, branch: string): string {
        const length = logger.contentLength(offerSDP);
        
        return (
            'SERVICE ' + sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branch + '\r\n' +
            'Max-Forwards: 70\r\n' +
            toLine + '\r\n' +
            'From: "macc" <' + sipUri + ';transport=wss>;tag=' + tag + '\r\n' +
            'Call-ID: ' + callId + '\r\n' +
            'CSeq: 1 SERVICE\r\n' +
            'Expires: 300\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
            'Supported: path,gruu,outbound\r\n' +
            'User-Agent: JsSIP 3.10.0\r\n' +
            'Content-Type: application/sdp\r\n' +
            'Contact: <' + sipUri + '>\r\n' +
            'Content-Length: ' + length + '\r\n\r\n' +
            offerSDP
        );
    }
    
    /**
     * Parses incoming SDP answer and sets it as remote description
     * Cancels RECEIVE_TIMEOUT on success
     * @param data - The SIP message containing SDP answer
     */
    async parseIncomingAnswer(data: string): Promise<void> {
        if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) && /CSeq:\s*2 SERVICE/.test(data)) {
            // Cancel RECEIVE_TIMEOUT - we got the answer
            if (this.timeoutManager) {
                this.timeoutManager.cancelTimer('RECEIVE_TIMEOUT');
                logger.log('⏱️ [PEER2PEER] Cancelled RECEIVE_TIMEOUT - answer received');
            }
            
            const sdpBlockMatch = data.match(/(\{[\s\S]*?"sdp"[\s\S]*?\})/m);
            if (sdpBlockMatch) {
                try {
                    const sdpBlock = sdpBlockMatch[1];
                    const sdpObj = JSON.parse(sdpBlock);
                    await this.pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
                    logger.log("✅ [PEER2PEER] Remote SDP Answer set successfully");
                    
                    this.sdpExchangeState = SdpExchangeState.ANSWER_RECEIVED;
                    this.retryCount = 0;  // Reset retry count on success
                } catch (err) {
                    logger.log("❌ [PEER2PEER] SDP or WebRTC error: " + err);
                    this.lastError = `SDP error: ${err}`;
                    this.sdpExchangeState = SdpExchangeState.FAILED;
                }
            } else {
                logger.log("⚠️ [PEER2PEER] SDP block not found in SERVICE answer");
                this.lastError = "SDP block not found in answer";
                this.sdpExchangeState = SdpExchangeState.FAILED;
            }
        }
    }
    
    /**
     * Start RECEIVE_TIMEOUT waiting for SDP answer
     */
    private startReceiveTimeout(): void {
        if (!this.timeoutManager) {
            logger.log('⚠️ [PEER2PEER] TimeoutManager not configured - cannot start RECEIVE_TIMEOUT');
            return;
        }
        
        logger.log(`⏱️ [PEER2PEER] Starting RECEIVE_TIMEOUT (${this.receiveTimeout}ms) waiting for SDP answer`);
        
        this.timeoutManager.startTimer('RECEIVE_TIMEOUT', this.receiveTimeout, () => {
            this.handleReceiveTimeout();
        });
    }
    
    /**
     * Handle RECEIVE_TIMEOUT expiry (no answer received)
     * Retry up to MAX_RETRIES times, then fail
     */
    private async handleReceiveTimeout(): Promise<void> {
        logger.log(`⏱️ [PEER2PEER] RECEIVE_TIMEOUT expired - no answer received (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})`);
        
        this.retryCount++;
        
        if (this.retryCount < this.MAX_RETRIES && this.lastOfferParams) {
            // Retry: close old peer connection and create new offer
            logger.log(`🔄 [PEER2PEER] Retrying SDP offer (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})`);
            
            // Close existing peer connection
            this.pc.close();
            this.pc = new RTCPeerConnection();
            this.dataChannelPeer = undefined;
            
            // Retry with same parameters
            const { socket, callId, sipUri, tag, toLine } = this.lastOfferParams;
            await this.createAndSendOffer(socket, callId, sipUri, tag, toLine);
        } else {
            // Max retries reached - fail
            logger.log(`❌ [PEER2PEER] Max retries (${this.MAX_RETRIES}) reached - SDP exchange failed`);
            this.lastError = `No answer received after ${this.MAX_RETRIES} attempts`;
            this.sdpExchangeState = SdpExchangeState.FAILED;
            
            // Send CONNECTION BYE
            this.sendConnectionBye("SDP exchange failed - no answer received");
        }
    }
    
    /**
     * Create and send CONNECTION BYE message
     * @param reason - Reason for sending BYE
     */
    private sendConnectionBye(reason: string): void {
        logger.log(`📤 [PEER2PEER] Sending CONNECTION BYE: ${reason}`);
        
        if (this.onSendConnectionBye && this.lastOfferParams) {
            const { sipUri, tag, callId } = this.lastOfferParams;
            const cseq = 7;  // CONNECTION BYE CSeq
            
            const byeMessage = this.createConnectionBye(sipUri, tag, callId, cseq, reason);
            this.onSendConnectionBye(byeMessage);
        } else {
            logger.log('⚠️ [PEER2PEER] Cannot send CONNECTION BYE - callback not configured');
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
        const branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
        const reasonHeader = `Reason: CONNECTION - ${reason}\r\n`;
        
        return `BYE sip:macs@127.0.0.1:8009 SIP/2.0\r\n` +
            `Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=${branch}\r\n` +
            `From: <${sipUri}>;tag=${tag}\r\n` +
            `To: <sip:macs@127.0.0.1:8009>\r\n` +
            `Call-ID: ${callId}\r\n` +
            `CSeq: ${cseq} BYE\r\n` +
            reasonHeader +
            `Content-Length: 0\r\n\r\n`;
    }
    
    /**
     * Returns the active data channel for sending messages
     * @returns The active RTCDataChannel or undefined
     */
    getActiveDataChannel(): RTCDataChannel | undefined {
        return this.dataChannelPeer;
    }
}
