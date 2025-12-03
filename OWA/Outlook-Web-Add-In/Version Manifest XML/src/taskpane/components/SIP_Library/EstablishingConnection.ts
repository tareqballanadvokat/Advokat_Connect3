/**
 * SIP Connection Establishment Handler
 * 
 * This class manages the connection establishment phase that occurs after successful SIP registration.
 * It handles the negotiation process to determine which peer will create the WebRTC offer and which
 * will create the answer for peer-to-peer communication setup.
 * 
 * The connection establishment process involves:
 * 1. Receiving NOTIFY (CSeq: 4) - Connection phase starts, ConnectionTimeout begins
 * 2. Sending ACK (CSeq: 5) - Acknowledge NOTIFY4
 * 3. Receiving NOTIFY (CSeq: 6) - Connection establishment complete
 * 4. Coordinating with PeerRegistrationTimeout (running from Registration phase)
 * 
 * Key Features:
 * - Manages connection type negotiation (OFFER vs ANSWER)
 * - Dual timeout management (ConnectionTimeout + PeerRegistrationTimeout)
 * - CONNECTION BYE support for error recovery
 * - State machine for tracking connection progress
 * - Coordinates with WebRTC peer connection setup
 * 
 * @author AdvokatConnect Development Team
 * @version 2.0.0
 */

import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';
import { MessageFactory } from './MessageFactory';

/**
 * Connection Establishment state machine enum
 * Tracks the current state of the connection establishment process
 */
export enum ConnectionState {
    WAITING_NOTIFY_4 = "WAITING_NOTIFY_4",      // Waiting for NOTIFY4 (PeerRegistrationTimeout active)
    NOTIFY_4_RECEIVED = "NOTIFY_4_RECEIVED",    // NOTIFY4 received, preparing ACK5
    WAITING_NOTIFY_6 = "WAITING_NOTIFY_6",      // ACK5 sent, waiting for NOTIFY6 (both timeouts active)
    COMPLETE = "COMPLETE",                      // Connection establishment complete
    FAILED = "FAILED",                          // Connection failed
    TERMINATING = "TERMINATING"                 // Graceful termination in progress
}

export class EstablishingConnection {
    public sipUri = "sip:macc@127.0.0.1:8009";
    public tag = Math.random().toString(36).substring(2, 12);
    private callId = Math.random().toString(36).substring(2, 12);
    private cseq = 1;
    public isEstablishingConnectionProcessFinished = false;
    private branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
    private fromDisplayName = "macc";
    private toDisplayName = "macs";
    
    // State machine and timeout management
    private connectionState: ConnectionState = ConnectionState.WAITING_NOTIFY_4;
    private timeoutManager: TimeoutManager;
    private connectionTimeout: number = 3000;  // Default 3s, updated from Registration
    private lastError: string = "";
    
    // Callback for querying PeerRegistrationTimeout remaining time (from SipClient)
    public getPeerRegistrationTimeRemaining: (() => number) | null = null;
    
    // Callback for sending messages when timeout occurs (from SipClient)
    public onSendMessage: ((message: string) => void) | null = null;
    
    constructor(timeoutManager: TimeoutManager) {
        this.timeoutManager = timeoutManager;
    }
    
    /**
     * Updates connection parameters from registration data
     * Receives tag, callId, branch from successful registration
     * Also receives updated ConnectionTimeout value from server
     * 
     * @param tag - SIP tag from registration
     * @param callId - Call ID from registration
     * @param branch - Branch parameter from registration
     * @param fromDisplay - From display name
     * @param toDisplay - To display name
     * @param connectionTimeout - ConnectionTimeout value from server (optional, defaults to 3000ms)
     */
    updateData(tag: string, callId: string, branch: string, fromDisplay: string, toDisplay: string, connectionTimeout?: number): void {
        this.tag = tag;
        this.callId = callId;
        this.branch = branch;
        this.fromDisplayName = fromDisplay;
        this.toDisplayName = toDisplay;
        
        if (connectionTimeout !== undefined) {
            this.connectionTimeout = connectionTimeout;
            logger.log(`EstablishingConnection: Updated ConnectionTimeout to ${connectionTimeout}ms`);
        }
        
        logger.log(`EstablishingConnection: Updated data - Tag: ${tag}, CallId: ${callId}, Branch: ${branch}`);
    }
    
    /**
     * Parses incoming SIP messages and determines appropriate response during connection establishment
     * Routes messages to specific handlers based on message type and current state
     * Manages ConnectionTimeout lifecycle and coordinates with PeerRegistrationTimeout
     * 
     * NOTE: NOTIFY messages use NEW Call-ID and tags for the SIP tunnel between clients.
     * These are DIFFERENT from the registration session IDs. No session validation needed here.
     * 
     * @param data - The SIP message data to parse
     * @returns The appropriate response message or undefined
     */
    parseMessage(data: string): string | undefined {
        logger.log(`EstablishingConnection: Parsing message in state ${this.connectionState}`);
        
        // Handle NOTIFY (initial connection establishment)
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            return this.handleNotify(data);
        }
        
