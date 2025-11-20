/**
 * SIP Registration Handler
 * 
 * This class manages the SIP registration phase ONLY.
 * Registration phase handles CSeq 1-3 (REGISTER → 202 → ACK_3).
 * 
 * The registration process follows these steps:
 * 1. Send REGISTER request (CSeq: 1) with timeout configuration
 * 2. Receive 202 Accepted (CSeq: 2) and extract server's timeout values
 * 3. Send ACK (CSeq: 3) - REGISTRATION PHASE COMPLETES HERE
 * 
 * After ACK_3 is sent, the Connection Establishment phase takes over.
 * 
 * Key Features:
 * - Generates SIP REGISTER messages with timeout configuration in JSON body
 * - Parses 202 Accepted responses and updates timeout values from server
 * - Creates ACK message for 202 response
 * - Tracks registration state through RegistrationState enum
 * - Validates session identity (Call-ID and tags)
 * - Handles ReceiveTimeout waiting for 202 response
 * - Implements retry logic with REGISTRATION BYE on failures
 * 
 * Important: This class does NOT handle NOTIFY messages (CSeq 4 and 6).
 * NOTIFY messages belong to Connection Establishment phase.
 * 
 * @author AdvokatConnect Development Team
 * @version 2.0.0
 */

import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';

// Global variables for FROM header parsing
let fromUri = "";
let fromTag = "";

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
    private sipUri = "sip:macc@127.0.0.1:8009";
    public tag = Math.random().toString(36).substring(2, 12);
    public callId = Math.random().toString(36).substring(2, 12);
    private cseq = 1;
    public isRegistrationProcessFinished = false;
    
    public branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
    public fromDisplayName = "macc";
    public toDisplayName = "macs";
    public fromUri = "";
    public fromTag = "";
    
    // State machine and timeout management
    private registrationState: RegistrationState = RegistrationState.IDLE;
    private timeoutManager: TimeoutManager;
    private retryCount: number = 0;
    private readonly MAX_RETRIES = 3;
    
    // Timeout configuration (dynamically set from server's 202 response)
    private connectionTimeout: number = 3000;           // Default 3s, updated from server
    private peerRegistrationTimeout: number = 30000;    // Default 30s, updated from server (handles null from server)
    private receiveTimeout: number = 1000;              // Default 1s, updated from server
    private readonly TIMEOUT_SAFETY_MARGIN = 500;       // 500ms margin to timeout before server
    
    private lastError: string = "";
    
    // Session validation - ensure messages belong to current registration
    private expectedToTag: string = ""; // To-tag from server (extracted from 202 response)
    private processedCSeqs: Set<number> = new Set(); // Track processed CSeq to detect duplicates

    constructor(timeoutManager: TimeoutManager) {
        this.timeoutManager = timeoutManager;
    }

    /**
     * Generates the timeout configuration JSON for REGISTER message body
     * @returns JSON string with timeout configuration
     */
    private generateTimeoutConfig(): string {
        const config = {
            ConnectionTimeout: this.connectionTimeout,
            PeerRegistrationTimeout: this.peerRegistrationTimeout,
            ReceiveTimeout: this.receiveTimeout
        };
        return JSON.stringify(config);
    }

    /**
     * Creates and returns the initial REGISTER message
     * Also resets registration state for new attempt
     * @returns The formatted SIP REGISTER message
     */
    getInitialRegistration(): string {
        logger.log('🔗 WebSocket connected');
        
        // Reset registration completion flag for new attempt
        this.isRegistrationProcessFinished = false;
        
        logger.log('📤 [REGISTRATION] STATE: IDLE -> REGISTER_SENT');
        this.registrationState = RegistrationState.REGISTER_SENT;
        
        // Generate timeout configuration JSON body
        const timeoutBody = this.generateTimeoutConfig();
        const contentLength = timeoutBody.length;
        
        // Build REGISTER message with timeout configuration in body
        const register = 
            'REGISTER ' + this.sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
            'Max-Forwards: 70\r\n' +
            'To: "' + this.toDisplayName + '" <sip:macs@127.0.0.1:8009>\r\n' +
            'From: "' + this.fromDisplayName + '" <' + this.sipUri + ';transport=wss>;tag=' + this.tag + '\r\n' +
            'Call-ID: ' + this.callId + '\r\n' +
            'CSeq: ' + this.cseq + ' REGISTER\r\n' +
            'Expires: 300\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
            'Supported: path,gruu,outbound\r\n' +
            'User-Agent: JsSIP 3.10.0\r\n' +
            'Contact: <' + this.sipUri + '>\r\n' +
            'Content-Type: application/json\r\n' +
            'Content-Length: ' + contentLength + '\r\n\r\n' +
            timeoutBody;
        
        logger.log('📤 [REGISTRATION] REGISTER message created with timeout configuration');
        
        // Start ReceiveTimeout waiting for 202 response
        this.timeoutManager.startTimer('RECEIVE_TIMEOUT', this.receiveTimeout, () => {
            logger.log('⏱️ [REGISTRATION] ReceiveTimeout expired waiting for 202 Accepted');
            this.handleReceiveTimeout();
        });
        
        return register;
    }
    
    /**
     * Handles ReceiveTimeout expiry (waiting for 202 Accepted)
     * Sends REGISTRATION BYE and retries
     * @returns BYE message to send
     */
    private handleReceiveTimeout(): string {
        this.lastError = 'ReceiveTimeout expired waiting for 202 Accepted';
        logger.log(`⏱️ [REGISTRATION] ${this.lastError}`);
        
        // Send REGISTRATION BYE (CSeq: 2)
        const byeMessage = this.createRegistrationBye(2);
        logger.log('📤 [REGISTRATION] Sending REGISTRATION BYE due to timeout');
        
        // Note: We don't wait for the BYE response, just reset and retry
        this.resetAndRetry();
        
        // Return the BYE message to be sent (will be handled by caller)
        return byeMessage;
    }
    
    /**
     * Resets registration state and retries if attempts remain
     */
    private resetAndRetry(): void {
        if (this.retryCount >= this.MAX_RETRIES) {
            logger.log(`❌ [REGISTRATION] Max retries (${this.MAX_RETRIES}) reached. Registration FAILED.`);
            this.registrationState = RegistrationState.FAILED;
            this.timeoutManager.logActiveTimers();
            return;
        }
        
        this.retryCount++;
        logger.log(`🔄 [REGISTRATION] Retry attempt ${this.retryCount}/${this.MAX_RETRIES}`);
        this.resetRegistrationState();
    }
    
    /**
     * Creates a REGISTRATION BYE message
     * @param cseqNum - CSeq number for the BYE message
     * @returns The formatted REGISTRATION BYE message
     */
    public createRegistrationBye(cseqNum: number): string {
        logger.log(`🔨 [REGISTRATION] Creating REGISTRATION BYE (CSeq: ${cseqNum})`);
        
        const bye =
            'BYE ' + this.sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
            'Max-Forwards: 70\r\n' +
            'To: "' + this.toDisplayName + '" <sip:macs@127.0.0.1:8009>' + 
            (this.expectedToTag ? ';tag=' + this.expectedToTag : '') + '\r\n' +
            'From: "' + this.fromDisplayName + '" <' + this.sipUri + ';transport=wss>;tag=' + this.tag + '\r\n' +
            'Call-ID: ' + this.callId + '\r\n' +
            'CSeq: ' + cseqNum + ' REGISTRATION BYE\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
            'Content-Length: 0\r\n\r\n';
        
        logger.log('📤 [REGISTRATION] REGISTRATION BYE created');
        return bye;
    }
    
    /**
     * Handles incoming REGISTRATION BYE message
     * @param _data - The REGISTRATION BYE message (unused but kept for consistency)
     * @returns Response message or empty string
     */
    private handleRegistrationBye(_data: string): string {
        logger.log('📥 [REGISTRATION] Received REGISTRATION BYE');
        
        // Cancel all timers
        this.timeoutManager.cancelTimer('RECEIVE_TIMEOUT');
        
        // Mark as failed and prepare for retry
        this.registrationState = RegistrationState.FAILED;
        this.resetAndRetry();
        
        // No response needed for REGISTRATION BYE in this implementation
        return "";
    }
    
    /**
     * Resets the registration state to prepare for a new registration attempt
     */
    private resetRegistrationState(): void {
        logger.log('🔄 [REGISTRATION] Resetting registration state for retry');
        
        // Clear any active timers
        this.timeoutManager.cancelTimer('RECEIVE_TIMEOUT');
        
        // Reset state machine
        this.registrationState = RegistrationState.IDLE;
        this.isRegistrationProcessFinished = false;
        
        // Generate new Call-ID and branch for the retry (new session)
        this.callId = Math.random().toString(36).substring(2, 12);
        this.branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11);
        this.tag = Math.random().toString(36).substring(2, 12);
        
        // Clear session-specific data
        this.expectedToTag = "";
        this.processedCSeqs.clear();
        this.fromUri = "";
        this.fromTag = "";
        
        // Reset global variables
        fromUri = "";
        fromTag = "";
        
        logger.log(`🔄 [REGISTRATION] New session - Call-ID: ${this.callId}, Tag: ${this.tag}, Branch: ${this.branch}`);
        this.timeoutManager.logActiveTimers();
    }
    
    /**
     * Validates that an incoming message belongs to the current registration session
     * Registration phase only handles CSeq 1-3 (REGISTER → 202 → ACK)
     * @param data - The SIP message to validate
     * @returns true if message is valid for current session, false otherwise
     */
    private validateSession(data: string): boolean {
        logger.log('🔍 [REGISTRATION] Validating session...');
        
        // Extract Call-ID from message
        const callIdMatch = data.match(/^Call-ID:\s*([^\r\n]+)/m);
        if (!callIdMatch) {
            logger.log('⚠️ [REGISTRATION] Message missing Call-ID header');
            return false;
        }
        
        const messageCallId = callIdMatch[1];
        
        // Verify Call-ID matches registration session
        logger.log(`🔍 [REGISTRATION] Call-ID check - Expected: ${this.callId}, Received: ${messageCallId}`);
        if (messageCallId !== this.callId) {
            logger.log(`⚠️ [REGISTRATION] Call-ID mismatch! Expected: ${this.callId}, Received: ${messageCallId}`);
            logger.log('⚠️ [REGISTRATION] Message belongs to different session - IGNORING');
            return false;
        }
        
        // Validate To-tag matches our tag
        const toTagMatch = data.match(/^To:.*?;tag=(\S+)/m);
        if (toTagMatch) {
            const messageToTag = toTagMatch[1];
            logger.log(`🔍 [REGISTRATION] To-tag check - Expected our tag: ${this.tag}, Received: ${messageToTag}`);
            if (messageToTag !== this.tag) {
                logger.log(`⚠️ [REGISTRATION] To-tag mismatch! Expected our tag: ${this.tag}, Received: ${messageToTag}`);
                return false;
            }
        }
        
        // Validate From-tag if we have the server's tag
        if (this.expectedToTag !== "") {
            const fromTagMatch = data.match(/^From:.*?;tag=(\S+)/m);
            if (fromTagMatch) {
                const messageFromTag = fromTagMatch[1];
                logger.log(`🔍 [REGISTRATION] From-tag check - Expected server tag: ${this.expectedToTag}, Received: ${messageFromTag}`);
                if (messageFromTag !== this.expectedToTag) {
                    logger.log(`⚠️ [REGISTRATION] From-tag mismatch! Expected server tag: ${this.expectedToTag}, Received: ${messageFromTag}`);
                    return false;
                }
            }
        }
        
        logger.log('✅ [REGISTRATION] Session validation passed');
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
     * Returns whether registration needs retry (returns true if should trigger retry from SipClient)
     * @returns true if registration should be retried
     */
    public shouldRetryRegistration(): boolean {
        return this.registrationState === RegistrationState.IDLE && 
               this.retryCount > 0 && 
               this.retryCount <= this.MAX_RETRIES;
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
     * @param data - The SIP message data received
     * @returns The formatted ACK message
     */
    createAck(data: string): string {
        logger.log('🔨 [REGISTRATION] Creating ACK for 202 Accepted');
        this.getFromParts(data);
        
        const ack =
            'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
            'Max-Forwards: 70\r\n' +
            'To: "' + this.toDisplayName + '" <' + fromUri + '>;tag=' + fromTag + '\r\n' +
            'From: "' + this.fromDisplayName + '" <' + this.sipUri + ';transport=wss>;tag=' + this.tag + '\r\n' +
            'Call-ID: ' + this.callId + '\r\n' +
            'CSeq: 3 ACK\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
            'Content-Length: 0\r\n\r\n';
        
        logger.log('📤 [REGISTRATION] ACK created with CSeq: 3');
        return ack;
    }
    
    /**
     * Central message router that analyzes incoming SIP messages and determines the appropriate response
     * Implements state machine logic with comprehensive error handling and session validation
     * @param data - The SIP message data to parse
     * @returns The appropriate response message or empty string
     */
    parseMessage(data: string): string {
        logger.log(`📨 [REGISTRATION] Parsing message in state: ${this.registrationState}`);
        logger.log(data);
        // First, validate that this message belongs to our current registration session
        if (!this.validateSession(data)) {
            logger.log('⛔ [REGISTRATION] Message failed session validation - ignoring');
            return "";
        }
        
        // Extract CSeq for duplicate detection
        const cseqMatch = data.match(/^CSeq:\s*(\d+)\s+(\w+)/m);
        if (cseqMatch) {
            const cseqNum = parseInt(cseqMatch[1], 10);
            const cseqMethod = cseqMatch[2];
            logger.log(`📋 [REGISTRATION] Message CSeq: ${cseqNum} ${cseqMethod}`);
            
            // Check for duplicate messages (server retransmission)
            if (this.processedCSeqs.has(cseqNum)) {
                logger.log(`⚠️ [REGISTRATION] Duplicate CSeq ${cseqNum} detected - resending last response`);
                // For duplicates, we should resend the same response (idempotent)
                // This handles server retransmissions
                return this.handleDuplicateMessage(data, cseqNum);
            }
        }
        
        // Handle SIP error responses (4xx, 5xx, 6xx)
        if (/SIP\/2\.0 [456]\d{2}/.test(data)) {
            return this.handleErrorResponse(data);
        }
        
        // Handle 202 Accepted response
        if (/SIP\/2\.0 202/.test(data)) {
            return this.handle202Accepted(data);
        }
        
        // Handle BYE messages from server
        if (/^BYE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            logger.log('📥 [REGISTRATION] Received BYE from server');
            return this.handleRegistrationBye(data);
        }
        
        // Handle NOTIFY messages - ERROR: Should never reach Registration phase
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            logger.log('❌ [REGISTRATION] ERROR: NOTIFY received in Registration phase!');
            logger.log('❌ [REGISTRATION] All NOTIFY messages belong to Connection Establishment phase');
            logger.log('❌ [REGISTRATION] This indicates a message routing error in SipClient');
            logger.log('❌ [REGISTRATION] Registration phase ends after sending ACK_3');
            return "";
        }
        
        // Unrecognized message type
        logger.log('⚠️ [REGISTRATION] Unrecognized message type or format');
        return "";
    }
    
    /**
     * Parses timeout configuration from server's 202 response body
     * Updates internal timeout values based on server configuration
     * @param data - The 202 response message with JSON body
     */
    private parseServerTimeouts(data: string): void {
        logger.log('⏱️ [REGISTRATION] Parsing server timeout configuration...');
        
        // Extract JSON body from message (after double CRLF)
        const doubleCrlfIndex = data.indexOf('\r\n\r\n');
        if (doubleCrlfIndex === -1) {
            logger.log('⚠️ [REGISTRATION] No body found in 202 response, using default timeouts');
            return;
        }
        
        try {
            const body = data.substring(doubleCrlfIndex + 4).trim();
            const config = JSON.parse(body);
            
            logger.log('📋 [REGISTRATION] Server timeout config: ' + JSON.stringify(config));
            
            // Update timeouts with safety margin (timeout before server does)
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
     * Handles 202 Accepted response from server
     * @param data - The 202 response message
     * @returns ACK message to send
     */
    private handle202Accepted(data: string): string {
        logger.log('📥 [REGISTRATION] Received 202 Accepted');
        
        // Validate state transition
        if (this.registrationState !== RegistrationState.REGISTER_SENT) {
            logger.log(`⚠️ [REGISTRATION] Unexpected 202 in state ${this.registrationState} - expected REGISTER_SENT`);
            // Still process it but log the warning
        }
        
        // Clear the ReceiveTimeout (we got the 202 response in time)
        this.timeoutManager.cancelTimer('RECEIVE_TIMEOUT');
        
        // Parse and update timeout configuration from server response
        this.parseServerTimeouts(data);
        
        // Extract server's tag from From header in 202 response
        // In server responses, the server's tag is in the From header
        const fromTagMatch = data.match(/^From:.*?;tag=(\S+)/m);
        if (fromTagMatch) {
            this.expectedToTag = fromTagMatch[1];
            logger.log(`🏷️ [REGISTRATION] Extracted server's tag from From header: ${this.expectedToTag}`);
        } else {
            logger.log(`⚠️ [REGISTRATION] No From-tag found in 202 response`);
        }
        
        // Update state
        this.registrationState = RegistrationState.ACCEPTED_202;
        logger.log('📤 [REGISTRATION] STATE: REGISTER_SENT -> ACCEPTED_202');
        
        // Mark CSeq as processed
        this.processedCSeqs.add(2); // Server's CSeq in 202 response
        
        // Create and send ACK (CSeq: 3)
        const ack = this.createAck(data);
        logger.log('✅ [REGISTRATION] Sending ACK (CSeq: 3) for 202 Accepted');
        
        // Update state to ACK_3_SENT
        this.registrationState = RegistrationState.ACK_3_SENT;
        logger.log('📤 [REGISTRATION] STATE: ACCEPTED_202 -> ACK_3_SENT');
        
        // Registration phase is now COMPLETE - Connection Establishment phase takes over
        this.isRegistrationProcessFinished = true;
        logger.log('🎉 [REGISTRATION] Registration phase COMPLETED (ACK_3 sent) - transitioning to Connection Establishment');
        logger.log('⏱️ [REGISTRATION] PeerRegistrationTimeout should start now (handled by SipClient)');
        
        return ack;
    }
    
    /**
     * Handles SIP error responses (4xx, 5xx, 6xx)
     * @param data - The error response message
     * @returns REGISTRATION BYE message to send before retry
     */
    private handleErrorResponse(data: string): string {
        const errorMatch = data.match(/SIP\/2\.0 (\d{3})\s+(.+?)[\r\n]/);
        if (errorMatch) {
            const errorCode = errorMatch[1];
            const errorReason = errorMatch[2];
            logger.log(`❌ [REGISTRATION] Received error response: ${errorCode} ${errorReason}`);
            
            this.lastError = `${errorCode} ${errorReason}`;
            
            // Handle specific error codes
            switch (errorCode) {
                case '401':
                case '407':
                    logger.log('🔐 [REGISTRATION] Authentication required - not implemented yet');
                    this.registrationState = RegistrationState.FAILED;
                    break;
                    
                case '403':
                    logger.log('⛔ [REGISTRATION] Forbidden - permanent failure');
                    this.registrationState = RegistrationState.FAILED;
                    break;
                    
                case '408':
                case '504':
                    logger.log('⏱️ [REGISTRATION] Timeout error from server - sending BYE and retrying');
                    return this.createRegistrationBye(2); // Will be sent before retry
                    
                case '500':
                case '503':
                    logger.log('🔧 [REGISTRATION] Server error - sending BYE and retrying');
                    return this.createRegistrationBye(2); // Will be sent before retry
                    
                default:
                    logger.log(`⚠️ [REGISTRATION] Unhandled error code: ${errorCode} - sending BYE and retrying`);
                    return this.createRegistrationBye(2); // Will be sent before retry
            }
        }
        
        return "";
    }
    
    /**
     * Handles duplicate messages from server (retransmissions)
     * @param data - The duplicate message
     * @param cseqNum - The CSeq number of the duplicate
     * @returns Response to resend (idempotent)
     */
    private handleDuplicateMessage(data: string, cseqNum: number): string {
        logger.log(`🔁 [REGISTRATION] Handling duplicate for CSeq: ${cseqNum}`);
        
        // For 202 Accepted duplicates, resend ACK
        if (/SIP\/2\.0 202/.test(data)) {
            logger.log('🔁 [REGISTRATION] Resending ACK for duplicate 202');
            return this.createAck(data);
        }
        
        // For other duplicates, just log and ignore
        logger.log('🔁 [REGISTRATION] Ignoring duplicate - no action needed');
        return "";
    }
    
    /**
     * Extracts FROM header components (URI and tag) from SIP message
     * @param data - The SIP message containing FROM header
     */
    getFromParts(data: string): void {
        logger.log('🔍 [REGISTRATION] Extracting FROM header components');
        
        if (fromTag !== "" && fromUri !== "") {
            logger.log('🔍 [REGISTRATION] FROM parts already extracted, skipping');
            return;
        }
        
        const re = /^From:\s*(?:"([^"]+)"\s*)?<([^>]+)>;tag=(\S+)/m;
        const m = re.exec(data);
        
        if (m) {
            fromUri = m[2]; // sip:macs@127.0.0.1:443;transport=wss
            fromTag = m[3]; // tag value
            logger.log(`✅ [REGISTRATION] Extracted FROM - URI: ${fromUri}, Tag: ${fromTag}`);
        } else {
            logger.log('❌ [REGISTRATION] Failed to parse From header');
        }
    }
    
    /**
     * Initiates graceful termination of registration
     * Sends REGISTRATION BYE and cleans up resources
     * @returns REGISTRATION BYE message to send
     */
    public terminate(): string {
        logger.log('🛑 [REGISTRATION] Initiating graceful termination');
        
        // Cancel all active timers
        this.timeoutManager.cancelTimer('RECEIVE_TIMEOUT');
        
        // Update state
        this.registrationState = RegistrationState.TERMINATING;
        logger.log('📤 [REGISTRATION] STATE: -> TERMINATING');
        
        // Create and return REGISTRATION BYE message
        const byeMessage = this.createRegistrationBye(this.cseq + 1);
        logger.log('📤 [REGISTRATION] Termination BYE message created');
        
        return byeMessage;
    }
}
