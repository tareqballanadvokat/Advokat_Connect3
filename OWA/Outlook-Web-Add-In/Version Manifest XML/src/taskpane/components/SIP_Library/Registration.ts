/**
 * SIP Registration Handler
 * 
 * This class manages the SIP registration phase ONLY.
 * Registration phase handles CSeq 1-3 (REGISTER → 202 → ACK_3).
 * 
 * EVENT-DRIVEN DESIGN:
 * Uses RegistrationEvents callback interface to emit state changes and outcomes.
 * SipClient subscribes to these events to coordinate overall connection flow.
 * No direct coupling to Redux or external state management.
 * 
 * REGISTRATION FLOW (Success Path):
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Client sends REGISTER (CSeq:1) with timeout config in JSON body     │
 * │   → State: IDLE → REGISTER_SENT                                      │
 * │   → Start RECEIVE_TIMEOUT waiting for 202                            │
 * └──────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Server responds with 202 Accepted (CSeq:2)                           │
 * │   → Cancel RECEIVE_TIMEOUT                                           │
 * │   → Parse server timeout configuration from response body            │
 * │   → Extract server's tag from From header                            │
 * │   → State: REGISTER_SENT → ACCEPTED_202                              │
 * └──────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Client sends ACK (CSeq:3)                                            │
 * │   → State: ACCEPTED_202 → ACK_3_SENT                                 │
 * │   → isRegistrationProcessFinished = true                             │
 * │   → isRegistered = true                                              │
 * │   → REGISTRATION PHASE COMPLETE                                      │
 * │   → Connection Establishment phase takes over                        │
 * └──────────────────────────────────────────────────────────────────────┘
 * 
 * RETRY LOGIC (Failure Handling):
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Failure Trigger (one of):                                            │
 * │   • RECEIVE_TIMEOUT expires (no 202 received)                        │
 * │   • Server sends error response (4xx, 5xx, 6xx)                      │
 * │   • Server sends REGISTRATION BYE                                    │
 * └──────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Check Connection Status:                                             │
 * │   → If connection still active/establishing → ABORT retry            │
 * │      (New REGISTER would cause server to drop current connection)    │
 * │   → If connection not active → Proceed with retry                    │
 * └──────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Check Retry Count:                                                   │
 * │   → If retryCount >= MAX_RETRIES (3) → Mark FAILED permanently       │
 * │   → If retryCount < MAX_RETRIES → Continue retry                     │
 * └──────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Send REGISTRATION BYE (CSeq:2) to signal failure                     │
 * │   → State: → FAILED                                                  │
 * │   → isRegistered = false                                             │
 * └──────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Reset Registration State:                                            │
 * │   → Generate new Call-ID, branch, tag                                │
 * │   → Clear session data (expectedToTag, processedCSeqs)               │
 * │   → State: FAILED → IDLE                                             │
 * │   → Increment retryCount                                             │
 * └──────────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Send new REGISTER (CSeq:1) via onSendMessage callback                │
 * │   → Restart RECEIVE_TIMEOUT                                          │
 * │   → State: IDLE → REGISTER_SENT                                      │
 * │   → Retry attempt logged (attempt X/3)                               │
 * └──────────────────────────────────────────────────────────────────────┘
 * 
 * ERROR HANDLING:
 *   • Permanent errors (401, 403, 407): Mark as FAILED, no retry
 *   • Temporary errors (408, 500, 503, 504): Send BYE, retry with delay
 *   • Duplicate messages: Resend last response (idempotent behavior)
 * 
 * IMPORTANT: This class does NOT handle NOTIFY messages (CSeq 4 and 6).
 * NOTIFY messages belong to Connection Establishment phase.
 * 
 * @author AdvokatConnect Development Team
 * @version 2.1.0
 */

import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';
import { MessageFactory } from './MessageFactory';
import { SipPhaseEvents } from './SipClient';

/**
 * Event callbacks for Registration phase
 * Specialized from generic SipPhaseEvents with RegistrationState and 'RECEIVE_TIMEOUT'
 * Note: onSuccess includes timeout configuration, onFailure includes isRetryable flag
 */
export interface RegistrationEvents extends Omit<SipPhaseEvents<RegistrationState, 'RECEIVE_TIMEOUT'>, 'onSuccess' | 'onFailure'> {
    onSuccess?: (config: { peerRegistration: number; connection: number; receive: number }) => void;
    onFailure?: (reason: string, isRetryable: boolean) => void;
}

