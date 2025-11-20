/**
 * SIP Library - Entry Point
 * 
 * This module provides a centralized export point for all SIP-related 
 * classes and utilities.
 * It exposes the complete SIP communication stack including 
 * registration, connection establishment,
 * SDP exchange, and peer-to-peer WebRTC communication components.
 * 
 * Available Classes:
 * - Helper: Utility functions for logging, blob conversion, and content length calculation
 * - Registration: Handles SIP registration process with server authentication
 * - EstablishingConnection: Manages connection negotiation and role determination
 * - SDPExchange: Handles SDP offer/answer exchange and candidate negotiation
 * - Peer2PeerConnection: Handles WebRTC data channel setup and communication
 * 
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

// Core utility classes
export { Helper, logger } from './Helper';

// SIP protocol handlers
export { Registration } from './Registration';
export { EstablishingConnection } from './EstablishingConnection';
export { SDPExchange } from './SDPExchange';
export { Peer2PeerConnection } from './Peer2PeerConnection';

// Main SIP client initialization function
export { initializeSipClient, SipClientInstance } from './SipClient';
