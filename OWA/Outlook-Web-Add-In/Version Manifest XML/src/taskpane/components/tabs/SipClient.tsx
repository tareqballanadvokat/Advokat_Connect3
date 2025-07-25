/**
 * SIP Client Component (Legacy - Refactored)
 * 
 * This file has been refactored to use the new SIP_Library modules.
 * All SIP functionality has been moved to separate, well-documented classes
 * in the SIP_Library folder for better maintainability and code organization.
 * 
 * For new development, import and use components from SIP_Library directly.
 * This file remains for backward compatibility with existing code.
 * 
 * @deprecated Use SIP_Library components directly for new development
 */

// Import the refactored SIP components
export { 
    initializeSipClient,
    Registration,
    EstablishingConnection,
    Peer2PeerConnection,
    Helper,
    logger
} from '../SIP_Library';

export { initializeSipClient as default } from '../SIP_Library';