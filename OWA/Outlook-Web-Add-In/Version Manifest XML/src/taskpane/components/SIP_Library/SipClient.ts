/**
 * SIP Client Main Controller
 * Version: 2.1.0
 * 
 * This module provides the main initialization function for the SIP client system.
 * It orchestrates the interaction between Registration, Connection Establishment,
 * and Peer-to-Peer connection components to provide a complete SIP communication solution.
 * 
 * Complete 3-Phase Flow:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Phase 1: REGISTRATION                                                   │
 * │ ─────────────────────────────────────────────────────────────────────── │
 * │ Client ──REGISTER→ Server                                               │
 * │ Client ←─200 OK──── Server (with timeout config)                        │
 * │ Client ──ACK_3────→ Server                                              │
 * │ [Start PEER_REGISTRATION_TIMEOUT]                                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                               ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Phase 2: CONNECTION ESTABLISHMENT                                       │
 * │ ─────────────────────────────────────────────────────────────────────── │
 * │ Client ←─NOTIFY4──── Server                                             │
 * │ Client ──ACK_5────→ Server                                              │
 * │ Client ←─NOTIFY6──── Server                                             │
 * │ [Start CONNECTION_TIMEOUT]                                              │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                               ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Phase 3: WEBRTC SDP EXCHANGE                                            │
 * │ ─────────────────────────────────────────────────────────────────────── │
 * │ Client ──SERVICE (Offer, CSeq:1)──→ Server                              │
 * │ Client ←─SERVICE (Answer, CSeq:2)── Server                              │
 * │ [WebRTC DataChannel established]                                        │
 * │ Client ↔ Bidirectional Data Flow ↔ Server                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Retry Strategy:
 * ┌─────────────────────┐
 * │ Registration Retry  │ ──> Max 3 attempts
 * │ (Full restart)      │     Reset all phases
 * └─────────────────────┘
 *            ↓
 * ┌─────────────────────┐
 * │ Connection Retry    │ ──> Max 3 attempts
 * │ (Within reg window) │     Keep registration
 * └─────────────────────┘
 *            ↓
 * ┌─────────────────────┐
 * │ WebRTC Retry        │ ──> Max 3 attempts (Peer2Peer)
 * │ (Restart connection)│     Restart from Phase 2
 * └─────────────────────┘
 * 
 * Timeout Coordination:
 * PEER_REGISTRATION_TIMEOUT: Covers entire connection + WebRTC phase
 * CONNECTION_TIMEOUT: Individual connection attempt timeout
 * RECEIVE_TIMEOUT: WebRTC answer timeout (managed by Peer2Peer)
 * 
 * Key Features:
 * - Three-phase SIP/WebRTC orchestration
 * - Coordinated timeout management across phases
 * - Multi-level retry strategy (registration, connection, WebRTC)
 * - Global BYE monitoring for graceful disconnection
 * - Automatic reconnection with exponential backoff
 * - Comprehensive error handling and recovery
 * 
 * @author AdvokatConnect Development Team
 * @version 2.1.0
 */

import { Registration, RegistrationState } from './Registration';
import { EstablishingConnection, ConnectionState } from './EstablishingConnection';
import { Peer2PeerConnection, SdpExchangeState } from './Peer2PeerConnection';
import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';

const LOG_PREFIX = '[SIPCLIENT]';
const MAX_RETRIES = 3;
const TIMER_PEER_REGISTRATION = 'PEER_REGISTRATION_TIMEOUT';
const TIMER_CONNECTION = 'CONNECTION_TIMEOUT';
const CSEQ_BYE_PEER_TIMEOUT = 4;
const CSEQ_BYE_CONNECTION_RETRY = 7;
const CSEQ_BYE_WEBRTC_FAILURE = 8;
const RECONNECT_DELAY_MS = 2000;
const REGEX_BYE = /^BYE\s+([^\s]+)\s+(SIP\/\d\.\d)/;
const REGEX_REASON_REGISTRATION = /Reason:\s*REGISTRATION/;
const REGEX_REASON_CONNECTION = /Reason:\s*CONNECTION/;
const REGEX_SERVICE = /^SERVICE\s+([^\s]+)\s+(SIP\/\d\.\d)/;
const REGEX_CSEQ = /CSeq:\s*(\d+)/;
const REGEX_CALL_ID = /^Call-ID:\s*([^\r\n]+)/m;
const REGEX_FROM_LINE = /^From:.*$/m;

/**
 * Configuration interface for SIP client initialization
 */
export interface SipClientConfig {
    sipUri: string;
    wsUri: string;
    maxRetries?: number;
}

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
 * Helper function for standardized logging with prefix
 */
function logWithPrefix(message: string): void {
    logger.log(`${LOG_PREFIX} ${message}`);
}

