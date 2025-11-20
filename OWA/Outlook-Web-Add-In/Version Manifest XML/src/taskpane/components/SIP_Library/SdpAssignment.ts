/**
 * SDP Assignment Handler
 * 
 * This class manages the SDP Assignment phase (Section 3.2) that occurs after successful
 * SIP connection establishment. It handles the negotiation process to determine which peer
 * will create the WebRTC SDP offer and which will create the SDP answer.
 * 
 * The SDP Assignment process involves:
 * 1. Receiving NOTIFY (CSeq: 1) with IsOffering flag from signaling server
 * 2. Sending ACK (CSeq: 2) confirming offering role (if IsOffering: true)
 * 3. Receiving/Sending ACK (CSeq: 3) confirming answering role (if IsOffering: false)
 * 
 * After this phase completes, the connection type (OFFER/ANSWER) is set, and the system
 * proceeds to the SDP Exchange phase (SERVICE messages) handled by Peer2PeerConnection.
 * 
 * Message Flow:
 * - Server → Both clients: NOTIFY with {"IsOffering": bool}
 * - Offering client → Peer: ACK with {"IsOffering": true}
 * - Answering client → Peer: ACK with {"IsOffering": false}
 * 
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

import { logger } from './Helper';

/**
 * SDP Assignment state machine enum
 * Tracks the current state of the SDP assignment process
 */
export enum SdpAssignmentState {
    WAITING_NOTIFY = "WAITING_NOTIFY",           // Waiting for NOTIFY with IsOffering
    NOTIFY_RECEIVED = "NOTIFY_RECEIVED",         // NOTIFY received, preparing ACK
    WAITING_PEER_ACK = "WAITING_PEER_ACK",       // Sent ACK, waiting for peer's ACK
    ASSIGNMENT_COMPLETE = "ASSIGNMENT_COMPLETE", // Both peers acknowledged their roles
    FAILED = "FAILED"                            // Assignment failed
}

export class SdpAssignment {
    public sipUri = "sip:macc@127.0.0.1:8009";
    public tag = "";
    private callId = "";
    private branch = "";
    private fromDisplayName = "macc";
    private toDisplayName = "macs";
    public toLineReplaced = "";  // Extracted from NOTIFY/ACK headers for WebRTC signaling
    
    // Role assignment
    public connectionType = "";  // "OFFER" or "ANSWER"
    public isAssignmentComplete = false;
    
    // State machine
    private assignmentState: SdpAssignmentState = SdpAssignmentState.WAITING_NOTIFY;
    private lastError: string = "";
    
    constructor() {
        // Initialize with empty values - will be updated from EstablishingConnection
    }
    
    /**
     * Updates SDP assignment parameters from connection establishment data
     * Receives session parameters from successful connection establishment
     * 
     * @param tag - SIP tag from connection establishment
     * @param callId - Call ID from connection establishment
     * @param branch - Branch parameter from connection establishment
     * @param fromDisplay - From display name
     * @param toDisplay - To display name
     */
    updateData(tag: string, callId: string, branch: string, fromDisplay: string, toDisplay: string): void {
        this.tag = tag;
        this.callId = callId;
        this.branch = branch;
        this.fromDisplayName = fromDisplay;
        this.toDisplayName = toDisplay;
        
        logger.log(`📋 [SDP_ASSIGNMENT] Updated data - Tag: ${tag}, CallId: ${callId}, Branch: ${branch}`);
    }
    
    /**
     * Parses incoming SIP messages during SDP assignment phase
     * Routes messages to specific handlers based on message type
     * 
     * @param data - The SIP message data to parse
     * @returns The appropriate response message or undefined
     */
    parseMessage(data: string): string | undefined {
        logger.log(`📋 [SDP_ASSIGNMENT] Parsing message in state ${this.assignmentState}`);
        
        // Handle NOTIFY with IsOffering assignment
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            const cseqMatch = data.match(/CSeq:\s*(\d+)/);
            const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
            
            // NOTIFY CSeq: 1 is the SDP Assignment notification
            if (cseq === 1) {
                return this.handleNotifyAssignment(data);
            }
        }
        
        // Handle ACK from peer (CSeq: 2 or 3) during SDP assignment
        if (/^ACK\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            const cseqMatch = data.match(/CSeq:\s*(\d+)/);
            const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
            
            // ACK CSeq: 2 or 3 are part of SDP Assignment
            if (cseq === 2 || cseq === 3) {
                return this.handleAckAssignment(data);
            }
        }
        
