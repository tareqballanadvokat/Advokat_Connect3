/**
 * WebRTC Peer-to-Peer Connection Handler
 * 
 * This class manages the WebRTC peer-to-peer connection establishment and data exchange
 * between SIP clients. It handles the complete WebRTC negotiation process including
 * SDP (Session Description Protocol) offer/answer exchange and ICE candidate gathering.
 * 
 * Protocol Flow:
 * - OWA Client: Always acts as OFFERER (creates SDP Offer, CSeq: 1)
 * - Server: Always acts as ANSWERER (creates SDP Answer, CSeq: 2)
 * 
 * The P2P connection process involves:
 * 1. OWA creates WebRTC peer connection and data channel
 * 2. OWA creates and sends SDP offer (SERVICE CSeq: 1)
 * 3. Server receives offer, creates answer, sends back (SERVICE CSeq: 2)
 * 4. OWA processes answer and establishes connection
 * 5. Data channel opens for bidirectional communication
 * 
 * Key Features:
 * - WebRTC peer connection management
 * - SDP offer creation (OWA only)
 * - Data channel setup and message handling
 * - ICE candidate gathering and state management
 * - SIP message formatting for WebRTC negotiation
 * - Bidirectional data channel communication
 * 
 * @author AdvokatConnect Development Team
 * @version 2.0.0
 */

import { logger } from './Helper';

