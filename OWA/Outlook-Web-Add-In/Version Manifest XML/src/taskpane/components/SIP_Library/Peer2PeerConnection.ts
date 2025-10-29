/**
 * WebRTC Peer-to-Peer Connection Handler
 * 
 * This class manages the WebRTC peer-to-peer connection establishment and data exchange
 * between SIP clients. It handles the complete WebRTC negotiation process including
 * SDP (Session Description Protocol) offer/answer exchange and ICE candidate gathering.
 * 
 * The P2P connection process involves:
 * 1. Creating WebRTC peer connections with appropriate configuration
 * 2. Setting up data channels for direct peer-to-peer communication
 * 3. Handling SDP offer creation and answer processing
 * 4. Managing ICE candidate gathering and exchange
 * 5. Establishing secure data channels for message exchange
 * 
 * Key Features:
 * - WebRTC peer connection management
 * - SDP offer/answer creation and processing
 * - Data channel setup and message handling
 * - ICE candidate gathering and state management
 * - SIP message formatting for WebRTC negotiation
 * - Bidirectional data channel communication
 * 
 * @author AdvokatConnect Development Team
 * @version 1.0.0
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
        console.log("📨 ArrayBuffer:", text);
    } else if (data instanceof Blob) {
        text = await data.text(); // Updated from deprecated FileReader approach
        console.log("📨 Blob:", text);
    } else if (typeof data === "string") {
        console.log("📨 Text:", data);
        text = data;
    } else {
        console.warn("❓ Unknown message type:", typeof data, data);
        return;
    }
    
    console.log("📨 DataChannel message:", text);
    logger.log(text);
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
                console.error('Error in message handler:', error);
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
        this.dataChannelPeer = this.pc.createDataChannel("answer");
        
        const fromLineMatch = data.match(/^from:.*$/mi);
        const fromLine = fromLineMatch ? fromLineMatch[0] : '';
        const toLine = fromLine.replace(/^from:/i, 'to:');
        console.log("toLine: ", toLine);
        const reCallId = /^call-id:\s*([^\r\n]+)/mi;
        const m = data.match(reCallId);
        const callId = m ? m[1] : "";
        
        // Set up ICE candidate handling
        this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                console.log("ICE candidate:", JSON.stringify(evt.candidate));
            }
        };
        
        // Handle ICE gathering completion
        this.pc.onicegatheringstatechange = () => {
            if (this.pc.iceGatheringState === 'complete') {
                console.log("ICE gathering complete.");
                console.log("Final SDP:", JSON.stringify(this.pc.localDescription));
                const answerMsg = this.sendSdpAnswer(
                    JSON.stringify(this.pc.localDescription), 
                    callId, 
                    sipUri, 
                    tag, 
                    toLine
                );
                
                if (socket && socket.readyState === WebSocket.OPEN) {
                    logger.log('Sending Peer2PeerConnection answer:\n' + answerMsg);
                    socket.send(answerMsg);
                } else {
                    console.warn("⚠️ WebSocket is not available or not open");
                }
            }
        };
        
        // Set up data channel event handlers
        this.pc.ondatachannel = (ev) => {
            console.log("DataChannel found");
            
            ev.channel.onopen = () => {
                console.log("🟢 DataChannel opened: ", ev.channel.label);
            };
            
            ev.channel.onmessage = (event) => this.dispatchMessage(event);
            
            ev.channel.onclose = () => {
                console.log("🔴 DataChannel closed");
            };
            
            ev.channel.onerror = (err) => {
                console.error("❌ DataChannel error:", err);
            };
        };
        
        // Configure the answer data channel
        this.dataChannelPeer = this.pc.createDataChannel("answer");
        this.dataChannelPeer.onopen = () => {
            console.log("🟢 DataChannel opened: answer");
        };
        
        this.dataChannelPeer.onclose = () => {
            console.log("🔴 DataChannel closed");
        };
        
        this.dataChannelPeer.onerror = (err) => {
            console.error("❌ DataChannel error:", err);
        };
        
        // Process SDP offer from the incoming message
        const sdpBlockMatch = data.match(/(\{[\s\S]*?"sdp"[\s\S]*?\})/m);
        if (sdpBlockMatch) {
            try {
                const sdpBlock = sdpBlockMatch[1];
                console.log('SDP JSON block:', sdpBlock);
                
                const sdpInit = JSON.parse(sdpBlock);
                const desc = new RTCSessionDescription(sdpInit);
                
                // Set remote description and create answer
                await this.pc.setRemoteDescription(desc);
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                
                console.log("✔️ Local SDP Answer set:", JSON.stringify(this.pc.localDescription));
            } catch (err) {
                console.error("❌ SDP or WebRTC error:", err);
            }
        } else {
            console.warn("⚠️ SDP block not found");
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
            'CSeq: 5 SERVICE\r\n' +
            'Expires: 300\r\n' +
            'Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n' +
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
            console.log("🟢 DataChannel OFFER opened");
            if (this.dataChannelPeer) {
                this.dataChannelPeer.send("Hello from OFFER side");
            }
        };
        
        this.dataChannelPeer.onmessage = (event) => {
            const text = new TextDecoder("utf-8").decode(event.data);
            console.log("📨 Received on offer channel:", text);
        };
        
        this.dataChannelPeer.onerror = (err) => {
            console.error("❌ Offer DataChannel error:", err);
        };
        
        // Set up data channel event handlers
        this.pc.ondatachannel = (ev) => {
            console.log("DataChannel found");
            
            ev.channel.onopen = () => {
                console.log("🟢 DataChannel opened: ", ev.channel.label);
            };
            
            ev.channel.onmessage = (event) => this.dispatchMessage(event);
            
            ev.channel.onclose = () => {
                console.log("🔴 DataChannel closed");
            };
            
            ev.channel.onerror = (err) => {
                console.error("❌ DataChannel error:", err);
            };
        };
        
        // Handle ICE candidates
        this.pc.onicecandidate = (evt) => {
            if (evt.candidate) {
                console.log("📤 ICE candidate (offer):", JSON.stringify(evt.candidate));
            }
        };
        
        // Handle ICE gathering completion
        this.pc.onicegatheringstatechange = () => {
            if (this.pc.iceGatheringState === 'complete') {
                console.log("✅ ICE gathering complete (offer)");
                const offerSDP = JSON.stringify(this.pc.localDescription);
                const offerMsg = this.sendSdpOffer(offerSDP, callId, sipUri, tag, toLine, branch);
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(offerMsg);
                }
            }
        };
        
        // Create and set local offer
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        
        console.log("📤 SDP Offer created:", JSON.stringify(offer));
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
            'CSeq: 4 SERVICE\r\n' +
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
        if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) && /CSeq:\s*5 SERVICE/.test(data)) {
            const sdpBlockMatch = data.match(/(\{[\s\S]*?"sdp"[\s\S]*?\})/m);
            if (sdpBlockMatch) {
                try {
                    const sdpBlock = sdpBlockMatch[1];
                    const sdpObj = JSON.parse(sdpBlock);
                    await this.pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
                    console.log("✔️ Remote SDP Answer set successfully");
                } catch (err) {
                    console.error("❌ SDP or WebRTC error:", err);
                }
            } else {
                console.warn("⚠️ SDP block not found");
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
