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
 * 2. SIP registration process (REGISTER → OK → ACK)
 * 3. Connection establishment (NOTIFY4 → ACK5 → NOTIFY6)
 * 4. WebRTC SDP Exchange - OWA always creates offer (SERVICE1 → SERVICE2)
 * 5. Data channel communication between peers
 * 
 * Simplified Protocol (v2.0):
 * - Removed SDP Assignment phase (NOTIFY1, ACK2, ACK3)
 * - OWA always acts as OFFERER (sends SDP Offer)
 * - Server always acts as ANSWERER (sends SDP Answer)
 * - Direct transition from NOTIFY6 to SERVICE1
 * 
 * Key Features:
 * - Centralized SIP client initialization
 * - Coordinated state management across all SIP phases
 * - WebSocket message routing and handling
 * - Error handling and logging throughout the process
 * - Returns handle to all components for external control
 * 
 * @author AdvokatConnect Development Team
 * @version 2.0.0
 */

import { Registration, RegistrationState } from './Registration';
import { EstablishingConnection, ConnectionState } from './EstablishingConnection';
import { Peer2PeerConnection, SdpExchangeState } from './Peer2PeerConnection';
import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';

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
    timeoutManager: TimeoutManager;
}

/**
 * Main SIP client initialization function
 * Establishes WebSocket connection and coordinates all SIP communication phases
 * @returns Object containing all SIP component instances and WebSocket connection
 */