// Type for message handler functions
type MessageHandler = (event: MessageEvent) => Promise<void> | void;

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
     * Processes incoming SERVICE message and creates SDP answer for WebRTC connection
     * This method is called when this peer needs to create an answer to an incoming offer
     * @param data - The SIP SERVICE message containing SDP offer
     * @param socket - WebSocket connection for sending response
     * @param sipUri - SIP URI for this peer
     * @param tag - SIP tag for message identification
     */
    async parseServiceIncoming(data: string, socket: WebSocket, sipUri: string, tag: string): Promise<void> {
        logger.log('📥 [PEER2PEER] Received SERVICE with SDP offer - processing as ANSWERER');
        
        const fromLineMatch = data.match(/^from:.*$/mi);
        const fromLine = fromLineMatch ? fromLineMatch[0] : '';
        const toLine = fromLine.replace(/^from:/i, 'to:');
        logger.log("📥 [PEER2PEER] To Line: " + toLine);
        const reCallId = /^call-id:\s*([^\r\n]+)/mi;
        const m = data.match(reCallId);
        const callId = m ? m[1] : "";
        
        // Set up ICE candidate handling
        this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                logger.log("📡 [PEER2PEER] ICE candidate: " + JSON.stringify(evt.candidate));
            }
        };
        
        // Handle ICE gathering completion
        this.pc.onicegatheringstatechange = () => {
            if (this.pc.iceGatheringState === 'complete') {
                logger.log("✅ [PEER2PEER] ICE gathering complete");
                logger.log("📤 [PEER2PEER] Final SDP: " + JSON.stringify(this.pc.localDescription));
                const answerMsg = this.sendSdpAnswer(
                    JSON.stringify(this.pc.localDescription), 
                    callId, 
                    sipUri, 
                    tag, 
                    toLine
                );
                
                if (socket && socket.readyState === WebSocket.OPEN) {
                    logger.log('📤 [PEER2PEER] Sending SDP answer:\n' + answerMsg);
                    socket.send(answerMsg);
                } else {
                    logger.log("⚠️ [PEER2PEER] WebSocket is not available or not open");
                }
            }
        };
        
        // Set up data channel event handlers - ANSWERER receives channel from OFFERER
        this.pc.ondatachannel = (ev) => {
            logger.log("📥 [PEER2PEER] DataChannel received from OFFERER: " + ev.channel.label);
            
            // Store the received data channel
            this.dataChannelPeer = ev.channel;
            
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
        
        // Process SDP offer from the incoming message
        const sdpBlockMatch = data.match(/(\{[\s\S]*?"sdp"[\s\S]*?\})/m);
        if (sdpBlockMatch) {
            try {
                const sdpBlock = sdpBlockMatch[1];
                logger.log('📥 [PEER2PEER] SDP JSON block: ' + sdpBlock);
                
                const sdpInit = JSON.parse(sdpBlock);
                const desc = new RTCSessionDescription(sdpInit);
                
                // Set remote description and create answer
                await this.pc.setRemoteDescription(desc);
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                
                logger.log("✅ [PEER2PEER] Local SDP Answer set: " + JSON.stringify(this.pc.localDescription));
            } catch (err) {
                logger.log("❌ [PEER2PEER] SDP or WebRTC error: " + err);
            }
        } else {
            logger.log("⚠️ [PEER2PEER] SDP block not found in SERVICE message");
        }
    }
    
    /**
     * Formats and creates SDP answer message for SIP transmission
     * @param answer - The SDP answer as JSON string
     * @param callId - SIP Call-ID
     * @param sipUri - SIP URI for this peer
     * @param tag - SIP tag
     * @param toLine - Formatted To header line
     * @returns Formatted SIP SERVICE message with SDP answer
     */
    sendSdpAnswer(answer: string, callId: string, sipUri: string, tag: string, toLine: string): string {
        const branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11); // Updated from deprecated substr
        const length = logger.contentLength(answer);
        
        const sdpAnswer = 
            'SERVICE ' + sipUri + ' SIP/2.0\r\n' +
            'Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=' + branch + '\r\n' +
            'Max-Forwards: 70\r\n' +
            toLine + '\r\n' + 
            'From: "macc" <' + sipUri + ';transport=wss>;tag=' + tag + '\r\n' +
            'Call-ID: ' + callId + '\r\n' +
            'CSeq: 2 SERVICE\r\n' +
            'Expires: 300\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n'
            'Supported: path,gruu,outbound\r\n' +
            'User-Agent: JsSIP 3.10.0\r\n' +
            'Content-Type: application/sdp\r\n' +
            'Contact: <' + sipUri + '>\r\n' + 
            'Content-Length: ' + length + '\r\n\r\n' +
            answer;
        
        return sdpAnswer;
    }
    
    /**
     * Creates and sends WebRTC offer for establishing peer-to-peer connection
     * This method is called when this peer needs to initiate the WebRTC negotiation
     * @param socket - WebSocket connection for sending offer
     * @param callId - SIP Call-ID
     * @param sipUri - SIP URI for this peer
     * @param tag - SIP tag
     * @param toLine - Formatted To header line
     */
    async createAndSendOffer(socket: WebSocket, callId: string, sipUri: string, tag: string, toLine: string): Promise<void> {
        this.isOfferSent = true;
        const branch = 'z9hG4bK' + Math.random().toString(36).substring(2, 11); // Updated from deprecated substr
        
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
                } else {
                    logger.log("❌ [PEER2PEER] WebSocket is not available or not open - cannot send offer");
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
     * @param data - The SIP message containing SDP answer
     */
    async parseIncomingAnswer(data: string): Promise<void> {
        if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) && /CSeq:\s*2 SERVICE/.test(data)) {
            const sdpBlockMatch = data.match(/(\{[\s\S]*?"sdp"[\s\S]*?\})/m);
            if (sdpBlockMatch) {
                try {
                    const sdpBlock = sdpBlockMatch[1];
                    const sdpObj = JSON.parse(sdpBlock);
                    await this.pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
                    logger.log("✅ [PEER2PEER] Remote SDP Answer set successfully");
                } catch (err) {
                    logger.log("❌ [PEER2PEER] SDP or WebRTC error: " + err);
                }
            } else {
                logger.log("⚠️ [PEER2PEER] SDP block not found in SERVICE answer");
            }
        }
    }
    
    /**
     * Returns the active data channel for sending messages
     * @returns The active RTCDataChannel or undefined
     */
    getActiveDataChannel(): RTCDataChannel | undefined {
        return this.dataChannelPeer;
    }
}
