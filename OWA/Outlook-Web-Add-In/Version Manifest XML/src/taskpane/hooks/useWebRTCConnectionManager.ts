// React Hook for WebRTC Connection Manager
import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  getWebRTCConnectionManager, 
  WebRTCConnectionManager,
  ConnectionState, 
  ConnectionHealth,
  ConnectionManagerConfig 
} from '../services/WebRTCConnectionManager';

interface UseWebRTCConnectionManagerReturn {
  // Connection state
  connectionState: ConnectionState;
  connectionHealth: ConnectionHealth;
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: (force?: boolean) => Promise<void>;
  
  // Utilities
  isReady: () => boolean;
  performHealthCheck: () => Promise<ConnectionHealth>;
  
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
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    isRegistered: false,
    isConnectionEstablished: false,
    isPeerConnected: false,
    isDataChannelOpen: false,
    connectionStatus: 'Initializing...',
    reconnectAttempts: 0
  });
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    isHealthy: false,
    latency: 0,
    lastHealthCheck: new Date(),
    consecutiveFailures: 0
  });

  // Initialize connection manager
  useEffect(() => {
    const manager = getWebRTCConnectionManager(config);
    connectionManagerRef.current = manager;

    // Set up state listeners
    const unsubscribeState = manager.onStateChange(setConnectionState);
    const unsubscribeHealth = manager.onHealthChange(setConnectionHealth);

    // Initialize the connection
    manager.initialize().catch(error => {
      console.error('Failed to initialize WebRTC connection:', error);
    });

    // Cleanup on unmount
    return () => {
      unsubscribeState();
      unsubscribeHealth();
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

  const performHealthCheck = useCallback(async () => {
    if (connectionManagerRef.current) {
      return await connectionManagerRef.current.performHealthCheck();
    }
    return connectionHealth;
  }, [connectionHealth]);

  return {
    connectionState,
    connectionHealth,
    connect,
    disconnect,
    reconnect,
    isReady,
    performHealthCheck,
    connectionManager: connectionManagerRef.current!
  };
};

// Legacy compatibility - gradually replace useWebRTCApiIntegration with this
export const useWebRTCApiIntegration = () => {
  console.warn('useWebRTCApiIntegration is deprecated. Use useWebRTCConnectionManager instead.');
  
  const {
    connectionState,
    connectionManager
  } = useWebRTCConnectionManager();

  return {
    sipClient: connectionManager?.getSipClient() || null,
    isConnected: connectionState.isConnected,
    connectionStatus: connectionState.connectionStatus,
    isRegistered: connectionState.isRegistered,
    isConnectionEstablished: connectionState.isConnectionEstablished
  };
};