/**
 * Registration state machine enum
 * Tracks the current state of the SIP registration process
 * Registration phase handles only CSeq 1-3 (REGISTER → 202 → ACK)
 */
export enum RegistrationState {
    IDLE = "IDLE",                          // Initial state, no registration started
    REGISTER_SENT = "REGISTER_SENT",        // REGISTER message sent, waiting for 202 (ReceiveTimeout active)
    ACCEPTED_202 = "ACCEPTED_202",          // Received 202, preparing to send ACK
    ACK_3_SENT = "ACK_3_SENT",              // Sent ACK (CSeq: 3) - REGISTRATION PHASE COMPLETE, Connection Establishment takes over
    TERMINATING = "TERMINATING",            // Graceful termination in progress (BYE sent)
    FAILED = "FAILED"                       // Registration failed, needs retry or manual intervention
}

export class Registration {
    // Regex patterns
    private static readonly REGEX_CALL_ID = /^Call-ID:\s*([^\r\n]+)/m;
    private static readonly REGEX_TO_TAG = /^To:.*?;tag=(\S+)/m;
    private static readonly REGEX_FROM_TAG = /^From:.*?;tag=(\S+)/m;
    private static readonly REGEX_FROM_HEADER = /^From:\s*(?:"([^"]+)"\s*)?<([^>]+)>;tag=(\S+)/m;
    private static readonly REGEX_CSEQ = /^CSeq:\s*(\d+)\s+(\w+)/m;
    
    // CSeq constants
    private static readonly CSEQ_REGISTER = 1;
    private static readonly CSEQ_BYE_TIMEOUT = 2;
    private static readonly CSEQ_ACK = 3;
    
    private sipUri = "sip:macc@127.0.0.1:8009";
    public tag = "";
    public callId = "";
    private cseq = 1;
    public isRegistered = false;
    
    public branch = "";
    public fromDisplayName = "macc";
    public toDisplayName = "macs";
    
    // FROM header parsing (instance variables instead of globals)
    private parsedFromUri = "";

    private parsedFromTag = "";
    
    // State machine and timeout management
    private registrationState: RegistrationState = RegistrationState.IDLE;
    private timeoutManager: TimeoutManager;
    
    // BYE tracking metadata
    public lastByeReceived: string | null = null; // Timestamp of last REGISTRATION BYE
    
    // Event callbacks for SipClient observation
    private events: RegistrationEvents;
    
    // Timeout configuration (dynamically set from server's 202 response)
    private connectionTimeout: number = 3000;           // Default 3s, updated from server
    private peerRegistrationTimeout: number = 30000;    // Default 30s, updated from server
    private receiveTimeout: number = 1000;              // Default 1s, updated from server
    private readonly TIMEOUT_SAFETY_MARGIN = 500;       // 500ms margin to timeout before server
    
    private lastError: string = "";
    
    // Session validation - ensure messages belong to current registration
    private expectedToTag: string = ""; // To-tag from server (extracted from 202 response)
    private processedCSeqs: Set<number> = new Set(); // Track processed CSeq to detect duplicates

    constructor(timeoutManager: TimeoutManager, events: RegistrationEvents) {
        this.timeoutManager = timeoutManager;
        this.events = events;
        this.generateSessionIds();
    }

    /**
     * Generates new session identifiers (Call-ID, branch, tag) for a fresh registration attempt
     */
    private generateSessionIds(): void {
        this.callId = Math.random().toString(36).substring(2, 12);
        this.branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
        this.tag = Math.random().toString(36).substring(2, 12);
    }

    /**
     * Centralized state transition helper with automatic logging and event emission
     */
    private transitionTo(newState: RegistrationState, reason?: string): void {
        const oldState = this.registrationState;
        this.registrationState = newState;
        if (reason) {
            logger.log(`📤 [REGISTRATION] STATE: ${oldState} -> ${newState} (${reason})`);
        } else {
            logger.log(`📤 [REGISTRATION] STATE: ${oldState} -> ${newState}`);
        }
        this.events.onStateChange?.(newState);
    }

    /**
     * Marks registration as failed with consistent state updates
     * Resets isRegistered flag to allow retry
     */
    private markRegistrationFailed(reason?: string): void {
        this.isRegistered = false;
        this.transitionTo(RegistrationState.FAILED, reason);
        this.events.onStateChange?.(this.registrationState);
    }

    /**
     * Cancels RECEIVE_TIMEOUT timer if currently active
     */
    private cancelReceiveTimeout(): void {
        if (this.timeoutManager.isTimerActive('RECEIVE_TIMEOUT')) {
            this.timeoutManager.cancelTimer('RECEIVE_TIMEOUT');
        }
    }

    /**
     * Creates and returns the initial REGISTER message (CSeq:1) with timeout configuration
     * Starts RECEIVE_TIMEOUT waiting for 202 Accepted response
     * @returns The formatted SIP REGISTER message
     */
    getInitialRegistration(): string {
        const register = MessageFactory.createRegisterMessage({
            sipUri: this.sipUri,
            branch: this.branch,
            callId: this.callId,
            tag: this.tag,
            fromDisplayName: this.fromDisplayName,
            toDisplayName: this.toDisplayName,
            timeoutConfig: {
                ConnectionTimeout: this.connectionTimeout,
                PeerRegistrationTimeout: this.peerRegistrationTimeout,
                ReceiveTimeout: this.receiveTimeout
            },
            cseq: Registration.CSEQ_REGISTER
        });
        
        logger.log('📤 [REGISTRATION] REGISTER message created with timeout configuration');
        
        // Start timeout before transitioning state (we're about to send and wait for response)
        this.timeoutManager.startTimer('RECEIVE_TIMEOUT', this.receiveTimeout, () => {
            this.handleReceiveTimeout();
        });
        
        this.transitionTo(RegistrationState.REGISTER_SENT);
        
        return register;
    }
    

    
    /**
     * Handles RECEIVE_TIMEOUT expiry when waiting for 202 Accepted response
     * Notifies SipClient of timeout and failure
     */
    private handleReceiveTimeout(): void {
        // State guard: only process timeout if still waiting for 202
        if (this.registrationState !== RegistrationState.REGISTER_SENT) {
            logger.log(`⏱️ [REGISTRATION] RECEIVE_TIMEOUT fired but state is ${this.registrationState} - ignoring`);
            return;
        }
        
        this.lastError = 'ReceiveTimeout expired waiting for 202 Accepted';
        logger.log(`⏱️ [REGISTRATION] ${this.lastError}`);
        
        this.markRegistrationFailed('timeout before receiving 202');
        
        const byeMessage = this.createRegistrationBye(Registration.CSEQ_BYE_TIMEOUT);
        this.events.onMessageToSend?.(byeMessage, 'REGISTRATION BYE due to timeout');
        
        this.events.onTimeout?.('RECEIVE_TIMEOUT');
        this.events.onFailure?.('RECEIVE_TIMEOUT expired', true);
    }
    

    
    /**
     * Creates a REGISTRATION BYE message to signal registration failure
     * Cancels PEER_REGISTRATION_TIMEOUT if active
     * @param cseqNum - CSeq number for the BYE message
     * @returns The formatted REGISTRATION BYE message
     */
    public createRegistrationBye(cseqNum: number): string {
        logger.log(`🔨 [REGISTRATION] Creating REGISTRATION BYE (CSeq: ${cseqNum})`);
        
        const bye = MessageFactory.createByeMessage({
            sipUri: this.sipUri,
            branch: this.branch,
            callId: this.callId,
            tag: this.tag,
            cseq: cseqNum,
            toDisplayName: this.toDisplayName,
            fromDisplayName: this.fromDisplayName,
            toTag: this.expectedToTag || undefined,
            reasonType: 'REGISTRATION'
        });
        
        logger.log('📤 [REGISTRATION] REGISTRATION BYE created');
        
        return bye;
    }
    
    /**
     * Handles incoming REGISTRATION BYE message from server
     * Marks registration as failed and notifies SipClient
     * @param _data - The REGISTRATION BYE message (unused but kept for consistency)
     * @returns Empty string (no response needed)
     */
    private handleRegistrationBye(_data: string): string {
        logger.log('📥 [REGISTRATION] Received REGISTRATION BYE');
        
        this.lastByeReceived = new Date().toISOString();
        this.cancelReceiveTimeout();
        
        this.markRegistrationFailed('received REGISTRATION BYE from server');
        this.events.onFailure?.('Received REGISTRATION BYE from server', true);
        
        return "";
    }
    
    /**
     * Resets registration state for a new attempt
     * Generates fresh session IDs (Call-ID, branch, tag) and clears session data
     */
    public resetRegistrationState(): void {
        this.cancelReceiveTimeout();
        
        this.transitionTo(RegistrationState.IDLE, 'resetting for retry');
        this.isRegistered = false;
        this.lastByeReceived = null;
        
        this.generateSessionIds();
        
        this.expectedToTag = "";
        this.processedCSeqs.clear();
        this.parsedFromUri = "";
        this.parsedFromTag = "";
        
        logger.log(`🔄 [REGISTRATION] New session - Call-ID: ${this.callId}, Tag: ${this.tag}, Branch: ${this.branch}`);
    }
    
    /**
     * Validates that incoming message belongs to current registration session
     * Verifies Call-ID, To-tag, and From-tag match expected values
     * @param data - The SIP message to validate
     * @returns true if message is valid for current session, false otherwise
     */
    private validateSession(data: string): boolean {
        const callIdMatch = data.match(Registration.REGEX_CALL_ID);
        if (!callIdMatch) {
            logger.log('⚠️ [REGISTRATION] Message missing Call-ID header');
            return false;
        }
        
        const messageCallId = callIdMatch[1];
        
        if (messageCallId !== this.callId) {
            logger.log(`⚠️ [REGISTRATION] Call-ID mismatch - Expected: ${this.callId}, Got: ${messageCallId} - IGNORING`);
            return false;
        }
        
        const toTagMatch = data.match(Registration.REGEX_TO_TAG);
        if (toTagMatch && toTagMatch[1] !== this.tag) {
            logger.log(`⚠️ [REGISTRATION] To-tag mismatch - Expected: ${this.tag}, Got: ${toTagMatch[1]}`);
            return false;
        }
        
        if (this.expectedToTag !== "") {
            const fromTagMatch = data.match(Registration.REGEX_FROM_TAG);
            if (fromTagMatch && fromTagMatch[1] !== this.expectedToTag) {
                logger.log(`⚠️ [REGISTRATION] From-tag mismatch - Expected: ${this.expectedToTag}, Got: ${fromTagMatch[1]}`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Returns the current registration error, if any
     * @returns Error message or empty string
     */
    public getRegistrationError(): string {
        return this.lastError;
    }
    
    /**
     * Returns the current registration state
     * @returns Current RegistrationState
     */
    public getRegistrationState(): RegistrationState {
        return this.registrationState;
    }
    

    
    /**
     * Returns the current timeout configuration
     * @returns Object with current timeout values in milliseconds
     */
    public getTimeoutConfiguration(): { 
        peerRegistration: number; 
        connection: number; 
        receive: number;
        safetyMargin: number;
    } {
        return {
            peerRegistration: this.peerRegistrationTimeout,
            connection: this.connectionTimeout,
            receive: this.receiveTimeout,
            safetyMargin: this.TIMEOUT_SAFETY_MARGIN
        };
    }
    
    /**
     * Creates an ACK message in response to a 202 Accepted response
     */
    private createAck(data: string): string {
        this.extractFromParts(data);
        
        const toLine = `"${this.toDisplayName}" <${this.parsedFromUri}>;tag=${this.parsedFromTag}`;
        const fromLine = `"${this.fromDisplayName}" <${this.sipUri};transport=wss>;tag=${this.tag}`;
        
        const ack = MessageFactory.createAckMessage({
            sipUri: this.sipUri,
            branch: this.branch,
            callId: this.callId,
            tag: this.tag,
            cseq: Registration.CSEQ_ACK,
            toLine: toLine,
            fromLine: fromLine
        });
        
        logger.log('📤 [REGISTRATION] ACK created with CSeq: 3');
        return ack;
    }
    
    /**
     * Central message router - analyzes incoming SIP messages and returns appropriate response
     * Validates session, detects duplicates, and routes to specific handlers
     * @param data - The SIP message data to parse
     * @returns The appropriate response message or empty string
     */
    parseMessage(data: string): string {
        logger.log(`📨 [REGISTRATION] Parsing message in state: ${this.registrationState}`);
        
        if (!this.validateSession(data)) {
            return "";
        }
        
        const cseqMatch = data.match(Registration.REGEX_CSEQ);
        if (cseqMatch) {
            const cseqNum = parseInt(cseqMatch[1], 10);
            const cseqMethod = cseqMatch[2];
            logger.log(`📋 [REGISTRATION] Message CSeq: ${cseqNum} ${cseqMethod}`);
            
            if (this.processedCSeqs.has(cseqNum)) {
                logger.log(`⚠️ [REGISTRATION] Duplicate CSeq ${cseqNum} - resending response`);
                return this.handleDuplicateMessage(data, cseqNum);
            }
        }
        
        if (/SIP\/2\.0 [456]\d{2}/.test(data)) {
            return this.handleErrorResponse(data);
        }
        
        if (/SIP\/2\.0 202/.test(data)) {
            return this.handle202Accepted(data);
        }
        
        if (/^BYE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            // Only handle REGISTRATION BYE (not CONNECTION or SESSION BYE)
            if (/Reason:\s*REGISTRATION/.test(data)) {
                return this.handleRegistrationBye(data);
            } else {
                logger.log('⚠️ [REGISTRATION] BYE message without REGISTRATION reason - ignoring');
                return "";
            }
        }
        
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            logger.log('❌ [REGISTRATION] ERROR: NOTIFY received in Registration phase!');
            return "";
        }
        
        logger.log('⚠️ [REGISTRATION] Unrecognized message type');
        return "";
    }
    
    /**
     * Parses timeout configuration from server's 202 response JSON body
     * Updates internal timeout values with safety margin (500ms before server timeout)
     * @param data - The 202 response message with JSON body
     */
    private parseServerTimeouts(data: string): void {
        logger.log('⏱️ [REGISTRATION] Parsing server timeout configuration...');
        
        const doubleCrlfIndex = data.indexOf('\r\n\r\n');
        if (doubleCrlfIndex === -1) {
            logger.log('⚠️ [REGISTRATION] No body found in 202 response, using default timeouts');
            return;
        }
        
        try {
            const body = data.substring(doubleCrlfIndex + 4).trim();
            const config = JSON.parse(body);
            
            logger.log('📋 [REGISTRATION] Server timeout config: ' + JSON.stringify(config));
            
            if (config.ConnectionTimeout && typeof config.ConnectionTimeout === 'number') {
                this.connectionTimeout = Math.max(100, config.ConnectionTimeout - this.TIMEOUT_SAFETY_MARGIN);
                logger.log(`⏱️ [REGISTRATION] ConnectionTimeout set to ${this.connectionTimeout}ms (server: ${config.ConnectionTimeout}ms)`);
            }
            
            if (config.PeerRegistrationTimeout && typeof config.PeerRegistrationTimeout === 'number') {
                this.peerRegistrationTimeout = Math.max(100, config.PeerRegistrationTimeout - this.TIMEOUT_SAFETY_MARGIN);
                logger.log(`⏱️ [REGISTRATION] PeerRegistrationTimeout set to ${this.peerRegistrationTimeout}ms (server: ${config.PeerRegistrationTimeout}ms)`);
            } else {
                logger.log(`⏱️ [REGISTRATION] Server sent null/invalid PeerRegistrationTimeout, using default: ${this.peerRegistrationTimeout}ms`);
            }
            
            if (config.ReceiveTimeout && typeof config.ReceiveTimeout === 'number') {
                this.receiveTimeout = Math.max(100, config.ReceiveTimeout - this.TIMEOUT_SAFETY_MARGIN);
                logger.log(`⏱️ [REGISTRATION] ReceiveTimeout set to ${this.receiveTimeout}ms (server: ${config.ReceiveTimeout}ms)`);
            }
            
            logger.log('✅ [REGISTRATION] Timeout configuration updated from server');
            
        } catch (error) {
            logger.log('⚠️ [REGISTRATION] Failed to parse timeout configuration, using defaults');
            logger.log('⚠️ [REGISTRATION] Error: ' + String(error));
        }
    }
    
    /**
     * Handles 202 Accepted response (CSeq:2) from server
     * Cancels RECEIVE_TIMEOUT, parses server timeouts, extracts server tag, sends ACK (CSeq:3)
     * @param data - The 202 response message
     * @returns ACK message to send
     */
    private handle202Accepted(data: string): string {
        logger.log('📥 [REGISTRATION] Received 202 Accepted');
        
        this.cancelReceiveTimeout();
        this.parseServerTimeouts(data);
        
        const fromTagMatch = data.match(Registration.REGEX_FROM_TAG);
        if (fromTagMatch) {
            this.expectedToTag = fromTagMatch[1];
            logger.log(`🏷️ [REGISTRATION] Extracted server tag: ${this.expectedToTag}`);
        } else {
            logger.log('⚠️ [REGISTRATION] WARNING: Server did not provide tag in 202 response From header');
        }
        
        this.transitionTo(RegistrationState.ACCEPTED_202);
        this.processedCSeqs.add(2);
        
        const ack = this.createAck(data);
        
        // Track ACK CSeq to detect duplicates
        this.processedCSeqs.add(3);
        
        this.transitionTo(RegistrationState.ACK_3_SENT, 'ACK sent - registration complete');
        this.isRegistered = true;
        logger.log('🎉 [REGISTRATION] Registration phase COMPLETED - transitioning to Connection Establishment');
        
        // Notify SipClient of success with timeout configuration
        this.events.onSuccess?.({
            peerRegistration: this.peerRegistrationTimeout,
            connection: this.connectionTimeout,
            receive: this.receiveTimeout
        });
        
        return ack;
    }
    
    /**
     * Handles SIP error responses (4xx, 5xx, 6xx)
     * Permanent errors (401, 403, 407): no retry | Temporary errors: send BYE and notify for retry
     * @param data - The error response message
     * @returns REGISTRATION BYE message for temporary errors, empty string for permanent
     */
    private handleErrorResponse(data: string): string {
        const errorMatch = data.match(/SIP\/2\.0 (\d{3})\s+(.+?)[\r\n]/);
        if (errorMatch) {
            const errorCode = errorMatch[1];
            const errorReason = errorMatch[2];
            logger.log(`❌ [REGISTRATION] Received error response: ${errorCode} ${errorReason}`);
            
            this.lastError = `${errorCode} ${errorReason}`;
            
            const isPermanent = ['401', '403', '407'].includes(errorCode);
            
            if (isPermanent) {
                logger.log(`⛔ [REGISTRATION] Permanent failure - ${errorCode}`);
                this.markRegistrationFailed(`permanent error ${errorCode}`);
                this.events.onFailure?.(`Error ${errorCode}: ${errorReason}`, false);
                return "";
            }
            
            logger.log(`⚠️ [REGISTRATION] Temporary error ${errorCode}`);
            this.markRegistrationFailed(`temporary error ${errorCode}`);
            
            const byeMessage = this.createRegistrationBye(Registration.CSEQ_BYE_TIMEOUT);
            this.events.onMessageToSend?.(byeMessage, `REGISTRATION BYE for error ${errorCode}`);
            
            // Notify SipClient of retryable failure
            this.events.onFailure?.(`Error ${errorCode}: ${errorReason}`, true);
            
            return "";
        }
        
        return "";
    }
    
    /**
     * Handles duplicate messages from server (retransmissions)
     * Implements idempotent behavior by resending appropriate responses
     * @param data - The duplicate message
     * @param cseqNum - The CSeq number of the duplicate
     * @returns Response to resend (ACK for duplicate 202, empty otherwise)
     */
    private handleDuplicateMessage(data: string, cseqNum: number): string {
        logger.log(`🔁 [REGISTRATION] Handling duplicate for CSeq: ${cseqNum}`);
        
        if (/SIP\/2\.0 202/.test(data)) {
            logger.log('🔁 [REGISTRATION] Resending ACK for duplicate 202');
            return this.createAck(data);
        }
        
        logger.log('🔁 [REGISTRATION] Ignoring duplicate - no action needed');
        return "";
    }
    
    /**
     * Extracts FROM header components (URI and tag) from SIP message
     */
    private extractFromParts(data: string): void {
        if (this.parsedFromTag !== "" && this.parsedFromUri !== "") {
            return;
        }
        
        const m = data.match(Registration.REGEX_FROM_HEADER);
        if (m) {
            this.parsedFromUri = m[2];
            this.parsedFromTag = m[3];
            logger.log(`✅ [REGISTRATION] Extracted FROM - URI: ${this.parsedFromUri}, Tag: ${this.parsedFromTag}`);
        } else {
            logger.log('❌ [REGISTRATION] Failed to parse From header');
        }
    }
    
    /**
     * Initiates graceful termination of registration
     * Cancels active timers and sends REGISTRATION BYE
     * @returns REGISTRATION BYE message to send
     */
    public terminate(): string {
        logger.log('🛑 [REGISTRATION] Initiating graceful termination');
        
        this.cancelReceiveTimeout();
        this.transitionTo(RegistrationState.TERMINATING);
        
        const byeMessage = this.createRegistrationBye(this.cseq + 1);
        
        return byeMessage;
    }
}
