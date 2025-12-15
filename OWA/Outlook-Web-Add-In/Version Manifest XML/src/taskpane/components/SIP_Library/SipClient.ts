/**
 * SIP Client Main Controller
 * Version: 2.1.0
 * 
 * This module provides the main initialization function for the SIP client system.
 * It orchestrates the interaction between Registration, Connection Establishment,
 * and Peer-to-Peer connection components to provide a complete SIP communication solution.
 * 
 * EVENT-DRIVEN ARCHITECTURE (Observer Pattern):
 * Each phase (Registration, Connection, Peer2Peer) emits events via callback interfaces:
 * - onStateChange: Internal state transitions within each phase
 * - onSuccess: Phase completed successfully
 * - onFailure: Phase failed with reason
 * - onTimeout: Timeout occurred
 * - onMessageToSend: SIP message ready to send
 * 
 * SipClient aggregates these events and maintains the overall SipClientState,
 * which external observers (WebRTCConnectionManager) use to update Redux store.
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

import { Registration, RegistrationState, RegistrationEvents } from './Registration';
import { EstablishingConnection, ConnectionState, ConnectionEvents } from './EstablishingConnection';
import { Peer2PeerConnection, SdpExchangeState, Peer2PeerEvents } from './Peer2PeerConnection';
import { logger } from './Helper';
import { TimeoutManager } from './TimeoutManager';

/**
 * Generic event interface for SIP phase components
 * Provides a consistent event callback structure across Registration, Connection, and WebRTC phases
 * @template TState - The state enum type for the specific phase
 * @template TTimeout - String literal type for timeout identifiers
 */
export interface SipPhaseEvents<TState, TTimeout extends string> {
    onStateChange?: (state: TState) => void;
    onSuccess?: (...args: any[]) => void;
    onFailure?: (reason: string) => void;
    onTimeout?: (timeoutType: TTimeout) => void;
    onMessageToSend?: (message: string, context: string) => void;
}

/**
 * SIP Client state machine enum
 * Represents the overall connection lifecycle state
 */
export enum SipClientState {
    DISCONNECTED = "DISCONNECTED",
    REGISTERING = "REGISTERING",
    CONNECTING = "CONNECTING",
    CONNECTING_P2P = "CONNECTING_P2P",
    CONNECTED = "CONNECTED",
    FAILED = "FAILED",
    FAILED_PERMANENTLY = "FAILED_PERMANENTLY"
}

/**
 * Observer interface for SipClient state changes
 * Implements the Observer pattern - observers subscribe to SipClient (Subject)
 * and get notified whenever the client state changes
 */
