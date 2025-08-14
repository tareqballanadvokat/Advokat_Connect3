/**
 * SIP Connection Establishment Handler
 * 
 * This class manages the connection establishment phase that occurs after successful SIP registration.
 * It handles the negotiation process to determine which peer will create the WebRTC offer and which
 * will create the answer for peer-to-peer communication setup.
 * 
 * The connection establishment process involves:
 * 1. Exchanging NOTIFY/ACK messages with connection type information
 * 2. Determining the role (OFFER creator or ANSWER creator) for each peer
 * 3. Coordinating the WebRTC session initiation
 * 4. Preparing for SDP (Session Description Protocol) exchange
 * 
 * Key Features:
 * - Manages connection type negotiation (OFFER vs ANSWER)
 * - Handles NOTIFY/ACK message exchanges for connection setup
 * - Tracks connection establishment state
 * - Coordinates with WebRTC peer connection setup
 * - Parses JSON payloads to determine offering role
 * 
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

import { logger } from './Helper';

export class EstablishingConnection {
    public sipUri = "sip:macc@127.0.0.1:8009";
    private wsUri = "";
    public tag = Math.random().toString(36).substring(2, 12); // Updated from deprecated substr
    private callId = Math.random().toString(36).substring(2, 12); // Updated from deprecated substr
    private cseq = 1;
    public isEstablishingConnectionProcessFinished = false;
    public connectionType = "";
    private branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11); // Updated from deprecated substr
    private fromDisplayName = "macc";
    private toDisplayName = "macs";
    
    private pc = new RTCPeerConnection();
    private dataChannel: RTCDataChannel | undefined = undefined;
    
    /**
     * Updates connection parameters from registration data
     * @param tag - SIP tag from registration
     * @param callId - Call ID from registration
     * @param branch - Branch parameter from registration
     * @param fromDisplay - From display name
     * @param toDisplay - To display name
     */
    updateData(tag: string, callId: string, branch: string, fromDisplay: string, toDisplay: string): void {
        this.tag = tag;
        this.callId = callId;
        this.branch = branch;
        this.fromDisplayName = fromDisplay;
        this.toDisplayName = toDisplay;
    }
    
    /**
     * Parses incoming SIP messages and determines appropriate response during connection establishment
     * @param data - The SIP message data to parse
     * @returns The appropriate response message or undefined
     */
    parseMessage(data: string): string | undefined {
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            return this.createAckForIsOffer(data);
        }
        
        if (/^ACK\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            return this.createOffer(data);
        }
        
        if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
            this.isEstablishingConnectionProcessFinished = true;
        }
        
        return undefined;
    }
    
    /**
     * Creates an ACK response when this peer is designated to create the SDP offer
     * @param data - The NOTIFY message containing offering information
     * @returns The ACK message with offering confirmation or undefined
     */
    createAckForIsOffer(data: string): string | undefined {
        const isOffering = this.getIsOffer(data);
        if (isOffering) {
            this.connectionType = "OFFER";
            this.isEstablishingConnectionProcessFinished = true;
            
            const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
            const m = data.match(reCallId);
            
            const toLineMatchOrigin = data.match(/^To:.*$/m);
            const toLineOrigin = toLineMatchOrigin ? toLineMatchOrigin[0] : '';
            const fromLineOrigin = toLineOrigin.replace(/^To:/i, 'From:');
            
            const fromLineMatch = data.match(/^From:.*$/m);
            const fromLine = fromLineMatch ? fromLineMatch[0] : '';
            const toLine = fromLine.replace(/^From:/i, 'To:');
            logger.log('📥 createACKForIsOffer From Line: ' + fromLine);
            
            const ackOffering =
                'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
                'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
                'Max-Forwards: 70\r\n' +
                toLine + '\r\n' +
                fromLineOrigin + '\r\n' +
                'Call-ID: ' + (m ? m[1] : '') + '\r\n' +
                'CSeq: 2 ACK\r\n' +
                'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
                'Content-Type: application/json\r\n' +
                'Content-Length: 19\r\n\r\n' +
                '{"IsOffering":true}';
            
            return ackOffering;
        }
        return undefined;
    }
    
    /**
     * Creates an offer response when this peer is designated to create the SDP answer
     * @param data - The ACK message containing offering information
     * @returns The ACK message with answer confirmation or undefined
     */
    createOffer(data: string): string | undefined {
        const isOffering = this.getIsOffer(data);
        if (isOffering) {
            this.connectionType = "ANSWER";
            
            const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
            const m = data.match(reCallId);
            
            const toLineMatchOrigin = data.match(/^To:.*$/m);
            const toLineOrigin = toLineMatchOrigin ? toLineMatchOrigin[0] : '';
            const fromLineOrigin = toLineOrigin.replace(/^To:/i, 'From:');
            
            const fromLineMatch = data.match(/^From:.*$/m);
            const fromLine = fromLineMatch ? fromLineMatch[0] : '';
            const toLine = fromLine.replace(/^From:/i, 'To:');
            logger.log('📥 createOffer From Line: ' + fromLine);
            
            const ackOffering =
                'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
                'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
                'Max-Forwards: 70\r\n' +
                toLine + '\r\n' +
                fromLineOrigin + '\r\n' +
                'Call-ID: ' + (m ? m[1] : '') + '\r\n' +
                'CSeq: 3 ACK\r\n' +
                'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
                'Content-Type: application/json\r\n' +
                'Content-Length: 20\r\n\r\n' +
                '{"IsOffering":false}';
            
            return ackOffering;
        }
        return undefined;
    }
    
    /**
     * Extracts the IsOffering flag from JSON payload in SIP message
     * @param data - The SIP message containing JSON payload
     * @returns Boolean indicating if this peer should create the offer, or undefined if not found
     */
    getIsOffer(data: string): boolean | undefined {
        const offeringMatch = /\"IsOffering\"\s*:\s*(true|false)/i.exec(data);
        if (offeringMatch) {
            const isOffering = offeringMatch[1] === 'true';
            logger.log(`📡 IsOffering: ${isOffering}`);
            return isOffering;
        }
        return undefined;
    }
}
