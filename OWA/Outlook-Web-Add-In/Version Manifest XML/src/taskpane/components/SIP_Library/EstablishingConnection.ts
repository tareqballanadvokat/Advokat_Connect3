/**
 * SIP Connection Establishment Handler
 * 
 * This class manages the connection establishment phase that occurs after successful SIP registration.
 * Coordinates dual timeout management (ConnectionTimeout + PeerRegistrationTimeout) and handles
 * the NOTIFY4 → ACK5 → NOTIFY6 sequence to establish peer-to-peer connection readiness.
 * 
 * EVENT-DRIVEN DESIGN:
 * Uses ConnectionEvents callback interface to emit state changes and outcomes.
 * SipClient subscribes to these events to coordinate transition to WebRTC phase.
 * No direct coupling to Redux or external state management.
 * 
 * CONNECTION ESTABLISHMENT FLOW (Success Path):
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ Server sends NOTIFY (CSeq:4) - Connection phase starts            │
 * │   → State: WAITING_NOTIFY_4 → NOTIFY_4_RECEIVED                   │
 * │   → Start CONNECTION_TIMEOUT (default 3000ms)                     │
 * │   → PeerRegistrationTimeout continues running from Registration   │
 * │   → Both timeouts now active simultaneously                       │
 * └────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ Client sends ACK (CSeq:5) - Acknowledge NOTIFY4                   │
 * │   → Extract Call-ID, To/From lines from NOTIFY4                   │
 * │   → Swap To/From for ACK response                                 │
 * │   → State: NOTIFY_4_RECEIVED → WAITING_NOTIFY_6                   │
 * └────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ Server sends NOTIFY (CSeq:6) - Connection establishment complete  │
 * │   → Cancel both CONNECTION_TIMEOUT and PEER_REGISTRATION_TIMEOUT  │
 * │   → State: WAITING_NOTIFY_6 → COMPLETE                            │
 * │   → isConnectionEstablished = true                                │
 * │   → Ready for WebRTC SDP Exchange (SERVICE messages)              │
 * └────────────────────────────────────────────────────────────────────┘
 * 
 * TIMEOUT HANDLING (Failure Recovery):
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ CONNECTION_TIMEOUT Expires (ACK not received by server):          │
 * │   → Check PeerRegistrationTimeout remaining time                  │
 * │   → If time remaining > 0: Reset to WAITING_NOTIFY_4 (retry)      │
 * │   → If time exhausted: Mark as FAILED (restart registration)      │
 * │   → Send CONNECTION BYE (CSeq: incremented)                       │
 * └────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ CONNECTION BYE Received from server/peer:                         │
 * │   → Cancel CONNECTION_TIMEOUT                                     │
 * │   → Check PeerRegistrationTimeout remaining time                  │
 * │   → If time remaining > 0: Reset to WAITING_NOTIFY_4              │
 * │   → If time exhausted: Mark as FAILED                             │
 * │   → Respond with CONNECTION BYE (per protocol)                    │
 * └────────────────────────────────────────────────────────────────────┘
 * 
 * ERROR HANDLING:
 *   • Retryable errors (408, 500, 503, 504): Send CONNECTION BYE, mark FAILED
 *   • Non-retryable errors: Mark FAILED, no BYE sent
 *   • All errors: Cancel CONNECTION_TIMEOUT
 * 
 * DUAL TIMEOUT COORDINATION:
 *   • PeerRegistrationTimeout: Started in Registration phase after ACK_3
 *   • CONNECTION_TIMEOUT: Started when NOTIFY4 received
 *   • Both run simultaneously during connection establishment
 *   • Both cancelled when NOTIFY6 received (success)
 *   • CONNECTION_TIMEOUT cancelled on errors (PeerReg continues)
 * 
 * IMPORTANT: NOTIFY messages use NEW Call-ID and tags (SIP tunnel IDs).
 * These are DIFFERENT from registration session IDs. No session validation needed.
 * 
 * @author AdvokatConnect Development Team
 * @version 2.1.0
 */

import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';
import { MessageFactory } from './MessageFactory';
import { SipPhaseEvents } from './SipClient';

/**
 * Event callbacks for Connection Establishment phase
 * Specialized from generic SipPhaseEvents with ConnectionState and 'CONNECTION_TIMEOUT'
 */
