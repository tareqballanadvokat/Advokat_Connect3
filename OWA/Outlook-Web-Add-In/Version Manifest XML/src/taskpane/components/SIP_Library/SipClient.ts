/**
 * SIP Client Main Controller
 * 
 * This module provides the main initialization function for the 
 * SIP client system.
 * It orchestrates the interaction between Registration, 
 * Connection Establishment, and Peer-to-Peer connection components 
 * to provide a complete SIP communication solution.
 * 
 * The SIP client handles the complete call flow:
 * 1. WebSocket connection establishment to SIP server
 * 2. SIP registration process
 * 3. Connection establishment and role negotiation
 * 4. WebRTC peer-to-peer connection setup
 * 5. Data channel communication between peers
 * 
 * Key Features:
 * - Centralized SIP client initialization
 * - Coordinated state management across all SIP phases
 * - WebSocket message routing and handling
 * - Error handling and logging throughout the process
 * - Returns handle to all components for external control
 * 
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

import { Registration } from './Registration';
import { EstablishingConnection } from './EstablishingConnection';
import { Peer2PeerConnection } from './Peer2PeerConnection';
import { logger } from './Helper';

// Global variables for FROM header parsing (used across components)
let fromUri = "";
let fromTag = "";

/**
 * Interface defining the return type of the SIP client initialization
 */
export interface SipClientInstance {
    registration: Registration;
    connection: EstablishingConnection;
    peer2peer: Peer2PeerConnection;
    socket: WebSocket;
}

/**
 * Main SIP client initialization function
 * Establishes WebSocket connection and coordinates all SIP communication phases
 * @returns Object containing all SIP component instances and WebSocket connection
 */
export function initializeSipClient(): SipClientInstance {
    const sipUri = "sip:macc@127.0.0.1:8009"; // SIP is the SIP sender request (from), macc is the username, ip is the ip
    // the SIP Uri should be a variable. Every user has a username or could be a random value
    // the username after SIP should be unique for each user
    // ex SIP:TBA@MyIp:MyPort, it is your task to get the username
    const wsUri = "wss://localhost:8009";// here we need to establish a signaling server
    //each lawyer has their own server, therefore peers are allowed to only connect to one remote server that belongs to them
    // On the other hand there is only one signaling server
    // I need to find the target Remote, which is the to parameter in Registration.ts sip:macs@127.0.0.1:8009, right now it is only hardcoded
    
    const tag = Math.random().toString(36).substring(2, 12); // Updated from deprecated substr
    const callId = Math.random().toString(36).substring(2, 12); // Updated from deprecated substr
    let cseq = 1;
    fromUri = "";
    fromTag = "";
    
    // Initialize all SIP component instances
    const registrationObj = new Registration();
    const establishingConnectionObject = new EstablishingConnection();
    const peer2PeerConnectionObject = new Peer2PeerConnection();
    
    // Establish WebSocket connection with SIP protocol
    const socket = new WebSocket(wsUri, 'sip');
    
    /**
     * WebSocket connection opened - start SIP registration
     */
    socket.onopen = () => {
        
        const registerMsg = registrationObj.getInitialRegistration();
        socket.send(registerMsg);
        logger.log('🔄 Sent REGISTER message');
    };
    
    /**
     * Main message handler - routes messages to appropriate handlers based on current state
     */
    socket.onmessage = async (event) => {
        const data = await logger.blobToStringAsync(event.data);
        logger.log('📥 Received:\n' + data);
        
        // Phase 1: Handle Registration Process
        if (!registrationObj.isRegistrationProcessFinished) {
            const request = registrationObj.parseMessage(data);
            if (request) {
                socket.send(request);
            }
            
            // If registration completed, update connection establishment with registration data
            if (registrationObj.isRegistrationProcessFinished) {
                establishingConnectionObject.updateData(
                    registrationObj.tag,
                    registrationObj.callId,
                    registrationObj.branch,
                    registrationObj.fromDisplayName,
                    registrationObj.toDisplayName
                );
            }
        }
        
        // Phase 2: Handle Connection Establishment Process
        if (registrationObj.isRegistrationProcessFinished &&
            !establishingConnectionObject.isEstablishingConnectionProcessFinished) {
            
            const request = establishingConnectionObject.parseMessage(data);
            if (request) {
                socket.send(request);
            }
            
            // If SERVICE message received and connection establishment is finished, start WebRTC
            if (/^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data) &&
                establishingConnectionObject.isEstablishingConnectionProcessFinished) {
                
                await peer2PeerConnectionObject.parseServiceIncoming(
                    data, 
                    socket,
                    establishingConnectionObject.sipUri,
                    establishingConnectionObject.tag
                );
            }
        }
        
        // Phase 3: Handle WebRTC Offer Creation (if this peer is designated as offerer)
        if (establishingConnectionObject.connectionType === "OFFER" &&
            !peer2PeerConnectionObject.isOfferSent) {
            
            const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
            const m = data.match(reCallId);
            if (m) {
                await peer2PeerConnectionObject.createAndSendOffer(
                    socket, 
                    m[1],
                    establishingConnectionObject.sipUri,
                    establishingConnectionObject.tag,
                    registrationObj.toLineReplaced
                );
            }
        }
        
        // Phase 4: Handle WebRTC Answer Processing (if this peer sent the offer)
        if (peer2PeerConnectionObject.isOfferSent) {
            await peer2PeerConnectionObject.parseIncomingAnswer(data);
        }
    };
    
    /**
     * WebSocket error handler
     */
    socket.onerror = (err) => {
        logger.log('❌ WebSocket Error: ' + err);
    };
    
    /**
     * WebSocket connection closed handler
     */
    socket.onclose = () => {
        logger.log('🔌 WebSocket Connection Closed');
    };
    
    // Return all component instances for external access
    return {
        registration: registrationObj,
        connection: establishingConnectionObject,
        peer2peer: peer2PeerConnectionObject,
        socket,
    };
}

// Default export for convenience
export default initializeSipClient;
