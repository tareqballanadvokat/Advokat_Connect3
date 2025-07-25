/**
 * SIP Registration Handler
 * 
 * This class manages the SIP registration process, 
 * which is the initial step in establishing a SIP session. 
 * It handles the REGISTER request/response cycle and subsequent 
 * NOTIFY/ACK message exchanges, which are required to authenticate 
 * and register with a SIP server.
 * 
 * The registration process follows these steps:
 * 1. Send initial REGISTER request to the SIP server
 * 2. Handle server responses (202 Accepted, NOTIFY messages)
 * 3. Send appropriate ACK responses
 * 4. Track registration state until process is complete
 * 
 * Key Features:
 * - Generates SIP REGISTER messages with proper headers
 * - Parses incoming SIP responses and determines appropriate actions
 * - Creates ACK messages for different scenarios
 * - Tracks registration completion state
 * - Extracts FROM header information for subsequent communications
 * 
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

import { logger } from './Helper';

// Global variables for FROM header parsing
let fromUri = "";
let fromTag = "";

export class Registration {
    private sipUri = "sip:macc@127.0.0.1:8009";
    private wsUri = "wss://localhost:8009";
    public tag = Math.random().toString(36).substring(2, 12); // Updated from deprecated substr
    public callId = Math.random().toString(36).substring(2, 12); // Updated from deprecated substr
    private cseq = 1;
    public isRegistrationProcessFinished = false;
    
    public branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11); // Updated from deprecated substr
    public fromDisplayName = "macc";
    public toDisplayName = "macs";
    public toLineReplaced = "";
    public fromUri = "";
    public fromTag = "";

    /**
     * Generates the initial REGISTER message for SIP registration
     * @returns The formatted SIP REGISTER message
     */
    getInitialRegistration(): string {
        logger.log('🔗 WebSocket connected');
        // To and From should be dynamic
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
            'Content-Length: 0\r\n\r\n';
        
        return register;
    }
    
    /**
     * Creates an ACK message in response to a 202 Accepted response
     * @param data - The SIP message data received
     * @returns The formatted ACK message
     */
    createAck(data: string): string {
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
        
        return ack;
    }
    
    /**
     * Central message router that analyzes incoming SIP messages and determines the appropriate response
     * @param data - The SIP message data to parse
     * @returns The appropriate response message or empty string
     */
    parseMessage(data: string): string {
        if (/SIP\/2\.0 202/.test(data)) {
            logger.log('✔️ ACK sent ');
            return this.createAck(data);
        }
        
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) && /CSeq: 4 NOTIFY/.test(data)) {
            return this.createAckAfterNotification(data);
        }
        
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) && /CSeq:\s*1 ACK/.test(data)) {
            return this.createConfirmation(data);
        }
        
        if (/^NOTIFY\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) && /CSeq: 6 NOTIFY/.test(data)) {
            this.isRegistrationProcessFinished = true;
        }
        
        return "";
    }
    
    /**
     * Creates an ACK response after receiving a NOTIFY message during registration
     * @param data - The NOTIFY message data
     * @returns The formatted ACK response
     */
    createAckAfterNotification(data: string): string {
        const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
        const m = data.match(reCallId);
        
        const fromLineMatch = data.match(/^From:.*$/m);
        const fromLine = fromLineMatch ? fromLineMatch[0] : '';
        const toLine = fromLine.replace(/^From:/i, 'To:');
        this.toLineReplaced = toLine;
        logger.log('📥 From Line: ' + fromLine);
        
        const ack2 =
            'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + this.branch + '\r\n' +
            'Max-Forwards: 70\r\n' +
            toLine + '\r\n' +
            'From: "' + this.fromDisplayName + '" <' + this.sipUri + '>;tag=' + this.tag + '\r\n' +
            'Call-ID: ' + (m ? m[1] : '') + '\r\n' +
            'CSeq: 5 ACK\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
            'Content-Length: 0\r\n\r\n';
        
        return ack2;
    }
    
    /**
     * Creates a confirmation ACK message
     * @param data - The SIP message data
     * @returns The formatted confirmation ACK
     */
    createConfirmation(data: string): string {
        const branchAck = 'z9hG4bK' + Math.random().toString(36).substring(2, 11); // Updated from deprecated substr
        
        const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
        const m = data.match(reCallId);
        
        const fromLineMatch = data.match(/^From:.*$/m);
        const fromLine = fromLineMatch ? fromLineMatch[0] : '';
        const toLine = fromLine.replace(/^From:/i, 'To:');
        this.toLineReplaced = toLine.toString();
        logger.log('📥 From Line: ' + fromLine);
        
        const ack2 =
            'ACK ' + this.sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branchAck + '\r\n' +
            'Max-Forwards: 70\r\n' +
            toLine + '\r\n' +
            'From: "' + this.fromDisplayName + '" <' + this.sipUri + '>;tag=' + this.tag + '\r\n' +
            'Call-ID: ' + (m ? m[1] : '') + '\r\n' +
            'CSeq: 5 ACK\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
            'Content-Length: 0\r\n\r\n';
        
        return ack2;
    }
    
    /**
     * Extracts FROM header components (URI and tag) from SIP message
     * @param data - The SIP message containing FROM header
     */
    getFromParts(data: string): void {
        if (fromTag !== "" && fromUri !== "") return;
        
        const re = /^From:\s*(?:"([^"]+)"\s*)?<([^>]+)>;tag=(\S+)/m;
        const m = re.exec(data);
        
        if (m) {
            fromUri = m[2]; // sip:macs@127.0.0.1:443;transport=wss
            fromTag = m[3]; // tag value
        } else {
            console.error("Failed to parse From header");
        }
    }
}