export interface SipClientObserver {
    onSipClientStateChanged(newState: SipClientState, reason: string): void;
}

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
    // Phase components (for direct access if needed)
    registration: Registration;
    connection: EstablishingConnection;
    peer2peer: Peer2PeerConnection;
    socket: WebSocket;
    timeoutManager: TimeoutManager;
    
    // Public API methods
    getState: () => SipClientState;
    disconnect: (targetState?: SipClientState) => void;
    send: (message: string) => void;
    getDataChannelStatus: () => RTCDataChannelState | 'none';
    isHealthy: () => boolean;
    
    // Observer pattern methods
    subscribe: (observer: SipClientObserver) => void;
    unsubscribe: (observer: SipClientObserver) => void;
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
    let webrtcRetryCount = 0;
    let peerRegistrationTimeoutStarted = false;
    let clientState: SipClientState = SipClientState.DISCONNECTED;
    let isTransitioning = false; // Guard against re-entrant state transitions
    
    // Observer pattern - list of observers to notify on state changes
    const observers: SipClientObserver[] = [];
    
    /**
     * Notify all observers of state change
     */
    function notifyObservers(newState: SipClientState, reason: string): void {
        observers.forEach(observer => {
            try {
                observer.onSipClientStateChanged(newState, reason);
            } catch (error) {
                logWithPrefix(`Error notifying observer: ${error}`);
            }
        });
    }
    
    /**
     * Transition client state and log the change
     * Notifies all registered observers of the state change
     * Guards against re-entrant calls during observer notification
     */
    function transitionClientState(newState: SipClientState, reason: string): void {
        // Prevent re-entrant state transitions
        if (isTransitioning) {
            logWithPrefix(`⚠️ Ignoring re-entrant state transition to ${newState} while transitioning`);
            return;
        }
        
        const oldState = clientState;
        if (oldState === newState) {
            logWithPrefix(`State already ${newState}, skipping transition`);
            return;
        }
        
        isTransitioning = true;
        try {
            clientState = newState;
            logWithPrefix(`Client state: ${oldState} → ${newState} (${reason})`);
            
            // Notify all observers of the state change
            notifyObservers(newState, reason);
        } finally {
            isTransitioning = false;
        }
    }
    
    /**
     * Check if registration retry is allowed
     * Only allows retry if:
     * - Max retries not reached
     * - Not currently registered (registration failed or not started)
     * - Not currently in REGISTERING state (already attempting registration)
     * - Not in an active connection phase (must allow connection to complete/fail)
     */
    function canRetryRegistration(): boolean {
        return registrationRetryCount < maxRetries && 
               !isRegistered() && 
               !isRegistering() && 
               !isConnecting() && 
               !isConnected();
    }
    

    /**
     * Check if connection retry is allowed
     */
    function canRetryConnection(): boolean {
        return connectionRetryCount < maxRetries
               && isRegistered() &&
               !isConnecting() && !isConnected();
    }
    
    /**
     * Check if WebRTC retry is allowed
     * Requires:
     * - Not exceeded max WebRTC retry count (3)
     * - Still in CONNECTED or CONNECTING_P2P state (connection established)
     */
    function canRetryWebRTC(): boolean {
        return webrtcRetryCount < maxRetries && isConnected();
    }
    
    /**
     * Check if currently registering
     */
    function isRegistering(): boolean {
        return clientState === SipClientState.REGISTERING;
    }

    /**
     * Check if currently registered
     */
    function isRegistered(): boolean {
        return registrationObj.isRegistered;
    }

    /**
     * Check if we still have a valid connection
     * @returns true if in CONNECTING_P2P or CONNECTED state
     */
    function isConnected(): boolean {
        return clientState === SipClientState.CONNECTING_P2P ||
               clientState === SipClientState.CONNECTED;
    }
    
    /**
     * Check if we are in the process of establishing a connection
     * @returns true if in CONNECTING state
     */
    function isConnecting(): boolean {
        return clientState === SipClientState.CONNECTING;
    }
    
    /**
     * Send message via WebSocket
     * Checks for terminal states and socket readiness before sending
     */
    function sendMessage(message: string, context: string): void {
        // Don't send if in terminal state
        if (clientState === SipClientState.FAILED_PERMANENTLY || 
            clientState === SipClientState.DISCONNECTED) {
            logWithPrefix(`❌ Cannot send ${context} - in terminal state ${clientState}`);
            return;
        }
        
        const currentSocket = sipClientInstance.socket;
        if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
            currentSocket.send(message);
            logWithPrefix(`📤 Sent ${context}`);
        } else {
            logWithPrefix(`❌ Cannot send ${context} - socket not open`);
        }
    }
    
    /**
     * Cancel all active timers
     */
    function cancelAllTimers(): void {
        timeoutManager.cancelTimer(TIMER_PEER_REGISTRATION);
        timeoutManager.cancelTimer(TIMER_CONNECTION);
    }
    
    /**
     * Send CONNECTION BYE if currently connected or connecting
     * @param cseq - CSeq number for the BYE message
     * @param reason - Reason for sending BYE (for logging)
     */
    function sendConnectionBye(cseq: number, reason: string): void {
        if (isConnected() || isConnecting()) {
            const connectionByeMsg = peer2PeerConnectionObject.createConnectionBye(reason);
            if (connectionByeMsg) {
                sendMessage(connectionByeMsg, `CONNECTION BYE (CSeq: ${cseq}, ${reason})`);
            }
        }
    }
    
    /**
     * Send REGISTRATION BYE if not in DISCONNECTED or FAILED state
     * @param cseq - CSeq number for the BYE message
     * @param reason - Reason for sending BYE (for logging)
     */
    function sendRegistrationBye(cseq: number, reason: string): void {
        if (isRegistered()) {
            const registrationByeMsg = registrationObj.createRegistrationBye(cseq);
            sendMessage(registrationByeMsg, `REGISTRATION BYE (CSeq: ${cseq}, ${reason})`);
        }
    }
    
    /**
     * Gracefully close connection with proper cleanup
     * Sends BYE messages if needed based on current state, cancels timers, and closes socket
     * @param reason - Reason for closing (for logging)
     * @param targetState - Target state to transition to (DISCONNECTED or FAILED)
     * @param closeCode - WebSocket close code (default: 1000 normal closure)
     */
    function closeConnection(reason: string, targetState: SipClientState = SipClientState.DISCONNECTED, closeCode: number = 1000): void {
        logWithPrefix(`🔌 Closing connection: ${reason}`);

        sendConnectionBye(CSEQ_BYE_CONNECTION_RETRY, reason);
        sendRegistrationBye(CSEQ_BYE_WEBRTC_FAILURE, reason);
        
        // Cancel all timers
        resetForNewRegistration();
        
        // Transition to target state before closing socket
        transitionClientState(targetState, reason);
        
        // Remove event handlers to prevent race conditions
        // This ensures the state we set above is the final state
        const currentSocket = sipClientInstance.socket;
        if (currentSocket) {
            currentSocket.onerror = null;
            currentSocket.onclose = null;
            currentSocket.onmessage = null;
            currentSocket.onopen = null;
            
            // Close socket
            if (currentSocket.readyState === WebSocket.OPEN) {
                currentSocket.close(closeCode, reason);
            }
        }
    }
    
    /**
     * Reset state for new registration attempt
     */
    function resetForNewRegistration(): void {
        connectionRetryCount = 0;
        webrtcRetryCount = 0;
        peerRegistrationTimeoutStarted = false;
        cancelAllTimers();
        registrationObj.resetRegistrationState();
        establishingConnectionObject.reset();
        peer2PeerConnectionObject.reset();
    }
    
    /**
     * Registration event handlers
     */
    const registrationEvents: RegistrationEvents = {
        onStateChange: (state: RegistrationState) => {
            logWithPrefix(`Registration state: ${state}`);
            if (state === RegistrationState.REGISTER_SENT && clientState !== SipClientState.REGISTERING) {
                transitionClientState(SipClientState.REGISTERING, 'Started registration');
            }
        },
        
        onSuccess: (timeoutConfig) => {
            logWithPrefix('✅ Registration completed successfully');
            transitionClientState(SipClientState.CONNECTING, 'Registration complete');
            
            // Start PEER_REGISTRATION_TIMEOUT
            if (!peerRegistrationTimeoutStarted) {
                logWithPrefix(`⏱️ Starting PEER_REGISTRATION_TIMEOUT (${timeoutConfig.peerRegistration}ms)`);
                peerRegistrationTimeoutStarted = true;
                
                timeoutManager.startTimer(TIMER_PEER_REGISTRATION, timeoutConfig.peerRegistration, () => {
                    handlePeerRegistrationTimeout();
                });
            }
            
            // Initialize connection phase
            establishingConnectionObject.updateData(
                registrationObj.tag,
                registrationObj.callId,
                registrationObj.branch,
                registrationObj.fromDisplayName,
                registrationObj.toDisplayName,
                timeoutConfig.connection
            );
            
            // Initialize peer connection configuration
            peer2PeerConnectionObject.updateConfiguration(
                timeoutManager,
                timeoutConfig.receive
            );
        },
        
        onFailure: (reason, isRetryable) => {
            logWithPrefix(`❌ Registration failed: ${reason} (retryable: ${isRetryable})`);
            
            // Cancel PEER_REGISTRATION_TIMEOUT on registration failure
            timeoutManager.cancelTimer(TIMER_PEER_REGISTRATION);
            
            transitionClientState(SipClientState.FAILED, `Registration failure: ${reason}`);
            
            if (!isRetryable) {
                logWithPrefix('❌ Registration failed permanently');
                closeConnection('Permanent registration failure', SipClientState.FAILED_PERMANENTLY, 1000);
                return;
            }
            
            if (canRetryRegistration()) {
                registrationRetryCount++;
                logWithPrefix(`🔄 Retrying registration (${registrationRetryCount}/${maxRetries})`);
                resetForNewRegistration();
                const retryMsg = registrationObj.getInitialRegistration();
                sendMessage(retryMsg, 'REGISTER (retry)');
                transitionClientState(SipClientState.REGISTERING, 'Retry after failure');
            } else {
                logWithPrefix('❌ Max registration retries reached');
                closeConnection('Max registration retries reached', SipClientState.FAILED_PERMANENTLY, 1000);
            }
        },
        
        onTimeout: (timeoutType) => {
            logWithPrefix(`⏱️ Registration timeout: ${timeoutType}`);
            // Timeout handler will trigger onFailure
        },
        
        onMessageToSend: (message, context) => {
            sendMessage(message, context);
        }
    };
    
    /**
     * Connection event handlers
     */
    const connectionEvents: ConnectionEvents = {
        onStateChange: (state: ConnectionState) => {
            logWithPrefix(`Connection state: ${state}`);
        },
        
        onSuccess: () => {
            logWithPrefix('✅ Connection establishment completed');
            
            // Cancel PEER_REGISTRATION_TIMEOUT as connection phase is complete
            timeoutManager.cancelTimer(TIMER_PEER_REGISTRATION);
            logWithPrefix('⏱️ Cancelled PEER_REGISTRATION_TIMEOUT (connection complete)');
            
            transitionClientState(SipClientState.CONNECTING_P2P, 'Starting WebRTC phase');
            connectionRetryCount = 0;
        },
        
        onFailure: (reason) => {
            logWithPrefix(`❌ Connection failed: ${reason}`);
            
            if (canRetryConnection()) {
                connectionRetryCount++;
                logWithPrefix(`🔄 Retrying connection (${connectionRetryCount}/${maxRetries})`);
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
            } else {
                logWithPrefix('❌ Connection retry limit reached or peer timeout expired or I received a Registration BYE so I am not registered anymore');
                transitionClientState(SipClientState.FAILED, 'Connection retry exhausted');
                
                if (canRetryRegistration()) {
                    registrationRetryCount++;
                    logWithPrefix(`🔄 Restarting registration (${registrationRetryCount}/${maxRetries})`);
                    resetForNewRegistration();
                    
                    const retryMsg = registrationObj.getInitialRegistration();
                    sendMessage(retryMsg, 'REGISTER (after connection failure)');
                    transitionClientState(SipClientState.REGISTERING, 'Registration restart after connection failure');
                } else {
                    logWithPrefix('❌ Max registration retries reached');
                    closeConnection('Max registration retries after connection failure', SipClientState.FAILED_PERMANENTLY, 1000);
                }
            }
        },
        
        onTimeout: (timeoutType) => {
            logWithPrefix(`⏱️ Connection timeout: ${timeoutType}`);
            // Timeout handler will trigger onFailure
        },
        
        onMessageToSend: (message, context) => {
            sendMessage(message, context);
        }
    };
    
    /**
     * WebRTC/Peer2Peer event handlers
     */
    const peer2PeerEvents: Peer2PeerEvents = {
        onStateChange: (state: SdpExchangeState) => {
            logWithPrefix(`WebRTC state: ${state}`);
        },
        
        onSuccess: () => {
            logWithPrefix('✅ WebRTC DataChannel established - CONNECTED');
            transitionClientState(SipClientState.CONNECTED, 'DataChannel opened');
            webrtcRetryCount = 0;
        },
        
        onFailure: (reason) => {
            logWithPrefix(`❌ WebRTC failed: ${reason}`);
            
            // Case 1: Can retry WebRTC (still connected and have retries left)
            if (canRetryWebRTC()) {
                webrtcRetryCount++;
                logWithPrefix(`🔄 Retrying WebRTC (attempt ${webrtcRetryCount}/${maxRetries})`);
                
                // Only reset Peer2Peer, keep connection phase intact
                peer2PeerConnectionObject.reset();
                
                // Resend the offer using saved parameters
                const lastOfferParams = peer2PeerConnectionObject.getLastOfferParams();
                if (lastOfferParams) {
                    const { callId, sipUri, tag, toLine } = lastOfferParams;
                    peer2PeerConnectionObject.createAndSendOffer(callId, sipUri, tag, toLine);
                } else {
                    logWithPrefix('⚠️ Cannot retry WebRTC - last offer params not available');
                    // Fallback: transition to FAILED
                    transitionClientState(SipClientState.FAILED, 'WebRTC retry failed - no saved params');
                }
            } else {
                // Case 2: Cannot retry WebRTC directly, determine retry strategy based on connection and registration state
                
                // Check current connection and registration status
                const notConnectedAndNotConnecting = !isConnected() && !isConnecting();
                const notRegistered = clientState === SipClientState.DISCONNECTED || clientState === SipClientState.FAILED;
                
                if (notConnectedAndNotConnecting && notRegistered) {
                    // Not connected, not connecting, and not registered
                    if (canRetryRegistration()) {
                        // Can retry registration - restart from registration phase
                        registrationRetryCount++;
                        logWithPrefix(`🔄 Not connected/registered - restarting registration (${registrationRetryCount}/${maxRetries})`);
                        resetForNewRegistration();
                        
                        const retryMsg = registrationObj.getInitialRegistration();
                        sendMessage(retryMsg, 'REGISTER (after WebRTC failure)');
                        transitionClientState(SipClientState.REGISTERING, 'Registration restart after WebRTC failure');
                    } else {
                        // Max registration retries reached - fail completely
                        logWithPrefix(`❌ Max registration retries (${maxRetries}) reached - closing connection`);
                        closeConnection('Max registration retries after WebRTC failure', SipClientState.FAILED_PERMANENTLY, 1000);
                    }
                } else if (notConnectedAndNotConnecting && !notRegistered) {
                    // Not connected/connecting but still registered (not in DISCONNECTED/FAILED) - restart connection phase
                    logWithPrefix('🔄 Connection lost but still registered - restarting connection phase');
                    webrtcRetryCount = 0;
                    connectionRetryCount = 0;
                    
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
                    
                    transitionClientState(SipClientState.CONNECTING, 'Retry connection after WebRTC failure');
                } else if (isConnected()) {
                    // Still connected - max WebRTC retries reached
                    logWithPrefix(`❌ Max WebRTC retries (${maxRetries}) reached while connected - closing connection`);
                    closeConnection(`SDP exchange failed after ${maxRetries} attempts`, SipClientState.FAILED_PERMANENTLY, 1000);
                } else if (isConnecting()) {
                    // Still connecting - do nothing, let the connection flow complete and come back to peer2peer
                    logWithPrefix('⏳ Still establishing connection - waiting for connection phase to complete');
                    // Connection phase will eventually complete or fail, triggering appropriate handlers
                }
            }
        },
        
        onTimeout: (timeoutType) => {
            logWithPrefix(`⏱️ WebRTC timeout: ${timeoutType}`);
            // Timeout handler will trigger onFailure
        },
        
        onMessageToSend: (message, context) => {
            sendMessage(message, context);
        }
    };
    
    /**
     * Handle PEER_REGISTRATION_TIMEOUT expiry
     */
    function handlePeerRegistrationTimeout(): void {
        logWithPrefix('⏱️ PEER_REGISTRATION_TIMEOUT expired');
        
        // Check if still connecting - if so, wait for it to finish
        const connState = establishingConnectionObject.getState();
        if (connState !== ConnectionState.FAILED && connState !== ConnectionState.TERMINATING) {
            logWithPrefix('⏱️ Still in active connection state - will wait for completion');
            return;
        }
        
        logWithPrefix('📤 Sending REGISTRATION BYE due to timeout');
        const byeMessage = registrationObj.createRegistrationBye(CSEQ_BYE_PEER_TIMEOUT);
        sendMessage(byeMessage, 'REGISTRATION BYE (peer timeout)');
        
        if (canRetryRegistration()) {
            registrationRetryCount++;
            logWithPrefix(`🔄 Retrying registration (${registrationRetryCount}/${maxRetries})`);
            resetForNewRegistration();
            const retryMsg = registrationObj.getInitialRegistration();
            sendMessage(retryMsg, 'REGISTER (peer timeout retry)');
            transitionClientState(SipClientState.REGISTERING, 'Retry after peer timeout');
        } else {
            logWithPrefix('❌ Max registration retries reached');
            closeConnection('Max registration retries after peer timeout', SipClientState.FAILED_PERMANENTLY, 1000);
        }
    }
    
    // Initialize phase components with event callbacks
    const registrationObj = new Registration(timeoutManager, registrationEvents);
    const establishingConnectionObject = new EstablishingConnection(timeoutManager, connectionEvents);
    const peer2PeerConnectionObject = new Peer2PeerConnection(peer2PeerEvents);
    
    /**
     * Setup all WebSocket event handlers
     * This function is called on initial connection and on reconnection
     */
    function setupSocketHandlers(ws: WebSocket): void {
        /**
         * WebSocket connection opened - start SIP registration
         */
        ws.onopen = () => {
            logWithPrefix('🌐 WebSocket connection established');
            transitionClientState(SipClientState.REGISTERING, 'WebSocket opened');
            const registerMsg = registrationObj.getInitialRegistration();
            sendMessage(registerMsg, 'initial REGISTER');
        };
        
        /**
         * Main message handler - routes messages to appropriate handlers based on current state
         */
        ws.onmessage = async (event) => {
            const data = await logger.blobToStringAsync(event.data);
            logWithPrefix('📥 Received message:\n' + data);
            
            // Handle global BYE messages
            handleGlobalBye(data);
            
            // Route messages based on client state
            switch (clientState) {
                case SipClientState.REGISTERING:
                    // Route to Registration phase
                    const regRequest = registrationObj.parseMessage(data);
                    if (regRequest) {
                        sendMessage(regRequest, 'registration response');
                    }
                    break;
                    
                case SipClientState.CONNECTING:
                    // Route to Connection Establishment phase
                    const connRequest = establishingConnectionObject.parseMessage(data);
                    if (connRequest) {
                        sendMessage(connRequest, 'connection response');
                    }
                    
                    // Check if ready to transition to WebRTC phase
                    if (establishingConnectionObject.getState() === ConnectionState.COMPLETE) {
                        logWithPrefix('📤 OWA always creates SDP Offer - creating offer immediately');
                        
                        if (!peer2PeerConnectionObject.isOfferSent) {
                            const callId = extractCallId(data);
                            const toLine = extractAndSwapFromTo(data);
                            
                            logWithPrefix('📤 Creating SDP Offer with Call-ID: ' + callId);
                            await peer2PeerConnectionObject.createAndSendOffer(
                                callId,
                                establishingConnectionObject.sipUri,
                                establishingConnectionObject.tag,
                                toLine
                            );
                        }
                    }
                    break;
                    
                case SipClientState.CONNECTING_P2P:
                    // Route to WebRTC phase
                    if (peer2PeerConnectionObject.isOfferSent && REGEX_SERVICE.test(data)) {
                        const cseqMatch = data.match(REGEX_CSEQ);
                        const cseq = cseqMatch ? parseInt(cseqMatch[1]) : 0;
                        
                        if (cseq === 2) {
                            logWithPrefix('📥 Received SERVICE answer (CSeq: 2) - processing');
                            await peer2PeerConnectionObject.parseIncomingAnswer(data);
                        }
                    }
                    break;
                    
                case SipClientState.CONNECTED:
                    // Already connected - log unexpected message
                    logWithPrefix('⚠️ Received message in CONNECTED state - may be keep-alive or unexpected');
                    break;
                    
                case SipClientState.FAILED:
                case SipClientState.FAILED_PERMANENTLY:
                case SipClientState.DISCONNECTED:
                    // No action needed in these states
                    break;
            }
        };
        
        /**
         * WebSocket error handler
         * Transition to FAILED_PERMANENTLY - let WebRTCConnectionManager handle reconnection
         */
        ws.onerror = (err) => {
            logWithPrefix('❌ WebSocket Error: ' + err);
            transitionClientState(SipClientState.FAILED_PERMANENTLY, 'WebSocket error');
        };

        /**
         * WebSocket connection closed handler
         * Let WebRTCConnectionManager handle reconnection at a higher level
         */
        ws.onclose = (event) => {
            logWithPrefix('🔌 WebSocket Connection Closed');
            logWithPrefix(`🔌 Close Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);

            // Check if this was a deliberate close (normal closure code 1000)
            const isDeliberateClose = event.code === 1000;
            
            if (isDeliberateClose) {
                logWithPrefix('⚠️ Deliberate disconnect - no retry');
                return;
            }
            
            // Unexpected close - transition to FAILED_PERMANENTLY
            // Let WebRTCConnectionManager handle higher-level reconnection
            logWithPrefix('⚠️ Unexpected socket close - transitioning to FAILED_PERMANENTLY');
            transitionClientState(SipClientState.FAILED_PERMANENTLY, 'Socket closed unexpectedly');
        };
    }
    
    /**
     * Handle global BYE messages (REGISTRATION or CONNECTION)
     */
    function handleGlobalBye(data: string): void {
        if (!REGEX_BYE.test(data)) return;
        
        const isRegistrationBye = REGEX_REASON_REGISTRATION.test(data);
        const isConnectionBye = REGEX_REASON_CONNECTION.test(data);
        
        if (isRegistrationBye) {
            logWithPrefix('REGISTRATION BYE received - transitioning to DISCONNECTED');
            timeoutManager.cancelTimer(TIMER_PEER_REGISTRATION);
            transitionClientState(SipClientState.DISCONNECTED, 'REGISTRATION BYE received');
        }
        
        if (isConnectionBye) {
            logWithPrefix('CONNECTION BYE received - transitioning to CONNECTING');
            establishingConnectionObject.lastByeReceived = new Date().toISOString();
            // Connection was dropped, but we might still be registered
            // Transition to CONNECTING so we can attempt reconnection
            if (clientState === SipClientState.CONNECTED || clientState === SipClientState.CONNECTING_P2P) {
                transitionClientState(SipClientState.CONNECTING, 'CONNECTION BYE received');
            }
        }
    }
    
    // Create the instance object that will be returned
    // Initialize with new WebSocket
    const sipClientInstance: SipClientInstance = {
        // Phase components
        registration: registrationObj,
        connection: establishingConnectionObject,
        peer2peer: peer2PeerConnectionObject,
        socket: new WebSocket(wsUri, 'sip'),
        timeoutManager,
        
        // Public API methods
        /**
         * Get current SIP client state
         * @returns Current client state (DISCONNECTED, REGISTERING, CONNECTING, CONNECTING_P2P, CONNECTED, FAILED)
         */
        getState: (): SipClientState => {
            return clientState;
        },
        
        /**
         * Gracefully disconnect - sends BYE messages if needed
         * @param targetState - Target state after disconnect (DISCONNECTED for deliberate, FAILED for errors)
         */
        disconnect: (targetState: SipClientState = SipClientState.DISCONNECTED): void => {
            logWithPrefix(`Disconnect requested (target state: ${targetState})`);
            const reason = targetState === SipClientState.FAILED ? 'Fatal error or max retries' : 'Deliberate disconnect';
            closeConnection(reason, targetState, 1000);
        },
        
        /**
         * Send a message via the WebSocket
         * @param message - Message to send
         */
        send: (message: string): void => {
            sendMessage(message, 'external message');
        },
        
        /**
         * Get the status of the WebRTC DataChannel
         * @returns DataChannel state ('connecting', 'open', 'closing', 'closed') or 'none' if not established
         */
        getDataChannelStatus: (): RTCDataChannelState | 'none' => {
            const dataChannel = peer2PeerConnectionObject.getActiveDataChannel();
            return dataChannel ? dataChannel.readyState : 'none';
        },
        
        /**
         * Check if SipClient is healthy (connected with open DataChannel)
         * @returns true if client is in CONNECTED state with open DataChannel
         */
        isHealthy: (): boolean => {
            const dataChannel = peer2PeerConnectionObject.getActiveDataChannel();
            return clientState === SipClientState.CONNECTED && dataChannel?.readyState === 'open';
        },
        
        /**
         * Subscribe an observer to receive state change notifications
         * @param observer - Observer to register
         */
        subscribe: (observer: SipClientObserver): void => {
            if (!observers.includes(observer)) {
                observers.push(observer);
                logWithPrefix('Observer subscribed');
            }
        },
        
        /**
         * Unsubscribe an observer from state change notifications
         * @param observer - Observer to unregister
         */
        unsubscribe: (observer: SipClientObserver): void => {
            const index = observers.indexOf(observer);
            if (index !== -1) {
                observers.splice(index, 1);
                logWithPrefix('Observer unsubscribed');
            }
        }
    };
    
    // Setup event handlers for the socket after instance is created
    // This allows handlers to reference sipClientInstance.socket
    setupSocketHandlers(sipClientInstance.socket);
    
    return sipClientInstance;
}

// Default export for convenience
export default initializeSipClient;