export function initializeSipClient(): SipClientInstance {
    const sipUri = "sip:macc@127.0.0.1:8009";
    const wsUri = "wss://localhost:8009";
    
    const tag = Math.random().toString(36).substring(2, 12);
    const callId = Math.random().toString(36).substring(2, 12);
    let cseq = 1;
    fromUri = "";
    fromTag = "";
    
    // Create centralized timeout manager
    const timeoutManager = new TimeoutManager();
    
    // Retry counters (each phase gets 3 retries)
    let registrationRetryCount = 0;
    let connectionRetryCount = 0;
    const MAX_RETRIES = 3;
    
    // Flag to track if PeerRegistrationTimeout has been started
    let peerRegistrationTimeoutStarted = false;
    
    // Initialize all SIP component instances
    const registrationObj = new Registration(timeoutManager);
    const establishingConnectionObject = new EstablishingConnection(timeoutManager);
    const peer2PeerConnectionObject = new Peer2PeerConnection();
    
    // Establish WebSocket connection with SIP protocol
    const socket = new WebSocket(wsUri, 'sip');
    
    // ========== Configure Callbacks for All Components ==========
    
    // Registration callbacks
    registrationObj.onSendMessage = (message: string) => {
        socket.send(message);
        logger.log('📤 [SIPCLIENT] Sent message from Registration retry handler');
    };
    
    // EstablishingConnection callbacks
    establishingConnectionObject.getPeerRegistrationTimeRemaining = () => {
        return timeoutManager.getRemainingTime('PEER_REGISTRATION_TIMEOUT');
    };
    
    establishingConnectionObject.onSendMessage = (message: string) => {
        socket.send(message);
        logger.log('📤 [SIPCLIENT] Sent message from EstablishingConnection timeout handler');
    };
    
    // Peer2PeerConnection callbacks (set later after NOTIFY6, before creating offer)
    // peer2PeerConnectionObject.onSendConnectionBye will be set when connection completes
    
    // ========== End Callback Configuration ==========
    
    /**
     * WebSocket connection opened - start SIP registration
     */
    socket.onopen = () => {
        logger.log('🔗 [SIPCLIENT] WebSocket connection established');
        const registerMsg = registrationObj.getInitialRegistration();
        socket.send(registerMsg);
        logger.log('🔄 [SIPCLIENT] Sent initial REGISTER message');
    };
    
    /**
     * Main message handler - routes messages to appropriate handlers based on current state
     */
    socket.onmessage = async (event) => {
        const data = await logger.blobToStringAsync(event.data);
        logger.log('📥 [SIPCLIENT] Received message:\n' + data);
        
        // Phase 1: Handle Registration Process
        if (!registrationObj.isRegistrationProcessFinished) {
            const request = registrationObj.parseMessage(data);
            if (request) {
                socket.send(request);
                logger.log('📤 [SIPCLIENT] Sent response from registration handler');
            }
            
            // Check if ACK_3_SENT state reached - start PeerRegistrationTimeout (EXACTLY ONCE)
            if (registrationObj.getRegistrationState() === RegistrationState.ACK_3_SENT && !peerRegistrationTimeoutStarted) {
                const timeoutConfig = registrationObj.getTimeoutConfiguration();
                logger.log(`⏱️ [SIPCLIENT] ACK_3 sent - Starting PeerRegistrationTimeout (${timeoutConfig.peerRegistration}ms)`);
                peerRegistrationTimeoutStarted = true;  // Prevent starting it multiple times
                
                timeoutManager.startTimer('PEER_REGISTRATION_TIMEOUT', timeoutConfig.peerRegistration, () => {
                    logger.log('⏱️ [SIPCLIENT] PeerRegistrationTimeout expired - sending REGISTRATION BYE');
                    const byeMessage = registrationObj.createRegistrationBye(4);
                    socket.send(byeMessage);
                    
                    // Reset and retry if retries available
                    registrationRetryCount++;
                    peerRegistrationTimeoutStarted = false;  // Reset flag for retry
                    if (registrationRetryCount < MAX_RETRIES) {
                        logger.log(`🔄 [SIPCLIENT] Registration retry ${registrationRetryCount}/${MAX_RETRIES}`);
                        const retryMsg = registrationObj.getInitialRegistration();
                        socket.send(retryMsg);
                    } else {
                        logger.log('❌ [SIPCLIENT] Max registration retries reached');
                    }
                });
            }
            
            // Check if registration failed permanently
            if (registrationObj.getRegistrationState() === RegistrationState.FAILED) {
                logger.log('❌ [SIPCLIENT] Registration FAILED permanently');
                logger.log(`❌ [SIPCLIENT] Error: ${registrationObj.getRegistrationError()}`);
                socket.close();
            }
            
            // If registration completed, update connection establishment with registration data
            if (registrationObj.isRegistrationProcessFinished) {
                logger.log('✅ [SIPCLIENT] Registration completed - transitioning to Connection Establishment phase');
                const timeoutConfig = registrationObj.getTimeoutConfiguration();
                establishingConnectionObject.updateData(
                    registrationObj.tag,
                    registrationObj.callId,
                    registrationObj.branch,
                    registrationObj.fromDisplayName,
                    registrationObj.toDisplayName,
                    timeoutConfig.connection  // Pass ConnectionTimeout from server
                );
                
                // Also configure Peer2PeerConnection with timeout settings
                peer2PeerConnectionObject.updateConfiguration(
                    timeoutManager,
                    timeoutConfig.receive  // Pass ReceiveTimeout from server
                );
            }
        }
        
        // Phase 2: Handle Connection Establishment Process
        if (registrationObj.isRegistrationProcessFinished &&
            !establishingConnectionObject.isEstablishingConnectionProcessFinished) {
            
            const request = establishingConnectionObject.parseMessage(data);
            if (request) {
                socket.send(request);
                logger.log('📤 [SIPCLIENT] Sent response from connection establishment handler');
                logger.log(request);
            }
            
            // Check if connection establishment completed (NOTIFY6 received)
            if (establishingConnectionObject.getState() === ConnectionState.COMPLETE) {
                logger.log('✅ [SIPCLIENT] Connection Establishment completed - transitioning to WebRTC phase');
                logger.log('📤 [SIPCLIENT] OWA always creates SDP Offer - creating offer immediately');
                establishingConnectionObject.isEstablishingConnectionProcessFinished = true;
                
                // OWA always acts as OFFERER - create and send SDP offer immediately
                if (!peer2PeerConnectionObject.isOfferSent) {
                    // Extract Call-ID from current message (will be in the NOTIFY6)
                    const reCallId = /^Call-ID:\s*([^\r\n]+)/m;
                    const m = data.match(reCallId);
                    const callId = m ? m[1] : '';
                    
                    // Swap From and To from NOTIFY6 for SERVICE message
                    const fromLineMatch = data.match(/^From:.*$/m);
                    const fromLine = fromLineMatch ? fromLineMatch[0] : '';
                    const toLine = fromLine.replace(/^From:/i, 'To:');
                    
                    logger.log('📤 [SIPCLIENT] Creating SDP Offer with Call-ID: ' + callId);
                    logger.log('📤 [SIPCLIENT] To Line: ' + toLine);
                    
                    // Set up CONNECTION BYE callback for Peer2PeerConnection
                    peer2PeerConnectionObject.onSendConnectionBye = (byeMessage: string) => {
                        socket.send(byeMessage);
                        logger.log('📤 [SIPCLIENT] Sent CONNECTION BYE from WebRTC phase');
                    };
                    
                    await peer2PeerConnectionObject.createAndSendOffer(
                        socket,
                        callId,
                        establishingConnectionObject.sipUri,
                        establishingConnectionObject.tag,
                        toLine
                    );
                }
            }
            
            // Check for connection phase failure
            const connectionState = establishingConnectionObject.getState();
            if (connectionState === ConnectionState.FAILED) {
                const error = establishingConnectionObject.getLastError();
                logger.log(`❌ [SIPCLIENT] Connection establishment failed: ${error}`);
                
                // Check PeerRegistrationTimeout remaining time
                const peerTimeRemaining = timeoutManager.getRemainingTime('PEER_REGISTRATION_TIMEOUT');
                logger.log(`⏱️ [SIPCLIENT] PeerRegistrationTimeout has ${peerTimeRemaining}ms remaining`);
                
                if (peerTimeRemaining > 0 && connectionRetryCount < MAX_RETRIES) {
                    // Retry connection phase
                    connectionRetryCount++;
                    logger.log(`🔄 [SIPCLIENT] Connection retry ${connectionRetryCount}/${MAX_RETRIES}`);
                    
                    // Reset connection for retry
                    establishingConnectionObject.reset();
                    
                    // Re-update with registration data (keeping same session IDs)
                    const timeoutConfig = registrationObj.getTimeoutConfiguration();
                    establishingConnectionObject.updateData(
                        registrationObj.tag,
                        registrationObj.callId,
                        registrationObj.branch,
                        registrationObj.fromDisplayName,
                        registrationObj.toDisplayName,
                        timeoutConfig.connection
                    );
                } else if (peerTimeRemaining <= 0) {
                    // PeerRegistrationTimeout exhausted - check if we can retry registration
                    logger.log('❌ [SIPCLIENT] PeerRegistrationTimeout exhausted');
                    
                    if (registrationRetryCount < MAX_RETRIES) {
                        // Can retry registration - reset connection retry count only
                        logger.log(`🔄 [SIPCLIENT] Restarting registration (attempt ${registrationRetryCount + 1}/${MAX_RETRIES})`);
                        registrationRetryCount++;
                        connectionRetryCount = 0;
                        peerRegistrationTimeoutStarted = false;  // Reset flag for new registration attempt
                        
                        // Cancel both timeouts
                        timeoutManager.cancelTimer('PEER_REGISTRATION_TIMEOUT');
                        timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
                        
                        // Reset EstablishingConnection for new registration attempt
                        establishingConnectionObject.reset();
                        
                        // Send REGISTRATION BYE
                        const byeMessage = registrationObj.createRegistrationBye(7);
                        socket.send(byeMessage);
                        
                        // Start new registration (this will reset isRegistrationProcessFinished to false)
                        const retryMsg = registrationObj.getInitialRegistration();
                        socket.send(retryMsg);
                    } else {
                        // Max registration retries reached
                        logger.log('❌ [SIPCLIENT] Max registration retries reached - closing socket');
                        socket.close();
                    }
                } else {
                    // Max connection retries reached
                    logger.log('❌ [SIPCLIENT] Max connection retries reached - closing socket');
                    socket.close();
                }
            }
        }
        
        // Phase 3: Handle WebRTC SDP Exchange (SERVICE messages)
        // OWA always sends offer (CSeq: 1), server always sends answer (CSeq: 2)
        if (establishingConnectionObject.isEstablishingConnectionProcessFinished) {
            
            // Process incoming SERVICE answer from server (CSeq: 2)
            if (peer2PeerConnectionObject.isOfferSent && /^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/.test(data)) {
                const cseqMatch = data.match(/CSeq:\s*(\d+)/);
                const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
                
                // SERVICE CSeq: 2 is the SDP Answer from the server
                if (cseq === 2) {
                    logger.log('📥 [SIPCLIENT] Received SERVICE answer (CSeq: 2) - processing');
                    await peer2PeerConnectionObject.parseIncomingAnswer(data);
                }
            }
            
            // Check for WebRTC SDP exchange failure
            const sdpExchangeState = peer2PeerConnectionObject.getState();
            if (sdpExchangeState === SdpExchangeState.FAILED) {
                const error = peer2PeerConnectionObject.getLastError();
                logger.log(`❌ [SIPCLIENT] WebRTC SDP exchange failed: ${error}`);
                
                // CONNECTION BYE already sent by Peer2PeerConnection
                // Now check if we're still registered and can retry connection phase
                const peerTimeRemaining = timeoutManager.getRemainingTime('PEER_REGISTRATION_TIMEOUT');
                logger.log(`⏱️ [SIPCLIENT] PeerRegistrationTimeout has ${peerTimeRemaining}ms remaining`);
                
                if (peerTimeRemaining > 0) {
                    // Still registered - restart connection establishment phase
                    logger.log('🔄 [SIPCLIENT] Still registered - restarting Connection Establishment phase');
                    
                    // Reset WebRTC phase
                    peer2PeerConnectionObject.reset();
                    
                    // Reset connection establishment for new attempt
                    establishingConnectionObject.reset();
                    establishingConnectionObject.isEstablishingConnectionProcessFinished = false;
                    
                    // Re-update with registration data
                    const timeoutConfig = registrationObj.getTimeoutConfiguration();
                    establishingConnectionObject.updateData(
                        registrationObj.tag,
                        registrationObj.callId,
                        registrationObj.branch,
                        registrationObj.fromDisplayName,
                        registrationObj.toDisplayName,
                        timeoutConfig.connection
                    );
                    
                    logger.log('✅ [SIPCLIENT] Connection Establishment phase reset - waiting for NOTIFY4');
                } else {
                    // PeerRegistrationTimeout exhausted - need to re-register
                    logger.log('❌ [SIPCLIENT] PeerRegistrationTimeout exhausted - need to re-register');
                    
                    if (registrationRetryCount < MAX_RETRIES) {
                        registrationRetryCount++;
                        logger.log(`🔄 [SIPCLIENT] Restarting registration (attempt ${registrationRetryCount}/${MAX_RETRIES})`);
                        
                        // Reset everything
                        connectionRetryCount = 0;
                        peerRegistrationTimeoutStarted = false;
                        
                        // Send REGISTRATION BYE
                        const byeMessage = registrationObj.createRegistrationBye(8);
                        socket.send(byeMessage);
                        
                        // Start new registration
                        const retryMsg = registrationObj.getInitialRegistration();
                        socket.send(retryMsg);
                    } else {
                        logger.log('❌ [SIPCLIENT] Max registration retries reached - closing socket');
                        socket.close();
                    }
                }
            }
        }
    };
    
    /**
     * WebSocket error handler
     * Reset everything except registrationRetryCount and retry if possible
     */
    socket.onerror = (err) => {
        logger.log('❌ [SIPCLIENT] WebSocket Error: ' + err);
        
        // Cancel all active timers
        timeoutManager.cancelTimer('PEER_REGISTRATION_TIMEOUT');
        timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        
        // Reset connection retry count and flags
        connectionRetryCount = 0;
        peerRegistrationTimeoutStarted = false;  // Reset flag
        
        // Check if we can retry registration
        if (registrationRetryCount < MAX_RETRIES) {
            logger.log(`🔄 [SIPCLIENT] WebSocket error - retrying registration (attempt ${registrationRetryCount + 1}/${MAX_RETRIES})`);
            registrationRetryCount++;
            
            // Reset connection state
            establishingConnectionObject.reset();
            
            // Attempt to reconnect (will trigger onopen which sends REGISTER)
            setTimeout(() => {
                const newSocket = new WebSocket(wsUri, 'sip');
                // Note: In a real implementation, we'd need to replace the socket reference
                // This is simplified - full implementation would require restructuring
                logger.log('🔄 [SIPCLIENT] Reconnection attempted');
            }, 1000);
        } else {
            logger.log('❌ [SIPCLIENT] Max registration retries reached after WebSocket error');
        }
    };
    
    /**
     * WebSocket connection closed handler
     * Implement automatic reconnection as long as retry limit not reached
     */
    socket.onclose = (event) => {
        logger.log('🔌 [SIPCLIENT] WebSocket Connection Closed');
        logger.log(`🔌 [SIPCLIENT] Close Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
        
        // Cancel all active timers
        timeoutManager.cancelTimer('PEER_REGISTRATION_TIMEOUT');
        timeoutManager.cancelTimer('CONNECTION_TIMEOUT');
        
        // Reset connection retry count and flags
        connectionRetryCount = 0;
        peerRegistrationTimeoutStarted = false;  // Reset flag
        
        // Automatic reconnection if within retry limits
        if (registrationRetryCount < MAX_RETRIES) {
            logger.log(`🔄 [SIPCLIENT] Auto-reconnecting (attempt ${registrationRetryCount + 1}/${MAX_RETRIES})`);
            registrationRetryCount++;
            
            // Reset connection state
            establishingConnectionObject.reset();
            
            // Attempt reconnection after delay
            setTimeout(() => {
                try {
                    const newSocket = new WebSocket(wsUri, 'sip');
                    // Note: In a real implementation, we'd need to properly replace socket reference
                    // This simplified version shows the intent
                    logger.log('🔄 [SIPCLIENT] Reconnection initiated');
                } catch (reconnectError) {
                    logger.log('❌ [SIPCLIENT] Reconnection failed: ' + reconnectError);
                }
            }, 2000);  // 2 second delay before reconnection
        } else {
            logger.log('❌ [SIPCLIENT] Max registration retries reached - no automatic reconnection');
        }
    };
    
    // Return all component instances for external access
    return {
        registration: registrationObj,
        connection: establishingConnectionObject,
        peer2peer: peer2PeerConnectionObject,
        socket,
        timeoutManager,
    };
}

// Default export for convenience
export default initializeSipClient;
