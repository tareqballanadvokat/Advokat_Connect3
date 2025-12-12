// React Hook for WebRTC Connection Manager
import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppSelector } from '../../store/hooks';
import { 
  selectConnectionState, 
  selectSipClientState,
  ConnectionState
} from '../../store/slices/connectionSlice';
import { 
  getWebRTCConnectionManager, 
  WebRTCConnectionManager,
  ConnectionManagerConfig 
} from '../services/WebRTCConnectionManager';
import { SipClientState } from '../components/SIP_Library/SipClient';

interface UseWebRTCConnectionManagerReturn {
  // Connection state
  connectionState: ConnectionState;
  sipClientState?: SipClientState;
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: (force?: boolean) => Promise<void>;
  
  // Utilities
  isReady: () => boolean;
  isConnecting: boolean;
  
  // Manager instance (for advanced usage)
  connectionManager: WebRTCConnectionManager;
}

/**
 * React hook for robust WebRTC connection management
 * 
 * Features:
 * - Automatic connection establishment and recovery
 * - Health monitoring with auto-reconnection
 * - Exponential backoff for failed connections
 * - Real-time state updates
 * - Proper cleanup on component unmount
 * 
 * @param config - Configuration options for the connection manager
 * @returns Connection state, health, and management functions
 */
export const useWebRTCConnectionManager = (
  config: ConnectionManagerConfig = {}
): UseWebRTCConnectionManagerReturn => {
  const connectionManagerRef = useRef<WebRTCConnectionManager | null>(null);
  
  // Get state from Redux instead of local state
  const connectionState = useAppSelector(selectConnectionState);
  const sipClientState = useAppSelector(selectSipClientState);

  // Derived state: isConnecting covers REGISTERING, CONNECTING, and CONNECTING_P2P
  const isConnecting = useMemo(() => {
    return sipClientState === 'REGISTERING' || 
           sipClientState === 'CONNECTING' || 
           sipClientState === 'CONNECTING_P2P';
  }, [sipClientState]);

  // Initialize connection manager
  useEffect(() => {
    const manager = getWebRTCConnectionManager(config);
    connectionManagerRef.current = manager;

    // Initialize the connection
    manager.initialize().catch(error => {
      console.error('Failed to initialize WebRTC connection:', error);
    });

    // Cleanup on unmount
    return () => {
      // Note: Don't destroy the manager here as it's a singleton
      // It should persist across component unmounts
    };
  }, []); // Empty dependency array - initialize only once

  // Connection management functions
  const connect = useCallback(async () => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.disconnect();
    }
  }, []);

  const reconnect = useCallback(async (force?: boolean) => {
    if (connectionManagerRef.current) {
      await connectionManagerRef.current.reconnect(force);
    }
  }, []);

  const isReady = useCallback(() => {
    return connectionManagerRef.current?.isReady() || false;
  }, []);

  return {
    connectionState,
    sipClientState,
    connect,
    disconnect,
    reconnect,
    isReady,
    isConnecting,
    connectionManager: connectionManagerRef.current!
  };
};