        // Handle ACK (response to our NOTIFY acknowledgment)
        if (/^ACK\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            return this.handleAck(data);
        }
        
        // Handle CONNECTION BYE from server or peer
        if (/^BYE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) && /Reason:\s*CONNECTION/.test(data)) {
            return this.handleConnectionBye(data);
        }
        
        // Handle error responses (4xx, 5xx)
        if (/^SIP\/2\.0\s+[45]\d{2}/.test(data)) {
            return this.handleErrorResponse(data);
        }
        
        return undefined;
    }
    
    /**
     * Handle NOTIFY messages during connection establishment
     * Determines CSeq to route to NOTIFY4 or NOTIFY6 handler
     * 
     * @param data - NOTIFY message
     * @returns ACK response or undefined
     */
    private handleNotify(data: string): string | undefined {
        // Check CSeq to determine which NOTIFY this is
        const cseqMatch = data.match(/CSeq:\s*(\d+)/);
        const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
        
        if (cseq === 4) {
            return this.handleNotify4(data);
        } else if (cseq === 6) {
            return this.handleNotify6(data);
        }
        
        logger.log(`EstablishingConnection: Unexpected NOTIFY CSeq: ${cseq}`);
        return undefined;
    }
    
    /**
     * Handle NOTIFY (CSeq: 4) - Connection establishment phase starts
     * Starts ConnectionTimeout, keeps PeerRegistrationTimeout running
     * Transitions to NOTIFY_4_RECEIVED state
     * 
     * @param data - NOTIFY message
     * @returns ACK message with IsOffering role
     */
    private handleNotify4(data: string): string | undefined {
        logger.log("🔔 [CONNECTION] ===============================================");
        logger.log("🔔 [CONNECTION] NOTIFY4 RECEIVED - Connection phase starting");
        logger.log("🔔 [CONNECTION] ===============================================");
        
        // Check PeerRegistrationTimeout status BEFORE starting ConnectionTimeout
        const peerTimeRemaining = this.getPeerRegistrationTimeRemaining?.() ?? 0;
        logger.log(`⏱️ [CONNECTION] PeerRegistrationTimeout status: ${peerTimeRemaining}ms remaining`);
        
        // Start ConnectionTimeout (PeerRegistrationTimeout still running)
        this.timeoutManager.startTimer(
            'CONNECTION_TIMEOUT',
            this.connectionTimeout,
            () => this.handleConnectionTimeout()
        );
        logger.log(`⏱️ [CONNECTION] Started ConnectionTimeout (${this.connectionTimeout}ms)`);
        logger.log(`⏱️ [CONNECTION] Both timeouts now active: ConnectionTimeout + PeerRegistrationTimeout`);
        
        this.connectionState = ConnectionState.NOTIFY_4_RECEIVED;
        
        return this.createAck5ForNotify4(data);
    }
    
    /**
     * Creates ACK (CSeq: 5) in response to NOTIFY4
     * Simple acknowledgment without offering negotiation
     * 
     * @param data - The NOTIFY4 message
     * @returns ACK message with CSeq 5
     */
    private createAck5ForNotify4(data: string): string {
        logger.log('🔨 [CONNECTION] Creating ACK5 for NOTIFY4');
        
        // Extract Call-ID from NOTIFY4
        const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
        const callIdMatch = data.match(reCallId);
        const callId = callIdMatch ? callIdMatch[1] : '';
        
        // Extract To and From lines from NOTIFY4 and swap them for ACK
        const toLineMatch = data.match(/^To:.*$/m);
        const toLine = toLineMatch ? toLineMatch[0] : '';
        const fromLineOrigin = toLine.replace(/^To:/i, 'From:');
        
        const fromLineMatch = data.match(/^From:.*$/m);
        const fromLine = fromLineMatch ? fromLineMatch[0] : '';
        const toLineReplaced = fromLine.replace(/^From:/i, 'To:');
        
        logger.log('📥 [CONNECTION] ACK5 From Line: ' + fromLineOrigin);
        logger.log('📥 [CONNECTION] ACK5 To Line: ' + toLineReplaced);
        
        const ack5 = MessageFactory.createAckMessage({
            sipUri: this.sipUri,
            branch: this.branch,
            callId: callId,
            tag: this.tag,
            cseq: 5,
            toLine: toLineReplaced,
            fromLine: fromLineOrigin
        });
        
        logger.log('📤 [CONNECTION] Created ACK5 for NOTIFY4');
        return ack5;
    }
    
    /**
     * Handle NOTIFY (CSeq: 6) - Connection establishment complete
     * NOTIFY6 marks the end of the connection establishment phase
     * No ACK response is needed - NOTIFY6 is just an end marker
     * Cancels both ConnectionTimeout and PeerRegistrationTimeout
     * Transitions to COMPLETE - ready for WebRTC SDP Exchange
     * 
     * @param _data - NOTIFY message (unused, keeping for signature consistency)
     * @returns undefined (no response needed)
     */
    private handleNotify6(_data: string): undefined {
        logger.log("🏁 [CONNECTION] ===============================================");
        logger.log("🏁 [CONNECTION] NOTIFY6 RECEIVED - Connection establishment phase COMPLETE");
        logger.log("🏁 [CONNECTION] ===============================================");
        
        // Cancel both timeouts - connection establishment complete
        this.timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        this.timeoutManager.cancelTimer('PEER_REGISTRATION_TIMEOUT');
        logger.log("🏁 [CONNECTION] Cancelled ConnectionTimeout and PeerRegistrationTimeout");
        
        this.connectionState = ConnectionState.COMPLETE;
        
        logger.log("🏁 [CONNECTION] Connection establishment COMPLETE - Ready for WebRTC SDP Exchange");
        logger.log("🏁 [CONNECTION] OWA will create SDP Offer immediately (SERVICE CSeq: 1)");
        return undefined;
    }
    
    /**
     * Handle ACK received after we send response
     * Transitions directly to WAITING_NOTIFY_6 state
     * 
     * @param _data - ACK message (unused, keeping for signature consistency)
     * @returns undefined
     */
    private handleAck(_data: string): undefined {
        logger.log("EstablishingConnection: Handling ACK");
        
        if (this.connectionState === ConnectionState.NOTIFY_4_RECEIVED) {
            this.connectionState = ConnectionState.WAITING_NOTIFY_6;
            logger.log("EstablishingConnection: Transitioned to WAITING_NOTIFY_6");
        }
        
        return undefined;
    }
    
    /**
     * Handle ConnectionTimeout expiry
     * Means ACK was not received by server - send CONNECTION BYE and reset
     * Checks PeerRegistrationTimeout remaining time to decide retry strategy:
     * - If peer timeout has time remaining: reset to WAITING_NOTIFY_4 for retry
     * - If peer timeout exhausted: mark as FAILED (SipClient will restart registration)
     */
    private handleConnectionTimeout(): void {
        logger.log("⏰ [CONNECTION] ===============================================");
        logger.log("⏰ [CONNECTION] ConnectionTimeout EXPIRED - ACK not received by server");
        logger.log("⏰ [CONNECTION] ===============================================");
        
        // Check PeerRegistrationTimeout remaining time
        const peerTimeRemaining = this.getPeerRegistrationTimeRemaining?.() ?? 0;
        logger.log(`⏱️ [CONNECTION] Checking PeerRegistrationTimeout status...`);
        logger.log(`⏱️ [CONNECTION] PeerRegistrationTimeout has ${peerTimeRemaining}ms remaining`);
        
        // Cancel ConnectionTimeout (will restart when NOTIFY4 arrives)
        this.timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        
        let byeMessage: string;
        
        if (peerTimeRemaining > 0) {
            // Enough time for connection retry - reset to wait for NOTIFY4
            logger.log("✅ [CONNECTION] Sufficient time for connection retry - resetting to WAITING_NOTIFY_4");
            this.connectionState = ConnectionState.WAITING_NOTIFY_4;
            this.lastError = "ConnectionTimeout expired - ACK not received, waiting for retry";
            
            byeMessage = this.createConnectionBye(this.cseq++, "ConnectionTimeout expired - ACK not received");
        } else {
            // Must restart from registration
            logger.log("❌ [CONNECTION] PeerRegistrationTimeout exhausted - must restart registration");
            this.connectionState = ConnectionState.FAILED;
            this.lastError = "Both ConnectionTimeout and PeerRegistrationTimeout expired - restart registration";
            
            byeMessage = this.createConnectionBye(this.cseq++, "Both timeouts expired");
        }
        
        // Send CONNECTION BYE via callback
        if (this.onSendMessage) {
            this.onSendMessage(byeMessage);
        }
    }
    
    /**
     * Handle error responses (4xx, 5xx status codes)
     * Retryable errors (408, 500, 503, 504) trigger CONNECTION BYE
     * 
     * @param data - Error response message
     * @returns CONNECTION BYE message for retryable errors, undefined otherwise
     */
    private handleErrorResponse(data: string): string | undefined {
        const statusCodeMatch = data.match(/^SIP\/2\.0\s+(\d{3})/);
        const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1]) : 0;
        
        logger.log(`EstablishingConnection: Received error response: ${statusCode}`);
        
        // Retryable errors: 408, 500, 503, 504
        const retryableErrors = [408, 500, 503, 504];
        
        if (retryableErrors.includes(statusCode)) {
            this.lastError = `Received retryable error ${statusCode}`;
            this.connectionState = ConnectionState.FAILED;
            
            // Cancel active timers
            this.timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
            
            return this.createConnectionBye(this.cseq++, `Error ${statusCode}`);
        }
        
        // Non-retryable errors
        this.lastError = `Received non-retryable error ${statusCode}`;
        this.connectionState = ConnectionState.FAILED;
        this.timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        
        return undefined;
    }
    
    /**
     * Handle incoming CONNECTION BYE message
     * According to protocol: respond with CONNECTION BYE (not OK)
     * Resets ConnectionTimeout and waits for NOTIFY4 if PeerRegistrationTimeout has time remaining
     * 
     * @param _data - BYE message (unused, keeping for signature consistency)
     * @returns CONNECTION BYE response
     */
    private handleConnectionBye(_data: string): string {
        logger.log("EstablishingConnection: Received CONNECTION BYE from server/peer");
        
        // Cancel ConnectionTimeout (will restart when NOTIFY4 arrives)
        this.timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        logger.log("EstablishingConnection: Cancelled ConnectionTimeout");
        
        // Check PeerRegistrationTimeout remaining time
        const peerTimeRemaining = this.getPeerRegistrationTimeRemaining?.() ?? 0;
        logger.log(`EstablishingConnection: PeerRegistrationTimeout has ${peerTimeRemaining}ms remaining`);
        
        if (peerTimeRemaining > 0) {
            // Enough time - reset to wait for NOTIFY4 again
            logger.log("EstablishingConnection: Sufficient time - resetting to WAITING_NOTIFY_4");
            this.connectionState = ConnectionState.WAITING_NOTIFY_4;
            this.lastError = "Received CONNECTION BYE - ACK not received by server, waiting for retry";
        } else {
            // No time left - mark as failed (SipClient will handle registration restart)
            logger.log("EstablishingConnection: PeerRegistrationTimeout exhausted - marking as FAILED");
            this.connectionState = ConnectionState.FAILED;
            this.lastError = "Received CONNECTION BYE with PeerRegistrationTimeout exhausted";
        }
        
        // Respond with CONNECTION BYE (per protocol requirement)
        return this.createConnectionBye(this.cseq++, "ACK not received");
    }
    
    /**
     * Create CONNECTION BYE message to signal connection phase termination
     * Used for timeouts, errors, or graceful shutdown
     * 
     * @param cseqNum - CSeq number for the BYE message
     * @param reason - Reason for sending BYE (optional)
     * @returns CONNECTION BYE message
     */
    public createConnectionBye(cseqNum: number, reason?: string): string {
        const byeMessage = MessageFactory.createByeMessage({
            sipUri: this.sipUri,
            branch: this.branch,
            callId: this.callId,
            tag: this.tag,
            cseq: cseqNum,
            toDisplayName: this.toDisplayName,
            fromDisplayName: this.fromDisplayName,
            reasonType: 'CONNECTION',
            reasonText: reason
        });
        
        logger.log(`EstablishingConnection: Created CONNECTION BYE - ${reason || 'no reason specified'}`);
        return byeMessage;
    }
    
    /**
     * Terminate connection establishment gracefully
     * Sends CONNECTION BYE, cancels all timers, and transitions to TERMINATING state
     * 
     * @returns CONNECTION BYE message to send to server
     */
    public terminate(): string {
        logger.log("EstablishingConnection: Graceful termination initiated");
        
        // Cancel all active timers
        this.timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        
        this.connectionState = ConnectionState.TERMINATING;
        
        return this.createConnectionBye(this.cseq++, "Graceful termination");
    }
    
    /**
     * Get current connection state
     * 
     * @returns Current ConnectionState
     */
    public getState(): ConnectionState {
        return this.connectionState;
    }
    
    /**
     * Get last error message
     * 
     * @returns Last error string
     */
    public getLastError(): string {
        return this.lastError;
    }
    
    /**
     * Reset connection state for retry
     * Generates new session identifiers and resets state to WAITING_NOTIFY_4
     */
    public reset(): void {
        logger.log("EstablishingConnection: Resetting for retry");
        
        // Cancel any active timers
        this.timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        
        // Generate new session identifiers
        this.tag = Math.random().toString(36).substring(2, 12);
        this.callId = Math.random().toString(36).substring(2, 12);
        this.branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
        this.cseq = 1;
        
        // Reset state
        this.connectionState = ConnectionState.WAITING_NOTIFY_4;
        this.isEstablishingConnectionProcessFinished = false;
        this.lastError = "";
        
        logger.log("EstablishingConnection: Reset complete - ready for new connection attempt");
    }
}