export type ConnectionEvents = SipPhaseEvents<ConnectionState, 'CONNECTION_TIMEOUT'>;

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
    private static readonly REGEX_CALL_ID = /^Call-ID:\s*([^\r\n]+)/m;
    private static readonly REGEX_TO_LINE = /^To:.*$/m;
    private static readonly REGEX_FROM_LINE = /^From:.*$/m;
    private static readonly REGEX_CSEQ = /CSeq:\s*(\d+)/;
    
    private static readonly CSEQ_NOTIFY_4 = 4;
    private static readonly CSEQ_ACK_5 = 5;
    private static readonly CSEQ_NOTIFY_6 = 6;
    
    private static readonly RETRYABLE_ERROR_CODES = [408, 500, 503, 504];
    private static readonly DEFAULT_CONNECTION_TIMEOUT = 3000;
    
    public sipUri = "sip:macc@127.0.0.1:8009";
    public tag = "";
    private callId = "";
    private cseq = 1;
    public isConnectionEstablished = false;
    private branch = "";
    private fromDisplayName = "macc";
    private toDisplayName = "macs";
    
    private connectionState: ConnectionState = ConnectionState.WAITING_NOTIFY_4;
    private timeoutManager: TimeoutManager;
    private connectionTimeout: number = EstablishingConnection.DEFAULT_CONNECTION_TIMEOUT;
    private lastError: string = "";
    
    // Session tracking for connection phase
    private processedCSeqs: Set<number> = new Set(); // Track processed CSeqs to detect duplicates
    
    public lastByeReceived: string | null = null;
    
    // Event callbacks for SipClient observation
    private events: ConnectionEvents;
    
    constructor(timeoutManager: TimeoutManager, events: ConnectionEvents) {
        this.timeoutManager = timeoutManager;
        this.events = events;
        // Session IDs will be set via updateData() from Registration phase
    }
    
    /**
     * Generates new session identifiers (Call-ID, branch, tag) for connection establishment
     */
    private generateSessionIds(): void {
        this.callId = Math.random().toString(36).substring(2, 12);
        this.branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
        this.tag = Math.random().toString(36).substring(2, 12);
    }
    
    /**
     * Centralized state transition helper with automatic logging and event emission
     */
    private transitionTo(newState: ConnectionState, reason?: string): void {
        const oldState = this.connectionState;
        this.connectionState = newState;
        if (reason) {
            logger.log(`📤 [CONNECTION] STATE: ${oldState} -> ${newState} (${reason})`);
        } else {
            logger.log(`📤 [CONNECTION] STATE: ${oldState} -> ${newState}`);
        }
        this.events.onStateChange?.(newState);
    }
    
    /**
     * Cancels CONNECTION_TIMEOUT timer if currently active
     */
    private cancelConnectionTimeout(): void {
        if (this.timeoutManager.isTimerActive('CONNECTION_TIMEOUT')) {
            this.timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        }
    }
    

    
    /**
     * Updates connection parameters from registration data
     * Receives session IDs and timeout configuration from successful registration
     * @param tag - SIP tag from registration
     * @param callId - Call ID from registration
     * @param branch - Branch parameter from registration
     * @param fromDisplay - From display name
     * @param toDisplay - To display name
     * @param connectionTimeout - ConnectionTimeout value from server (optional)
     */
    updateData(tag: string, callId: string, branch: string, fromDisplay: string, toDisplay: string, connectionTimeout?: number): void {
        this.tag = tag;
        this.callId = callId;
        this.branch = branch;
        this.fromDisplayName = fromDisplay;
        this.toDisplayName = toDisplay;
        
        if (connectionTimeout !== undefined) {
            this.connectionTimeout = connectionTimeout;
            logger.log(`[CONNECTION] Updated ConnectionTimeout to ${connectionTimeout}ms`);
        }
        
        logger.log(`[CONNECTION] Updated data - Tag: ${tag}, CallId: ${callId}, Branch: ${branch}`);
    }
    
    /**
     * Central message router - analyzes incoming SIP messages and returns appropriate response
     * Routes to specific handlers based on message type and current state
     * NOTE: NOTIFY messages use NEW Call-ID/tags (SIP tunnel IDs), different from registration session
     * @param data - The SIP message data to parse
     * @returns The appropriate response message or undefined
     */
    parseMessage(data: string): string | undefined {
        logger.log(`📨 [CONNECTION] Parsing message in state ${this.connectionState}`);
        
        // Check for duplicate CSeq (except BYE which may be retransmitted)
        if (!/^BYE/.test(data)) {
            const cseqMatch = data.match(EstablishingConnection.REGEX_CSEQ);
            if (cseqMatch) {
                const cseq = parseInt(cseqMatch[1]);
                if (this.processedCSeqs.has(cseq)) {
                    logger.log(`⚠️ [CONNECTION] Duplicate CSeq ${cseq} detected - handling duplicate`);
                    return this.handleDuplicateMessage(data, cseq);
                }
            }
        }
        
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            return this.handleNotify(data);
        }
        
        if (/^ACK\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            return this.handleAck(data);
        }
        
        if (/^BYE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) && /Reason:\s*CONNECTION/.test(data)) {
            return this.handleConnectionBye(data);
        }
        
        if (/^SIP\/2\.0\s+[45]\d{2}/.test(data)) {
            return this.handleErrorResponse(data);
        }
        
        return undefined;
    }
    
    /**
     * Handles duplicate messages (server retransmissions)
     * Resends appropriate response for idempotent behavior
     * @param data - The duplicate message
     * @param cseq - The CSeq number of the duplicate
     * @returns Response to resend or undefined
     */
    private handleDuplicateMessage(data: string, cseq: number): string | undefined {
        logger.log(`🔁 [CONNECTION] Handling duplicate for CSeq: ${cseq}`);
        
        // Duplicate NOTIFY4 - resend ACK5
        if (cseq === EstablishingConnection.CSEQ_NOTIFY_4 && /^NOTIFY/.test(data)) {
            logger.log('🔁 [CONNECTION] Resending ACK5 for duplicate NOTIFY4');
            return this.createAck5ForNotify4(data);
        }
        
        // Duplicate NOTIFY6 - no response needed (already processed)
        if (cseq === EstablishingConnection.CSEQ_NOTIFY_6 && /^NOTIFY/.test(data)) {
            logger.log('🔁 [CONNECTION] Ignoring duplicate NOTIFY6');
            return undefined;
        }
        
        logger.log('🔁 [CONNECTION] Ignoring duplicate - no action needed');
        return undefined;
    }
    
    /**
     * Routes NOTIFY messages to appropriate handler based on CSeq
     * CSeq 4: Connection phase start | CSeq 6: Connection complete
     * @param data - NOTIFY message
     * @returns ACK response or undefined
     */
    private handleNotify(data: string): string | undefined {
        const cseqMatch = data.match(EstablishingConnection.REGEX_CSEQ);
        const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
        
        if (cseq === EstablishingConnection.CSEQ_NOTIFY_4) {
            return this.handleNotify4(data);
        } else if (cseq === EstablishingConnection.CSEQ_NOTIFY_6) {
            return this.handleNotify6(data);
        }
        
        logger.log(`⚠️ [CONNECTION] Unexpected NOTIFY CSeq: ${cseq}`);
        return undefined;
    }
    
    /**
     * Handles NOTIFY (CSeq:4) - Connection establishment phase starts
     * Starts CONNECTION_TIMEOUT, coordinates with PeerRegistrationTimeout
     * @param data - NOTIFY4 message
     * @returns ACK5 message
     */
    private handleNotify4(data: string): string | undefined {
        logger.log("🔔 [CONNECTION] ===============================================");
        logger.log("🔔 [CONNECTION] NOTIFY4 RECEIVED - Connection phase starting");
        logger.log("🔔 [CONNECTION] ===============================================");
        
        // Extract and update Call-ID from NOTIFY4 (overwrites registration Call-ID)
        const callIdMatch = data.match(EstablishingConnection.REGEX_CALL_ID);
        if (callIdMatch) {
            this.callId = callIdMatch[1];
            logger.log(`🏷️ [CONNECTION] Updated Call-ID from NOTIFY4: ${this.callId}`);
        } else {
            logger.log('⚠️ [CONNECTION] WARNING: NOTIFY4 missing Call-ID header');
        }
        
        // Mark CSeq 4 as processed
        this.processedCSeqs.add(EstablishingConnection.CSEQ_NOTIFY_4);
        
        this.timeoutManager.startTimer(
            'CONNECTION_TIMEOUT',
            this.connectionTimeout,
            () => this.handleConnectionTimeout()
        );
        logger.log(`⏱️ [CONNECTION] Started ConnectionTimeout (${this.connectionTimeout}ms)`);
        
        this.transitionTo(ConnectionState.NOTIFY_4_RECEIVED, 'NOTIFY4 received');
        
        return this.createAck5ForNotify4(data);
    }
    
    /**
     * Creates ACK (CSeq:5) in response to NOTIFY4
     * Swaps To/From lines for acknowledgment, uses current Call-ID
     * @param data - The NOTIFY4 message
     * @returns ACK5 message
     */
    private createAck5ForNotify4(data: string): string {
        const toLineMatch = data.match(EstablishingConnection.REGEX_TO_LINE);
        const toLine = toLineMatch ? toLineMatch[0] : '';
        const fromLineOrigin = toLine.replace(/^To:/i, 'From:');
        
        const fromLineMatch = data.match(EstablishingConnection.REGEX_FROM_LINE);
        const fromLine = fromLineMatch ? fromLineMatch[0] : '';
        const toLineReplaced = fromLine.replace(/^From:/i, 'To:');
        
        const ack5 = MessageFactory.createAckMessage({
            sipUri: this.sipUri,
            branch: this.branch,
            callId: this.callId,
            tag: this.tag,
            cseq: EstablishingConnection.CSEQ_ACK_5,
            toLine: toLineReplaced,
            fromLine: fromLineOrigin
        });
        
        logger.log('📤 [CONNECTION] Created ACK5 for NOTIFY4');
        return ack5;
    }
    
    /**
     * Handles NOTIFY (CSeq:6) - Connection establishment complete
     * Cancels both timeouts, marks connection as established, transitions to COMPLETE
     * No ACK response needed - NOTIFY6 is final marker
     * @param _data - NOTIFY6 message (unused, keeping for signature consistency)
     * @returns undefined (no response needed)
     */
    private handleNotify6(_data: string): undefined {
        logger.log("🏁 [CONNECTION] ===============================================");
        logger.log("🏁 [CONNECTION] NOTIFY6 RECEIVED - Connection establishment COMPLETE");
        logger.log("🏁 [CONNECTION] ===============================================");
        
        this.cancelConnectionTimeout();
        
        // Mark CSeq 6 as processed
        this.processedCSeqs.add(EstablishingConnection.CSEQ_NOTIFY_6);
        
        this.transitionTo(ConnectionState.COMPLETE, 'NOTIFY6 received - ready for WebRTC');
        this.isConnectionEstablished = true;
        
        logger.log("🏁 [CONNECTION] Ready for WebRTC SDP Exchange (SERVICE CSeq:1)");
        
        // Notify SipClient of success
        this.events.onSuccess?.();
        
        return undefined;
    }
    
    /**
     * Handles ACK received after sending ACK5
     * Validates CSeq and transitions to WAITING_NOTIFY_6 state
     * @param data - ACK message
     * @returns undefined
     */
    private handleAck(data: string): undefined {
        // Validate ACK is CSeq 5 (response to our ACK5)
        const cseqMatch = data.match(EstablishingConnection.REGEX_CSEQ);
        const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
        
        if (cseq !== EstablishingConnection.CSEQ_ACK_5) {
            logger.log(`⚠️ [CONNECTION] Unexpected ACK CSeq: ${cseq}, expected ${EstablishingConnection.CSEQ_ACK_5}`);
            return undefined;
        }
        
        if (this.connectionState === ConnectionState.NOTIFY_4_RECEIVED) {
            this.processedCSeqs.add(EstablishingConnection.CSEQ_ACK_5);
            this.transitionTo(ConnectionState.WAITING_NOTIFY_6, 'ACK received');
        }
        return undefined;
    }
    
    /**
     * Handles CONNECTION_TIMEOUT expiry (ACK not received by server)
     * Notifies SipClient of timeout failure
     */
    private handleConnectionTimeout(): void {
        // State guard: only process timeout if still waiting for NOTIFY6
        if (this.connectionState !== ConnectionState.WAITING_NOTIFY_6 && 
            this.connectionState !== ConnectionState.NOTIFY_4_RECEIVED) {
            logger.log(`⏱️ [CONNECTION] CONNECTION_TIMEOUT fired but state is ${this.connectionState} - ignoring`);
            return;
        }
        
        logger.log("⏰ [CONNECTION] ===============================================");
        logger.log("⏰ [CONNECTION] ConnectionTimeout EXPIRED - ACK not received");
        logger.log("⏰ [CONNECTION] ===============================================");
        
        this.cancelConnectionTimeout();
        
        this.transitionTo(ConnectionState.FAILED, 'CONNECTION_TIMEOUT expired');
        this.isConnectionEstablished = false;
        this.lastError = "ConnectionTimeout expired - ACK not received";
        
        const byeMessage = this.createConnectionBye(this.cseq++, "ConnectionTimeout expired");
        this.events.onMessageToSend?.(byeMessage, 'CONNECTION BYE due to timeout');
        
        // Notify SipClient of timeout and failure
        this.events.onTimeout?.('CONNECTION_TIMEOUT');
        this.events.onFailure?.('CONNECTION_TIMEOUT expired');
    }
    
    /**
     * Handles SIP error responses (4xx, 5xx status codes)
     * Retryable errors (408, 500, 503, 504): Send CONNECTION BYE
     * Non-retryable errors: Mark as FAILED
     * @param data - Error response message
     * @returns CONNECTION BYE message for retryable errors, undefined otherwise
     */
    private handleErrorResponse(data: string): string | undefined {
        const statusCodeMatch = data.match(/^SIP\/2\.0\s+(\d{3})/);
        const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1]) : 0;
        
        logger.log(`❌ [CONNECTION] Received error response: ${statusCode}`);
        
        this.cancelConnectionTimeout();
        this.transitionTo(ConnectionState.FAILED, `error ${statusCode}`);
        this.isConnectionEstablished = false;
        
        const isRetryable = EstablishingConnection.RETRYABLE_ERROR_CODES.includes(statusCode);
        
        if (isRetryable) {
            this.lastError = `Retryable error ${statusCode}`;
            const byeMessage = this.createConnectionBye(this.cseq++, `Error ${statusCode}`);
            this.events.onMessageToSend?.(byeMessage, `CONNECTION BYE for error ${statusCode}`);
        } else {
            this.lastError = `Non-retryable error ${statusCode}`;
        }
        
        logger.log(`📋 [CONNECTION] Last error set: ${this.lastError}`);
        
        // Notify SipClient of failure
        this.events.onFailure?.(this.lastError);
        
        return undefined;
    }
    
    /**
     * Handles incoming CONNECTION BYE from server/peer
     * Responds with CONNECTION BYE (per protocol), checks PeerRegistrationTimeout for retry
     * @param _data - BYE message (unused, keeping for signature consistency)
     * @returns CONNECTION BYE response
     */
    private handleConnectionBye(_data: string): string {
        logger.log("📥 [CONNECTION] Received CONNECTION BYE from server/peer");
        
        this.lastByeReceived = new Date().toISOString();
        this.cancelConnectionTimeout();
        
        this.transitionTo(ConnectionState.FAILED, 'BYE received from server');
        this.isConnectionEstablished = false;
        this.lastError = "Received CONNECTION BYE from server";
        
        // Notify SipClient of failure
        this.events.onFailure?.('Received CONNECTION BYE from server');
        
        return this.createConnectionBye(this.cseq++, "ACK not received");
    }
    
    /**
     * Creates CONNECTION BYE message to signal connection phase termination
     * Uses current Call-ID (updated from NOTIFY4 in connection phase)
     * Used for timeouts, errors, or graceful shutdown
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
        
        logger.log(`🔨 [CONNECTION] Created CONNECTION BYE - ${reason || 'no reason'}`);
        return byeMessage;
    }
    
    /**
     * Initiates graceful termination of connection establishment
     * Cancels active timers and sends CONNECTION BYE
     * @returns CONNECTION BYE message to send to server
     */
    public terminate(): string {
        logger.log("🛑 [CONNECTION] Graceful termination initiated");
        
        this.cancelConnectionTimeout();
        this.transitionTo(ConnectionState.TERMINATING, 'graceful termination');
        
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
     * Resets connection state for retry
     * Generates new session identifiers and resets to WAITING_NOTIFY_4
     */
    public reset(): void {
        logger.log("🔄 [CONNECTION] Resetting for retry");
        
        this.cancelConnectionTimeout();
        this.generateSessionIds();
        this.cseq = 1;
        
        // Clear session tracking
        this.processedCSeqs.clear();
        
        this.transitionTo(ConnectionState.WAITING_NOTIFY_4, 'reset for retry');
        this.isConnectionEstablished = false;
        this.lastError = "";
        
        logger.log("🔄 [CONNECTION] Reset complete - ready for new attempt");
    }
}
