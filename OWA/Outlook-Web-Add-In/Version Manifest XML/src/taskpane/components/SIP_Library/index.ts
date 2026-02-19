/**
 * SIP Library - Entry Point
 * 
 * This module provides a centralized export point for all SIP-related 
 * classes and utilities.
 * It exposes the complete SIP communication stack including 
 * registration, connection establishment,
 * and peer-to-peer WebRTC communication components.
 * 
 * Simplified Protocol Flow (v2.0):
 * 1. Registration: REGISTER → OK → ACK (with PeerRegistrationTimeout)
 * 2. Connection: NOTIFY4 → ACK5 → NOTIFY6 (with ConnectionTimeout)
 * 3. WebRTC: OWA creates offer (SERVICE1) → Server sends answer (SERVICE2)
 * 
 * Available Classes:
 * - Helper: Utility functions for logging, blob conversion, and content length calculation
 * - Registration: Handles SIP registration process with server authentication
 * - EstablishingConnection: Manages connection establishment phase
 * - Peer2PeerConnection: Handles WebRTC offer/answer exchange and data channel setup
 * 
 * @author AdvokatConnect Development Team
 * @version 2.0.0
 */

// Core utility classes
export { Helper, helper } from './Helper';

// SIP protocol handlers
export { Registration } from './Registration';
export { EstablishingConnection } from './EstablishingConnection';
export { Peer2PeerConnection } from './Peer2PeerConnection';

// Main SIP client initialization function
export { initializeSipClient, SipClientInstance } from './SipClient';