        return undefined;
    }
    
    /**
     * Handle NOTIFY (CSeq: 1) with IsOffering assignment from signaling server
     * Extracts IsOffering flag and determines this peer's role
     * Creates ACK response confirming the assigned role
     * 
     * @param data - NOTIFY message with IsOffering flag
     * @returns ACK message confirming role assignment
     */
    private handleNotifyAssignment(data: string): string | undefined {
        logger.log("📋 [SDP_ASSIGNMENT] ===============================================");
        logger.log("📋 [SDP_ASSIGNMENT] NOTIFY (CSeq: 1) RECEIVED - SDP Assignment starting");
        logger.log("📋 [SDP_ASSIGNMENT] ===============================================");
        
        const isOffering = this.getIsOffer(data);
        
        if (isOffering !== undefined) {
            logger.log(`✅ [SDP_ASSIGNMENT] IsOffering flag found: ${isOffering}`);
            this.connectionType = isOffering ? "OFFER" : "ANSWER";
            this.assignmentState = SdpAssignmentState.NOTIFY_RECEIVED;
            
            logger.log(`📋 [SDP_ASSIGNMENT] Role assigned: ${this.connectionType}`);
            
            return this.createAckForIsOffer(data, isOffering);
        } else {
            logger.log("⚠️ [SDP_ASSIGNMENT] No IsOffering flag found in NOTIFY");
            this.lastError = "IsOffering flag missing in NOTIFY";
            this.assignmentState = SdpAssignmentState.FAILED;
            return undefined;
        }
    }
    
    /**
     * Creates ACK (CSeq: 2 or 3) response with IsOffering confirmation
     * 
     * - If IsOffering: true → ACK CSeq: 2 with {"IsOffering": true}
     * - If IsOffering: false → ACK CSeq: 3 with {"IsOffering": false}
     * 
     * @param data - The NOTIFY message containing IsOffering flag
     * @param isOffering - Boolean indicating if this peer creates the offer
     * @returns The ACK message with IsOffering confirmation
     */
    private createAckForIsOffer(data: string, isOffering: boolean): string {
        logger.log(`🔨 [SDP_ASSIGNMENT] Creating ACK for IsOffering: ${isOffering}`);
        
        const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
        const m = data.match(reCallId);
        const callId = m ? m[1] : '';
        
        // Extract To and From lines from NOTIFY and swap them for ACK
        const toLineMatchOrigin = data.match(/^To:.*$/m);
        const toLineOrigin = toLineMatchOrigin ? toLineMatchOrigin[0] : '';
        const fromLineOrigin = toLineOrigin.replace(/^To:/i, 'From:');
        
        const fromLineMatch = data.match(/^From:.*$/m);
        const fromLine = fromLineMatch ? fromLineMatch[0] : '';
        const toLine = fromLine.replace(/^From:/i, 'To:');
        
        // Store toLine for WebRTC signaling
        this.toLineReplaced = toLine;
        
        logger.log('📥 [SDP_ASSIGNMENT] ACK From Line: ' + fromLineOrigin);
        logger.log('📥 [SDP_ASSIGNMENT] ACK To Line: ' + toLine);
        
        // CSeq: 2 for offering client, CSeq: 3 for answering client
        const cseq = isOffering ? 2 : 3;
        
        const ackOffering =
            'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
            'Max-Forwards: 70\r\n' +
            toLine + '\r\n' +
            fromLineOrigin + '\r\n' +
            'Call-ID: ' + callId + '\r\n' +
            `CSeq: ${cseq} ACK\r\n` +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
            'Content-Type: application/json\r\n' +
            'Content-Length: 19\r\n\r\n' +
            `{"IsOffering":${isOffering}}`;
        
        logger.log(`📤 [SDP_ASSIGNMENT] Created ACK (CSeq: ${cseq}) with IsOffering: ${isOffering}`);
        
        // Transition to waiting for peer's ACK
        this.assignmentState = SdpAssignmentState.WAITING_PEER_ACK;
        
        return ackOffering;
    }
    
    /**
     * Handle ACK (CSeq: 2 or 3) from peer during SDP assignment
     * 
     * - If we're OFFERING and receive ACK with IsOffering:false → Assignment complete
     * - If we're ANSWERING and receive ACK with IsOffering:true → Need to send our ACK
     * 
     * @param data - ACK message from peer
     * @returns Response ACK if needed, or undefined
     */
    private handleAckAssignment(data: string): string | undefined {
        logger.log("📋 [SDP_ASSIGNMENT] Handling ACK from peer");
        
        const cseqMatch = data.match(/CSeq:\s*(\d+)/);
        const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
        logger.log(`📋 [SDP_ASSIGNMENT] Received ACK with CSeq: ${cseq}`);
        
        const peerIsOffering = this.getIsOffer(data);
        
        if (peerIsOffering !== undefined) {
            logger.log(`📋 [SDP_ASSIGNMENT] Peer IsOffering: ${peerIsOffering}`);
            
            // If we're in NOTIFY_RECEIVED state and received peer's ACK
            if (this.assignmentState === SdpAssignmentState.NOTIFY_RECEIVED) {
                // We received peer's ACK before sending ours
                // If peer is offering, we should respond as answering
                if (peerIsOffering) {
                    this.connectionType = "ANSWER";
                    logger.log("📋 [SDP_ASSIGNMENT] Peer is OFFERING, we are ANSWERING");
                    
                    // Create our ACK response
                    const response = this.createOfferResponse(data);
                    this.assignmentState = SdpAssignmentState.ASSIGNMENT_COMPLETE;
                    this.isAssignmentComplete = true;
                    
                    logger.log("✅ [SDP_ASSIGNMENT] Assignment COMPLETE - Role: ANSWER");
                    return response;
                }
            }
            
            // If we already sent our ACK and now received peer's ACK
            if (this.assignmentState === SdpAssignmentState.WAITING_PEER_ACK) {
                this.assignmentState = SdpAssignmentState.ASSIGNMENT_COMPLETE;
                this.isAssignmentComplete = true;
                
                logger.log(`✅ [SDP_ASSIGNMENT] Assignment COMPLETE - Role: ${this.connectionType}`);
            }
        }
        
        return undefined;
    }
    
    /**
     * Creates ACK response when this peer is designated as answering client
     * Responds to peer's ACK with IsOffering:true
     * 
     * @param data - The ACK message from offering peer
     * @returns ACK message with IsOffering:false
     */
    private createOfferResponse(data: string): string {
        logger.log('🔨 [SDP_ASSIGNMENT] Creating ACK response as ANSWERING client');
        
        const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
        const m = data.match(reCallId);
        const callId = m ? m[1] : '';
        
        const toLineMatchOrigin = data.match(/^To:.*$/m);
        const toLineOrigin = toLineMatchOrigin ? toLineMatchOrigin[0] : '';
        const fromLineOrigin = toLineOrigin.replace(/^To:/i, 'From:');
        
        const fromLineMatch = data.match(/^From:.*$/m);
        const fromLine = fromLineMatch ? fromLineMatch[0] : '';
        const toLine = fromLine.replace(/^From:/i, 'To:');
        
        // Store toLine for WebRTC signaling
        this.toLineReplaced = toLine;
        
        logger.log('📥 [SDP_ASSIGNMENT] Response From Line: ' + fromLineOrigin);
        logger.log('📥 [SDP_ASSIGNMENT] Response To Line: ' + toLine);
        
        const ackOffering =
            'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
            'Max-Forwards: 70\r\n' +
            toLine + '\r\n' +
            fromLineOrigin + '\r\n' +
            'Call-ID: ' + callId + '\r\n' +
            'CSeq: 3 ACK\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
            'Content-Type: application/json\r\n' +
            'Content-Length: 20\r\n\r\n' +
            '{"IsOffering":false}';
        
        logger.log('📤 [SDP_ASSIGNMENT] Created ACK (CSeq: 3) with IsOffering: false');
        
        return ackOffering;
    }
    
    /**
     * Extracts the IsOffering flag from JSON payload in SIP message
     * 
     * @param data - The SIP message containing JSON payload
     * @returns Boolean indicating if this peer should create the offer, or undefined if not found
     */
    private getIsOffer(data: string): boolean | undefined {
        const offeringMatch = /\"IsOffering\"\s*:\s*(true|false)/i.exec(data);
        if (offeringMatch) {
            const isOffering = offeringMatch[1] === 'true';
            logger.log(`📡 [SDP_ASSIGNMENT] IsOffering: ${isOffering}`);
            return isOffering;
        }
        return undefined;
    }
    
    /**
     * Get current assignment state
     * 
     * @returns Current SdpAssignmentState
     */
    public getState(): SdpAssignmentState {
        return this.assignmentState;
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
     * Reset assignment state for retry
     */
    public reset(): void {
        logger.log("📋 [SDP_ASSIGNMENT] Resetting for retry");
        
        this.assignmentState = SdpAssignmentState.WAITING_NOTIFY;
        this.connectionType = "";
        this.isAssignmentComplete = false;
        this.lastError = "";
        this.toLineReplaced = "";
        
        logger.log("📋 [SDP_ASSIGNMENT] Reset complete - ready for new assignment");
    }
}
