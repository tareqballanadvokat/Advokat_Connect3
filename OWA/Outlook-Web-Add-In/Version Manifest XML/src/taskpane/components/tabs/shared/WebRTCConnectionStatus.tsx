// src/taskpane/components/tabs/shared/WebRTCConnectionStatus.tsx
import React from 'react';
import { useAppSelector } from '@store/hooks';
import { selectConnectionState, selectIsReady, selectIsConnected, selectIsConnecting } from '@store/slices/connectionSlice';
import { getWebRTCConnectionManager } from '../../../services/WebRTCConnectionManager';

interface WebRTCConnectionStatusProps {
  className?: string;
  style?: React.CSSProperties;
  showHealthIndicator?: boolean;
  showReconnectButton?: boolean;
}

const WebRTCConnectionStatus: React.FC<WebRTCConnectionStatusProps> = ({ 
  className, 
  style,
  showHealthIndicator = false,
  showReconnectButton = false
}) => {
  // Read directly from Redux
  const connectionState = useAppSelector(selectConnectionState);
  const isReady = useAppSelector(selectIsReady);
  const isConnected = useAppSelector(selectIsConnected);
  const isConnecting = useAppSelector(selectIsConnecting);

  const handleReconnect = () => {
    const manager = getWebRTCConnectionManager();
    manager.reconnect(true);
  };

  // Function to get connection status styling
  const getConnectionStatusStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '8px',
      marginBottom: '10px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      color: 'white',
      ...style // Allow custom style overrides
    };

    // Idle state - gray background (disconnected due to inactivity)
    if (connectionState.idleDisconnectedAt) {
      return {
        ...baseStyle,
        backgroundColor: '#6c757d', // Gray
        border: '1px solid #5a6268'
      };
    }

    // Connected and ready state - green background
    if (isReady) {
      return {
        ...baseStyle,
        backgroundColor: '#28a745', // Green
        border: '1px solid #1e7e34'
      };
    }

    // Connected but not authenticated - yellow background
    if (isConnected && !isReady) {
      return {
        ...baseStyle,
        backgroundColor: '#ffc107', // Yellow
        border: '1px solid #e0a800'
      };
    }

    // Error/Failed state - red background
    if (connectionState.lastError || connectionState.connectionStatus.includes('Failed') || 
        connectionState.connectionStatus.includes('Error')) {
      return {
        ...baseStyle,
        backgroundColor: '#dc3545', // Red
        border: '1px solid #bd2130'
      };
    }

    // Connecting/Processing state - orange background
    return {
      ...baseStyle,
      backgroundColor: '#fd7e14', // Orange
      border: '1px solid #e8590c'
    };
  };

  return (
    <div className={className} style={getConnectionStatusStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          {connectionState.connectionStatus}
          {isReady && <span style={{ color: 'white' }}> ✓</span>}
          {connectionState.reconnectAttempts > 0 && (
            <span style={{ marginLeft: '5px', fontSize: '11px' }}>
              (Retry {connectionState.reconnectAttempts}/2)
            </span>
          )}
        </div>
        
        {showReconnectButton && !isConnecting && (
          <button
            onClick={handleReconnect}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
            title="Force reconnect"
          >
            🔄
          </button>
        )}
      </div>
      
      {showHealthIndicator && (
        <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.9 }}>
          Status: {isReady ? '✅ Ready' : isConnecting ? '⏳ Connecting' : '⚠️ Not Ready'}
        </div>
      )}
    </div>
  );
};

export default WebRTCConnectionStatus;
