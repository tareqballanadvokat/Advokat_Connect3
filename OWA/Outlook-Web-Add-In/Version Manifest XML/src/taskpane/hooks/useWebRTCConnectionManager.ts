// React Hook for WebRTC Connection Manager
import { useEffect, useCallback, useRef } from 'react';
import { useAppSelector } from '../../store/hooks';
import { 
  selectConnectionState, 
  selectConnectionHealth,
  ConnectionState,
  ConnectionHealth 
} from '../../store/slices/connectionSlice';
import { 
  getWebRTCConnectionManager, 
  WebRTCConnectionManager,
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
  
  // Get state from Redux instead of local state
  const connectionState = useAppSelector(selectConnectionState);
  const connectionHealth = useAppSelector(selectConnectionHealth);

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

  const performHealthCheck = useCallback(async (): Promise<ConnectionHealth> => {
    if (connectionManagerRef.current) {
      return await connectionManagerRef.current.performHealthCheck();
    }
    return {
      isHealthy: connectionHealth.isHealthy,
      latency: connectionHealth.latency,
      lastHealthCheck: connectionHealth.lastHealthCheck,
      consecutiveFailures: connectionHealth.consecutiveFailures
    };
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