/**
 * Extract Call-ID from SIP message
 */
function extractCallId(message: string): string {
    const match = message.match(REGEX_CALL_ID);
    return match ? match[1] : '';
}

/**
 * Extract From line and swap to To line for response
 */
function extractAndSwapFromTo(message: string): string {
    const fromLineMatch = message.match(REGEX_FROM_LINE);
    const fromLine = fromLineMatch ? fromLineMatch[0] : '';
    return fromLine.replace(/^From:/i, 'To:');
}

/**
 * Main SIP client initialization function
 * Establishes WebSocket connection and coordinates all SIP communication phases
 * @param config - Optional configuration object
 * @returns Object containing all SIP component instances and WebSocket connection
 */
export function initializeSipClient(config?: Partial<SipClientConfig>): SipClientInstance {
    const sipUri = config?.sipUri || "sip:macc@127.0.0.1:8009";
    const wsUri = config?.wsUri || "wss://localhost:8009";
    const maxRetries = config?.maxRetries || MAX_RETRIES;
    
    const timeoutManager = new TimeoutManager();
    
    let registrationRetryCount = 0;
    let connectionRetryCount = 0;
    let peerRegistrationTimeoutStarted = false;
    
    const registrationObj = new Registration(timeoutManager);
    const establishingConnectionObject = new EstablishingConnection(timeoutManager);
    const peer2PeerConnectionObject = new Peer2PeerConnection();
    const socket = new WebSocket(wsUri, 'sip');
    
    /**
     * Cancel all active timers
     */
    function cancelAllTimers(): void {
        timeoutManager.cancelTimer(TIMER_PEER_REGISTRATION);
        timeoutManager.cancelTimer(TIMER_CONNECTION);
    }
    
    /**
     * Reset state for new registration attempt
     */
    function resetForNewRegistration(): void {
        connectionRetryCount = 0;
        peerRegistrationTimeoutStarted = false;
        cancelAllTimers();
        registrationObj.resetRegistrationState();
        establishingConnectionObject.reset();
        peer2PeerConnectionObject.reset();
    }
    
    /**
     * Handle global BYE messages (REGISTRATION or CONNECTION)
     */
    function handleGlobalBye(data: string): void {
        // Todo: is there any other bye that I need to handle?

        if (!REGEX_BYE.test(data)) return;
        
        const isRegistrationBye = REGEX_REASON_REGISTRATION.test(data);
        const isConnectionBye = REGEX_REASON_CONNECTION.test(data);
        
        if (isRegistrationBye) {
            logWithPrefix('REGISTRATION BYE received - updating status');
            registrationObj.isRegistered = false;
            registrationObj.lastByeReceived = new Date().toISOString();
            logWithPrefix('⚠️ isRegistered = false');
            timeoutManager.cancelTimer(TIMER_PEER_REGISTRATION);
        }
        
        if (isConnectionBye) {
            logWithPrefix('CONNECTION BYE received - updating status');
            establishingConnectionObject.isConnectionEstablished = false;
            establishingConnectionObject.lastByeReceived = new Date().toISOString();
            logWithPrefix('⚠️ isConnectionEstablished = false');
        }
    }
    
    registrationObj.onSendMessage = (message: string) => {
        socket.send(message);
        logWithPrefix('📤 Sent message from Registration retry handler');
    };
    
    registrationObj.getConnectionStatus = () => {
        return establishingConnectionObject.isConnectionEstablished;
    };
    
    establishingConnectionObject.getPeerRegistrationTimeRemaining = () => {
        return timeoutManager.getRemainingTime(TIMER_PEER_REGISTRATION);
    };
    
    establishingConnectionObject.onSendMessage = (message: string) => {
        socket.send(message);
        logWithPrefix('📤 Sent message from EstablishingConnection timeout handler');
    };
    
    /**
     * WebSocket connection opened - start SIP registration
     */
    socket.onopen = () => {
        logWithPrefix('� WebSocket connection established');
        const registerMsg = registrationObj.getInitialRegistration();
        socket.send(registerMsg);
        logWithPrefix('🔄 Sent initial REGISTER message');
    };
    
    /**
     * Main message handler - routes messages to appropriate handlers based on current state
     */
    socket.onmessage = async (event) => {
        const data = await logger.blobToStringAsync(event.data);
        logWithPrefix('📥 Received message:\n' + data);
        
        handleGlobalBye(data);
        
        if (!registrationObj.isRegistrationProcessFinished) {
            const request = registrationObj.parseMessage(data);
            if (request) {
                socket.send(request);
                logWithPrefix('📤 Sent response from registration handler');
            }
            
            if (registrationObj.getRegistrationState() === RegistrationState.ACK_3_SENT && !peerRegistrationTimeoutStarted) {
                const timeoutConfig = registrationObj.getTimeoutConfiguration();
                logWithPrefix(`⏱️ ACK_3 sent - Starting PeerRegistrationTimeout (${timeoutConfig.peerRegistration}ms)`);
                peerRegistrationTimeoutStarted = true;
                
                timeoutManager.startTimer(TIMER_PEER_REGISTRATION, timeoutConfig.peerRegistration, () => {
                    logWithPrefix('⏱️ PeerRegistrationTimeout expired - sending REGISTRATION BYE');
                    const byeMessage = registrationObj.createRegistrationBye(CSEQ_BYE_PEER_TIMEOUT);
                    socket.send(byeMessage);
                    logWithPrefix('📤 Sent REGISTRATION BYE due to PeerRegistrationTimeout');
                    
                    if (establishingConnectionObject.getState() != ConnectionState.FAILED
                        && establishingConnectionObject.getState() != ConnectionState.TERMINATING) {
                        return;
                    }
        
                    registrationRetryCount++;
                    peerRegistrationTimeoutStarted = false;
                    if (registrationRetryCount < maxRetries) {
                        logWithPrefix(`🔄 Registration retry ${registrationRetryCount}/${maxRetries}`);
                        const retryMsg = registrationObj.getInitialRegistration();
                        socket.send(retryMsg);
                        logWithPrefix('📤 Sent REGISTER message for retry');
                    } else {
                        logWithPrefix('❌ Max registration retries reached');
                    }
                });
            }
            
            if (registrationObj.getRegistrationState() === RegistrationState.FAILED) {
                logWithPrefix('❌ Registration FAILED permanently');
                logWithPrefix(`❌ Error: ${registrationObj.getRegistrationError()}`);
                socket.close();
            }
            
            if (registrationObj.isRegistrationProcessFinished) {
                logWithPrefix('✅ Registration completed - transitioning to Connection Establishment phase');
                const timeoutConfig = registrationObj.getTimeoutConfiguration();
                establishingConnectionObject.updateData(
                    registrationObj.tag,
                    registrationObj.callId,
                    registrationObj.branch,
                    registrationObj.fromDisplayName,
                    registrationObj.toDisplayName,
                    timeoutConfig.connection
                );
                
                peer2PeerConnectionObject.updateConfiguration(
                    timeoutManager,
                    timeoutConfig.receive
                );
            }
        }
        
        if (registrationObj.isRegistrationProcessFinished &&
            !establishingConnectionObject.isEstablishingConnectionProcessFinished) {
            const request = establishingConnectionObject.parseMessage(data);
            if (request) {
                socket.send(request);
                logWithPrefix('📤 Sent response from connection establishment handler');
            }
            
            if (establishingConnectionObject.getState() === ConnectionState.COMPLETE) {
                logWithPrefix('✅ Connection Establishment completed - transitioning to WebRTC phase');
                logWithPrefix('📤 OWA always creates SDP Offer - creating offer immediately');
                establishingConnectionObject.isEstablishingConnectionProcessFinished = true;
                
                if (!peer2PeerConnectionObject.isOfferSent) {
                    const callId = extractCallId(data);
                    const toLine = extractAndSwapFromTo(data);
                    
                    logWithPrefix('📤 Creating SDP Offer with Call-ID: ' + callId);
                    logWithPrefix('📤 To Line: ' + toLine);
                    
                    peer2PeerConnectionObject.onSendConnectionBye = (byeMessage: string) => {
                        socket.send(byeMessage);
                        logWithPrefix('📤 Sent CONNECTION BYE from WebRTC phase');
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
            
            const connectionState = establishingConnectionObject.getState();
            if (connectionState === ConnectionState.FAILED) {
                const error = establishingConnectionObject.getLastError();
                logWithPrefix(`❌ Connection establishment failed: ${error}`);
                
                const peerTimeRemaining = timeoutManager.getRemainingTime(TIMER_PEER_REGISTRATION);
                logWithPrefix(`⏱️ PeerRegistrationTimeout has ${peerTimeRemaining}ms remaining`);
                
                if (peerTimeRemaining > 0 && connectionRetryCount < maxRetries) {
                    connectionRetryCount++;
                    logWithPrefix(`🔄 Connection retry ${connectionRetryCount}/${maxRetries}`);
                    
                    establishingConnectionObject.reset();
                    
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
                    logWithPrefix('❌ PeerRegistrationTimeout exhausted');
                    
                    if (registrationRetryCount < maxRetries) {
                        logWithPrefix(`🔄 Restarting registration (attempt ${registrationRetryCount + 1}/${maxRetries})`);
                        registrationRetryCount++;
                        resetForNewRegistration();
                        
                        const byeMessage = registrationObj.createRegistrationBye(CSEQ_BYE_CONNECTION_RETRY);
                        socket.send(byeMessage);
                        
                        const retryMsg = registrationObj.getInitialRegistration();
                        socket.send(retryMsg);
                    } else {
                        logWithPrefix('❌ Max registration retries reached - closing socket');
                        socket.close();
                    }
                } else {
                    logWithPrefix('❌ Max connection retries reached - closing socket');
                    socket.close();
                }
            }
        }
        
        if (establishingConnectionObject.isEstablishingConnectionProcessFinished) {
            if (peer2PeerConnectionObject.isOfferSent && REGEX_SERVICE.test(data)) {
                const cseqMatch = data.match(REGEX_CSEQ);
                const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
                
                if (cseq === 2) {
                    logWithPrefix('📥 Received SERVICE answer (CSeq: 2) - processing');
                    await peer2PeerConnectionObject.parseIncomingAnswer(data);
                }
            }
            
            const sdpExchangeState = peer2PeerConnectionObject.getState();
            if (sdpExchangeState === SdpExchangeState.FAILED) {
                const error = peer2PeerConnectionObject.getLastError();
                logWithPrefix(`❌ WebRTC SDP exchange failed: ${error}`);
                
                const peerTimeRemaining = timeoutManager.getRemainingTime(TIMER_PEER_REGISTRATION);
                logWithPrefix(`⏱️ PeerRegistrationTimeout has ${peerTimeRemaining}ms remaining`);
                
                if (peerTimeRemaining > 0) {
                    logWithPrefix('🔄 Still registered - restarting Connection Establishment phase');
                    
                    peer2PeerConnectionObject.reset();
                    establishingConnectionObject.reset();
                    establishingConnectionObject.isEstablishingConnectionProcessFinished = false;
                    
                    const timeoutConfig = registrationObj.getTimeoutConfiguration();
                    establishingConnectionObject.updateData(
                        registrationObj.tag,
                        registrationObj.callId,
                        registrationObj.branch,
                        registrationObj.fromDisplayName,
                        registrationObj.toDisplayName,
                        timeoutConfig.connection
                    );
                    
                    logWithPrefix('✅ Connection Establishment phase reset - waiting for NOTIFY4');
                } else {
                    logWithPrefix('❌ PeerRegistrationTimeout exhausted - need to re-register');
                    
                    if (registrationRetryCount < maxRetries) {
                        registrationRetryCount++;
                        logWithPrefix(`🔄 Restarting registration (attempt ${registrationRetryCount}/${maxRetries})`);
                        
                        resetForNewRegistration();
                        
                        const byeMessage = registrationObj.createRegistrationBye(CSEQ_BYE_WEBRTC_FAILURE);
                        socket.send(byeMessage);
                        
                        const retryMsg = registrationObj.getInitialRegistration();
                        socket.send(retryMsg);
                    } else {
                        logWithPrefix('❌ Max registration retries reached - closing socket');
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
        logWithPrefix('❌ WebSocket Error: ' + err);
        
        cancelAllTimers();
        
        connectionRetryCount = 0;
        peerRegistrationTimeoutStarted = false;
        
        if (registrationRetryCount < maxRetries) {
            logWithPrefix(`🔄 WebSocket error - retrying registration (attempt ${registrationRetryCount + 1}/${maxRetries})`);
            registrationRetryCount++;
            
            establishingConnectionObject.reset();
            
            setTimeout(() => {
                const newSocket = new WebSocket(wsUri, 'sip');
                logWithPrefix('🔄 Reconnection attempted');
            }, 1000);
        } else {
            logWithPrefix('❌ Max registration retries reached after WebSocket error');
        }
    };
    
    /**
     * WebSocket connection closed handler
     * Implement automatic reconnection as long as retry limit not reached
     */
    socket.onclose = (event) => {
        logWithPrefix('🔌 WebSocket Connection Closed');
        logWithPrefix(`🔌 Close Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
        
        cancelAllTimers();
        
        connectionRetryCount = 0;
        peerRegistrationTimeoutStarted = false;
        
        if (registrationRetryCount < maxRetries) {
            logWithPrefix(`🔄 Auto-reconnecting (attempt ${registrationRetryCount + 1}/${maxRetries})`);
            registrationRetryCount++;
            
            establishingConnectionObject.reset();
            
            setTimeout(() => {
                try {
                    const newSocket = new WebSocket(wsUri, 'sip');
                    logWithPrefix('🔄 Reconnection initiated');
                } catch (reconnectError) {
                    logWithPrefix('❌ Reconnection failed: ' + reconnectError);
                }
            }, RECONNECT_DELAY_MS);
        } else {
            logWithPrefix('❌ Max registration retries reached - no automatic reconnection');
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
